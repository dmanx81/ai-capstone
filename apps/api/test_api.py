import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch


os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")

from apps.api import api  # noqa: E402


class ApiIngestionTests(unittest.TestCase):
    def test_memory_failure_does_not_fail_analysis(self):
        request = api.AnalyzeRequest(
            customer_text="A sufficiently long interaction note for analysis.",
            account_id="00000000-0000-0000-0000-000000000001",
            interaction_id="00000000-0000-0000-0000-000000000002",
        )
        auth = api.AuthenticatedRequest(
            claims={"sub": "user-1"},
            bearer_token="caller.jwt.value",
        )
        brief = SimpleNamespace(
            model_dump=lambda: {"executive_summary": "ok"},
        )

        with patch("apps.api.api.analyze_account", return_value=brief), patch(
            "apps.api.api.get_configured_model_name", return_value="test-model"
        ), patch(
            "apps.api.api.ingest_interaction_memory",
            side_effect=RuntimeError("provider unavailable"),
        ):
            response = api.analyze(request, auth)

        self.assertEqual(response["executive_summary"], "ok")
        self.assertEqual(response["model_used"], "test-model")


if __name__ == "__main__":
    unittest.main()