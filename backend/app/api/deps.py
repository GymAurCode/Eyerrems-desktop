"""
FastAPI dependency injection — authentication, tenant isolation, permissions.

TENANT ISOLATION RULE
─────────────────────
Every protected dependency attaches `request.state.company_id` so route
handlers can filter queries without repeating the lookup.
"""
from collections.abc import Iterable
from typing import Optional

import logging

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.auth import Role, User
from app.models.company import Company

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

log = logging.getLogger("rems.auth")


# ── Internal helpers ──────────────────────────────────────────────────────────

def _is_admin(user: User) -> bool:
    """True if user holds the 'Admin' role (company-level admin) or is a superadmin."""
    if user.is_super_admin:
        return True
    for role in user.roles:
        if role.name.lower() == "admin":
            return True
    if user.role and user.role.name.lower() == "admin":
        return True
    return False


def _load_user(db: Session, email: str) -> User:
    try:
        return (
            db.query(User)
            .options(
                joinedload(User.roles).joinedload(Role.permissions),
                joinedload(User.direct_permissions),
                joinedload(User.role).joinedload(Role.permissions),
                joinedload(User.company),
            )
            .filter(User.email == email)
            .first()
        )
    except SQLAlchemyError as exc:
        db.rollback()
        log.warning("User load failed with company join, retrying without: %s", exc)
        return (
            db.query(User)
            .options(
                joinedload(User.roles).joinedload(Role.permissions),
                joinedload(User.direct_permissions),
                joinedload(User.role).joinedload(Role.permissions),
            )
            .filter(User.email == email)
            .first()
        )


# ── Core auth dependency ──────────────────────────────────────────────────────

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """
    Validate JWT, load user, enforce tenant isolation.

    Sets:
        request.state.company_id   – int
    """
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    email: str = payload.get("sub", "")
    token_company_id: Optional[str] = payload.get("company_id")
    token_is_super_admin: bool = bool(payload.get("is_super_admin", False))

    user = _load_user(db, email)
    if not user:
        log.warning(f"User '{email}' not found in resolved DB, trying master DB fallback")
        from app.core.tenant_manager import tenant_manager
        master_db = tenant_manager.get_master_session()
        try:
            user = _load_user(master_db, email)
        finally:
            master_db.close()
    if not user and payload.get("user_type") == "role_user":
        # Fallback: RBAC user not yet mirrored as a User record.
        from app.core.tenant_manager import tenant_manager as _tm
        from app.models.rbac import RoleUser as RbacUser
        from sqlalchemy import text as _sa_text

        _master = _tm.get_master_session()
        try:
            rbac_user = _master.query(RbacUser).filter(RbacUser.email == email).first()
        finally:
            _master.close()

        if rbac_user and rbac_user.slug_locked:
            _company_id = None
            if rbac_user.company_slug:
                _m2 = _tm.get_master_session()
                try:
                    _row = _m2.execute(
                        _sa_text("SELECT id FROM companies WHERE slug = :s"),
                        {"s": rbac_user.company_slug},
                    ).fetchone()
                    if _row:
                        _company_id = int(_row[0])
                finally:
                    _m2.close()

            if _company_id:
                _m3 = _tm.get_master_session()
                try:
                    _existing = _m3.execute(
                        _sa_text("SELECT id FROM users WHERE email = :e"),
                        {"e": email},
                    ).fetchone()
                    if not _existing:
                        _ar = _m3.execute(
                            _sa_text("SELECT id FROM roles WHERE name = 'Admin' ORDER BY id LIMIT 1"),
                        ).fetchone()
                        _ar_id = int(_ar[0]) if _ar else None
                        _m3.execute(
                            _sa_text("""
                                INSERT INTO users
                                    (email, full_name, hashed_password, company_id,
                                     is_super_admin, status, is_approved, is_active,
                                     approval_status, role_id)
                                VALUES
                                    (:e, :fn, :pw, :cid,
                                     FALSE, 'active', TRUE, TRUE,
                                     'approved', :rid)
                            """),
                            {
                                "e": email, "fn": rbac_user.full_name,
                                "pw": rbac_user.password_hash, "cid": _company_id,
                                "rid": _ar_id,
                            },
                        )
                        if _ar_id:
                            _uid_row = _m3.execute(
                                _sa_text("SELECT id FROM users WHERE email = :e"),
                                {"e": email},
                            ).fetchone()
                            if _uid_row:
                                _m3.execute(
                                    _sa_text("INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"),
                                    {"uid": _uid_row[0], "rid": _ar_id},
                                )
                        _m3.commit()
                    user = _load_user(_m3, email)
                finally:
                    _m3.close()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # Regular tenant user — must belong to an active company.
    if not user.company_id and not token_is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no company assigned")

    if token_is_super_admin:
        # Master admin may authenticate with a token that carries no tenant context.
        cid = token_company_id if token_company_id is not None else 1
        try:
            cid = int(cid)
        except (ValueError, TypeError):
            cid = 1
        request.state.company_id = cid
        request.state.is_super_admin = True
        return user

    from app.core.tenant_manager import tenant_manager
    master_db = tenant_manager.get_master_session()
    try:
        company = master_db.query(Company).filter(Company.id == user.company_id).first()
    finally:
        master_db.close()

    if not company:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company not found")
    if company.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company account is suspended")

    # Approval check (admins bypass)
    if not _is_admin(user):
        if user.status != "active" or not user.is_approved:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not approved or active")

    # Attach tenant context to request state
    request.state.company_id     = user.company_id
    request.state.is_super_admin = False

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active or current_user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active")
    return current_user




# ── Feature-flag guard ────────────────────────────────────────────────────────

def require_feature(feature_key: str):
    """
    Block route if the company has the feature disabled.

    Usage:
        @router.get("/employees", dependencies=[Depends(require_feature("hr_module"))])
    """
    def dep(
        request: Request,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.is_super_admin:
            return current_user

        from app.models.company import CompanyFeature
        feat = (
            db.query(CompanyFeature)
            .filter(
                CompanyFeature.company_id == current_user.company_id,
                CompanyFeature.feature_key == feature_key,
            )
            .first()
        )
        if feat and not feat.enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Module '{feature_key}' is disabled for your company",
            )
        return current_user

    return dep


# ── Permission guards ─────────────────────────────────────────────────────────

def require_permissions(*permission_names: str):
    """User must have ALL listed permissions.  Admin always passes."""
    required = set(permission_names)

    def dep(current_user: User = Depends(get_current_user)) -> User:
        if _is_admin(current_user):
            return current_user
        missing = required - current_user.get_all_permissions()
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(missing)}",
            )
        return current_user

    return dep


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require the current user to be a Super Admin."""
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required.",
        )
    return current_user


def require_any_permission(*permission_names: str):
    """User must have ANY of the listed permissions."""
    allowed: Iterable[str] = permission_names

    def dep(current_user: User = Depends(get_current_user)) -> User:
        if _is_admin(current_user):
            return current_user
        if not current_user.get_all_permissions().intersection(set(allowed)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least one of: {', '.join(allowed)}",
            )
        return current_user

    return dep


def require_roles(*roles: str):
    """User must hold one of the specified role names."""
    def dep(current_user: User = Depends(get_current_user)) -> User:
        user_roles = {r.name for r in current_user.roles}
        if not user_roles and current_user.role:
            user_roles.add(current_user.role.name)
        if not user_roles.intersection(set(roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(roles)}",
            )
        return current_user

    return dep


def optional_user(
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[User]:
    if not token:
        return None
    try:
        return get_current_user(request, db, token)
    except HTTPException:
        return None


# ── Backward-compat aliases ───────────────────────────────────────────────────

def require_permission(permission: str):
    """Single-permission check (backward compat)."""
    return require_permissions(permission)


def _normalize_permission(code: str) -> str:
    if ":" in code:
        module, action = code.split(":", 1)
        return f"{module}.{action}"
    return code
