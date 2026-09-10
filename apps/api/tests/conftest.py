from __future__ import annotations

import os
from pathlib import Path

TEST_DB = Path("/tmp/relia-test.db")
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": f"sqlite:///{TEST_DB}",
        "JWT_SECRET": "test-secret-relia-please-use-32b+",
        "SEED_DEMO": "true",
        "CORS_ORIGINS": "http://testserver",
        "FRONTEND_ORIGIN": "http://testserver",
    }
)

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, email: str, password: str) -> TestClient:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return client
