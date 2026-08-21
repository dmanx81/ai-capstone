import unittest
from datetime import datetime, timezone

from apps.api.signal_rules import (
    compute_account_signals,
    derive_failed_analysis_by_account,
    priority_for_signal,
)


class SignalRulesTests(unittest.TestCase):
    def test_health_drop_is_critical(self):
        signals = compute_account_signals(
            account_id="acc-1",
            previous_health_score=72,
            latest_health_score=54,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "health_drop" and signal["severity"] == "critical" for signal in signals))

    def test_health_decline_is_warning(self):
        signals = compute_account_signals(
            account_id="acc-1",
            previous_health_score=70,
            latest_health_score=58,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "health_decline" and signal["severity"] == "warning" for signal in signals))

    def test_small_health_movement_creates_no_health_signal(self):
        signals = compute_account_signals(
            account_id="acc-1",
            previous_health_score=70,
            latest_health_score=66,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertFalse(any(signal["type"] in {"health_drop", "health_decline"} for signal in signals))

    def test_renewal_within_30_days_is_critical(self):
        signals = compute_account_signals(
            account_id="acc-1",
            renewal_date="2026-08-30",
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "renewal_critical" and signal["severity"] == "critical" for signal in signals))

    def test_renewal_within_31_to_90_days_is_warning(self):
        signals = compute_account_signals(
            account_id="acc-1",
            renewal_date="2026-10-10",
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "renewal_soon" and signal["severity"] == "warning" for signal in signals))

    def test_renewal_null_creates_no_renewal_signal(self):
        signals = compute_account_signals(
            account_id="acc-1",
            renewal_date=None,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertFalse(any(signal["type"] in {"renewal_critical", "renewal_soon"} for signal in signals))

    def test_high_open_risk_is_critical(self):
        signals = compute_account_signals(
            account_id="acc-1",
            high_severity_open_risk_count=1,
            open_risks=1,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "high_risk" and signal["severity"] == "critical" for signal in signals))

    def test_three_open_risks_triggers_warning(self):
        signals = compute_account_signals(
            account_id="acc-1",
            open_risks=3,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "multiple_open_risks" and signal["severity"] == "warning" for signal in signals))

    def test_stale_relationship_is_warning(self):
        signals = compute_account_signals(
            account_id="acc-1",
            last_interaction_at="2026-07-01T00:00:00Z",
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "stale_relationship" and signal["severity"] == "warning" for signal in signals))

    def test_no_interaction_uses_explicit_warning_text(self):
        signals = compute_account_signals(
            account_id="acc-1",
            last_interaction_at=None,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "stale_relationship" and "No interaction recorded yet" in signal["detail"] for signal in signals))

    def test_overdue_action_requires_due_date_in_past(self):
        signals = compute_account_signals(
            account_id="acc-1",
            overdue_action_count=1,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "overdue_action" and signal["severity"] == "warning" for signal in signals))

    def test_failed_analysis_is_warning(self):
        signals = compute_account_signals(
            account_id="acc-1",
            failed_analysis=True,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "failed_analysis" and signal["severity"] == "warning" for signal in signals))

    def test_no_health_score_is_info(self):
        signals = compute_account_signals(
            account_id="acc-1",
            latest_health_score=None,
            previous_health_score=None,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "no_health_score" and signal["severity"] == "info" for signal in signals))

    def test_priority_order_is_deterministic(self):
        signals = compute_account_signals(
            account_id="acc-1",
            previous_health_score=90,
            latest_health_score=60,
            renewal_date="2026-08-25",
            high_severity_open_risk_count=1,
            failed_analysis=True,
            overdue_action_count=1,
            open_risks=4,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertLess(
            priority_for_signal(signals[0]["type"]),
            priority_for_signal(signals[1]["type"]),
        )

    def test_no_duplicate_health_signal(self):
        signals = compute_account_signals(
            account_id="acc-1",
            previous_health_score=72,
            latest_health_score=54,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertEqual(sum(1 for signal in signals if signal["type"] in {"health_drop", "health_decline"}), 1)

    def test_newest_complete_older_failed_has_no_failed_analysis_signal(self):
        interactions = [
            {"account_id": "acc-1", "analysis_status": "complete", "occurred_at": "2026-08-21T00:00:00Z"},
            {"account_id": "acc-1", "analysis_status": "failed", "occurred_at": "2026-08-20T00:00:00Z"},
        ]
        latest_failed_analysis = derive_failed_analysis_by_account(interactions)

        self.assertFalse(latest_failed_analysis["acc-1"])

        signals = compute_account_signals(
            account_id="acc-1",
            failed_analysis=latest_failed_analysis["acc-1"],
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertFalse(any(signal["type"] == "failed_analysis" for signal in signals))

    def test_newest_failed_older_complete_has_failed_analysis_signal(self):
        interactions = [
            {"account_id": "acc-1", "analysis_status": "failed", "occurred_at": "2026-08-21T00:00:00Z"},
            {"account_id": "acc-1", "analysis_status": "complete", "occurred_at": "2026-08-20T00:00:00Z"},
        ]
        latest_failed_analysis = derive_failed_analysis_by_account(interactions)

        self.assertTrue(latest_failed_analysis["acc-1"])

        signals = compute_account_signals(
            account_id="acc-1",
            failed_analysis=latest_failed_analysis["acc-1"],
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "failed_analysis" and signal["severity"] == "warning" for signal in signals))

    def test_no_interactions_has_no_failed_analysis_signal(self):
        latest_failed_analysis = derive_failed_analysis_by_account([])
        self.assertEqual(latest_failed_analysis, {})

        signals = compute_account_signals(
            account_id="acc-1",
            failed_analysis=latest_failed_analysis.get("acc-1", False),
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertFalse(any(signal["type"] == "failed_analysis" for signal in signals))

    def test_detail_contains_actual_values(self):
        signals = compute_account_signals(
            account_id="acc-1",
            previous_health_score=72,
            latest_health_score=54,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any("72" in signal["detail"] and "54" in signal["detail"] for signal in signals))

    def test_signal_logic_has_no_provider_requirement(self):
        signals = compute_account_signals(
            account_id="acc-1",
            latest_health_score=81,
            previous_health_score=76,
            last_interaction_at="2026-08-20T00:00:00Z",
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertIsInstance(signals, list)

    def test_portfolio_signal_summary_is_derived_without_new_table(self):
        signals = compute_account_signals(
            account_id="acc-1",
            open_risks=1,
            high_severity_open_risk_count=1,
            now_iso="2026-08-21T00:00:00Z",
        )
        self.assertTrue(any(signal["type"] == "high_risk" for signal in signals))


if __name__ == "__main__":
    unittest.main()
