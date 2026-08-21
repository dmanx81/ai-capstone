import unittest
from types import SimpleNamespace
from unittest.mock import patch

from apps.api import worker


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
            "apps.api.worker.update_job_status"
        ) as update_job_status:
            result = worker.process_job(job, "https://example.supabase.co", "service-token")

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("mismatch", result["error"].lower())
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


if __name__ == "__main__":
    unittest.main()
