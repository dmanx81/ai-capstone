from tests.conftest import login


def test_brief_is_grounded(client):
    login(client, "demo@relia.app", "demo-password")
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    response = client.post(f"/api/v1/accounts/{meridian['id']}/brief")
    assert response.status_code == 200, response.text
    brief = response.json()["content"]
    assert "Meridian" in brief["executive_summary"]
    assert brief["relationship_health"]["score"] >= 0
    assert any("SSO" in r["title"] or "Champion" in r["title"] for r in brief["risks"])
    assert brief["disclaimer"]
    joined = str(brief)
    assert "invent" in brief["disclaimer"].lower() or "stored" in brief["disclaimer"].lower()
    assert "Totally Fake Competitor" not in joined


def test_rag_risk_question(client):
    login(client, "demo@relia.app", "demo-password")
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    response = client.post("/api/v1/ask", json={"account_id": meridian["id"], "question": "What are the main risks with this customer?"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["grounded"] is True
    assert "risk" in body["answer"].lower() or "Champion" in body["answer"]
    assert body["evidence"]


def test_rag_promises(client):
    login(client, "demo@relia.app", "demo-password")
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    response = client.post(
        "/api/v1/ask",
        json={"account_id": meridian["id"], "question": "What did we promise Meridian Health Systems?"},
    )
    answer = response.json()["answer"]
    assert "SSO" in answer
    assert response.json()["evidence"]
    assert response.json()["grounded"] is True


def test_rag_meridian_operating_questions(client):
    login(client, "demo@relia.app", "demo-password")
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")

    risks = client.post("/api/v1/ask", json={"account_id": meridian["id"], "question": "What are their biggest risks?"})
    assert risks.status_code == 200
    risk_answer = risks.json()["answer"].lower()
    assert "risk" in risk_answer
    assert "champion" in risk_answer or "sso" in risk_answer
    assert risks.json()["evidence"]

    recent = client.post("/api/v1/ask", json={"account_id": meridian["id"], "question": "What changed recently?"})
    assert recent.status_code == 200
    assert recent.json()["answer"]
    assert "No stored evidence" not in recent.json()["answer"]

    champion = client.post("/api/v1/ask", json={"account_id": meridian["id"], "question": "Who is the champion?"})
    assert "Priya" in champion.json()["answer"]

    meeting = client.post(
        "/api/v1/ask",
        json={"account_id": meridian["id"], "question": "What should I discuss in the next meeting?"},
    )
    assert meeting.status_code == 200
    assert meeting.json()["answer"]
    assert meeting.json()["evidence"]


def test_reindex_rebuilds_chunks(client):
    login(client, "demo@relia.app", "demo-password")
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    result = client.post(f"/api/v1/accounts/{meridian['id']}/reindex")
    assert result.status_code == 200, result.text
    assert result.json()["chunks"] > 0


def test_agent_requires_confirm_to_write(client):
    login(client, "demo@relia.app", "demo-password")
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    preview = client.post(
        f"/api/v1/accounts/{meridian['id']}/agents",
        json={"action": "suggest_next_best_actions", "confirm": False, "apply_writes": False},
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["status"] == "preview"
    assert preview.json()["output_payload"]["proposed_writes"]
    before = client.get(f"/api/v1/accounts/{meridian['id']}/tasks").json()
    applied = client.post(
        f"/api/v1/accounts/{meridian['id']}/agents",
        json={"action": "suggest_next_best_actions", "confirm": True, "apply_writes": True},
    )
    assert applied.json()["status"] == "applied"
    after = client.get(f"/api/v1/accounts/{meridian['id']}/tasks").json()
    assert len(after) > len(before)


def test_dashboard(client):
    login(client, "demo@relia.app", "demo-password")
    dash = client.get("/api/v1/dashboard").json()
    assert dash["summary"]["accounts"] >= 7
    assert dash["health_distribution"]
    assert dash["focus"]
    assert dash["today"]
    assert dash["high_risk"] or dash["attention"]


def test_billing_demo_upgrade(client):
    login(client, "isolated@example.com", "isolation-test")
    status = client.get("/api/v1/billing/status").json()
    assert status["plan"] == "free"
    upgraded = client.post("/api/v1/billing/demo-activate", json={"plan": "starter"})
    assert upgraded.status_code == 200
    assert upgraded.json()["plan"] == "starter"


def test_stripe_webhook_ignored_without_keys(client):
    response = client.post("/api/v1/billing/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=dead"})
    assert response.status_code == 200
    assert response.json()["ignored"] is True


def test_stripe_webhook_rejects_invalid_signature(client, monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_relia")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_relia_test")
    response = client.post(
        "/api/v1/billing/webhook",
        content=b'{"id":"evt_test"}',
        headers={"stripe-signature": "t=1,v1=not-a-real-signature"},
    )
    assert response.status_code == 400
    assert "Invalid Stripe signature" in response.text
