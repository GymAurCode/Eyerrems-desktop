from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_permissions
from app.core.audit import log_create, log_update, log_user_action
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.auth import Permission, Role, User
from app.models.company import Company
from app.schemas.auth import (
    AssignPermissionsRequest,
    AssignRolesRequest,
    AuthToken,
    LoginRequest,
    PermissionCheckRequest,
    PermissionCheckResponse,
    PermissionResponse,
    RegisterRequest,
    RoleDetailResponse,
    RoleResponse,
    UserApprovalRequest,
    UserDetailResponse,
    UserListResponse,
    UserResponse,
    UserStatusUpdate,
)
from app.services.rbac_service import RBACService

router = APIRouter()


def _user_response(user: User) -> UserResponse:
    """Convert User model to UserResponse"""
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        status=user.status,
        is_approved=user.is_approved,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login=user.last_login,
        company_id=user.company_id,
        is_super_admin=user.is_super_admin,
        role=user.role.name if user.role else (user.roles[0].name if user.roles else None),
        approval_status=user.approval_status,
    )


def _get_company_features(db: Session, company_id: int | None) -> dict:
    """Return feature flags dict for a company."""
    if not company_id:
        return {}
    from app.models.company import CompanyFeature
    rows = db.query(CompanyFeature).filter(CompanyFeature.company_id == company_id).all()
    return {r.feature_key: r.enabled for r in rows}


def _user_detail_response(user: User, db: Session) -> UserDetailResponse:
    """Convert User model to UserDetailResponse with roles and permissions"""
    roles = [role.name for role in user.roles]
    if not roles and user.role:
        roles = [user.role.name]

    return UserDetailResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        status=user.status,
        is_approved=user.is_approved,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login=user.last_login,
        company_id=user.company_id,
        is_super_admin=user.is_super_admin,
        role=roles[0] if roles else None,
        approval_status=user.approval_status,
        roles=roles,
        permissions=list(user.get_all_permissions()),
        features=_get_company_features(db, user.company_id),
        approved_by=user.approved_by,
        approved_at=user.approved_at,
    )


# ============= Authentication Endpoints =============

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Register a new user — requires admin approval before login.
    
    The company is resolved from the request body (company_slug).
    If no slug is provided, the user is assigned to the default company.
    """
    from app.models.company import Company

    # Resolve company in master.db
    company_slug = getattr(payload, "company_slug", None)
    if company_slug:
        company = db.query(Company).filter(Company.slug == company_slug).first()
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        if company.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company is suspended")
    else:
        company = db.query(Company).filter(Company.slug == "default").first()

    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    company_id = company.id

    # Open tenant database session
    from app.core.tenant_manager import tenant_manager
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        # Email must be unique in this company's database
        existing = tenant_db.query(User).filter(User.email == payload.email, User.company_id == company_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

        # Get default Staff role in this company's database
        staff_role = (
            tenant_db.query(Role).filter(Role.name == "Staff", Role.company_id == company_id).first()
        )
        # Fallback to initialize company DB if default role is not seeded
        if not staff_role:
            tenant_manager.initialize_tenant_db(company_id, company.slug)
            staff_role = (
                tenant_db.query(Role).filter(Role.name == "Staff", Role.company_id == company_id).first()
            )

        if not staff_role:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Default role not configured in company database.",
            )

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            company_id=company_id,
            is_super_admin=False,
            status="pending",
            is_approved=False,
            is_active=True,
            approval_status="pending",
            role_id=staff_role.id,
        )
        user.roles = [staff_role]

        tenant_db.add(user)
        tenant_db.flush()

        log_create(
            tenant_db, user_id=user.id, entity_type="user", entity_id=user.id,
            company_id=company_id, module="Auth",
            description=f"User {user.email} registered",
            details={"email": user.email, "full_name": user.full_name},
            request=request,
        )

        tenant_db.commit()
        tenant_db.refresh(user)
        return _user_response(user)
    except HTTPException:
        tenant_db.rollback()
        raise
    except Exception as e:
        tenant_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )
    finally:
        tenant_db.close()


@router.get("/pending-users", response_model=list[UserListResponse])
def list_pending_users_legacy(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("user.approve"))
):
    """Legacy endpoint — list users pending approval"""
    users = (
        db.query(User)
        .options(joinedload(User.roles))
        .filter(User.status == "pending", User.is_approved == False)
        .order_by(User.created_at)
        .all()
    )
    return [
        UserListResponse(
            id=u.id, email=u.email, full_name=u.full_name, status=u.status,
            is_approved=u.is_approved,
            roles=[r.name for r in u.roles] or ([u.role.name] if u.role else []),
            created_at=u.created_at,
        )
        for u in users
    ]


@router.post("/login", response_model=AuthToken)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Login with role-aware response.

    Flow:
      1. If email matches SUPERADMIN_EMAIL → validate password → return role="superadmin"
      2. Else look up company in master.companies by admin_email
         → validate password, status, expiry → return role="company_admin"
    """
    from app.core.config import settings as app_settings
    from app.core.master_db import ensure_master_schema
    from app.tenant import get_master_session
    from sqlalchemy import text

    # ── 1. Check superadmin ───────────────────────────────────────────────
    if payload.email == app_settings.superadmin_email:
        # Verify against the superadmin user in the public schema
        sa_user = db.query(User).filter(
            User.email == payload.email,
            User.is_super_admin == True,
        ).first()
        if not sa_user or not verify_password(payload.password, sa_user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if not sa_user.is_active or not sa_user.is_approved:
            raise HTTPException(status_code=403, detail="Super Admin account is not active")

        sa_user.last_login = datetime.utcnow()
        db.commit()

        token = create_access_token(subject=sa_user.email, company_id=None, is_super_admin=True)
        return AuthToken(
            access_token=token,
            role="superadmin",
            company_id=None,
            company_name=None,
        )

    # ── 2. Check company admin in master.companies ────────────────────────
    master_db = get_master_session()
    try:
        ensure_master_schema(master_db)
        company = master_db.execute(
            text("""
                SELECT id, name, admin_email, admin_password_hash, status, expiry_date, schema_name
                FROM master.companies
                WHERE admin_email = :email
            """),
            {"email": payload.email},
        ).fetchone()
    finally:
        master_db.close()

    if not company:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, company[3]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if company[4] == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended. Contact your administrator.")

    if company[5] and company[5] < datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="License expired. Contact your administrator.")

    # Resolve integer company_id for SQLite tenant session resolution
    from app.models.company import Company
    schema_name = company[6]  # "company_default" etc.
    slug = schema_name.removeprefix("company_") if schema_name and schema_name.startswith("company_") else schema_name
    orm_company = (db.query(Company).filter(Company.slug == slug).first()) if slug else None
    company_id_int = orm_company.id if orm_company else None

    token = create_access_token(
        subject=payload.email,
        company_id=str(company_id_int or company[0]),
        is_super_admin=False,
    )

    return AuthToken(
        access_token=token,
        role="company_admin",
        company_id=str(company[0]),
        company_name=company[1],
    )


@router.get("/me", response_model=UserDetailResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user information with roles, permissions, and feature flags."""
    return _user_detail_response(current_user, db)


@router.get("/me/permissions", response_model=list[str])
def get_my_permissions(current_user: User = Depends(get_current_user)):
    """Get all permissions for current user"""
    return list(current_user.get_all_permissions())


@router.post("/me/check-permissions", response_model=PermissionCheckResponse)
def check_my_permissions(
    payload: PermissionCheckRequest,
    current_user: User = Depends(get_current_user)
):
    """Check if current user has specific permissions"""
    user_perms = current_user.get_all_permissions()
    required = set(payload.permissions)
    
    granted = user_perms.intersection(required)
    missing = required - user_perms
    
    return PermissionCheckResponse(
        has_all=len(missing) == 0,
        has_any=len(granted) > 0,
        granted=list(granted),
        missing=list(missing),
    )


# ============= User Management Endpoints =============

@router.get("/users", response_model=list[UserListResponse])
def list_users(
    status_filter: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("user.view"))
):
    """List all users (requires user.view permission)"""
    query = db.query(User).options(joinedload(User.roles))
    
    query = query.filter(User.company_id == current_user.company_id)
    
    if status_filter:
        query = query.filter(User.status == status_filter)
    
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        UserListResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            status=u.status,
            is_approved=u.is_approved,
            roles=[r.name for r in u.roles] or ([u.role.name] if u.role else []),
            created_at=u.created_at,
        )
        for u in users
    ]


@router.get("/users/pending", response_model=list[UserListResponse])
def list_pending_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("user.approve"))
):
    """List users pending approval"""
    query = (
        db.query(User)
        .options(joinedload(User.roles))
        .filter(User.status == "pending", User.is_approved == False)
    )
    
    query = query.filter(User.company_id == current_user.company_id)
        
    users = query.order_by(User.created_at).all()
    
    return [
        UserListResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            status=u.status,
            is_approved=u.is_approved,
            roles=[r.name for r in u.roles] or ([u.role.name] if u.role else []),
            created_at=u.created_at,
        )
        for u in users
    ]


@router.get("/users/{user_id}", response_model=UserDetailResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("user.view"))
):
    """Get user details by ID"""
    user = (
        db.query(User)
        .options(
            joinedload(User.roles).joinedload(Role.permissions),
            joinedload(User.direct_permissions),
            joinedload(User.role).joinedload(Role.permissions)
        )
        .filter(User.id == user_id)
        .first()
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if user.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return _user_detail_response(user, db)


@router.post("/users/{user_id}/approve", response_model=UserResponse)
def approve_or_reject_user(
    user_id: int,
    payload: UserApprovalRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("user.approve"))
):
    """Approve or reject a user registration"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if user.company_id != admin.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if payload.approved:
        user.status = "active"
        user.is_approved = True
        user.approval_status = "approved"
        user.approved_by = admin.id
        user.approved_at = datetime.utcnow()
        action = "APPROVE"
        description = f"User {user.email} approved by {admin.email}"
    else:
        user.status = "suspended"
        user.is_approved = False
        user.approval_status = "rejected"
        user.is_active = False
        user.approved_by = admin.id
        user.approved_at = datetime.utcnow()
        action = "REJECT"
        description = f"User {user.email} rejected by {admin.email}"
    
    # Log approval/rejection
    log_user_action(
        db,
        user_id=admin.id,
        action=action,
        module="Admin",
        entity_type="user",
        entity_id=user.id,
        description=description,
        details={"target_email": user.email, "approved": payload.approved},
        request=request,
    )
    
    db.commit()
    db.refresh(user)
    return _user_response(user)


@router.patch("/users/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("user.update"))
):
    """Update user status (active/suspended)"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if payload.status not in ["active", "suspended"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'active' or 'suspended'"
        )
    
    old_status = user.status
    user.status = payload.status
    user.is_active = payload.status == "active"
    
    # Log status change
    log_update(
        db,
        user_id=admin.id,
        entity_type="user",
        entity_id=user.id,
        module="Admin",
        description=f"User {user.email} status changed from {old_status} to {payload.status}",
        details={"old_status": old_status, "new_status": payload.status},
        request=request,
    )
    
    db.commit()
    db.refresh(user)
    return _user_response(user)


@router.post("/users/{user_id}/roles", response_model=UserDetailResponse)
def assign_roles_to_user(
    user_id: int,
    payload: AssignRolesRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("role.assign"))
):
    """Assign roles to a user"""
    user = RBACService.assign_roles_to_user(db, user_id, payload.role_ids)
    
    # Log role assignment
    log_update(
        db,
        user_id=admin.id,
        entity_type="user",
        entity_id=user.id,
        module="Admin",
        description=f"Roles assigned to user {user.email}",
        details={"role_ids": payload.role_ids, "roles": [r.name for r in user.roles]},
        request=request,
    )
    
    db.commit()
    db.refresh(user)
    return _user_detail_response(user, db)


@router.post("/users/{user_id}/permissions", response_model=UserDetailResponse)
def assign_permissions_to_user(
    user_id: int,
    payload: AssignPermissionsRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("permission.assign"))
):
    """Assign direct permission overrides to a user"""
    user = RBACService.assign_permissions_to_user(db, user_id, payload.permission_ids)
    
    # Log permission assignment
    log_update(
        db,
        user_id=admin.id,
        entity_type="user",
        entity_id=user.id,
        module="Admin",
        description=f"Direct permissions assigned to user {user.email}",
        details={
            "permission_ids": payload.permission_ids,
            "permissions": [p.name for p in user.direct_permissions]
        },
        request=request,
    )
    
    db.commit()
    db.refresh(user)
    return _user_detail_response(user, db)


# ============= Role Management Endpoints =============

@router.get("/roles", response_model=list[RoleDetailResponse])
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("role.view"))
):
    """List all roles with their permissions"""
    roles = RBACService.list_roles(db)
    
    return [
        RoleDetailResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            created_at=r.created_at,
            updated_at=r.updated_at,
            permissions=[
                PermissionResponse(
                    id=p.id,
                    name=p.name,
                    module=p.module,
                    description=p.description,
                    created_at=p.created_at,
                )
                for p in r.permissions
            ],
        )
        for r in roles
    ]


@router.get("/roles/{role_id}", response_model=RoleDetailResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("role.view"))
):
    """Get role details by ID"""
    role = RBACService.get_role_by_id(db, role_id)
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
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


# ============= Permission Endpoints =============

@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    module: str = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("permission.view"))
):
    """List all permissions, optionally filtered by module"""
    permissions = RBACService.list_permissions(db, module=module)
    
    return [
        PermissionResponse(
            id=p.id,
            name=p.name,
            module=p.module,
            description=p.description,
            created_at=p.created_at,
        )
        for p in permissions
    ]


@router.get("/permissions/modules", response_model=list[str])
def list_modules(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("permission.view"))
):
    """Get list of all modules"""
    return RBACService.get_modules(db)
