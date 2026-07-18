import json
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    jwt_secret_key: str = ""

    @property
    def database_url_fixed(self) -> str:
        """Return a SQLAlchemy-ready URL, converting postgres:// → postgresql+psycopg2://.
        Returns empty string if DATABASE_URL is not set (triggers SQLite fallback locally).
        """
        url = self.database_url
        if not url:
            return ""
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        return url

    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    upload_dir: str = "uploads"
    public_base_url: str = "http://localhost:8000"
    mail_encryption_key: Optional[str] = None
    cors_origins: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS env var into a list.
        Accepts: empty string, *, JSON array, or comma-separated URLs.
        """
        val = self.cors_origins
        if not val:
            return []
        if val.strip() == "*":
            return ["*"]
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
        return [o.strip() for o in val.split(",") if o.strip()]

    # ── Super Admin credentials ──────────────────────────────────────────────
    superadmin_email: str = "superadmin@system.local"
    superadmin_password: str = "SuperAdmin@123"

    # ── Cloudinary (external file storage) ───────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""


settings = Settings()
