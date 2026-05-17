"""JWT creation / verification with multi-tenant claims."""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# ── Password helpers ──────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        digest = hashed.encode("utf-8") if isinstance(hashed, str) else hashed
        return bcrypt.checkpw(plain.encode("utf-8"), digest)
    except (ValueError, TypeError):
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(
    subject: str,
    company_id: Optional[int] = None,
    is_super_admin: bool = False,
) -> str:
    """
    Create a signed JWT.

    Payload:
        sub            – user email (legacy compat)
        company_id     – tenant identifier (None for super-admins)
        is_super_admin – bool flag
        exp            – expiry
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload: dict = {
        "sub": subject,
        "company_id": company_id,
        "is_super_admin": is_super_admin,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT.

    Returns the full payload dict on success, None on failure.
    Callers should read payload["sub"] for the email.
    """
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None
