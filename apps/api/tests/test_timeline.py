from tests.conftest import login


def _meridian(client):
    login(client, "demo@relia.app", "demo-password")
    return next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")


def test_timeline_filter_and_create(client):
    account = _meridian(client)
    listing = client.get(f"/api/v1/accounts/{account['id']}/timeline").json()
    assert len(listing) >= 3
    meetings = client.get(f"/api/v1/accounts/{account['id']}/timeline", params={"event_type": "meeting"}).json()
    assert meetings and all(row["event_type"] == "meeting" for row in meetings)
    search = client.get(f"/api/v1/accounts/{account['id']}/timeline", params={"q": "SSO"}).json()
    assert search

    created = client.post(
        f"/api/v1/accounts/{account['id']}/timeline",
        json={
            "event_type": "note",
            "title": "Prep for Thursday steering",
            "body": "Bring the SSO status and expansion deck.",
            "evidence_source": "AM notebook",
            "evidence_excerpt": "Thursday steering needs SSO status.",
        },
    )
    assert created.status_code == 201, created.text
    event_id = created.json()["id"]
    updated = client.patch(f"/api/v1/timeline/{event_id}", json={"title": "Prep for Friday steering"})
    assert updated.status_code == 200
    assert updated.json()["title"] == "Prep for Friday steering"
    assert updated.json()["editable"] is True

    deleted = client.delete(f"/api/v1/timeline/{event_id}")
    assert deleted.status_code == 204


def test_system_timeline_events_are_not_editable(client):
    account = _meridian(client)
    listing = client.get(f"/api/v1/accounts/{account['id']}/timeline").json()
    managed = next(row for row in listing if row["event_type"] in {"risk", "commitment", "ai_insight", "task"})
    assert managed["editable"] is False
    patched = client.patch(f"/api/v1/timeline/{managed['id']}", json={"title": "Should not stick"})
    assert patched.status_code == 400
    removed = client.delete(f"/api/v1/timeline/{managed['id']}")
    assert removed.status_code == 400


def test_risks_opportunities_commitments(client):
    account = _meridian(client)
    risks = client.get(f"/api/v1/accounts/{account['id']}/risks").json()
    assert any("Champion" in row["title"] for row in risks)
    created = client.post(
        f"/api/v1/accounts/{account['id']}/risks",
        json={
            "title": "Budget freeze rumor",
            "description": "Elena asked whether Q4 software spend is paused. Unconfirmed.",
            "severity": "low",
            "confidence": 0.4,
            "evidence": [{"source_type": "note", "excerpt": "Unconfirmed budget freeze question from procurement."}],
        },
    )
    assert created.status_code == 201
    assert created.json()["evidence"]
