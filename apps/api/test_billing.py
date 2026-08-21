import os
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")

from apps.api import billing  # noqa: E402

MIGRATION_PATH = "supabase/migrations/008_billing.sql"


def _mock_response(json_data=None, content_range=None):
    response = MagicMock()
    response.json.return_value = json_data if json_data is not None else []
    response.headers = {"Content-Range": content_range} if content_range else {}
    response.raise_for_status.return_value = None
    return response


class BillingRlsMigrationTests(unittest.TestCase):
    def setUp(self):
        with open(MIGRATION_PATH, "r", encoding="utf-8") as migration_file:
            self.migration = migration_file.read()

    def test_authenticated_users_have_select_only_billing_policy(self):
        self.assertIn('create policy "user_billing_select_own"', self.migration)
        self.assertIn("for select", self.migration)
        self.assertIn("to authenticated", self.migration)

    def test_no_authenticated_insert_billing_policy(self):
        self.assertNotIn("user_billing_insert_own", self.migration)
        self.assertNotIn("for insert", self.migration)

    def test_no_authenticated_update_billing_policy(self):
        self.assertNotIn("user_billing_update_own", self.migration)
        self.assertNotIn("for update", self.migration)

    def test_no_authenticated_delete_billing_policy(self):
        self.assertNotIn("user_billing_delete_own", self.migration)
        self.assertNotIn("for delete", self.migration)

    def test_no_custom_stripe_signature_verification_remains(self):
        with open("apps/api/billing.py", "r", encoding="utf-8") as billing_file:
            api_source = billing_file.read()
        self.assertNotIn("verify_stripe_signature", api_source)
        self.assertNotIn("hmac", api_source.lower())


class BillingPeriodTests(unittest.TestCase):
    def test_current_period_calculation_is_deterministic_utc(self):
        reference = datetime(2026, 2, 15, 12, 30, tzinfo=timezone.utc)
        start, end = billing._calendar_month_period_utc(reference)
        self.assertEqual(start, "2026-02-01T00:00:00+00:00")
        self.assertEqual(end, "2026-03-01T00:00:00+00:00")

    def test_period_rolls_over_december_to_january(self):
        reference = datetime(2026, 12, 25, tzinfo=timezone.utc)
        start, end = billing._calendar_month_period_utc(reference)
        self.assertEqual(start, "2026-12-01T00:00:00+00:00")
        self.assertEqual(end, "2027-01-01T00:00:00+00:00")


class BillingEntitlementTests(unittest.TestCase):
    def test_completed_unique_interaction_counts_exactly_once(self):
        with patch("apps.api.billing._request", return_value=_mock_response(content_range="0-0/1")):
            count = billing.count_completed_interactions_for_accounts(
                ["00000000-0000-0000-0000-000000000001"], "2026-02-01T00:00:00+00:00", "2026-03-01T00:00:00+00:00"
            )
        self.assertEqual(count, 1)

    def test_failed_analysis_counts_zero(self):
        # A failed analysis never transitions interactions.analysis_status to
        # 'complete', so it falls outside the analysis_status=eq.complete filter
        # regardless of whether a brief row happens to exist for it.
        with patch("apps.api.billing._request", return_value=_mock_response(content_range="*/0")):
            count = billing.count_completed_interactions_for_accounts(
                ["00000000-0000-0000-0000-000000000001"], "2026-02-01T00:00:00+00:00", "2026-03-01T00:00:00+00:00"
            )
        self.assertEqual(count, 0)

    def test_retry_of_completed_interaction_does_not_double_count(self):
        # A retry re-processes the same interaction_id, but interactions.id is
        # the primary key -- one row per interaction, updated in place by
        # update_interaction_status -- so however many times it was retried,
        # the count query below can only ever see it once.
        with patch("apps.api.billing._request", return_value=_mock_response(content_range="0-0/1")) as mock_request:
            count = billing.count_completed_interactions_for_accounts(
                ["00000000-0000-0000-0000-000000000001"], "2026-02-01T00:00:00+00:00", "2026-03-01T00:00:00+00:00"
            )
        self.assertEqual(count, 1)
        called_url = mock_request.call_args.args[1]
        called_params = mock_request.call_args.kwargs["params"]
        self.assertIn("/interactions", called_url)
        self.assertNotIn("/briefs", called_url)
        self.assertNotIn("/analysis_jobs", called_url)
        self.assertEqual(called_params["analysis_status"], "eq.complete")

    def test_brief_existence_alone_is_not_the_counting_source(self):
        # A brief row can persist even when the overall job ends 'failed' (the
        # extracted_items insert can fail after the brief POST already
        # committed -- see worker.persist_brief_and_items). The counting query
        # must therefore key off interactions.analysis_status, not brief rows.
        with patch("apps.api.billing._request", return_value=_mock_response(content_range="0-0/0")) as mock_request:
            billing.count_completed_interactions_for_accounts(
                ["00000000-0000-0000-0000-000000000001"], "2026-02-01T00:00:00+00:00", "2026-03-01T00:00:00+00:00"
            )
        called_url = mock_request.call_args.args[1]
        self.assertNotIn("/briefs", called_url)

    def test_mutable_usage_count_column_is_not_entitlement_authority(self):
        with patch("apps.api.billing.get_user_billing_row", return_value={"plan": "FREE", "status": "inactive", "usage_count": 0}), patch(
            "apps.api.billing.get_account_ids_for_owner", return_value=["00000000-0000-0000-0000-000000000001"]
        ), patch("apps.api.billing.count_completed_interactions_for_accounts", return_value=5):
            entitlement = billing.get_user_entitlement("user-1")

        self.assertEqual(entitlement["usage_count"], 5)
        self.assertEqual(entitlement["remaining_usage"], 0)
        self.assertFalse(entitlement["can_analyze"])

    def test_active_pro_gets_pro_allowance(self):
        with patch(
            "apps.api.billing.get_user_billing_row",
            return_value={
                "plan": "PRO",
                "status": "active",
                "current_period_start": "2026-02-01T00:00:00+00:00",
                "current_period_end": "2026-03-01T00:00:00+00:00",
            },
        ), patch("apps.api.billing.get_account_ids_for_owner", return_value=[]), patch(
            "apps.api.billing.count_completed_interactions_for_accounts", return_value=0
        ):
            entitlement = billing.get_user_entitlement("user-pro")

        self.assertEqual(entitlement["plan"], "PRO")
        self.assertTrue(entitlement["is_active"])
        self.assertEqual(entitlement["monthly_analysis_allowance"], billing.DEFAULT_PRO_ALLOWANCE)
        self.assertEqual(entitlement["period_start"], "2026-02-01T00:00:00+00:00")
        self.assertEqual(entitlement["period_end"], "2026-03-01T00:00:00+00:00")

    def test_inactive_pro_falls_back_to_free_allowance(self):
        with patch(
            "apps.api.billing.get_user_billing_row",
            return_value={"plan": "PRO", "status": "canceled"},
        ), patch("apps.api.billing.get_account_ids_for_owner", return_value=[]), patch(
            "apps.api.billing.count_completed_interactions_for_accounts", return_value=0
        ):
            entitlement = billing.get_user_entitlement("user-expired-pro")

        self.assertEqual(entitlement["plan"], "FREE")
        self.assertFalse(entitlement["is_active"])
        self.assertEqual(entitlement["monthly_analysis_allowance"], billing.DEFAULT_FREE_ALLOWANCE)
        self.assertTrue(entitlement["can_analyze"])

    def test_billing_lookup_failure_cannot_grant_unlimited_usage(self):
        with patch("apps.api.billing.get_user_billing_row", side_effect=billing.BillingServiceError("down")):
            with self.assertRaises(billing.BillingServiceError):
                billing.get_user_entitlement("user-1")

    def test_account_ownership_resolves_through_trusted_db_lookup_not_client_input(self):
        with patch("apps.api.billing.get_account_owner_id", return_value="owner-1") as mock_owner, patch(
            "apps.api.billing.get_user_entitlement", return_value=billing._default_entitlement()
        ) as mock_entitlement:
            billing.get_account_entitlement("account-1")

        mock_owner.assert_called_once_with("account-1")
        mock_entitlement.assert_called_once_with("owner-1")

    def test_valid_owner_with_no_billing_row_returns_free_entitlement(self):
        # Option A: the owner resolves fine, there's just no user_billing row
        # for them yet -- that's a normal, expected FREE user.
        with patch("apps.api.billing.get_account_owner_id", return_value="owner-1"), patch(
            "apps.api.billing.get_user_billing_row", return_value=None
        ), patch("apps.api.billing.get_account_ids_for_owner", return_value=[]), patch(
            "apps.api.billing.count_completed_interactions_for_accounts", return_value=0
        ):
            entitlement = billing.get_account_entitlement("account-1")

        self.assertEqual(entitlement["plan"], "FREE")
        self.assertTrue(entitlement["can_analyze"])
        self.assertEqual(entitlement["remaining_usage"], billing.DEFAULT_FREE_ALLOWANCE)

    def test_unresolved_owner_raises_billing_service_error(self):
        # Option B: the trusted account_id -> owner_id lookup itself found
        # nothing (deleted/bogus account_id) -- this must fail closed, not
        # silently grant FREE usage.
        with patch("apps.api.billing.get_account_owner_id", return_value=None):
            with self.assertRaises(billing.BillingServiceError) as ctx:
                billing.get_account_entitlement("bogus-account")

        self.assertEqual(str(ctx.exception), billing.BILLING_OWNER_UNRESOLVED_REASON)

    def test_unresolved_owner_does_not_return_can_analyze_true(self):
        with patch("apps.api.billing.get_account_owner_id", return_value=""):
            try:
                result = billing.get_account_entitlement("bogus-account")
            except billing.BillingServiceError:
                result = None

        self.assertIsNone(result)

    def test_account_owner_lookup_network_failure_remains_fail_closed(self):
        with patch(
            "apps.api.billing.get_account_owner_id",
            side_effect=billing.BillingServiceError("down"),
        ):
            with self.assertRaises(billing.BillingServiceError):
                billing.get_account_entitlement("account-1")


class BillingWriteFailureTests(unittest.TestCase):
    def test_trusted_billing_write_failure_raises_instead_of_fake_success(self):
        with patch("apps.api.billing.requests.request", side_effect=billing.requests.RequestException("boom")):
            with self.assertRaises(billing.BillingServiceError):
                billing._request("GET", "https://example.supabase.co/rest/v1/user_billing")

    def test_request_helper_never_logs_service_role_key(self):
        logged = []
        with patch("apps.api.billing.requests.request", side_effect=billing.requests.RequestException("boom")), patch(
            "apps.api.billing.logger.error", side_effect=lambda *args, **kwargs: logged.append((args, kwargs))
        ), patch.dict(os.environ, {"SUPABASE_SERVICE_ROLE_KEY": "super-secret-token"}):
            with self.assertRaises(billing.BillingServiceError):
                billing._request("GET", "https://example.supabase.co/rest/v1/user_billing")

        self.assertTrue(logged)
        for args, kwargs in logged:
            self.assertNotIn("super-secret-token", repr(args))
            self.assertNotIn("super-secret-token", repr(kwargs))


class EntitlementRequestAuthorityTests(unittest.TestCase):
    def test_enforce_analysis_allowance_blocks_when_quota_exhausted(self):
        with patch(
            "apps.api.billing.get_account_entitlement",
            return_value={"plan": "FREE", "can_analyze": False, "remaining_usage": 0},
        ):
            with self.assertRaises(billing.HTTPException) as ctx:
                billing.enforce_analysis_allowance_for_account("account-1")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(ctx.exception.detail, billing.PLAN_LIMIT_REASON)

    def test_enforce_analysis_allowance_surfaces_billing_outage_as_503(self):
        with patch(
            "apps.api.billing.get_account_entitlement",
            side_effect=billing.BillingServiceError("down"),
        ):
            with self.assertRaises(billing.HTTPException) as ctx:
                billing.enforce_analysis_allowance_for_account("account-1")
        self.assertEqual(ctx.exception.status_code, 503)


class BillingDocumentationTests(unittest.TestCase):
    def test_billing_doc_states_authoritative_unit_period_path_and_concurrency(self):
        with open("apps/api/BILLING.md", "r", encoding="utf-8") as doc_file:
            doc = doc_file.read()
        self.assertIn("analysis_status = 'complete'", doc)
        self.assertIn("UTC calendar month", doc)
        self.assertIn("interaction insert (queued)", doc)
        self.assertIn("check-then-act", doc)
        self.assertIn("exactly one supervised worker process", doc)
        self.assertIn("410 Gone", doc)

    def test_deployed_worker_topology_is_single_process(self):
        with open("deploy/systemd/relationship-worker.service", "r", encoding="utf-8") as service_file:
            service = service_file.read()
        self.assertEqual(service.count("ExecStart="), 1)
        self.assertNotIn("%i", service)


if __name__ == "__main__":
    unittest.main()
