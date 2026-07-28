import logging
from threading import Lock
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from sqlalchemy import text as sa_text

from app.core.database import get_db
from app.models.auth import User
from app.models.rbac import Role, RolePermission

log = logging.getLogger("rems.rbac")

_PERM_CACHE: dict[int, dict[str, dict[str, dict[str, bool]]]] = {}
_PERM_CACHE_LOCK = Lock()

_MISSING = object()
_LOAD_ERROR = object()


def _invalidate_permission_cache(user_id: Optional[int] = None) -> None:
    with _PERM_CACHE_LOCK:
        if user_id is not None:
            _PERM_CACHE.pop(user_id, None)
        else:
            _PERM_CACHE.clear()


def get_user_permissions(db: Session, user: User) -> set[str]:
    """Return a set of '<module>:<tab>:<action>' permission strings for the user."""
    if user.is_super_admin:
        return {"*"}

    perms = _get_cached_permissions(user.id)
    if perms is None or perms is _LOAD_ERROR:
        try:
            perms = _load_and_cache_permissions(db, user)
        except Exception:
            return set()

    if perms and perms is not _LOAD_ERROR and _perm_full_access(perms):
        return {"*"}

    if perms and perms is not _LOAD_ERROR:
        result = set()
        for module_key, tabs in perms.items():
            for tab_key, actions in tabs.items():
                for action, granted in actions.items():
                    if granted:
                        result.add(f"{module_key}:{tab_key}:{action}")
                        result.add(f"{module_key}:*:{action}")
            for action in ("view", "add", "edit", "delete"):
                if any(tabs[t].get(action, False) for t in tabs):
                    result.add(f"{module_key}:*:{action}")
        return result

    return set()


def _get_cached_permissions(user_id: int) -> Optional[dict]:
    with _PERM_CACHE_LOCK:
        val = _PERM_CACHE.get(user_id, _MISSING)
        if val is _MISSING:
            return None
        if val is _LOAD_ERROR:
            return _LOAD_ERROR
        return val


def _load_and_cache_permissions(db: Session, user: User) -> dict:
    role_id = None
    if user.role_id:
        role_id = user.role_id
    elif not user.is_super_admin:
        try:
            row = db.execute(
                "SELECT role_id FROM rbac3_user_roles WHERE user_id = :uid LIMIT 1",
                {"uid": user.id},
            ).fetchone()
            if row:
                role_id = row[0]
        except Exception:
            pass

    permissions_map: dict[str, dict[str, dict[str, bool]]] = {}

    if role_id:
        try:
            result = db.execute(sa_text(
                "SELECT module_key, tab_key, can_view, can_add, can_edit, can_delete "
                "FROM role_permissions WHERE role_id = :rid"
            ), {"rid": role_id})
            for row in result:
                mk = row[0]
                tk = row[1] if row[1] is not None else "*"
                if mk not in permissions_map:
                    permissions_map[mk] = {}
                permissions_map[mk][tk] = {
                    "view": bool(row[2]),
                    "add": bool(row[3]),
                    "edit": bool(row[4]),
                    "delete": bool(row[5]),
                }
        except Exception as exc:
            log.warning("Failed to load permissions for user %s: %s", user.id, exc)
            db.rollback()
            with _PERM_CACHE_LOCK:
                _PERM_CACHE[user.id] = _LOAD_ERROR
            return permissions_map

    has_actual_perms = any(
        actions.get(a, False)
        for module_tabs in permissions_map.values()
        for actions in module_tabs.values()
        for a in ("view", "add", "edit", "delete")
    )

    if not has_actual_perms:
        permissions_map = {"*": {"*": {"view": True, "add": True, "edit": True, "delete": True}}}

    with _PERM_CACHE_LOCK:
        _PERM_CACHE[user.id] = permissions_map

    return permissions_map


def refresh_user_permissions(db: Session, user: User) -> dict:
    with _PERM_CACHE_LOCK:
        _PERM_CACHE.pop(user.id, None)
    return _load_and_cache_permissions(db, user)


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:]
    return None


def _perm_full_access(perm_map: dict) -> bool:
    if perm_map is _LOAD_ERROR:
        return False
    return "*" in perm_map


def _load_perm_map(current_user: User, db: Session) -> dict:
    if current_user.is_super_admin:
        return {"*": {"*": {"view": True, "add": True, "edit": True, "delete": True}}}
    perm_map = _get_cached_permissions(current_user.id)
    if perm_map is None or perm_map is _LOAD_ERROR:
        perm_map = _load_and_cache_permissions(db, current_user)
    return perm_map


def _check_super_admin_or_full_access(current_user: User, perm_map: dict) -> bool:
    if current_user.is_super_admin:
        return True
    if _perm_full_access(perm_map):
        return True
    return False


def require_permission(module_key: str, tab_key: str, action: str):
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
    ) -> User:
        token = _extract_token(request)
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        from app.api.deps import get_current_user as _get_user

        current_user = _get_user(request, db, token)

        if current_user.is_super_admin or getattr(request.state, "is_super_admin", False):
            return current_user

        perm_map = _load_perm_map(current_user, db)

        if _check_super_admin_or_full_access(current_user, perm_map):
            return current_user

        tab_perms = perm_map.get(module_key, {}).get(tab_key, {})
        if tab_perms.get(action, False):
            return current_user

        wildcard_tab = perm_map.get(module_key, {}).get("*", {})
        if wildcard_tab.get(action, False):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {module_key}:{tab_key}:{action}",
        )

    return dependency


def require_permissions(*required_permissions: str):
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
    ) -> User:
        token = _extract_token(request)
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        from app.api.deps import get_current_user as _get_user

        current_user = _get_user(request, db, token)

        if current_user.is_super_admin or getattr(request.state, "is_super_admin", False):
            return current_user

        perm_map = _load_perm_map(current_user, db)

        if _check_super_admin_or_full_access(current_user, perm_map):
            return current_user

        for perm in required_permissions:
            perm = perm.replace(":", ".")
            parts = perm.split(".")
            if len(parts) == 3:
                module_key, tab_key, action = parts
                tab_perms = perm_map.get(module_key, {}).get(tab_key, {})
                if tab_perms.get(action, False):
                    return current_user
            elif len(parts) == 2:
                module_key, action = parts
                if action == "manage":
                    module_tabs = perm_map.get(module_key, {})
                    for t in module_tabs.values():
                        if t.get("view") or t.get("add") or t.get("edit") or t.get("delete"):
                            return current_user
                else:
                    for t in perm_map.get(module_key, {}).values():
                        if t.get(action, False):
                            return current_user
            elif len(parts) == 1:
                if perm_map.get(parts[0]):
                    return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {', '.join(required_permissions)}",
        )

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

        if current_user.is_super_admin or getattr(request.state, "is_super_admin", False):
            return current_user

        perm_map = _load_perm_map(current_user, db)

        if _check_super_admin_or_full_access(current_user, perm_map):
            return current_user

        for perm in permissions:
            parts = perm.split(".")
            if len(parts) == 3:
                module_key, tab_key, action = parts
                tab_perms = perm_map.get(module_key, {}).get(tab_key, {})
                if tab_perms.get(action, False):
                    return current_user
            elif len(parts) == 2:
                module_key, action = parts
                if action == "manage":
                    module_tabs = perm_map.get(module_key, {})
                    for t in module_tabs.values():
                        if t.get("view") or t.get("add") or t.get("edit") or t.get("delete"):
                            return current_user
                else:
                    for t in perm_map.get(module_key, {}).values():
                        if t.get(action, False):
                            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: none of the required permissions granted",
        )

    return dependency


def invalidate_permission_cache(user_id: Optional[int] = None) -> None:
    _invalidate_permission_cache(user_id)


def seed_all_v3_permissions(db: Session) -> dict[str, int]:
    return {}


def assign_v3_role_to_user(db: Session, user_id: int, role_id: int) -> None:
    from sqlalchemy import text

    db.execute(
        text("""
            INSERT INTO rbac3_user_roles (user_id, role_id, created_at)
            VALUES (:uid, :rid, NOW())
            ON CONFLICT (user_id, role_id) DO NOTHING
        """),
        {"uid": user_id, "rid": role_id},
    )
    db.commit()


def ensure_admin_role_assignments(db: Session, user: User) -> None:
    pass
