def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_register_login_and_me(client):
    payload = {
        "email": "new.user@example.com",
        "password": "supersecret",
        "full_name": "New User",
        "organization_name": "New Workspace",
    }
    created = client.post("/api/v1/auth/register", json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["user"]["email"] == "new.user@example.com"
    assert body["organization"]["name"] == "New Workspace"
    assert body["role"] == "owner"

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["full_name"] == "New User"

    client.post("/api/v1/auth/logout")
    logged_out = client.get("/api/v1/auth/me")
    assert logged_out.status_code == 401


def test_demo_login(client):
    response = client.post("/api/v1/auth/login", json={"email": "demo@relia.app", "password": "demo-password"})
    assert response.status_code == 200
    assert response.json()["organization"]["name"] == "Northstar Customer Success"
