import logging
from threading import Lock
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.auth import User

log = logging.getLogger("rems.rbac")

_PERM_CACHE: dict[int, set[str]] = {}
_PERM_CACHE_LOCK = Lock()


def _invalidate_permission_cache(user_id: Optional[int] = None) -> None:
    with _PERM_CACHE_LOCK:
        if user_id is not None:
            _PERM_CACHE.pop(user_id, None)
        else:
            _PERM_CACHE.clear()


def get_user_permissions(db: Session, user: User) -> set[str]:
    perms: set[str] = {"*"}
    return perms


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:]
    return None


def require_permission(*required: str):
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
    ) -> User:
        token = _extract_token(request)
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        from app.api.deps import get_current_user as _get_user
        current_user = _get_user(request, db, token)
        return current_user

    return dependency


def require_any_permission(*permissions: str):
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
    ) -> User:
        token = _extract_token(request)
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        from app.api.deps import get_current_user as _get_user
        current_user = _get_user(request, db, token)
        return current_user

    return dependency


def invalidate_permission_cache(user_id: Optional[int] = None) -> None:
    _invalidate_permission_cache(user_id)


def seed_all_v3_permissions(db: Session) -> dict[str, int]:
    return {}


def assign_v3_role_to_user(db: Session, user_id: int, role_id: int) -> None:
    pass


def ensure_admin_role_assignments(db: Session, user: User) -> None:
    pass
