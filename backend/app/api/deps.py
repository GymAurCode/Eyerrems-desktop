from typing import Optional
import logging

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.auth import User
from app.models.company import Company

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
log = logging.getLogger("rems.auth")


def _load_user(db: Session, email: str) -> User:
    try:
        return (
            db.query(User)
            .filter(User.email == email)
            .first()
        )
    except SQLAlchemyError as exc:
        db.rollback()
        log.warning("User load failed, retrying: %s", exc)
        try:
            return (
                db.query(User)
                .filter(User.email == email)
                .first()
            )
        except SQLAlchemyError:
            db.rollback()
            return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
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

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not token_is_super_admin:
        if user.status == "pending":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is awaiting admin approval")
        if user.status in ("rejected", "suspended") or not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account access was not approved")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    if not user.company_id and not token_is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no company assigned")

    if token_is_super_admin:
        cid = token_company_id if token_company_id is not None else 1
        try:
            cid = int(cid)
        except (ValueError, TypeError):
            cid = 1
        request.state.company_id = cid
        request.state.is_super_admin = True
        user.is_super_admin = True  # force to match token, bypass DB inconsistency
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

    request.state.company_id = user.company_id
    request.state.is_super_admin = False

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active or current_user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active")
    return current_user


def require_feature(feature_key: str):
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
            .filter(CompanyFeature.company_id == current_user.company_id, CompanyFeature.feature_key == feature_key)
            .first()
        )
        if feat and not feat.enabled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Module '{feature_key}' is disabled for your company")
        return current_user
    return dep


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required.")
    return current_user


def require_admin_role(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if current_user.is_super_admin:
        return current_user
    if not current_user.role_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    from app.models.rbac import Role as RbacRole
    role = db.query(RbacRole).filter(RbacRole.id == current_user.role_id).first()
    if not role or role.name.lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user


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


from app.core.rbac import (
    require_permission as _new_require_permission_structured,
    require_permissions as _new_require_permissions_flat,
    require_any_permission as _new_require_any_permission,
    get_user_permissions as _new_get_user_permissions,
    seed_all_v3_permissions,
    assign_v3_role_to_user,
    invalidate_permission_cache,
)


def require_permissions(*required_permissions: str):
    """Backward-compatible permission check using flat strings like 'finance:manage'."""
    return _new_require_permissions_flat(*required_permissions)


def require_any_permission(*permissions: str):
    normalized = {p.replace(":", ".") for p in permissions}
    return _new_require_any_permission(*normalized)


def require_roles(*required_roles: str):
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> User:
        return current_user

    return dependency


_get_user_permissions = _new_get_user_permissions

# Re-export the structured require_permission for use in new routes
def require_permission(module_key: str, tab_key: str, action: str):
    """Structured permission check: require 'module:tab:action' exactly.

    Usage: Depends(require_permission("finance", "Invoices", "view"))
    """
    return _new_require_permission_structured(module_key, tab_key, action)
