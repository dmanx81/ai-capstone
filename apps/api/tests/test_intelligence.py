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
    response = client.post("/api/v1/ask", json={"account_id": meridian["id"], "question": "What did we promise them?"})
    assert "SSO" in response.json()["answer"]


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
    assert dash["high_risk"] or dash["attention"]


def test_billing_demo_upgrade(client):
    login(client, "isolated@example.com", "isolation-test")
    status = client.get("/api/v1/billing/status").json()
    assert status["plan"] == "free"
    upgraded = client.post("/api/v1/billing/demo-activate", json={"plan": "starter"})
    assert upgraded.status_code == 200
    assert upgraded.json()["plan"] == "starter"
