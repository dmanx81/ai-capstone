from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT / ".env"), extra="ignore")

    app_name: str = "Relia"
    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 43181
    frontend_origin: str = "http://127.0.0.1:43180"
    cors_origins: str = "http://127.0.0.1:43180,http://localhost:43180"

    database_url: str = f"sqlite:///{DATA_DIR / 'relia.db'}"
    jwt_secret: str = "dev-only-change-me-relia-jwt-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    cookie_name: str = "relia_session"
    cookie_secure: bool = False
    bcrypt_rounds: int = 12

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_growth: str = ""
    stripe_success_url: str = "http://127.0.0.1:43180/settings/billing?checkout=success"
    stripe_cancel_url: str = "http://127.0.0.1:43180/settings/billing?checkout=cancel"

    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"

    seed_demo: bool = True
    embedding_dim: int = 1536
    upload_dir: str = str(DATA_DIR / "uploads")
    resend_api_key: str = ""
    invite_from_email: str = "Relia <noreply@relia.app>"
    llm_timeout_seconds: float = 30.0
    llm_retries: int = 2

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key)

    @property
    def llm_provider(self) -> str:
        if self.openai_api_key:
            return "openai"
        if self.anthropic_api_key:
            return "anthropic"
        return "grounded"

    @property
    def embedding_provider(self) -> str:
        if self.openai_api_key:
            return "openai"
        return "hashing"

    @property
    def should_seed(self) -> bool:
        return self.seed_demo and self.app_env != "production"

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and (self.supabase_jwt_secret or self.supabase_anon_key))

    def assert_production_safe(self) -> None:
        if self.app_env != "production":
            return
        forbidden_secrets = {
            "",
            "dev-only-change-me-relia-jwt-secret",
            "replace-with-a-long-random-secret",
            "test-secret-relia-please-use-32b+",
        }
        if self.jwt_secret.strip() in forbidden_secrets or len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be a unique value of at least 32 characters when APP_ENV=production")
        if self.database_url.startswith("sqlite"):
            raise RuntimeError("DATABASE_URL must be a Postgres URL when APP_ENV=production (do not use SQLite)")
        if not self.cookie_secure:
            raise RuntimeError("COOKIE_SECURE=true is required when APP_ENV=production")
        if self.supabase_service_role_key and not self.supabase_url:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is set but SUPABASE_URL is empty")
        if self.seed_demo:
            raise RuntimeError("SEED_DEMO must be false when APP_ENV=production")


@lru_cache
def get_settings() -> Settings:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return Settings()


PLANS: dict[str, dict[str, int | None | bool]] = {
    "free": {"max_accounts": 8, "ai_actions_monthly": 25, "docs": False},
    "starter": {"max_accounts": 50, "ai_actions_monthly": 200, "docs": True},
    "growth": {"max_accounts": None, "ai_actions_monthly": 2000, "docs": True},
}
