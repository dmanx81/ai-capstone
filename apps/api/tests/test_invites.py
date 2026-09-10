from tests.conftest import login


def test_invite_create_accept_and_roles(client):
    login(client, "demo@relia.app", "demo-password")
    created = client.post("/api/v1/invites", json={"email": "viewer.invite@example.com", "role": "viewer"})
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "pending"
    assert body["emailed"] is False
    token_url = body["invite_url"]
    token = token_url.rsplit("/", 1)[-1]

    listing = client.get("/api/v1/invites").json()
    assert any(row["email"] == "viewer.invite@example.com" for row in listing)

    preview = client.get(f"/api/v1/invites/preview/{token}")
    assert preview.status_code == 200
    assert preview.json()["organization"] == "Northstar Customer Success"

    client.post("/api/v1/auth/logout")
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": "viewer.invite@example.com",
            "password": "viewer-secret",
            "full_name": "Invited Viewer",
            "invite_token": token,
        },
    )
    assert registered.status_code == 201, registered.text
    assert registered.json()["role"] == "viewer"
    assert registered.json()["organization"]["name"] == "Northstar Customer Success"

    meridian = next(row for row in client.get("/api/v1/accounts").json() if row["name"] == "Meridian Health Systems")
    blocked = client.post(
        f"/api/v1/accounts/{meridian['id']}/timeline",
        json={"event_type": "note", "title": "Viewer should not write", "body": "Nope"},
    )
    assert blocked.status_code == 403

    invite_blocked = client.post("/api/v1/invites", json={"email": "someone@example.com", "role": "member"})
    assert invite_blocked.status_code == 403


def test_invite_resend_and_revoke(client):
    login(client, "demo@relia.app", "demo-password")
    created = client.post("/api/v1/invites", json={"email": "pending.member@example.com", "role": "member"})
    assert created.status_code == 201, created.text
    invite_id = created.json()["id"]
    first_url = created.json()["invite_url"]

    resent = client.post(f"/api/v1/invites/{invite_id}/resend")
    assert resent.status_code == 200
    assert resent.json()["invite_url"] != first_url

    revoked = client.post(f"/api/v1/invites/{invite_id}/revoke")
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"

    old_token = resent.json()["invite_url"].rsplit("/", 1)[-1]
    preview = client.get(f"/api/v1/invites/preview/{old_token}")
    assert preview.status_code in {404, 410}
