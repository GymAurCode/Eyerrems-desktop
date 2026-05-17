"""
Credential encryption utilities — Fernet symmetric encryption.

Key resolution order (first non-empty value wins):
  1. settings.mail_encryption_key  (MAIL_ENCRYPTION_KEY in .env)
  2. settings.jwt_secret_key       (JWT_SECRET_KEY in .env)
  3. os.environ fallbacks          (in case settings object is stale)

This triple-fallback ensures the module works even if the server process
was started before the .env was written, or if pydantic_settings hasn't
propagated the values yet.
"""
import base64
import hashlib
import os

from cryptography.fernet import Fernet


def _raw_key() -> str:
    """Return the first available key string, trying every source."""
    # 1. Try the already-loaded settings object (normal path)
    try:
        from app.core.config import settings as _s
        v = (getattr(_s, "mail_encryption_key", None) or "").strip()
        if v:
            return v
        v = (getattr(_s, "jwt_secret_key", None) or "").strip()
        if v:
            return v
    except Exception:
        pass

    # 2. Fall back to os.environ (covers cases where settings failed to load)
    for var in ("MAIL_ENCRYPTION_KEY", "JWT_SECRET_KEY"):
        v = os.environ.get(var, "").strip()
        if v:
            return v

    # 3. Last resort: try reading .env directly
    for candidate in (".env", "backend/.env"):
        try:
            with open(candidate) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("#") or "=" not in line:
                        continue
                    k, _, v = line.partition("=")
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k in ("MAIL_ENCRYPTION_KEY", "JWT_SECRET_KEY") and v:
                        return v
        except OSError:
            pass

    raise RuntimeError(
        "No encryption key found. Set MAIL_ENCRYPTION_KEY or JWT_SECRET_KEY in backend/.env"
    )


def _get_fernet() -> Fernet:
    key = _raw_key()
    digest = hashlib.sha256(key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_password(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_password(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()
