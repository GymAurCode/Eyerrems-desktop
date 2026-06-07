from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.models.rbac import (Role, RolePermission, RoleUser,
                               LoginHistory, ActivityLog, AdminNotification)
from app.core.security import (decode_access_token, hash_password,
                                create_access_token)
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/rbac", tags=["rbac-admin"])


# ── Dependencies (defined first — required by route decorators) ──────────────

def get_current_role_user(request: Request, db: Session = Depends(get_db)):
    """Extract role user from JWT (used by rbac_auth endpoints)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("user_type") != "role_user":
        raise HTTPException(status_code=403, detail="Not a role user")
    user_id = payload.get("user_id")
    user = db.query(RoleUser).filter(RoleUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    payload["id"] = user.id
    payload["full_name"] = user.full_name
    payload["email"] = user.email
    return payload


def get_super_admin_user(request: Request, db: Session = Depends(get_db)):
    """Extract super admin user from JWT."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    is_super_admin = payload.get("is_super_admin", False) or payload.get("role") == "superadmin"
    if not is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    payload["id"] = payload.get("sub")
    return payload


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class RoleCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class PermissionEntry(BaseModel):
    module: str
    tab: Optional[str] = None
    can_view: bool = False
    can_add: bool = False
    can_edit: bool = False
    can_delete: bool = False


class BulkPermissionsRequest(BaseModel):
    permissions: List[PermissionEntry]


class UserCreateRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role_id: str


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    role_id: Optional[str] = None
    is_active: Optional[bool] = None


class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = None


class TemplateRoleRequest(BaseModel):
    template_key: str
    name: Optional[str] = None


# ── ROLE CRUD ────────────────────────────────────────────────────────────────

@router.get("/roles")
def list_roles(db: Session = Depends(get_db),
               _=Depends(get_super_admin_user)):
    roles = db.query(Role).options(
        joinedload(Role.users), joinedload(Role.permissions)
    ).order_by(Role.name).all()
    return [r.to_dict() for r in roles]


@router.post("/roles", status_code=201)
def create_role(payload: RoleCreateRequest,
                db: Session = Depends(get_db),
                _=Depends(get_super_admin_user)):
    existing = db.query(Role).filter(Role.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Role '{payload.name}' already exists")
    role = Role(
        id=str(uuid.uuid4()),
        name=payload.name,
        description=payload.description,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role.to_dict()


@router.get("/roles/{role_id}")
def get_role(role_id: str,
             db: Session = Depends(get_db),
             _=Depends(get_super_admin_user)):
    role = db.query(Role).options(
        joinedload(Role.users), joinedload(Role.permissions)
    ).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    result = role.to_dict()
    result["permissions"] = [p.to_dict() for p in role.permissions]
    return result


@router.put("/roles/{role_id}")
def update_role(role_id: str,
                payload: RoleUpdateRequest,
                db: Session = Depends(get_db),
                _=Depends(get_super_admin_user)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if payload.name is not None:
        existing = db.query(Role).filter(Role.name == payload.name, Role.id != role_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Role name '{payload.name}' already taken")
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    db.commit()
    db.refresh(role)
    return role.to_dict()


@router.delete("/roles/{role_id}")
def delete_role(role_id: str,
                db: Session = Depends(get_db),
                _=Depends(get_super_admin_user)):
    role = db.query(Role).options(joinedload(Role.users)).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.users and len(role.users) > 0:
        raise HTTPException(status_code=400,
                           detail=f"Cannot delete role '{role.name}' - it has {len(role.users)} user(s)")
    db.delete(role)
    db.commit()
    return {"success": True, "message": f"Role '{role.name}' deleted"}


@router.put("/roles/{role_id}/permissions")
def update_role_permissions(role_id: str,
                            payload: BulkPermissionsRequest,
                            db: Session = Depends(get_db),
                            _=Depends(get_super_admin_user)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    db.query(RolePermission).filter(
        RolePermission.role_id == role_id
    ).delete()

    for entry in payload.permissions:
        perm = RolePermission(
            id=str(uuid.uuid4()),
            role_id=role_id,
            module=entry.module,
            tab=entry.tab,
            can_view=entry.can_view,
            can_add=entry.can_add,
            can_edit=entry.can_edit,
            can_delete=entry.can_delete,
        )
        db.add(perm)

    db.commit()

    updated = db.query(RolePermission).filter(
        RolePermission.role_id == role_id
    ).all()
    return {"permissions": [p.to_dict() for p in updated]}


# ── USER CRUD ────────────────────────────────────────────────────────────────

@router.get("/users")
def list_role_users(db: Session = Depends(get_db),
                    _=Depends(get_super_admin_user)):
    users = db.query(RoleUser).options(joinedload(RoleUser.role)).order_by(
        RoleUser.created_at.desc()
    ).all()
    return [u.to_dict() for u in users]


@router.post("/users", status_code=201)
def create_role_user(payload: UserCreateRequest,
                     db: Session = Depends(get_db),
                     _=Depends(get_super_admin_user)):
    existing = db.query(RoleUser).filter(RoleUser.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Role not found")

    user = RoleUser(
        id=str(uuid.uuid4()),
        role_id=payload.role_id,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    notif = AdminNotification(
        type="new_user",
        title="New Role User Created",
        message=f"User {user.full_name} ({user.email}) created with role {role.name}",
        related_user_email=user.email,
    )
    db.add(notif)
    db.commit()

    return user.to_dict()


@router.put("/users/{user_id}")
def update_role_user(user_id: str,
                     payload: UserUpdateRequest,
                     db: Session = Depends(get_db),
                     _=Depends(get_super_admin_user)):
    user = db.query(RoleUser).options(joinedload(RoleUser.role)).filter(
        RoleUser.id == user_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role_id is not None:
        role = db.query(Role).filter(Role.id == payload.role_id).first()
        if not role:
            raise HTTPException(status_code=400, detail="Role not found")
        user.role_id = payload.role_id
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user.to_dict()


@router.post("/users/{user_id}/reset-password")
def reset_user_password(user_id: str,
                        payload: ResetPasswordRequest,
                        db: Session = Depends(get_db),
                        _=Depends(get_super_admin_user)):
    user = db.query(RoleUser).filter(RoleUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_password = payload.new_password or "Temp@123"
    user.password_hash = hash_password(new_password)
    user.must_change_password = True
    db.commit()
    return {
        "success": True,
        "message": "Password reset successfully",
        "temp_password": new_password if payload.new_password is None else None,
    }


@router.post("/users/{user_id}/deactivate")
def deactivate_user(user_id: str,
                    db: Session = Depends(get_db),
                    _=Depends(get_super_admin_user)):
    user = db.query(RoleUser).filter(RoleUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    return {"success": True, "message": "User deactivated"}


@router.post("/users/{user_id}/activate")
def activate_user(user_id: str,
                  db: Session = Depends(get_db),
                  _=Depends(get_super_admin_user)):
    user = db.query(RoleUser).filter(RoleUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    return {"success": True, "message": "User activated"}


# ── LOGIN HISTORY ────────────────────────────────────────────────────────────

@router.get("/login-history")
def list_login_history(
    user_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(get_super_admin_user)
):
    query = db.query(LoginHistory).order_by(desc(LoginHistory.login_at))
    if user_id:
        query = query.filter(LoginHistory.user_id == user_id)
    if date_from:
        query = query.filter(LoginHistory.login_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(LoginHistory.login_at <= datetime.fromisoformat(date_to))
    if status:
        query = query.filter(LoginHistory.status == status)

    total = query.count()
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    return {
        "items": [h.to_dict() for h in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── ACTIVITY LOGS ────────────────────────────────────────────────────────────

@router.get("/activity-logs")
def list_activity_logs(
    user_id: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(get_super_admin_user)
):
    query = db.query(ActivityLog).order_by(desc(ActivityLog.timestamp))
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if module:
        query = query.filter(ActivityLog.module == module)
    if action:
        query = query.filter(ActivityLog.action == action)
    if date_from:
        query = query.filter(ActivityLog.timestamp >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(ActivityLog.timestamp <= datetime.fromisoformat(date_to))

    total = query.count()
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    return {
        "items": [a.to_dict() for a in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── ADMIN NOTIFICATIONS ──────────────────────────────────────────────────────

@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db),
                       _=Depends(get_super_admin_user)):
    notifs = db.query(AdminNotification).order_by(
        desc(AdminNotification.created_at)
    ).limit(100).all()
    return [n.to_dict() for n in notifs]


@router.get("/notifications/count")
def unread_notification_count(db: Session = Depends(get_db),
                               _=Depends(get_super_admin_user)):
    count = db.query(AdminNotification).filter(
        AdminNotification.is_read == False
    ).count()
    return {"unread_count": count}


@router.put("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str,
                           db: Session = Depends(get_db),
                           _=Depends(get_super_admin_user)):
    notif = db.query(AdminNotification).filter(
        AdminNotification.id == notif_id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"success": True}


@router.post("/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db),
                                _=Depends(get_super_admin_user)):
    db.query(AdminNotification).filter(
        AdminNotification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"success": True, "message": "All notifications marked as read"}


# ── ROLE FROM TEMPLATE ───────────────────────────────────────────────────────

@router.post("/roles/from-template")
def create_role_from_template(payload: TemplateRoleRequest,
                               db: Session = Depends(get_db),
                               _=Depends(get_super_admin_user)):
    from app.data.role_templates import ROLE_TEMPLATES

    template = ROLE_TEMPLATES.get(payload.template_key)
    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"Template '{payload.template_key}' not found. Available: {list(ROLE_TEMPLATES.keys())}"
        )

    role_name = payload.name or template["name"]
    existing = db.query(Role).filter(Role.name == role_name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Role '{role_name}' already exists")

    role = Role(
        id=str(uuid.uuid4()),
        name=role_name,
        description=template["description"],
    )
    db.add(role)
    db.flush()

    for entry in template["permissions"]:
        perm = RolePermission(
            id=str(uuid.uuid4()),
            role_id=role.id,
            module=entry["module"],
            tab=entry.get("tab"),
            can_view=entry.get("can_view", False),
            can_add=entry.get("can_add", False),
            can_edit=entry.get("can_edit", False),
            can_delete=entry.get("can_delete", False),
        )
        db.add(perm)

    db.commit()
    db.refresh(role)

    result = role.to_dict()
    result["permissions"] = [
        p.to_dict() for p in db.query(RolePermission).filter(
            RolePermission.role_id == role.id
        ).all()
    ]
    return result
