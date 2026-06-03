import json
from typing import Any, List, Optional

from pydantic import field_validator
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
    cors_origins: List[str] = []

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> Any:
        if not v:
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            if not v.strip():
                return []
            if v.strip() == "*":
                return ["*"]
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                pass
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ── Super Admin credentials ──────────────────────────────────────────────
    superadmin_email: str = "superadmin@rems.local"
    superadmin_password: str = "SuperAdmin@123"


settings = Settings()
