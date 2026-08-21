import unittest

from apps.api import analyzer, api


class Session10HardeningTests(unittest.TestCase):
    def test_structured_logging_omits_customer_and_jwt_values(self):
        fields = api.build_request_log_fields(
            request_id="req-123",
            path="/analyze",
            method="POST",
            account_id="00000000-0000-0000-0000-000000000001",
            interaction_id="00000000-0000-0000-0000-000000000002",
            user_id="user-42",
            duration_ms=12,
            status_code=200,
            request_meta={"model_used": "test-model"},
            request_body={"customer_text": "raw customer note", "jwt": "secret.jwt.value"},
        )

        self.assertEqual(fields["request_id"], "req-123")
        self.assertNotIn("raw customer note", str(fields))
        self.assertNotIn("secret.jwt.value", str(fields))
        self.assertEqual(fields["status_code"], 200)

    def test_llm_timeout_and_retry_policy_is_bounded(self):
        self.assertEqual(analyzer.get_llm_timeout_seconds(), 30)
        self.assertEqual(analyzer.get_llm_max_retries(), 2)

    def test_model_fallback_list_tracks_primary_and_secondary(self):
        primary = analyzer.get_configured_model_name()
        fallback = analyzer.get_fallback_model_name()
        expected = [primary]
        if fallback:
            expected.append(fallback)
        self.assertEqual(analyzer.get_model_candidates(), expected)

    def test_cors_is_not_wildcard_when_credentials_enabled(self):
        self.assertFalse(api.cors_allows_credentials_with_wildcard())


if __name__ == "__main__":
    unittest.main()
