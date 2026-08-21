import unittest
from types import SimpleNamespace
from unittest.mock import patch

from apps.api import billing, embeddings, worker

ACCOUNT_ID = "00000000-0000-0000-0000-000000000789"
INTERACTION_ID = "00000000-0000-0000-0000-000000000456"


def make_chunk(interaction_id=INTERACTION_ID, content="A recorded commitment remains open."):
    return embeddings.RetrievedChunk(
        id="00000000-0000-0000-0000-000000000003",
        interaction_id=interaction_id,
        content=content,
        similarity=0.87,
        created_at="2026-08-21T10:00:00Z",
    )


class AsyncAnalysisWorkerTests(unittest.TestCase):
    def test_sanitize_error_removes_secrets(self):
        raw = "OpenAIError: api_key=secret-123 provider=OpenRouter"
        self.assertNotIn("secret-123", worker.sanitize_analysis_error(raw))
        self.assertIn("OpenAIError", worker.sanitize_analysis_error(raw))

    def test_claim_rpc_is_worker_only_in_migration(self):
        migration = open("supabase/migrations/007_async_analysis.sql", "r", encoding="utf-8").read()
        self.assertIn("revoke all on function public.claim_next_analysis_job() from public;", migration)
        self.assertIn("revoke execute on function public.claim_next_analysis_job() from anon;", migration)
        self.assertIn("revoke execute on function public.claim_next_analysis_job() from authenticated;", migration)
        self.assertIn("grant execute on function public.claim_next_analysis_job() to service_role;", migration)

    def test_analysis_jobs_policy_requires_matching_interaction_account(self):
        migration = open("supabase/migrations/007_async_analysis.sql", "r", encoding="utf-8").read()
        self.assertIn("i.account_id = analysis_jobs.account_id", migration)
        self.assertIn("where i.id = analysis_jobs.interaction_id", migration)

    @patch("apps.api.worker.requests.post")
    def test_claim_next_job_uses_rpc(self, mock_post):
        mock_post.return_value.json.return_value = [{
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": "00000000-0000-0000-0000-000000000456",
            "account_id": "00000000-0000-0000-0000-000000000789",
            "status": "queued",
            "attempts": 0,
            "last_error": None,
        }]
        mock_post.return_value.raise_for_status.return_value = None

        job = worker.claim_next_job("https://example.supabase.co", "service-token")

        self.assertIsNotNone(job)
        self.assertEqual(job["interaction_id"], "00000000-0000-0000-0000-000000000456")
        self.assertEqual(mock_post.call_count, 1)

    def test_retry_preserves_attempt_history_and_avoids_duplicate_jobs(self):
        action = open("apps/web/src/app/relationships/interaction-actions.ts", "r", encoding="utf-8").read()
        self.assertIn("analysis_started_at: null", action)
        self.assertIn("analysis_completed_at: null", action)
        self.assertNotIn("analysis_attempts: 0", action)
        self.assertIn("attempts: existingJob?.attempts ?? 0", action)
        self.assertIn("onConflict: \"interaction_id\"", action)

    def test_session9_settings_and_delete_ui_are_present(self):
        with open("apps/web/src/app/settings/page.tsx", "r", encoding="utf-8") as settings_file:
            settings = settings_file.read()
        self.assertIn("Data controls", settings)
        self.assertIn("relationship-memory chunks/embeddings", settings)
        self.assertIn("Delete relationship", settings)

    def test_session9_export_route_excludes_chunks_and_secrets(self):
        with open("apps/web/src/app/api/relationships/[id]/export/route.ts", "r", encoding="utf-8") as export_file:
            export_route = export_file.read()
        self.assertIn('"relationship"', export_route)
        self.assertIn('"interactions"', export_route)
        self.assertIn('"briefs"', export_route)
        self.assertIn('"extracted_items"', export_route)
        self.assertNotIn("chunks", export_route)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", export_route)
        self.assertNotIn("OPENAI_API_KEY", export_route)
        self.assertNotIn("OPENROUTER_API_KEY", export_route)

    def test_session9_delete_uses_account_row_and_no_manual_child_delete_sequence(self):
        with open("apps/web/src/app/relationships/actions.ts", "r", encoding="utf-8") as actions_file:
            actions = actions_file.read()
        self.assertIn("from(\"accounts\")", actions)
        self.assertIn(".delete()", actions)
        self.assertNotIn("from(\"interactions\")", actions)
        self.assertNotIn("from(\"briefs\")", actions)
        self.assertNotIn("from(\"chunks\")", actions)

    def test_session9_schema_cascade_graph_uses_account_parentage(self):
        with open("supabase/migrations/001_schema.sql", "r", encoding="utf-8") as schema_file:
            schema = schema_file.read()
        self.assertIn("account_id uuid not null references public.accounts(id) on delete cascade", schema)
        self.assertIn("interactions (", schema)
        self.assertIn("briefs (", schema)
        self.assertIn("extracted_items (", schema)
        self.assertIn("chunks (", schema)

    def test_session9_worker_handles_deleted_account_or_interaction(self):
        with open("apps/api/worker.py", "r", encoding="utf-8") as worker_file:
            worker_source = worker_file.read()
        self.assertIn("Interaction/account mismatch detected", worker_source)
        self.assertIn("interaction_account_id is None", worker_source)

    def test_adversarial_account_interaction_mismatch_is_rejected_before_analysis(self):
        interaction = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000456",
            account_id="00000000-0000-0000-0000-000000000999",
            raw_text="interaction text that should never be processed",
            analysis_status="queued",
        )
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": interaction.id,
            "account_id": "00000000-0000-0000-0000-000000000789",
            "status": "queued",
            "attempts": 2,
        }

        with patch("apps.api.worker.fetch_interaction", return_value=interaction), patch(
            "apps.api.worker.perform_analysis"
        ) as mock_perform, patch(
            "apps.api.worker.persist_brief_and_items"
        ) as mock_persist, patch(
            "apps.api.worker.update_job_status"
        ) as mock_update_job, patch(
            "apps.api.worker.update_interaction_status"
        ) as mock_update_interaction:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("mismatch", result["error"].lower())
        mock_perform.assert_not_called()
        mock_persist.assert_not_called()
        mock_update_interaction.assert_not_called()
        mock_update_job.assert_called_once()

    def test_deleted_interaction_and_missing_job_are_safe_failures(self):
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": "00000000-0000-0000-0000-000000000456",
            "account_id": "00000000-0000-0000-0000-000000000789",
            "status": "queued",
            "attempts": 4,
        }
        with patch("apps.api.worker.fetch_interaction", return_value=None), patch(
            "apps.api.worker.perform_analysis"
        ) as mock_perform, patch(
            "apps.api.worker.update_job_status"
        ) as mock_update_job:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "failed")
        mock_perform.assert_not_called()
        mock_update_job.assert_called_once()

    def test_worker_security_artifacts_exist(self):
        self.assertTrue(__import__("os").path.exists("deploy/systemd/relationship-worker.service"))
        self.assertTrue(__import__("os").path.exists("scripts/check_stale_analysis_jobs.py"))

    def test_stale_job_monitor_uses_real_schema_fields_only(self):
        with open("scripts/check_stale_analysis_jobs.py", "r", encoding="utf-8") as script_file:
            script = script_file.read()
        self.assertIn("analysis_jobs", script)
        self.assertIn("id", script)
        self.assertIn("status", script)
        self.assertIn("created_at", script)
        self.assertIn("started_at", script)
        self.assertIn("attempts", script)
        self.assertNotIn("updated_at", script)

    def test_session9_no_service_role_in_web_source(self):
        web_files = []
        for root, _, files in __import__("os").walk("apps/web"):
            for name in files:
                if name.endswith((".ts", ".tsx", ".js", ".jsx")):
                    web_files.append(root + "/" + name)

        for path in web_files:
            with open(path, "r", encoding="utf-8") as web_file:
                text = web_file.read()
            self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", text)
            self.assertNotIn("OPENAI_API_KEY", text)
            self.assertNotIn("OPENROUTER_API_KEY", text)

    def test_process_job_defensively_rejects_account_mismatch(self):
        interaction = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000456",
            account_id="00000000-0000-0000-0000-000000000999",
            raw_text="A long enough interaction note ...",
            analysis_status="queued",
        )
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": interaction.id,
            "account_id": "00000000-0000-0000-0000-000000000789",
            "status": "queued",
            "attempts": 3,
        }

        with patch("apps.api.worker.fetch_interaction", return_value=interaction), patch(
            "apps.api.worker.update_interaction_status"
        ) as mock_update_interaction, patch(
            "apps.api.worker.update_job_status"
        ) as update_job_status:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("mismatch", result["error"].lower())
        mock_update_interaction.assert_not_called()
        update_job_status.assert_called_once()

    def test_process_job_marks_failure_without_deleting_interaction(self):
        interaction = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000456",
            account_id="00000000-0000-0000-0000-000000000789",
            raw_text="A long enough interaction note ...",
            analysis_status="queued",
        )
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": interaction.id,
            "account_id": interaction.account_id,
            "status": "queued",
            "attempts": 0,
        }

        with patch("apps.api.worker.fetch_interaction", return_value=interaction), patch(
            "apps.api.worker.get_account_entitlement", return_value={"can_analyze": True}
        ), patch(
            "apps.api.worker.retrieve_relationship_context", side_effect=RuntimeError("bad history")
        ), patch(
            "apps.api.worker.perform_analysis",
            side_effect=RuntimeError("OpenAIError: api_key=secret-123 provider=OpenRouter")
        ), patch("apps.api.worker.update_interaction_status") as update_status, patch(
            "apps.api.worker.update_job_status"
        ):
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        failed_call = update_status.call_args_list[-1]
        self.assertEqual(failed_call.args[3], "failed")
        self.assertIn("OpenAIError", failed_call.kwargs["analysis_error"])
        self.assertIn("OpenAIError", result["error"])

    def test_worker_checks_account_interaction_mismatch_before_entitlement(self):
        interaction = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000456",
            account_id="00000000-0000-0000-0000-000000000999",
            raw_text="A long enough interaction note ...",
            analysis_status="queued",
        )
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": interaction.id,
            "account_id": "00000000-0000-0000-0000-000000000789",
            "status": "queued",
            "attempts": 1,
        }

        with patch("apps.api.worker.fetch_interaction", return_value=interaction), patch(
            "apps.api.worker.get_account_entitlement"
        ) as mock_entitlement, patch(
            "apps.api.worker.update_job_status"
        ) as mock_update_job, patch(
            "apps.api.worker.update_interaction_status"
        ) as mock_update_interaction:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        mock_entitlement.assert_not_called()
        mock_update_interaction.assert_not_called()
        mock_update_job.assert_called_once()

    def test_worker_blocks_provider_call_when_quota_exhausted(self):
        interaction = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000456",
            account_id="00000000-0000-0000-0000-000000000789",
            raw_text="A long enough interaction note ...",
            analysis_status="queued",
        )
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": interaction.id,
            "account_id": interaction.account_id,
            "status": "queued",
            "attempts": 0,
        }

        with patch("apps.api.worker.fetch_interaction", return_value=interaction), patch(
            "apps.api.worker.get_account_entitlement",
            return_value={"plan": "FREE", "can_analyze": False, "remaining_usage": 0},
        ), patch(
            "apps.api.worker.perform_analysis"
        ) as mock_perform, patch(
            "apps.api.worker.persist_brief_and_items"
        ) as mock_persist, patch(
            "apps.api.worker.update_job_status"
        ) as mock_update_job, patch(
            "apps.api.worker.update_interaction_status"
        ) as mock_update_interaction:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error"], worker.PLAN_LIMIT_REASON)
        mock_perform.assert_not_called()
        mock_persist.assert_not_called()

        job_call = mock_update_job.call_args
        self.assertEqual(job_call.args[3], "failed")
        self.assertEqual(job_call.kwargs["last_error"], worker.PLAN_LIMIT_REASON)

        interaction_call = mock_update_interaction.call_args
        self.assertEqual(interaction_call.args[3], "failed")
        self.assertEqual(interaction_call.kwargs["analysis_error"], worker.PLAN_LIMIT_REASON)

    def test_worker_fails_safely_when_billing_backend_is_unavailable(self):
        interaction = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000456",
            account_id="00000000-0000-0000-0000-000000000789",
            raw_text="A long enough interaction note ...",
            analysis_status="queued",
        )
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": interaction.id,
            "account_id": interaction.account_id,
            "status": "queued",
            "attempts": 0,
        }

        with patch("apps.api.worker.fetch_interaction", return_value=interaction), patch(
            "apps.api.worker.get_account_entitlement",
            side_effect=worker.BillingServiceError("boom"),
        ), patch(
            "apps.api.worker.perform_analysis"
        ) as mock_perform, patch(
            "apps.api.worker.update_job_status"
        ) as mock_update_job, patch(
            "apps.api.worker.update_interaction_status"
        ) as mock_update_interaction:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        self.assertEqual(result["error"], worker.BILLING_UNAVAILABLE_REASON)
        mock_perform.assert_not_called()
        mock_update_job.assert_called_once()
        mock_update_interaction.assert_called_once()

    def test_worker_does_not_call_provider_or_persist_anything_when_owner_cannot_be_resolved(self):
        # get_account_entitlement raises BillingServiceError("billing_owner_unresolved")
        # when the account_id -> owner_id lookup finds nothing (deleted/bogus
        # account_id). Linkage validation has already proven interaction.account_id
        # == job.account_id by this point, so the interaction may be marked
        # failed -- but the provider must never be called and nothing may be
        # persisted. The worker intentionally maps this to the same sanitized
        # billing_unavailable reason as any other billing resolution failure
        # rather than leaking which specific lookup failed.
        interaction = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000456",
            account_id="00000000-0000-0000-0000-000000000789",
            raw_text="A long enough interaction note ...",
            analysis_status="queued",
        )
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": interaction.id,
            "account_id": interaction.account_id,
            "status": "queued",
            "attempts": 0,
        }

        with patch("apps.api.worker.fetch_interaction", return_value=interaction), patch(
            "apps.api.worker.get_account_entitlement",
            side_effect=billing.BillingServiceError(billing.BILLING_OWNER_UNRESOLVED_REASON),
        ), patch(
            "apps.api.worker.perform_analysis"
        ) as mock_perform, patch(
            "apps.api.worker.persist_brief_and_items"
        ) as mock_persist, patch(
            "apps.api.worker.ingest_interaction_memory"
        ) as mock_ingest, patch(
            "apps.api.worker.update_job_status"
        ) as mock_update_job, patch(
            "apps.api.worker.update_interaction_status"
        ) as mock_update_interaction:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error"], worker.BILLING_UNAVAILABLE_REASON)
        mock_perform.assert_not_called()
        mock_persist.assert_not_called()
        mock_ingest.assert_not_called()

        job_call = mock_update_job.call_args
        self.assertEqual(job_call.args[3], "failed")
        interaction_call = mock_update_interaction.call_args
        self.assertEqual(interaction_call.args[3], "failed")

    def test_perform_analysis_removes_current_interaction_from_historical_context(self):
        current = make_chunk()
        historical = make_chunk(interaction_id="00000000-0000-0000-0000-000000000004")
        brief = SimpleNamespace(model_dump=lambda: {"executive_summary": "ok"})

        with patch(
            "apps.api.worker.retrieve_relationship_context", return_value=[current, historical]
        ) as retrieve, patch("apps.api.worker.analyze_account", return_value=brief) as analyze, patch(
            "apps.api.worker.ingest_interaction_memory"
        ):
            worker.perform_analysis(ACCOUNT_ID, INTERACTION_ID, "raw text", "access-token")

        self.assertEqual(retrieve.call_args.kwargs["match_count"], 3)
        self.assertEqual(analyze.call_args.args[1], [historical])

    def test_perform_analysis_tolerates_historical_context_retrieval_failure(self):
        brief = SimpleNamespace(model_dump=lambda: {"executive_summary": "ok"})

        with patch(
            "apps.api.worker.retrieve_relationship_context",
            side_effect=RuntimeError("retrieval down"),
        ), patch("apps.api.worker.analyze_account", return_value=brief) as analyze, patch(
            "apps.api.worker.ingest_interaction_memory"
        ):
            worker.perform_analysis(ACCOUNT_ID, INTERACTION_ID, "raw text", "access-token")

        self.assertEqual(analyze.call_args.args[1], [])

    def test_brief_persisted_but_items_failure_leaves_interaction_not_complete(self):
        # provider succeeds -> brief persists -> extracted_items persistence
        # fails -> job/interaction must end 'failed', never 'complete'. This is
        # the failure boundary billing.count_completed_interactions_for_accounts
        # is designed around: it counts interactions.analysis_status='complete',
        # not brief existence, precisely because a brief can outlive a failed job.
        interaction = SimpleNamespace(
            id=INTERACTION_ID,
            account_id=ACCOUNT_ID,
            raw_text="A long enough interaction note ...",
            analysis_status="queued",
        )
        job = {
            "id": "00000000-0000-0000-0000-000000000123",
            "interaction_id": interaction.id,
            "account_id": interaction.account_id,
            "status": "queued",
            "attempts": 0,
        }

        with patch("apps.api.worker.fetch_interaction", return_value=interaction), patch(
            "apps.api.worker.get_account_entitlement", return_value={"can_analyze": True}
        ), patch("apps.api.worker.perform_analysis", return_value=SimpleNamespace()), patch(
            "apps.api.worker.persist_brief_and_items",
            side_effect=RuntimeError("extracted_items insert failed"),
        ), patch(
            "apps.api.worker.update_job_status"
        ) as mock_update_job, patch(
            "apps.api.worker.update_interaction_status"
        ) as mock_update_interaction:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        interaction_call = mock_update_interaction.call_args_list[-1]
        job_call = mock_update_job.call_args_list[-1]
        self.assertEqual(interaction_call.args[3], "failed")
        self.assertEqual(job_call.args[3], "failed")
        self.assertNotIn("complete", [call.args[3] for call in mock_update_interaction.call_args_list])

    def test_interactions_table_is_single_row_per_interaction(self):
        # Guarantees that a retried interaction can only ever be counted once
        # by count_completed_interactions_for_accounts: there is one row per
        # interaction (primary key), updated in place by update_interaction_status,
        # never appended to.
        with open("supabase/migrations/001_schema.sql", "r", encoding="utf-8") as schema_file:
            schema = schema_file.read()
        interactions_table = schema.split("create table public.interactions (")[1].split(");")[0]
        self.assertIn("id uuid primary key default gen_random_uuid(),", interactions_table)


if __name__ == "__main__":
    unittest.main()
