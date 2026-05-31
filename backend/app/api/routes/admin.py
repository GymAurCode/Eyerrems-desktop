from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_permissions
from app.core.audit import log_action
from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.auth import Permission, Role, User
from app.schemas.admin import AuditLogResponse, RolePermissionResponse
from app.schemas.auth import (
    PermissionCreate,
    PermissionResponse,
    RoleCreate,
    RoleDetailResponse,
    RoleUpdate,
)
from app.services.rbac_service import RBACService

router = APIRouter()


# ============= Audit Log Endpoints =============

@router.get("/audit-logs", response_model=list[AuditLogResponse])
def list_audit_logs(
    module: str = None,
    action: str = None,
    user_id: int = None,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    _=Depends(require_permissions("audit.view"))
):
    """List audit logs with optional filters"""
    query = db.query(AuditLog).options(joinedload(AuditLog.user))
    
    if module:
        query = query.filter(AuditLog.module == module)
    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            action=log.action,
            module=log.module,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            description=log.description,
            created_at=log.created_at,
        )
        for log in logs
    ]


# ============= Role Management Endpoints =============

@router.post("/roles", response_model=RoleDetailResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("role.create"))
):
    """Create a new role with permissions"""
    role = RBACService.create_role(
        db,
        name=payload.name,
        description=payload.description,
        permission_ids=payload.permission_ids
    )
    
    db.commit()

    log_action(
        db=db, module="user", action="CREATE",
        record_id=str(role.id), record_label=f"Role: {role.name}",
        changed_by=admin.email, changed_by_role=getattr(admin, 'role', None),
        new_data={"role_name": role.name, "permission_count": len(role.permissions)},
        ip_address=request.client.host if request.client else None,
    )
    db.refresh(role)
    
    return RoleDetailResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permissions=[
            PermissionResponse(
                id=p.id,
                name=p.name,
                module=p.module,
                description=p.description,
                created_at=p.created_at,
            )
            for p in role.permissions
        ],
    )


@router.patch("/roles/{role_id}", response_model=RoleDetailResponse)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("role.update"))
):
    """Update an existing role"""
    role = RBACService.update_role(
        db,
        role_id=role_id,
        name=payload.name,
        description=payload.description,
        permission_ids=payload.permission_ids
    )
    
    db.commit()

    log_action(
        db=db, module="user", action="UPDATE",
        record_id=str(role.id), record_label=f"Role: {role.name}",
        changed_by=admin.email, changed_by_role=getattr(admin, 'role', None),
        new_data={"role_name": role.name, "permission_count": len(role.permissions)},
        ip_address=request.client.host if request.client else None,
    )
    db.refresh(role)
    
    return RoleDetailResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permissions=[
            PermissionResponse(
                id=p.id,
                name=p.name,
                module=p.module,
                description=p.description,
                created_at=p.created_at,
            )
            for p in role.permissions
        ],
    )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("role.delete"))
):
    """Delete a role"""
    role = RBACService.get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    role_name = role.name
    
    RBACService.delete_role(db, role_id)
    
    db.commit()

    log_action(
        db=db, module="user", action="DELETE",
        record_id=str(role_id), record_label=f"Role: {role_name}",
        changed_by=admin.email, changed_by_role=getattr(admin, 'role', None),
        old_data={"role_name": role_name},
        ip_address=request.client.host if request.client else None,
    )


@router.get("/roles", response_model=list[RolePermissionResponse])
def list_roles_with_permissions(
    db: Session = Depends(get_db),
    _=Depends(require_permissions("role.view"))
):
    """List all roles with their permissions (legacy format)"""
    roles = db.query(Role).options(joinedload(Role.permissions)).order_by(Role.name).all()
    out: list[RolePermissionResponse] = []
    for role in roles:
        codes = sorted({p.name for p in role.permissions})
        out.append(RolePermissionResponse(role_id=role.id, role_name=role.name, permissions=codes))
    return out


# ============= Permission Management Endpoints =============

@router.post("/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
def create_permission(
    payload: PermissionCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("permission.view"))
):
    """Create a new permission"""
    permission = RBACService.create_permission(
        db,
        name=payload.name,
        module=payload.module,
        description=payload.description
    )
    
    db.commit()

    log_action(
        db=db, module="user", action="CREATE",
        record_id=str(permission.id), record_label=f"Permission: {permission.name}",
        changed_by=admin.email, changed_by_role=getattr(admin, 'role', None),
        new_data={"permission_name": permission.name, "module": permission.module},
        ip_address=request.client.host if request.client else None,
    )
    db.refresh(permission)
    
    return PermissionResponse(
        id=permission.id,
        name=permission.name,
        module=permission.module,
        description=permission.description,
        created_at=permission.created_at,
    )


@router.get("/permissions", response_model=list[str])
def list_permissions(
    db: Session = Depends(get_db),
    _=Depends(require_permissions("permission.view"))
):
    """List all permission names (legacy format)"""
    rows = db.query(Permission).order_by(Permission.name).all()
    return [p.name for p in rows]


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_permission(
    permission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("permission.assign"))
):
    """Delete a permission"""
    perm = db.query(Permission).filter(Permission.id == permission_id).first()
    if not perm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    perm_name = perm.name
    log_action(
        db=db, module="user", action="DELETE",
        record_id=str(permission_id), record_label=f"Permission: {perm_name}",
        changed_by=admin.email, changed_by_role=getattr(admin, 'role', None),
        old_data={"permission_name": perm_name},
        ip_address=request.client.host if request.client else None,
    )
    db.delete(perm)
    db.commit()


# ============= System Seed Endpoints =============

@router.post("/seed/permissions", status_code=status.HTTP_201_CREATED)
def seed_permissions(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("user.manage"))
):
    """Seed default permissions"""
    created = RBACService.seed_default_permissions(db)
    
    if created:
        db.commit()
        log_action(
            db=db, module="user", action="CREATE",
            record_id="seed", record_label="Seeded default permissions",
            changed_by=admin.email, changed_by_role=getattr(admin, 'role', None),
            new_data={"count": len(created)},
            ip_address=request.client.host if request.client else None,
        )
    
    return {"message": f"Seeded {len(created)} permissions", "count": len(created)}


@router.post("/seed/roles", status_code=status.HTTP_201_CREATED)
def seed_roles(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("user.manage"))
):
    """Seed default roles with permissions"""
    created = RBACService.seed_default_roles(db)
    
    if created:
        db.commit()
        log_action(
            db=db, module="user", action="CREATE",
            record_id="seed", record_label="Seeded default roles",
            changed_by=admin.email, changed_by_role=getattr(admin, 'role', None),
            new_data={"count": len(created), "roles": [r.name for r in created]},
            ip_address=request.client.host if request.client else None,
        )
    
    return {
        "message": f"Seeded {len(created)} roles",
        "count": len(created),
        "roles": [r.name for r in created]
    }
