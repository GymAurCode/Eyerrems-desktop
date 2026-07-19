import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text as sa_text
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_master_db
from app.models.rbac import (RoleUser, LoginHistory,
                               AdminNotification, ActivityLog)
from app.core.security import create_access_token, verify_password, hash_password
from app.routers.rbac_admin import get_current_role_user
from datetime import datetime

log = logging.getLogger("rems.rbac_auth")
router = APIRouter(prefix="/api/rbac", tags=["rbac-auth"])


def _resolve_company_id(db: Session, slug: str) -> Optional[int]:
    """Look up company primary key (Integer) from the public schema by slug."""
    if not slug:
        return None
    row = db.execute(
        sa_text("SELECT id FROM companies WHERE slug = :slug"),
        {"slug": slug},
    ).fetchone()
    return int(row[0]) if row else None


class RoleLoginRequest(BaseModel):
    email: str
    password: str


class SlugSetupRequest(BaseModel):
    company_slug: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def role_user_login(
    request: Request,
    body: RoleLoginRequest,
    db: Session = Depends(get_master_db)
):
    """Login for role users (not admin login)"""

    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    user = db.query(RoleUser).filter(
        RoleUser.email == body.email
    ).first()

    def log_failed(reason: str):
        try:
            history = LoginHistory(
                user_id=user.id if user else None,
                user_email=body.email,
                ip_address=ip,
                user_agent=user_agent,
                status="failed",
                failure_reason=reason
            )
            db.add(history)

            notif = AdminNotification(
                type="failed_login",
                title="Failed Login Attempt",
                message=f"{body.email} failed to login: {reason}",
                related_user_email=body.email
            )
            db.add(notif)
            db.commit()
        except Exception as log_exc:
            log.warning("Failed to persist login failure log: %s", log_exc)
            db.rollback()

    if not user:
        log.warning("RBAC login failed: user not found for %s from %s", body.email, ip)
        log_failed("User not found")
        raise HTTPException(status_code=401,
                           detail="Invalid email or password")

    if not user.is_active:
        log.warning("RBAC login blocked: account deactivated for %s", body.email)
        log_failed("Account deactivated")
        raise HTTPException(status_code=403,
                           detail="Your account has been deactivated. Contact your administrator.")

    if not verify_password(body.password, user.password_hash):
        log.warning("RBAC login failed: wrong password for %s", body.email)
        log_failed("Wrong password")
        raise HTTPException(status_code=401,
                           detail="Invalid email or password")

    log.info("RBAC login success: %s (%s) from %s", body.email, user.full_name, ip)
    user.last_login = datetime.utcnow()
    user.last_login_ip = ip

    history = LoginHistory(
        user_id=user.id,
        user_email=user.email,
        ip_address=ip,
        user_agent=user_agent,
        status="success"
    )
    db.add(history)

    notif = AdminNotification(
        type="user_login",
        title="User Logged In",
        message=f"{user.full_name} ({user.email}) logged in from {ip}",
        related_user_email=user.email
    )
    db.add(notif)
    db.commit()

    permissions = {}
    role_name = None
    if user.role:
        role_name = user.role.name
        for perm in user.role.permissions:
            key = f"{perm.module}"
            if perm.tab:
                key = f"{perm.module}.{perm.tab}"
            permissions[key] = {
                "view": perm.can_view,
                "add": perm.can_add,
                "edit": perm.can_edit,
                "delete": perm.can_delete,
            }

    token_data = {
        "sub": user.email,
        "user_id": user.id,
        "user_type": "role_user",
        "role_id": user.role_id,
        "role_name": role_name,
        "full_name": user.full_name,
        "company_slug": user.company_slug,
        "company_id": str(_resolve_company_id(db, user.company_slug)) if user.company_slug else None,
        "slug_locked": user.slug_locked,
        "must_change_password": user.must_change_password,
        "permissions": permissions,
    }

    token = create_access_token(subject=user.email, extra_payload=token_data)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role_name": user.role.name,
            "company_slug": user.company_slug,
            "slug_locked": user.slug_locked,
            "must_change_password": user.must_change_password,
            "permissions": permissions,
        },
        "requires_slug_setup": not user.slug_locked,
        "requires_password_change": user.must_change_password,
    }


@router.post("/setup-slug")
async def setup_company_slug(
    body: SlugSetupRequest,
    db: Session = Depends(get_master_db),
    current_user=Depends(get_current_role_user)
):
    user = db.query(RoleUser).filter(
        RoleUser.id == current_user["id"]
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.slug_locked:
        raise HTTPException(
            status_code=400,
            detail="Company slug is already set and cannot be changed."
        )

    slug = body.company_slug.strip().lower().replace(" ", "-")

    from app.core.database import get_master_db
    master_db = next(get_master_db())
    try:
        # Look up the company by slug in the public schema (Integer PK)
        row = master_db.execute(
            sa_text("SELECT id, status FROM companies WHERE slug = :slug"),
            {"slug": slug},
        ).fetchone()
        if not row:
            row = master_db.execute(
                sa_text("SELECT c.id, c.status FROM companies c JOIN master.companies m ON m.slug = c.slug WHERE m.schema_name = :slug"),
                {"slug": slug},
            ).fetchone()
    finally:
        master_db.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Company '{slug}' not found. Check the slug and try again."
        )

    company_id = int(row[0])

    user.company_slug = slug
    user.slug_locked = True

    # 2. Ensure a User record exists (in the public schema) so RBAC users can
    #    authenticate through the regular auth pipeline (get_current_user).
    existing_user = db.execute(
        sa_text("SELECT id FROM users WHERE email = :e"),
        {"e": user.email},
    ).fetchone()
    if not existing_user:
        admin_role = db.execute(
            sa_text("SELECT id FROM roles WHERE name = 'Admin' ORDER BY id LIMIT 1"),
        ).fetchone()
        admin_role_id = int(admin_role[0]) if admin_role else None
        db.execute(
            sa_text("""
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
                "e": user.email, "fn": user.full_name,
                "pw": user.password_hash, "cid": company_id,
                "rid": admin_role_id,
            },
        )
        if admin_role_id:
            user_row = db.execute(
                sa_text("SELECT id FROM users WHERE email = :e"),
                {"e": user.email},
            ).fetchone()
            if user_row:
                db.execute(
                    sa_text("INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"),
                    {"uid": user_row[0], "rid": admin_role_id},
                )

    db.commit()

    notif = AdminNotification(
        type="user_login",
        title="User Connected to Company",
        message=f"{user.full_name} ({user.email}) connected to company: {slug}",
        related_user_email=user.email
    )
    db.add(notif)
    db.commit()

    permissions = {}
    for perm in user.role.permissions:
        key = f"{perm.module}"
        if perm.tab:
            key = f"{perm.module}.{perm.tab}"
        permissions[key] = {
            "view": perm.can_view,
            "add": perm.can_add,
            "edit": perm.can_edit,
            "delete": perm.can_delete,
        }

    token_data = {
        "sub": user.email,
        "user_id": user.id,
        "user_type": "role_user",
        "role_id": user.role_id,
        "role_name": user.role.name,
        "full_name": user.full_name,
        "company_slug": slug,
        "company_id": str(_resolve_company_id(db, slug)) if slug else None,
        "slug_locked": True,
        "must_change_password": user.must_change_password,
        "permissions": permissions,
    }

    token = create_access_token(subject=user.email, extra_payload=token_data)

    return {
        "access_token": token,
        "token_type": "bearer",
        "success": True,
        "message": f"Successfully connected to {slug}",
        "company_slug": slug,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role_name": user.role.name,
            "company_slug": slug,
            "slug_locked": True,
            "must_change_password": user.must_change_password,
            "permissions": permissions,
        },
    }


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_master_db),
    current_user=Depends(get_current_role_user)
):
    user = db.query(RoleUser).filter(
        RoleUser.id == current_user["id"]
    ).first()

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400,
                           detail="Current password is incorrect")

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    db.commit()

    permissions = {}
    for perm in user.role.permissions:
        key = f"{perm.module}"
        if perm.tab:
            key = f"{perm.module}.{perm.tab}"
        permissions[key] = {
            "view": perm.can_view,
            "add": perm.can_add,
            "edit": perm.can_edit,
            "delete": perm.can_delete,
        }

    token_data = {
        "sub": user.email,
        "user_id": user.id,
        "user_type": "role_user",
        "role_id": user.role_id,
        "role_name": user.role.name,
        "full_name": user.full_name,
        "company_slug": user.company_slug,
        "company_id": str(_resolve_company_id(db, user.company_slug)) if user.company_slug else None,
        "slug_locked": user.slug_locked,
        "must_change_password": False,
        "permissions": permissions,
    }

    new_token = create_access_token(subject=user.email, extra_payload=token_data)

    return {
        "access_token": new_token,
        "token_type": "bearer",
        "success": True,
        "message": "Password changed successfully",
    }


@router.get("/me")
async def role_user_me(
    db: Session = Depends(get_master_db),
    current_user=Depends(get_current_role_user)
):
    user = db.query(RoleUser).filter(
        RoleUser.id == current_user["id"]
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    permissions = {}
    for perm in user.role.permissions:
        key = f"{perm.module}"
        if perm.tab:
            key = f"{perm.module}.{perm.tab}"
        permissions[key] = {
            "view": perm.can_view,
            "add": perm.can_add,
            "edit": perm.can_edit,
            "delete": perm.can_delete,
        }

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role_id": user.role_id,
        "role_name": user.role.name if user.role else None,
        "company_slug": user.company_slug,
        "slug_locked": user.slug_locked,
        "must_change_password": user.must_change_password,
        "is_active": user.is_active,
        "permissions": permissions,
    }


@router.post("/logout")
async def logout(
    db: Session = Depends(get_master_db),
    current_user=Depends(get_current_role_user)
):
    last_login = db.query(LoginHistory).filter(
        LoginHistory.user_id == current_user["id"],
        LoginHistory.logout_at == None
    ).order_by(LoginHistory.login_at.desc()).first()

    if last_login:
        last_login.logout_at = datetime.utcnow()
        db.commit()

    return {"success": True, "message": "Logged out successfully"}
