import unittest

from apps.api.action_center import (
    build_action_update_payload,
    filter_open_actions,
    get_action_account_id,
    is_action_overdue,
    sort_action_rows,
)


class ActionCenterTests(unittest.TestCase):
    def test_open_only_portfolio_query(self):
        actions = [
            {"id": "a1", "status": "open", "due_date": "2026-08-25", "created_at": "2026-08-20T00:00:00Z"},
            {"id": "a2", "status": "resolved", "due_date": "2026-08-24", "created_at": "2026-08-19T00:00:00Z"},
        ]
        self.assertEqual([item["id"] for item in filter_open_actions(actions)], ["a1"])

    def test_completed_actions_are_excluded(self):
        actions = [
            {"id": "a1", "status": "resolved", "due_date": None, "created_at": "2026-08-20T00:00:00Z"},
            {"id": "a2", "status": "open", "due_date": "2026-08-30", "created_at": "2026-08-20T00:00:00Z"},
        ]
        self.assertEqual([item["id"] for item in filter_open_actions(actions)], ["a2"])

    def test_overdue_action_sorts_first(self):
        now = "2026-08-21T00:00:00Z"
        actions = [
            {"id": "later", "status": "open", "due_date": "2026-08-30", "created_at": "2026-08-20T00:00:00Z"},
            {"id": "overdue", "status": "open", "due_date": "2026-08-19", "created_at": "2026-08-10T00:00:00Z"},
        ]
        self.assertEqual([item["id"] for item in sort_action_rows(actions, now)], ["overdue", "later"])

    def test_due_within_7_days_sorts_before_later_future_actions(self):
        now = "2026-08-21T00:00:00Z"
        actions = [
            {"id": "future", "status": "open", "due_date": "2026-09-10", "created_at": "2026-08-01T00:00:00Z"},
            {"id": "soon", "status": "open", "due_date": "2026-08-25", "created_at": "2026-08-05T00:00:00Z"},
        ]
        self.assertEqual([item["id"] for item in sort_action_rows(actions, now)], ["soon", "future"])

    def test_no_due_date_action_is_after_scheduled_work(self):
        now = "2026-08-21T00:00:00Z"
        actions = [
            {"id": "scheduled", "status": "open", "due_date": "2026-08-27", "created_at": "2026-08-10T00:00:00Z"},
            {"id": "no_due", "status": "open", "due_date": None, "created_at": "2026-08-12T00:00:00Z"},
        ]
        self.assertEqual([item["id"] for item in sort_action_rows(actions, now)], ["scheduled", "no_due"])

    def test_owner_update_payload_keeps_text_and_preserves_payload_shape(self):
        payload = build_action_update_payload(owner="Dritan")
        self.assertEqual(payload["owner"], "Dritan")
        self.assertNotIn("evidence", payload)
        self.assertNotIn("detail", payload)

    def test_due_date_can_be_set_and_cleared(self):
        set_payload = build_action_update_payload(due_date="2026-08-25")
        self.assertEqual(set_payload["due_date"], "2026-08-25")

        clear_payload = build_action_update_payload(clear_due_date=True)
        self.assertEqual(clear_payload["due_date"], None)

    def test_resolved_status_sets_resolved_at(self):
        payload = build_action_update_payload(status="resolved", resolved_at="2026-08-21T00:00:00Z")
        self.assertEqual(payload["status"], "resolved")
        self.assertEqual(payload["resolved_at"], "2026-08-21T00:00:00Z")

    def test_reopen_clears_resolved_at(self):
        payload = build_action_update_payload(status="open", resolved_at=None)
        self.assertEqual(payload["status"], "open")
        self.assertEqual(payload["resolved_at"], None)

    def test_action_scope_uses_persisted_account_id_for_revalidation(self):
        item = {"id": "a1", "account_id": "acct-123", "kind": "action"}
        self.assertEqual(get_action_account_id(item), "acct-123")

    def test_overdue_signal_disappears_when_action_is_resolved(self):
        action = {"status": "resolved", "due_date": "2026-08-19", "created_at": "2026-08-10T00:00:00Z"}
        self.assertFalse(is_action_overdue(action, "2026-08-21T00:00:00Z"))


if __name__ == "__main__":
    unittest.main()
