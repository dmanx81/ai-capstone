from tests.conftest import login


def test_demo_accounts_seeded(client):
    login(client, "demo@relia.app", "demo-password")
    accounts = client.get("/api/v1/accounts").json()
    names = {row["name"] for row in accounts}
    assert "Meridian Health Systems" in names
    assert "Canvas Retail Group" in names
    assert "Secret Customer Co" not in names


def test_org_isolation(client):
    login(client, "demo@relia.app", "demo-password")
    demo_ids = {row["id"] for row in client.get("/api/v1/accounts").json()}
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")

    login(client, "isolated@example.com", "isolation-test")
    isolated = client.get("/api/v1/accounts").json()
    isolated_names = {row["name"] for row in isolated}
    assert isolated_names == {"Secret Customer Co"}
    hidden = client.get(f"/api/v1/accounts/{meridian['id']}")
    assert hidden.status_code == 404
    for account_id in demo_ids:
        assert client.get(f"/api/v1/accounts/{account_id}").status_code == 404


def test_create_account_and_contact(client):
    login(client, "demo@relia.app", "demo-password")
    created = client.post(
        "/api/v1/accounts",
        json={
            "name": "Pioneer Biotech",
            "domain": "pioneerbiotech.example",
            "industry": "Life sciences",
            "lifecycle": "onboarding",
            "arr": 88000,
            "tags": ["new"],
            "description": "Just closed. Need a kickoff.",
        },
    )
    assert created.status_code == 201, created.text
    account_id = created.json()["id"]
    contact = client.post(
        f"/api/v1/accounts/{account_id}/contacts",
        json={
            "name": "Amina Farah",
            "title": "VP Ops",
            "email": "amina@pioneerbiotech.example",
            "stakeholder_role": "champion",
            "influence": "high",
            "sentiment": "positive",
        },
    )
    assert contact.status_code == 201, contact.text
    detail = client.get(f"/api/v1/accounts/{account_id}").json()
    assert detail["account"]["name"] == "Pioneer Biotech"
    assert len(detail["contacts"]) == 1
    assert detail["contacts"][0]["stakeholder_role"] == "champion"
