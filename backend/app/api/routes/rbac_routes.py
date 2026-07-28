import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.audit import log_action, log_create, log_delete, log_update
from app.core.database import get_db
from app.core.rbac import (
    _load_and_cache_permissions,
    invalidate_permission_cache,
    refresh_user_permissions,
    require_permission,
)
from app.core.security import hash_password
from app.core.websocket_manager import ws_manager
from app.models.audit import AuditLog
from app.models.auth import User
from app.models.company import Company
from app.models.rbac import Role, RolePermission
from app.schemas.rbac import (
    AuditLogEntry,
    AuditLogPage,
    CompanyUserCreate,
    CompanyUserResponse,
    CompanyUserUpdate,
    PermissionEntry,
    PermissionResponse,
    PermissionUpdate,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
)

router = APIRouter(prefix="/rbac", tags=["rbac"])
log = logging.getLogger("rems.rbac_api")


def _ensure_company_admin(current_user: User) -> int:
    """Ensure user is a company user (not superadmin) and return company_id."""
    if current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="RBAC is not available for super admin")
    cid = current_user.company_id
    if not cid:
        raise HTTPException(status_code=403, detail="User has no company")
    return cid


def _broadcast_event(company_id: int, event: str, payload: dict) -> None:
    """Send a WebSocket event to all connections in a company."""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(ws_manager.broadcast_to_company(company_id, event, payload))
    except RuntimeError:
        pass


# ── Roles CRUD ────────────────────────────────────────────────────────────────


@router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    roles = db.query(Role).filter(Role.company_id == cid).order_by(Role.name).all()
    result = []
    for r in roles:
        user_count = (
            db.query(User).filter(User.company_id == cid, User.role_id == r.id).count()
        ) if hasattr(User, "role_id") else 0
        result.append(RoleResponse(
            id=r.id,
            company_id=r.company_id,
            name=r.name,
            description=r.description,
            is_system_role=r.is_system_role,
            created_at=r.created_at,
            updated_at=r.updated_at,
            user_count=user_count,
        ))
    return result


@router.post("/roles", response_model=RoleResponse, status_code=201)
def create_role(
    body: RoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    existing = db.query(Role).filter(Role.company_id == cid, Role.name == body.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")

    role = Role(
        company_id=cid,
        name=body.name,
        description=body.description,
    )
    db.add(role)
    db.flush()
    db.commit()
    db.refresh(role)

    log_create(
        db, user_id=current_user.id, entity_type="role", entity_id=role.id,
        module="rbac", description=f"Created role: {role.name}",
        details={"name": role.name},
        request=request,
    )
    _broadcast_event(cid, "rbac.role.created", {"id": role.id, "name": role.name})

    return RoleResponse(
        id=role.id,
        company_id=role.company_id,
        name=role.name,
        description=role.description,
        is_system_role=role.is_system_role,
        created_at=role.created_at,
        updated_at=role.updated_at,
        user_count=0,
    )


@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    body: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    role = db.query(Role).filter(Role.id == role_id, Role.company_id == cid).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system_role:
        raise HTTPException(status_code=400, detail="Cannot modify system role")

    old_data = {"name": role.name, "description": role.description}

    if body.name is not None:
        role.name = body.name
    if body.description is not None:
        role.description = body.description

    role.updated_at = datetime.utcnow()
    db.flush()
    db.commit()
    db.refresh(role)

    log_update(
        db, user_id=current_user.id, entity_type="role", entity_id=role.id,
        module="rbac", description=f"Updated role: {role.name}",
        details={"old": old_data, "new": {"name": role.name, "description": role.description}},
        request=request,
    )
    _broadcast_event(cid, "rbac.role.updated", {"id": role.id, "name": role.name})

    user_count = db.query(User).filter(User.company_id == cid, User.role_id == role.id).count() if hasattr(User, "role_id") else 0

    return RoleResponse(
        id=role.id,
        company_id=role.company_id,
        name=role.name,
        description=role.description,
        is_system_role=role.is_system_role,
        created_at=role.created_at,
        updated_at=role.updated_at,
        user_count=user_count,
    )


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    role = db.query(Role).filter(Role.id == role_id, Role.company_id == cid).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system_role:
        raise HTTPException(status_code=400, detail="Cannot delete system role")

    user_count = db.query(User).filter(User.role_id == role.id, User.company_id == cid).count() if hasattr(User, "role_id") else 0
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete role '{role.name}': {user_count} user(s) are assigned to it. Reassign users first.",
        )

    role_name = role.name
    db.delete(role)
    db.commit()

    log_delete(
        db, user_id=current_user.id, entity_type="role", entity_id=role_id,
        module="rbac", description=f"Deleted role: {role_name}",
        details={"name": role_name},
        request=request,
    )
    _broadcast_event(cid, "rbac.role.deleted", {"id": role_id, "name": role_name})

    return None


# ── Permissions ───────────────────────────────────────────────────────────────


@router.get("/roles/{role_id}/permissions", response_model=list[PermissionResponse])
def list_permissions(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    role = db.query(Role).filter(Role.id == role_id, Role.company_id == cid).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    perms = db.query(RolePermission).filter(RolePermission.role_id == role_id).all()
    log.info("=== list_permissions: role_id=%s, found=%s ===", role_id, len(perms))
    return [
        PermissionResponse(
            id=p.id,
            role_id=p.role_id,
            module_key=p.module_key,
            tab_key=p.tab_key,
            can_view=p.can_view,
            can_add=p.can_add,
            can_edit=p.can_edit,
            can_delete=p.can_delete,
        )
        for p in perms
    ]


@router.put("/roles/{role_id}/permissions")
def update_permissions(
    role_id: int,
    body: PermissionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    role = db.query(Role).filter(Role.id == role_id, Role.company_id == cid).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    old_perms_raw = db.query(RolePermission).filter(RolePermission.role_id == role_id).all()
    old_data = {}
    for p in old_perms_raw:
        key = f"{p.module_key}:{p.tab_key}"
        old_data[key] = {
            "view": p.can_view,
            "add": p.can_add,
            "edit": p.can_edit,
            "delete": p.can_delete,
        }

    log.info("=== update_permissions: role_id=%s, permission_count=%s ===", role_id, len(body.permissions))
    for i, e in enumerate(body.permissions):
        log.info("  [%s] module_key=%s tab_key=%s v=%s a=%s e=%s d=%s",
                 i, e.module_key, e.tab_key, e.can_view, e.can_add, e.can_edit, e.can_delete)

    # Delete all existing permissions for the role
    deleted = db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
    log.info("  deleted %s existing permission rows", deleted)

    # Insert new permissions
    for entry in body.permissions:
        perm = RolePermission(
            role_id=role_id,
            module_key=entry.module_key,
            tab_key=entry.tab_key,
            can_view=entry.can_view,
            can_add=entry.can_add,
            can_edit=entry.can_edit,
            can_delete=entry.can_delete,
        )
        db.add(perm)

    db.flush()
    db.commit()
    log.info("  committed %s permission rows", len(body.permissions))

    # Invalidate permission cache for all users with this role
    users_with_role = db.query(User).filter(User.role_id == role_id, User.company_id == cid).all() if hasattr(User, "role_id") else []
    for u in users_with_role:
        invalidate_permission_cache(u.id)

    log_action(
        db, module="rbac", action="UPDATE",
        record_id=str(role_id), record_label=f"Permissions for role: {role.name}",
        changed_by=current_user.email,
        changed_by_role="admin",
        old_data=old_data,
        new_data={f"{e.module_key}:{e.tab_key}": {"view": e.can_view, "add": e.can_add, "edit": e.can_edit, "delete": e.can_delete} for e in body.permissions},
        ip_address=request.client.host if request.client else None,
        request=request,
    )
    _broadcast_event(cid, "rbac.permissions.updated", {"role_id": role_id, "role_name": role.name})

    return {"ok": True, "message": f"Permissions updated for role '{role.name}'"}


# ── Company Users ─────────────────────────────────────────────────────────────


@router.get("/users", response_model=list[CompanyUserResponse])
def list_company_users(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    role_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)

    query = db.query(User).filter(User.company_id == cid)

    if search:
        like = f"%{search}%"
        query = query.filter(
            User.email.ilike(like) | User.full_name.ilike(like)
        )
    if status:
        query = query.filter(User.status == status)
    if role_id is not None:
        query = query.filter(User.role_id == role_id)

    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    role_ids = [u.role_id for u in users if u.role_id]
    role_names = {}
    if role_ids:
        roles = db.query(Role).filter(Role.id.in_(role_ids), Role.company_id == cid).all()
        role_names = {r.id: r.name for r in roles}

    return [
        CompanyUserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role_id=u.role_id,
            role_name=role_names.get(u.role_id) if u.role_id else None,
            status=u.status,
            is_active=u.is_active,
            is_approved=u.is_approved,
            created_at=u.created_at,
            last_login=u.last_login,
        )
        for u in users
    ]


@router.post("/users", response_model=CompanyUserResponse, status_code=201)
def create_company_user(
    body: CompanyUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)

    # company_id is ALWAYS set from the authenticated admin — never from the request body
    existing = db.query(User).filter(User.email == body.email, User.company_id == cid).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered in this company")

    # Validate role belongs to same company
    if body.role_id:
        role = db.query(Role).filter(Role.id == body.role_id, Role.company_id == cid).first()
        if not role:
            raise HTTPException(status_code=400, detail="Role not found in your company")

    now = datetime.utcnow()
    user = User(
        email=body.email.lower().strip(),
        full_name=body.full_name.strip(),
        hashed_password=hash_password(body.password),
        company_id=cid,
        role_id=body.role_id,
        is_super_admin=False,
        status="active",
        is_approved=True,
        is_active=body.is_active,
        approval_status="approved",
        created_at=now,
        approved_by=current_user.id,
        approved_at=now,
    )
    db.add(user)
    db.flush()
    db.commit()
    db.refresh(user)

    role_name = None
    if body.role_id:
        role = db.query(Role).filter(Role.id == body.role_id).first()
        role_name = role.name if role else None

    log_create(
        db, user_id=current_user.id, entity_type="user", entity_id=user.id,
        module="rbac", description=f"Created user: {user.email}",
        details={"email": user.email, "full_name": user.full_name, "role_id": body.role_id},
        request=request,
    )
    _broadcast_event(cid, "rbac.user.created", {"id": user.id, "email": user.email})

    return CompanyUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=role_name,
        status=user.status,
        is_active=user.is_active,
        is_approved=user.is_approved,
        created_at=user.created_at,
        last_login=user.last_login,
    )


@router.put("/users/{user_id}", response_model=CompanyUserResponse)
def update_company_user(
    user_id: int,
    body: CompanyUserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    user = db.query(User).filter(User.id == user_id, User.company_id == cid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role_id is not None:
        role = db.query(Role).filter(Role.id == body.role_id, Role.company_id == cid).first()
        if not role:
            raise HTTPException(status_code=400, detail="Role not found in your company")
        user.role_id = body.role_id
        invalidate_permission_cache(user.id)

    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.email is not None:
        user.email = body.email.lower().strip()
    if body.password is not None:
        user.hashed_password = hash_password(body.password)
    if body.is_active is not None:
        user.is_active = body.is_active
        user.status = "active" if body.is_active else "suspended"

    db.flush()
    db.commit()
    db.refresh(user)

    role_name = None
    if user.role_id:
        role = db.query(Role).filter(Role.id == user.role_id).first()
        role_name = role.name if role else None

    log_update(
        db, user_id=current_user.id, entity_type="user", entity_id=user.id,
        module="rbac", description=f"Updated user: {user.email}",
        details={"user_id": user.id, "email": user.email},
        request=request,
    )
    _broadcast_event(cid, "rbac.user.updated", {"id": user.id, "email": user.email})

    return CompanyUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=role_name,
        status=user.status,
        is_active=user.is_active,
        is_approved=user.is_approved,
        created_at=user.created_at,
        last_login=user.last_login,
    )


@router.delete("/users/{user_id}", status_code=204)
def delete_company_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    user = db.query(User).filter(User.id == user_id, User.company_id == cid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    email = user.email
    db.delete(user)
    db.commit()

    log_delete(
        db, user_id=current_user.id, entity_type="user", entity_id=user_id,
        module="rbac", description=f"Deleted user: {email}",
        details={"email": email},
        request=request,
    )
    _broadcast_event(cid, "rbac.user.deleted", {"id": user_id, "email": email})

    return None


@router.post("/users/{user_id}/toggle-status")
def toggle_user_status(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)
    user = db.query(User).filter(User.id == user_id, User.company_id == cid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot toggle your own status")

    user.is_active = not user.is_active
    user.status = "active" if user.is_active else "suspended"
    db.flush()
    db.commit()

    action_label = "activated" if user.is_active else "deactivated"
    log_action(
        db, module="rbac", action="STATUS_CHANGE",
        record_id=str(user.id), record_label=f"User {action_label}: {user.email}",
        changed_by=current_user.email,
        changed_by_role="admin",
        request=request,
    )
    _broadcast_event(cid, "rbac.user.status_changed", {"id": user.id, "is_active": user.is_active})

    return {"ok": True, "is_active": user.is_active, "message": f"User {action_label}"}


# ── Audit Logs (company-scoped) ───────────────────────────────────────────────


@router.get("/audit-logs", response_model=AuditLogPage)
def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    module: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _ensure_company_admin(current_user)

    conditions = ["1=1"]
    params: dict = {}

    if module:
        conditions.append("module = :module")
        params["module"] = module
    if action:
        conditions.append("action = :action")
        params["action"] = action
    if user_id:
        conditions.append("user_id = :user_id")
        params["user_id"] = str(user_id)
    if date_from:
        conditions.append("created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("created_at <= :date_to")
        params["date_to"] = date_to
    if search:
        like = f"%{search}%"
        conditions.append("""
            (module ILIKE :search OR action ILIKE :search
             OR entity_name ILIKE :search OR full_name ILIKE :search)
        """)
        params["search"] = like

    where = " AND ".join(conditions)
    offset = (page - 1) * per_page

    count_sql = f"SELECT COUNT(*) FROM audit_logs WHERE {where}"
    total = db.execute(text(count_sql), params).scalar() or 0

    fetch_sql = f"""
        SELECT id, module, action, user_id, username, full_name,
               entity_type, entity_id, entity_name,
               old_data, new_data, diff,
               ip_address, created_at
        FROM audit_logs
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """
    params["limit"] = per_page
    params["offset"] = offset
    rows = db.execute(text(fetch_sql), params).fetchall()

    logs = []
    for r in rows:
        logs.append(AuditLogEntry(
            id=str(r[0]),
            module=r[1],
            action=r[2],
            user_id=str(r[3]) if r[3] else None,
            username=r[4],
            full_name=r[5],
            entity_type=r[6],
            entity_id=r[7],
            entity_name=r[8],
            old_data=r[9],
            new_data=r[10],
            diff=r[11],
            ip_address=r[12],
            created_at=r[13].isoformat() if r[13] else "",
        ))

    return AuditLogPage(total=total, page=page, per_page=per_page, logs=logs)


# ── Permission Check (for frontend) ───────────────────────────────────────────


@router.get("/check-permissions")
def check_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's full permissions map for frontend use."""
    if current_user.is_super_admin:
        return {"is_super_admin": True, "permissions": {"*": {"*": {"view": True, "add": True, "edit": True, "delete": True}}}}

    perm_map = refresh_user_permissions(db, current_user)
    return {
        "is_super_admin": False,
        "user_id": current_user.id,
        "role_id": current_user.role_id,
        "permissions": perm_map,
    }


# ── Available modules/tabs (for role permission UI) ────────────────────────────


@router.get("/module-config")
def get_module_config():
    """Return the canonical module/tab configuration for permission UI."""
    return [
        {"key": "dashboard", "label": "Dashboard", "tabs": ["Dashboard"]},
        {"key": "properties", "label": "Properties", "tabs": ["Properties", "Units", "Lease", "Sales", "Buyers", "Sellers"]},
        {"key": "towns", "label": "Towns", "tabs": ["Overview"]},
        {"key": "crm", "label": "CRM", "tabs": ["Dashboard", "Leads", "Clients", "Dealers", "Deals", "Bookings", "Follow-ups", "Site Visits", "Installments", "Payments"]},
        {"key": "tenants", "label": "Tenants", "tabs": ["Profile", "Payments", "Documents", "Leases"]},
        {"key": "maintenance", "label": "Maintenance", "tabs": ["Requests", "History"]},
        {"key": "construction", "label": "Construction", "tabs": ["Dashboard", "Projects", "Drawings", "Batches", "Reports"]},
        {"key": "hr", "label": "HR", "tabs": ["Employees", "Attendance", "Payroll", "Leaves", "Documents"]},
        {"key": "finance", "label": "Finance", "tabs": ["Overview", "Invoices", "Payments", "Ledger", "Accounts", "Expenses", "Commissions"]},
        {"key": "reports", "label": "Reports", "tabs": ["Reports"]},
        {"key": "spreadsheet", "label": "Spreadsheet", "tabs": ["Spreadsheet"]},
        {"key": "ai", "label": "AI Intel", "tabs": ["Assistant", "Chat"]},
        {"key": "communication", "label": "Communication", "tabs": ["Email", "WhatsApp"]},
        {"key": "reminders", "label": "Reminders", "tabs": ["Reminders"]},
        {"key": "admin", "label": "Admin", "tabs": ["Settings"]},
        {"key": "history", "label": "History", "tabs": ["Activity"]},
        {"key": "import", "label": "Import", "tabs": ["Import"]},
        {"key": "advance-options", "label": "Advance Options", "tabs": ["Options"]},
    ]
