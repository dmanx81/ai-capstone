import pytest

from app.config import Settings
from app.seed import seed_demo


def _prod(**overrides: object) -> Settings:
    values = {
        "app_env": "production",
        "jwt_secret": "production-jwt-secret-value-32chars+",
        "database_url": "postgresql+psycopg://relia:relia@127.0.0.1:5432/relia",
        "cookie_secure": True,
        "seed_demo": False,
        "supabase_url": "",
        "supabase_service_role_key": "",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_accepts_valid_settings():
    _prod().assert_production_safe()


def test_production_rejects_sample_jwt():
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        _prod(jwt_secret="replace-with-a-long-random-secret").assert_production_safe()


def test_production_rejects_sqlite():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        _prod(database_url="sqlite:///tmp/relia.db").assert_production_safe()


def test_production_requires_secure_cookie():
    with pytest.raises(RuntimeError, match="COOKIE_SECURE"):
        _prod(cookie_secure=False).assert_production_safe()


def test_production_rejects_seed_flag():
    with pytest.raises(RuntimeError, match="SEED_DEMO"):
        _prod(seed_demo=True).assert_production_safe()


def test_production_rejects_service_role_without_url():
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        _prod(supabase_service_role_key="service-role-not-for-browser").assert_production_safe()


def test_seed_refuses_production(monkeypatch):
    settings = _prod()
    monkeypatch.setattr("app.seed.get_settings", lambda: settings)
    with pytest.raises(RuntimeError, match="Refusing to seed"):
        seed_demo(None)  # type: ignore[arg-type]
