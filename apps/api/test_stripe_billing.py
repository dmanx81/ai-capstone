import os
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")

import stripe  # noqa: E402

from apps.api import api  # noqa: E402
from apps.api import billing  # noqa: E402

MIGRATION_PATH = "supabase/migrations/009_stripe_webhook_events.sql"
PRO_PRICE_ID = "price_pro_test_123"


def _mock_response(json_data=None, content_range=None, headers=None):
    response = MagicMock()
    response.json.return_value = json_data if json_data is not None else []
    response.headers = headers or ({"Content-Range": content_range} if content_range else {})
    response.raise_for_status.return_value = None
    return response


def _make_subscription(*, status="active", price_id=PRO_PRICE_ID, customer="cus_123", subscription_id="sub_123", period_start=1700000000, period_end=1702592000):
    return {
        "id": subscription_id,
        "customer": customer,
        "status": status,
        "current_period_start": period_start,
        "current_period_end": period_end,
        "items": {"data": [{"price": {"id": price_id}}]},
    }


def _authenticated(user_id="user-1"):
    return api.AuthenticatedRequest({"sub": user_id}, "caller.jwt")


def _unauthenticated():
    return api.AuthenticatedRequest({}, "caller.jwt")


class FakeRequest:
    def __init__(self, body: bytes, headers: dict):
        self._body = body
        self.headers = headers

    async def body(self) -> bytes:
        return self._body


class CheckoutSecurityTests(unittest.TestCase):
    def test_unauthenticated_checkout_rejected(self):
        with self.assertRaises(api.HTTPException) as ctx:
            api.create_billing_checkout(_unauthenticated())
        self.assertEqual(ctx.exception.status_code, 401)

    def test_checkout_route_takes_no_body_and_cannot_receive_a_price_id(self):
        # Static: the route function only depends on the auth dependency --
        # there is no request body parameter a browser could use to submit
        # price_id / plan / amount / customer_id.
        with open("apps/api/api.py", "r", encoding="utf-8") as api_file:
            source = api_file.read()
        route_body = source.split('@app.post("/billing/checkout")')[1].split("\n\n\n")[0]
        self.assertNotIn("request:", route_body)
        self.assertIn("Depends(verify_supabase_token)", route_body)

    def test_configured_pro_price_id_is_always_used(self):
        with patch("apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID), patch(
            "apps.api.billing.get_stripe_success_url", return_value="https://app.example.com/success"
        ), patch("apps.api.billing.get_stripe_cancel_url", return_value="https://app.example.com/cancel"), patch(
            "apps.api.billing.resolve_or_create_stripe_customer", return_value="cus_123"
        ), patch(
            "apps.api.billing.stripe.checkout.Session.create"
        ) as mock_create, patch(
            "apps.api.billing._configure_stripe"
        ):
            mock_create.return_value = MagicMock(url="https://checkout.stripe.com/session/abc")
            url = billing.create_checkout_session("user-1")

        self.assertEqual(url, "https://checkout.stripe.com/session/abc")
        line_items = mock_create.call_args.kwargs["line_items"]
        self.assertEqual(line_items, [{"price": PRO_PRICE_ID, "quantity": 1}])

    def test_checkout_maps_to_authenticated_supabase_user(self):
        with patch("apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID), patch(
            "apps.api.billing.get_stripe_success_url", return_value="https://app.example.com/success"
        ), patch("apps.api.billing.get_stripe_cancel_url", return_value="https://app.example.com/cancel"), patch(
            "apps.api.billing.resolve_or_create_stripe_customer", return_value="cus_123"
        ) as mock_resolve, patch(
            "apps.api.billing.stripe.checkout.Session.create",
            return_value=MagicMock(url="https://checkout.stripe.com/session/abc"),
        ) as mock_create, patch("apps.api.billing._configure_stripe"):
            billing.create_checkout_session("user-42")

        mock_resolve.assert_called_once_with("user-42")
        self.assertEqual(mock_create.call_args.kwargs["metadata"], {"supabase_user_id": "user-42"})

    def test_server_reuses_trusted_stripe_customer_if_already_present(self):
        with patch(
            "apps.api.billing.get_user_billing_row",
            return_value={"stripe_customer_id": "cus_existing"},
        ), patch("apps.api.billing.stripe.Customer.create") as mock_create_customer:
            customer_id = billing.resolve_or_create_stripe_customer("user-1")

        self.assertEqual(customer_id, "cus_existing")
        mock_create_customer.assert_not_called()

    def test_arbitrary_customer_id_from_client_is_impossible(self):
        # Static: create_checkout_session's only parameter is the trusted
        # server-resolved user_id; nothing about a client-supplied customer_id
        # can reach stripe.checkout.Session.create.
        with open("apps/api/billing.py", "r", encoding="utf-8") as billing_file:
            source = billing_file.read()
        func_body = source.split("def create_checkout_session(user_id: str) -> str:")[1].split("\n\ndef ")[0]
        self.assertIn("resolve_or_create_stripe_customer(str(user_id))", func_body)
        self.assertNotIn("customer_id=", func_body)  # no client-supplied param name in scope

    def test_stripe_api_failure_surfaces_safely(self):
        with patch("apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID), patch(
            "apps.api.billing.get_stripe_success_url", return_value="https://app.example.com/success"
        ), patch("apps.api.billing.get_stripe_cancel_url", return_value="https://app.example.com/cancel"), patch(
            "apps.api.billing.resolve_or_create_stripe_customer", return_value="cus_123"
        ), patch(
            "apps.api.billing.stripe.checkout.Session.create",
            side_effect=stripe.error.StripeError("boom"),
        ), patch("apps.api.billing._configure_stripe"):
            with self.assertRaises(billing.BillingServiceError):
                billing.create_checkout_session("user-1")

    def test_checkout_route_maps_billing_service_error_to_503(self):
        with patch("apps.api.billing.create_checkout_session", side_effect=billing.BillingServiceError("down")):
            with self.assertRaises(api.HTTPException) as ctx:
                api.create_billing_checkout(_authenticated())
        self.assertEqual(ctx.exception.status_code, 503)


class PortalSecurityTests(unittest.TestCase):
    def test_unauthenticated_portal_rejected(self):
        with self.assertRaises(api.HTTPException) as ctx:
            api.create_billing_portal(_unauthenticated())
        self.assertEqual(ctx.exception.status_code, 401)

    def test_customer_id_comes_from_trusted_billing_row(self):
        with patch(
            "apps.api.billing.get_user_billing_row",
            return_value={"stripe_customer_id": "cus_trusted"},
        ), patch("apps.api.billing.get_stripe_portal_return_url", return_value="https://app.example.com/settings"), patch(
            "apps.api.billing.stripe.billing_portal.Session.create",
            return_value=MagicMock(url="https://billing.stripe.com/session/xyz"),
        ) as mock_create, patch("apps.api.billing._configure_stripe"):
            url = billing.create_portal_session("user-1")

        self.assertEqual(url, "https://billing.stripe.com/session/xyz")
        self.assertEqual(mock_create.call_args.kwargs["customer"], "cus_trusted")

    def test_missing_customer_returns_safe_error(self):
        with patch("apps.api.billing.get_user_billing_row", return_value={"stripe_customer_id": None}), patch(
            "apps.api.billing.get_stripe_portal_return_url", return_value="https://app.example.com/settings"
        ):
            with self.assertRaises(billing.NoStripeCustomerError):
                billing.create_portal_session("user-1")

    def test_portal_route_maps_no_customer_to_400(self):
        with patch("apps.api.billing.create_portal_session", side_effect=billing.NoStripeCustomerError("none")):
            with self.assertRaises(api.HTTPException) as ctx:
                api.create_billing_portal(_authenticated())
        self.assertEqual(ctx.exception.status_code, 400)

    def test_stripe_failure_handled_safely(self):
        with patch(
            "apps.api.billing.get_user_billing_row",
            return_value={"stripe_customer_id": "cus_trusted"},
        ), patch("apps.api.billing.get_stripe_portal_return_url", return_value="https://app.example.com/settings"), patch(
            "apps.api.billing.stripe.billing_portal.Session.create",
            side_effect=stripe.error.StripeError("boom"),
        ), patch("apps.api.billing._configure_stripe"):
            with self.assertRaises(billing.BillingServiceError):
                billing.create_portal_session("user-1")

    def test_portal_route_maps_billing_service_error_to_503(self):
        with patch("apps.api.billing.create_portal_session", side_effect=billing.BillingServiceError("down")):
            with self.assertRaises(api.HTTPException) as ctx:
                api.create_billing_portal(_authenticated())
        self.assertEqual(ctx.exception.status_code, 503)


class BillingStatusTests(unittest.TestCase):
    def test_unauthenticated_status_rejected(self):
        with self.assertRaises(api.HTTPException) as ctx:
            api.get_billing_status(_unauthenticated())
        self.assertEqual(ctx.exception.status_code, 401)

    def test_status_returns_only_safe_fields(self):
        entitlement = {
            "plan": "FREE",
            "status": "inactive",
            "usage_count": 1,
            "monthly_analysis_allowance": 5,
            "remaining_usage": 4,
            "period_start": "2026-08-01T00:00:00+00:00",
            "period_end": "2026-09-01T00:00:00+00:00",
            "is_active": False,
            "can_analyze": True,
        }
        with patch("apps.api.billing.get_user_entitlement", return_value=entitlement):
            result = api.get_billing_status(_authenticated())

        self.assertEqual(
            set(result.keys()),
            {"plan", "status", "usage_count", "monthly_analysis_allowance", "remaining_usage", "period_start", "period_end"},
        )
        self.assertNotIn("is_active", result)
        self.assertNotIn("can_analyze", result)


class SubscriptionReconciliationTests(unittest.TestCase):
    def test_wrong_price_id_yields_free(self):
        subscription = _make_subscription(status="active", price_id="price_other")
        captured = {}
        with patch("apps.api.billing.resolve_user_id_for_stripe_customer", return_value="user-1"), patch(
            "apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID
        ), patch("apps.api.billing.upsert_user_billing_fields", side_effect=lambda uid, fields: captured.update(fields)):
            billing.apply_subscription_state(subscription)

        self.assertEqual(captured["plan"], "FREE")

    def test_active_correct_price_yields_pro(self):
        subscription = _make_subscription(status="active", price_id=PRO_PRICE_ID)
        captured = {}
        with patch("apps.api.billing.resolve_user_id_for_stripe_customer", return_value="user-1"), patch(
            "apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID
        ), patch("apps.api.billing.upsert_user_billing_fields", side_effect=lambda uid, fields: captured.update(fields)):
            billing.apply_subscription_state(subscription)

        self.assertEqual(captured["plan"], "PRO")
        self.assertEqual(captured["status"], "active")

    def test_trialing_correct_price_yields_pro(self):
        subscription = _make_subscription(status="trialing", price_id=PRO_PRICE_ID)
        captured = {}
        with patch("apps.api.billing.resolve_user_id_for_stripe_customer", return_value="user-1"), patch(
            "apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID
        ), patch("apps.api.billing.upsert_user_billing_fields", side_effect=lambda uid, fields: captured.update(fields)):
            billing.apply_subscription_state(subscription)

        self.assertEqual(captured["plan"], "PRO")
        self.assertEqual(captured["status"], "trialing")

    def test_canceled_subscription_yields_free_effective_entitlement(self):
        subscription = _make_subscription(status="canceled", price_id=PRO_PRICE_ID)
        written = {}
        with patch("apps.api.billing.resolve_user_id_for_stripe_customer", return_value="user-1"), patch(
            "apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID
        ), patch("apps.api.billing.upsert_user_billing_fields", side_effect=lambda uid, fields: written.update(fields)):
            billing.apply_subscription_state(subscription)

        # The raw row truthfully records a PRO-price subscription that is
        # canceled; _effective_plan_and_active (unchanged) is what actually
        # decides this yields FREE access at read time.
        self.assertEqual(written["plan"], "PRO")
        self.assertEqual(written["status"], "canceled")

        with patch("apps.api.billing.get_user_billing_row", return_value=written), patch(
            "apps.api.billing.get_account_ids_for_owner", return_value=[]
        ), patch("apps.api.billing.count_completed_interactions_for_accounts", return_value=0):
            entitlement = billing.get_user_entitlement("user-1")

        self.assertEqual(entitlement["plan"], "FREE")

    def test_deleted_subscription_dispatches_and_yields_free_effective_entitlement(self):
        subscription = _make_subscription(status="canceled", price_id=PRO_PRICE_ID)
        event = {"type": "customer.subscription.deleted", "data": {"object": subscription}}
        written = {}
        with patch("apps.api.billing.resolve_user_id_for_stripe_customer", return_value="user-1"), patch(
            "apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID
        ), patch("apps.api.billing.upsert_user_billing_fields", side_effect=lambda uid, fields: written.update(fields)):
            billing.handle_stripe_webhook_event(event)

        with patch("apps.api.billing.get_user_billing_row", return_value=written), patch(
            "apps.api.billing.get_account_ids_for_owner", return_value=[]
        ), patch("apps.api.billing.count_completed_interactions_for_accounts", return_value=0):
            entitlement = billing.get_user_entitlement("user-1")

        self.assertEqual(entitlement["plan"], "FREE")

    def test_period_timestamps_convert_correctly_to_utc(self):
        expected_start = datetime.fromtimestamp(1700000000, tz=timezone.utc).isoformat()
        expected_end = datetime.fromtimestamp(1702592000, tz=timezone.utc).isoformat()
        subscription = _make_subscription(period_start=1700000000, period_end=1702592000)

        fields = billing._extract_subscription_fields(subscription)

        self.assertEqual(fields["current_period_start"], expected_start)
        self.assertEqual(fields["current_period_end"], expected_end)
        self.assertTrue(expected_start.endswith("+00:00"))

    def test_unknown_customer_is_out_of_scope_not_an_error(self):
        subscription = _make_subscription()
        with patch("apps.api.billing.resolve_user_id_for_stripe_customer", return_value=None), patch(
            "apps.api.billing.upsert_user_billing_fields"
        ) as mock_upsert:
            billing.apply_subscription_state(subscription)  # must not raise

        mock_upsert.assert_not_called()


class MetadataDistrustTests(unittest.TestCase):
    def test_arbitrary_metadata_user_id_cannot_promote_another_account(self):
        # Session carries a forged metadata.user_id pointing at a victim, but
        # the customer_id only maps (via the trusted mapping) to a different,
        # real account owner. The mutation must target the trusted owner only.
        session = {
            "customer": "cus_real_owner",
            "subscription": "sub_123",
            "metadata": {"supabase_user_id": "attacker-forged-victim-id"},
        }
        subscription = _make_subscription(customer="cus_real_owner", price_id=PRO_PRICE_ID)
        captured = {}

        with patch("apps.api.billing._configure_stripe"), patch(
            "apps.api.billing.stripe.Subscription.retrieve", return_value=subscription
        ), patch(
            "apps.api.billing.resolve_user_id_for_stripe_customer", return_value="real-owner-user-id"
        ) as mock_resolve, patch(
            "apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID
        ), patch(
            "apps.api.billing.upsert_user_billing_fields",
            side_effect=lambda uid, fields: captured.update({"user_id": uid, **fields}),
        ):
            billing.apply_checkout_completed(session)

        mock_resolve.assert_called_once_with("cus_real_owner")
        self.assertEqual(captured["user_id"], "real-owner-user-id")
        self.assertNotEqual(captured["user_id"], "attacker-forged-victim-id")

    def test_apply_checkout_completed_never_reads_session_metadata(self):
        # A session dict with no "metadata" key at all must still work --
        # proving metadata isn't consulted anywhere in this path.
        session = {"customer": "cus_real_owner", "subscription": "sub_123"}
        subscription = _make_subscription(customer="cus_real_owner", price_id=PRO_PRICE_ID)

        with patch("apps.api.billing._configure_stripe"), patch(
            "apps.api.billing.stripe.Subscription.retrieve", return_value=subscription
        ), patch("apps.api.billing.resolve_user_id_for_stripe_customer", return_value="real-owner-user-id"), patch(
            "apps.api.billing.get_stripe_pro_price_id", return_value=PRO_PRICE_ID
        ), patch("apps.api.billing.upsert_user_billing_fields"):
            billing.apply_checkout_completed(session)  # must not raise KeyError

    def test_checkout_completed_never_used_for_non_subscription_session(self):
        session = {"customer": "cus_real_owner"}  # no "subscription" key
        with patch("apps.api.billing.stripe.Subscription.retrieve") as mock_retrieve:
            billing.apply_checkout_completed(session)
        mock_retrieve.assert_not_called()


class WebhookSignatureTests(unittest.TestCase):
    def test_invalid_signature_rejected(self):
        with patch("apps.api.billing.get_stripe_webhook_secret", return_value="whsec_test"), patch(
            "apps.api.billing.stripe.Webhook.construct_event",
            side_effect=stripe.error.SignatureVerificationError("bad sig", "sig"),
        ):
            with self.assertRaises(stripe.error.SignatureVerificationError):
                billing.verify_and_parse_stripe_event(b"{}", "t=1,v1=abc")

    def test_missing_signature_rejected(self):
        with patch("apps.api.billing.get_stripe_webhook_secret", return_value="whsec_test"):
            with self.assertRaises(stripe.error.SignatureVerificationError):
                billing.verify_and_parse_stripe_event(b"{}", None)

    def test_unconfigured_webhook_secret_fails_safe(self):
        with patch("apps.api.billing.get_stripe_webhook_secret", return_value=""):
            with self.assertRaises(billing.StripeWebhookNotConfiguredError):
                billing.verify_and_parse_stripe_event(b"{}", "t=1,v1=abc")

    def test_no_custom_hmac_verification_used(self):
        with open("apps/api/billing.py", "r", encoding="utf-8") as billing_file:
            source = billing_file.read()
        self.assertIn("stripe.Webhook.construct_event", source)
        self.assertNotIn("hmac", source.lower())


class WebhookRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_signature_returns_400(self):
        request = FakeRequest(b'{"id": "evt_1"}', {"stripe-signature": "bad"})
        with patch(
            "apps.api.billing.verify_and_parse_stripe_event",
            side_effect=stripe.error.SignatureVerificationError("bad sig", "bad"),
        ):
            with self.assertRaises(api.HTTPException) as ctx:
                await api.stripe_webhook(request)
        self.assertEqual(ctx.exception.status_code, 400)

    async def test_unconfigured_webhook_secret_returns_503(self):
        request = FakeRequest(b'{"id": "evt_1"}', {"stripe-signature": "t=1,v1=abc"})
        with patch(
            "apps.api.billing.verify_and_parse_stripe_event",
            side_effect=billing.StripeWebhookNotConfiguredError("no secret"),
        ):
            with self.assertRaises(api.HTTPException) as ctx:
                await api.stripe_webhook(request)
        self.assertEqual(ctx.exception.status_code, 503)

    async def test_unknown_event_type_safely_ignored_and_marked_completed(self):
        event = {"id": "evt_unknown", "type": "customer.updated", "data": {"object": {}}}
        request = FakeRequest(b"{}", {"stripe-signature": "t=1,v1=abc"})
        with patch("apps.api.billing.verify_and_parse_stripe_event", return_value=event), patch(
            "apps.api.billing.claim_stripe_webhook_event",
            return_value={"claimed": True, "already_completed": False},
        ), patch("apps.api.billing.mark_stripe_webhook_event_completed") as mock_complete, patch(
            "apps.api.billing.mark_stripe_webhook_event_failed"
        ) as mock_failed:
            result = await api.stripe_webhook(request)

        self.assertEqual(result, {"status": "ok"})
        mock_complete.assert_called_once_with("evt_unknown")
        mock_failed.assert_not_called()

    async def test_concurrent_in_flight_claim_returns_409_and_never_mutates(self):
        event = {"id": "evt_race", "type": "checkout.session.completed", "data": {"object": {}}}
        request = FakeRequest(b"{}", {"stripe-signature": "t=1,v1=abc"})
        with patch("apps.api.billing.verify_and_parse_stripe_event", return_value=event), patch(
            "apps.api.billing.claim_stripe_webhook_event",
            return_value={"claimed": False, "already_completed": False},
        ), patch("apps.api.billing.handle_stripe_webhook_event") as mock_handle:
            with self.assertRaises(api.HTTPException) as ctx:
                await api.stripe_webhook(request)

        self.assertEqual(ctx.exception.status_code, 409)
        mock_handle.assert_not_called()

    async def test_idempotency_lifecycle_claim_fail_retry_succeed_duplicate(self):
        event = {"id": "evt_lifecycle", "type": "customer.subscription.updated", "data": {"object": {}}}
        request = FakeRequest(b"{}", {"stripe-signature": "t=1,v1=abc"})

        # 1. First delivery: claimed, mutation fails.
        with patch("apps.api.billing.verify_and_parse_stripe_event", return_value=event), patch(
            "apps.api.billing.claim_stripe_webhook_event",
            return_value={"claimed": True, "already_completed": False},
        ) as mock_claim_1, patch(
            "apps.api.billing.handle_stripe_webhook_event",
            side_effect=billing.BillingServiceError("db down"),
        ), patch("apps.api.billing.mark_stripe_webhook_event_failed") as mock_failed_1, patch(
            "apps.api.billing.mark_stripe_webhook_event_completed"
        ) as mock_complete_1:
            with self.assertRaises(api.HTTPException) as ctx:
                await api.stripe_webhook(request)

        self.assertEqual(ctx.exception.status_code, 503)
        mock_claim_1.assert_called_once_with("evt_lifecycle", "customer.subscription.updated")
        mock_failed_1.assert_called_once()
        mock_complete_1.assert_not_called()

        # 2. Simulated Stripe retry: RPC reclaims the failed row -- claimed
        #    again, NOT already_completed. This time the mutation succeeds.
        with patch("apps.api.billing.verify_and_parse_stripe_event", return_value=event), patch(
            "apps.api.billing.claim_stripe_webhook_event",
            return_value={"claimed": True, "already_completed": False},
        ), patch("apps.api.billing.handle_stripe_webhook_event") as mock_handle_2, patch(
            "apps.api.billing.mark_stripe_webhook_event_failed"
        ) as mock_failed_2, patch("apps.api.billing.mark_stripe_webhook_event_completed") as mock_complete_2:
            result = await api.stripe_webhook(request)

        self.assertEqual(result, {"status": "ok"})
        mock_handle_2.assert_called_once()
        mock_failed_2.assert_not_called()
        mock_complete_2.assert_called_once_with("evt_lifecycle")

        # 3. Third (duplicate) delivery after completion: no mutation at all.
        with patch("apps.api.billing.verify_and_parse_stripe_event", return_value=event), patch(
            "apps.api.billing.claim_stripe_webhook_event",
            return_value={"claimed": False, "already_completed": True},
        ), patch("apps.api.billing.handle_stripe_webhook_event") as mock_handle_3:
            result = await api.stripe_webhook(request)

        self.assertEqual(result, {"status": "already_processed"})
        mock_handle_3.assert_not_called()

    async def test_webhook_never_trusts_a_browser_supplied_plan(self):
        # Static: the route has no request body schema at all (raw bytes
        # only), so there is no "plan" field a caller could ever supply.
        with open("apps/api/api.py", "r", encoding="utf-8") as api_file:
            source = api_file.read()
        route_body = source.split('@app.post("/billing/webhook")')[1]
        self.assertIn("await request.body()", route_body)
        self.assertNotIn("plan:", route_body)


class WebhookMigrationStaticTests(unittest.TestCase):
    def setUp(self):
        with open(MIGRATION_PATH, "r", encoding="utf-8") as migration_file:
            self.migration = migration_file.read()

    def test_status_state_machine_present(self):
        self.assertIn("check (status in ('processing', 'completed', 'failed'))", self.migration)

    def test_first_ever_delivery_is_claimed_via_returning_insert(self):
        self.assertIn("returning stripe_event_id into v_inserted_id", self.migration)
        self.assertIn("if v_inserted_id is not null then", self.migration)
        # The very next thing after detecting a fresh insert must be an
        # immediate claim -- not a fall-through into the fresh-processing
        # staleness check (the bug caught during plan review).
        insert_branch = self.migration.split("if v_inserted_id is not null then")[1].split("end if;")[0]
        self.assertIn("select true, false", insert_branch)

    def test_concurrent_claim_uses_for_update_skip_locked(self):
        self.assertIn("for update skip locked", self.migration)

    def test_stale_processing_window_is_two_minutes(self):
        self.assertIn("interval '2 minutes'", self.migration)

    def test_function_is_service_role_only(self):
        self.assertIn("revoke execute on function public.claim_stripe_webhook_event(text, text) from anon;", self.migration)
        self.assertIn(
            "revoke execute on function public.claim_stripe_webhook_event(text, text) from authenticated;", self.migration
        )
        self.assertIn("grant execute on function public.claim_stripe_webhook_event(text, text) to service_role;", self.migration)

    def test_no_authenticated_write_policy_on_stripe_webhook_events(self):
        self.assertNotIn("create policy", self.migration)
        self.assertNotIn("to authenticated", self.migration)


class SettingsUiTests(unittest.TestCase):
    def test_free_ui_shows_upgrade_button(self):
        with open("apps/web/src/app/settings/page.tsx", "r", encoding="utf-8") as page_file:
            page = page_file.read()
        self.assertIn("Upgrade to Pro", page)
        self.assertIn("startCheckoutAction", page)

    def test_pro_ui_shows_manage_subscription_button(self):
        with open("apps/web/src/app/settings/page.tsx", "r", encoding="utf-8") as page_file:
            page = page_file.read()
        self.assertIn("Manage subscription", page)
        self.assertIn("openPortalAction", page)

    def test_usage_display_comes_from_authenticated_server_state(self):
        with open("apps/web/src/app/settings/page.tsx", "r", encoding="utf-8") as page_file:
            page = page_file.read()
        self.assertIn("getBillingStatus()", page)

    def test_no_stripe_secrets_or_price_id_in_web_source(self):
        web_files = []
        for root, _, files in os.walk("apps/web/src"):
            for name in files:
                if name.endswith((".ts", ".tsx", ".js", ".jsx")):
                    web_files.append(os.path.join(root, name))

        for path in web_files:
            with open(path, "r", encoding="utf-8") as web_file:
                text = web_file.read()
            self.assertNotIn("STRIPE_SECRET_KEY", text)
            self.assertNotIn("STRIPE_WEBHOOK_SECRET", text)
            self.assertNotIn("STRIPE_PRO_PRICE_ID", text)
            self.assertNotIn("sk_live", text)
            self.assertNotIn("sk_test", text)

    def test_no_price_id_or_customer_id_submitted_from_billing_actions(self):
        with open("apps/web/src/app/settings/billing-actions.ts", "r", encoding="utf-8") as actions_file:
            actions = actions_file.read()
        self.assertNotIn("price_id", actions)
        self.assertNotIn("customer_id", actions)
        self.assertNotIn("body: JSON.stringify", actions)  # no client-chosen billing body sent


if __name__ == "__main__":
    unittest.main()
