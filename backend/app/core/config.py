from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    upload_dir: str = "uploads"
    public_base_url: str = "http://localhost:8000"
    mail_encryption_key: Optional[str] = None
    cors_origins: list[str] = []

    # ── Super Admin credentials ──────────────────────────────────────────────
    superadmin_email: str = "superadmin@rems.local"
    superadmin_password: str = "SuperAdmin@123"


settings = Settings()
