from tests.conftest import login


def _org_and_account(client, email: str, password: str, account_name: str) -> tuple[str, str]:
    login(client, email, password)
    me = client.get("/api/v1/auth/me").json()
    org_id = me["organization"]["id"]
    account = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == account_name)
    return org_id, account["id"]


def test_org_a_can_access_own_data(client):
    login(client, "demo@relia.app", "demo-password")
    accounts = client.get("/api/v1/accounts").json()
    meridian = next(row for row in accounts if row["name"] == "Meridian Health Systems")
    detail = client.get(f"/api/v1/accounts/{meridian['id']}")
    assert detail.status_code == 200
    assert detail.json()["account"]["name"] == "Meridian Health Systems"
    timeline = client.get(f"/api/v1/accounts/{meridian['id']}/timeline")
    assert timeline.status_code == 200
    assert timeline.json()
    risks = client.get(f"/api/v1/accounts/{meridian['id']}/risks")
    assert risks.status_code == 200
    assert risks.json()


def test_org_a_cannot_read_org_b_by_id(client):
    _, meridian_id = _org_and_account(client, "demo@relia.app", "demo-password", "Meridian Health Systems")
    login(client, "isolated@example.com", "isolation-test")
    assert client.get(f"/api/v1/accounts/{meridian_id}").status_code == 404
    assert client.get(f"/api/v1/accounts/{meridian_id}/timeline").status_code == 404
    assert client.get(f"/api/v1/accounts/{meridian_id}/risks").status_code == 404
    assert client.get(f"/api/v1/accounts/{meridian_id}/contacts").status_code == 404
    assert client.get(f"/api/v1/accounts/{meridian_id}/tasks").status_code == 404
    names = {row["name"] for row in client.get("/api/v1/accounts").json()}
    assert names == {"Secret Customer Co"}
    assert "Meridian Health Systems" not in names


def test_org_a_cannot_insert_into_org_b(client):
    _, meridian_id = _org_and_account(client, "demo@relia.app", "demo-password", "Meridian Health Systems")
    login(client, "isolated@example.com", "isolation-test")
    created = client.post(
        f"/api/v1/accounts/{meridian_id}/contacts",
        json={"name": "Forged Contact", "stakeholder_role": "blocker"},
    )
    assert created.status_code == 404
    risk = client.post(
        f"/api/v1/accounts/{meridian_id}/risks",
        json={"title": "Forged risk", "description": "Should not land in Northstar", "severity": "low"},
    )
    assert risk.status_code == 404
    note = client.post(
        f"/api/v1/accounts/{meridian_id}/timeline",
        json={"event_type": "note", "title": "Forged note", "body": "cross-tenant"},
    )
    assert note.status_code == 404


def test_org_a_cannot_update_or_delete_org_b(client):
    login(client, "demo@relia.app", "demo-password")
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    meridian_id = meridian["id"]
    event = client.get(f"/api/v1/accounts/{meridian_id}/timeline").json()[0]
    login(client, "isolated@example.com", "isolation-test")
    patched = client.patch(f"/api/v1/accounts/{meridian_id}", json={"name": "Hijacked Meridian"})
    assert patched.status_code == 404
    deleted = client.delete(f"/api/v1/accounts/{meridian_id}")
    assert deleted.status_code in {403, 404}
    timeline_patch = client.patch(f"/api/v1/timeline/{event['id']}", json={"title": "Hijacked"})
    assert timeline_patch.status_code == 404


def test_spoofed_organization_header_is_rejected(client):
    northstar_id, _ = _org_and_account(client, "demo@relia.app", "demo-password", "Meridian Health Systems")
    login(client, "isolated@example.com", "isolation-test")
    response = client.get("/api/v1/accounts", headers={"X-Organization-Id": northstar_id})
    assert response.status_code == 403
    dashboard = client.get("/api/v1/dashboard", headers={"X-Organization-Id": northstar_id})
    assert dashboard.status_code == 403


def test_rag_does_not_return_foreign_chunks(client):
    _, meridian_id = _org_and_account(client, "demo@relia.app", "demo-password", "Meridian Health Systems")
    login(client, "isolated@example.com", "isolation-test")
    secret = client.get("/api/v1/accounts").json()[0]
    leaked = client.post("/api/v1/ask", json={"account_id": meridian_id, "question": "What are the main risks?"})
    assert leaked.status_code == 404
    own = client.post(
        "/api/v1/ask",
        json={"account_id": secret["id"], "question": "What is happening with Meridian Health Systems SSO?"},
    )
    assert own.status_code == 200
    body = own.json()["answer"].lower()
    joined = body + " ".join(item.get("excerpt", "") for item in own.json().get("evidence", [])).lower()
    assert "priya" not in joined
    assert "secret customer" in body or "no stored evidence" in body or own.json()["grounded"] is True


def test_invite_token_cannot_cross_tenants(client):
    login(client, "demo@relia.app", "demo-password")
    created = client.post("/api/v1/invites", json={"email": "other.person@example.com", "role": "member"})
    assert created.status_code == 201, created.text
    token = created.json()["invite_url"].rsplit("/", 1)[-1]
    login(client, "isolated@example.com", "isolation-test")
    listing = client.get("/api/v1/invites")
    assert listing.status_code == 200
    assert all(row["email"] != "other.person@example.com" for row in listing.json())
    accept = client.post(f"/api/v1/invites/accept/{token}")
    assert accept.status_code == 403
    names = {row["name"] for row in client.get("/api/v1/accounts").json()}
    assert names == {"Secret Customer Co"}


def test_viewer_cannot_write_or_invite(client):
    login(client, "demo@relia.app", "demo-password")
    created = client.post("/api/v1/invites", json={"email": "phase1.viewer@example.com", "role": "viewer"})
    token = created.json()["invite_url"].rsplit("/", 1)[-1]
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    client.post("/api/v1/auth/logout")
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": "phase1.viewer@example.com",
            "password": "viewer-secret",
            "full_name": "Phase1 Viewer",
            "invite_token": token,
        },
    )
    assert registered.status_code == 201, registered.text
    assert registered.json()["role"] == "viewer"
    assert client.post(
        f"/api/v1/accounts/{meridian['id']}/timeline",
        json={"event_type": "note", "title": "viewer write", "body": "nope"},
    ).status_code == 403
    assert client.post("/api/v1/accounts", json={"name": "Viewer Account"}).status_code == 403
    assert client.post("/api/v1/invites", json={"email": "x@example.com", "role": "member"}).status_code == 403
    assert client.get(f"/api/v1/accounts/{meridian['id']}").status_code == 200


def test_member_can_write_but_cannot_invite(client):
    login(client, "demo@relia.app", "demo-password")
    created = client.post("/api/v1/invites", json={"email": "phase1.member@example.com", "role": "member"})
    token = created.json()["invite_url"].rsplit("/", 1)[-1]
    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    client.post("/api/v1/auth/logout")
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": "phase1.member@example.com",
            "password": "member-secret",
            "full_name": "Phase1 Member",
            "invite_token": token,
        },
    )
    assert registered.status_code == 201, registered.text
    assert registered.json()["role"] == "member"
    note = client.post(
        f"/api/v1/accounts/{meridian['id']}/timeline",
        json={"event_type": "note", "title": "Member note", "body": "Allowed write"},
    )
    assert note.status_code == 201, note.text
    assert client.post("/api/v1/invites", json={"email": "x2@example.com", "role": "member"}).status_code == 403


def test_session_payload_omits_secrets(client):
    login(client, "demo@relia.app", "demo-password")
    me = client.get("/api/v1/auth/me").json()
    blob = str(me)
    assert "password_hash" not in blob
    assert "token_hash" not in blob
    assert "stripe_customer_id" not in me["organization"]
    assert "stripe_subscription_id" not in me["organization"]
    assert "demo-password" not in blob
