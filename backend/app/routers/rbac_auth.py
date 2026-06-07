from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.models.rbac import (RoleUser, LoginHistory,
                               AdminNotification, ActivityLog)
from app.core.security import create_access_token, verify_password, hash_password
from app.routers.rbac_admin import get_current_role_user
from datetime import datetime

router = APIRouter(prefix="/api/rbac", tags=["rbac-auth"])


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
    db: Session = Depends(get_db)
):
    """Login for role users (not admin login)"""

    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    user = db.query(RoleUser).filter(
        RoleUser.email == body.email
    ).first()

    def log_failed(reason: str):
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

    if not user:
        log_failed("User not found")
        raise HTTPException(status_code=401,
                           detail="Invalid email or password")

    if not user.is_active:
        log_failed("Account deactivated")
        raise HTTPException(status_code=403,
                           detail="Your account has been deactivated. Contact your administrator.")

    if not verify_password(body.password, user.password_hash):
        log_failed("Wrong password")
        raise HTTPException(status_code=401,
                           detail="Invalid email or password")

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
        },
        "requires_slug_setup": not user.slug_locked,
        "requires_password_change": user.must_change_password,
    }


@router.post("/setup-slug")
async def setup_company_slug(
    body: SlugSetupRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_role_user)
):
    user = db.query(RoleUser).filter(
        RoleUser.id == current_user.id
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.slug_locked:
        raise HTTPException(
            status_code=400,
            detail="Company slug is already set and cannot be changed."
        )

    slug = body.company_slug.strip().lower()

    from app.core.database import get_master_db
    master_db = next(get_master_db())
    try:
        from app.models.company import Company
        company = master_db.query(Company).filter(Company.slug == slug).first()
    finally:
        master_db.close()

    if not company:
        raise HTTPException(
            status_code=404,
            detail=f"Company '{slug}' not found. Check the slug and try again."
        )

    user.company_slug = slug
    user.slug_locked = True
    db.commit()

    notif = AdminNotification(
        type="user_login",
        title="User Connected to Company",
        message=f"{user.full_name} ({user.email}) connected to company: {slug}",
        related_user_email=user.email
    )
    db.add(notif)
    db.commit()

    return {
        "success": True,
        "message": f"Successfully connected to {slug}",
        "company_slug": slug,
    }


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_role_user)
):
    user = db.query(RoleUser).filter(
        RoleUser.id == current_user.id
    ).first()

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400,
                           detail="Current password is incorrect")

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    db.commit()

    return {"success": True, "message": "Password changed successfully"}


@router.post("/logout")
async def logout(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_role_user)
):
    last_login = db.query(LoginHistory).filter(
        LoginHistory.user_id == current_user.id,
        LoginHistory.logout_at == None
    ).order_by(LoginHistory.login_at.desc()).first()

    if last_login:
        last_login.logout_at = datetime.utcnow()
        db.commit()

    return {"success": True, "message": "Logged out successfully"}
