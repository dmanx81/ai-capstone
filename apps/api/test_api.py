import os
import unittest
from unittest.mock import patch


os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")

from apps.api import api  # noqa: E402


class ApiIngestionTests(unittest.TestCase):
    def test_direct_analyze_endpoint_is_gone_and_never_consumes_provider(self):
        request = api.AnalyzeRequest(
            customer_text="A sufficiently long interaction note for analysis.",
            account_id="00000000-0000-0000-0000-000000000001",
            interaction_id="00000000-0000-0000-0000-000000000002",
        )
        auth = api.AuthenticatedRequest(
            claims={"sub": "user-1"},
            bearer_token="caller.jwt.value",
        )

        with self.assertRaises(api.HTTPException) as ctx:
            api.analyze(request, auth)
        self.assertEqual(ctx.exception.status_code, 410)

    def test_repeated_direct_analyze_calls_cannot_affect_authoritative_usage(self):
        # Regression for the quota-bypass finding: since /analyze is gated
        # before it can reach the provider or any billing helper, calling it
        # any number of times has zero effect on billing.get_user_entitlement()'s
        # usage count -- there is nothing left in this path that could desync
        # from the authoritative interactions.analysis_status='complete' source.
        request = api.AnalyzeRequest(
            customer_text="A sufficiently long interaction note for analysis.",
            account_id="00000000-0000-0000-0000-000000000001",
            interaction_id="00000000-0000-0000-0000-000000000002",
        )
        auth = api.AuthenticatedRequest(
            claims={"sub": "user-1"},
            bearer_token="caller.jwt.value",
        )

        with patch(
            "apps.api.api.retrieve_relationship_context",
            side_effect=AssertionError("provider path must be unreachable"),
        ) as retrieve, patch(
            "apps.api.api.get_configured_model_name",
            side_effect=AssertionError("must be unreachable"),
        ):
            for _ in range(5):
                with self.assertRaises(api.HTTPException) as ctx:
                    api.analyze(request, auth)
                self.assertEqual(ctx.exception.status_code, 410)

        retrieve.assert_not_called()

    def test_ask_route_uses_same_rate_limit_as_analyze(self):
        api.request_timestamps.clear()
        api.RATE_LIMIT_REQUESTS = 1
        api.RATE_LIMIT_WINDOW_SECONDS = 60

        question = api.RelationshipQuestion(question="What happened with this relationship?")
        auth = api.AuthenticatedRequest(
            claims={"sub": "user-rate-limit"},
            bearer_token="caller.jwt.value",
        )

        with patch("apps.api.api.retrieve_relationship_context", return_value=[]):
            first = api.ask_relationship(
                "00000000-0000-0000-0000-000000000001",
                question,
                auth,
            )
            self.assertEqual(
                first.answer,
                "There is insufficient evidence in this relationship's recorded interactions to answer that question.",
            )

        with patch("apps.api.api.retrieve_relationship_context", return_value=[]):
            with self.assertRaises(api.HTTPException) as ctx:
                api.ask_relationship(
                    "00000000-0000-0000-0000-000000000001",
                    question,
                    auth,
                )

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Retry-After", ctx.exception.headers)

    def test_analyze_endpoint_body_only_contains_the_deprecation_gate(self):
        with open("apps/api/api.py", "r", encoding="utf-8") as api_file:
            source = api_file.read()
        analyze_body = source.split("def analyze(")[1].split("\n@app.")[0]
        self.assertIn("HTTP_410_GONE", analyze_body)
        self.assertNotIn("enforce_analysis_allowance_for_account", analyze_body)
        self.assertNotIn("analyze_account(", analyze_body)


if __name__ == "__main__":
    unittest.main()