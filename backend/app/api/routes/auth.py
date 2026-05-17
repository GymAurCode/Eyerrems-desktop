from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_permissions
from app.core.audit import log_create, log_login, log_update, log_user_action
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.auth import Permission, Role, User
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

    # Resolve company
    company_slug = getattr(payload, "company_slug", None)
    if company_slug:
        company = db.query(Company).filter(Company.slug == company_slug).first()
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        if company.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company is suspended")
    else:
        company = db.query(Company).filter(Company.slug == "default").first()

    company_id = company.id if company else None

    # Email must be unique per company
    existing = db.query(User).filter(User.email == payload.email, User.company_id == company_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Get default Staff role (company-scoped first, then global)
    staff_role = (
        db.query(Role).filter(Role.name == "Staff", Role.company_id == company_id).first()
        or db.query(Role).filter(Role.name == "Staff", Role.company_id.is_(None)).first()
    )
    if not staff_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default role not configured. Please run database seed.",
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

    db.add(user)
    db.flush()

    log_create(
        db, user_id=user.id, entity_type="user", entity_id=user.id,
        company_id=company_id, module="Auth",
        description=f"User {user.email} registered",
        details={"email": user.email, "full_name": user.full_name},
        request=request,
    )

    db.commit()
    db.refresh(user)
    return _user_response(user)


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
    """Login and get access token with tenant context."""
    # Find user — super-admins have no company_id so search globally by email
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    user_roles = [r.name.lower() for r in (user.roles or [])]
    if user.role:
        user_roles.append(user.role.name.lower())
    is_admin = "admin" in user_roles or user.is_super_admin

    if not is_admin and (user.status != "active" or not user.is_approved):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is pending admin approval")

    # Check company status for non-super-admins
    if not user.is_super_admin and user.company_id:
        from app.models.company import Company
        company = db.query(Company).filter(Company.id == user.company_id).first()
        if company and company.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company account is suspended")

    user.last_login = datetime.utcnow()
    log_login(db, user.id, user.email, success=True, company_id=user.company_id, request=request)
    db.commit()

    token = create_access_token(
        subject=user.email,
        company_id=user.company_id,
        is_super_admin=user.is_super_admin,
    )

    return AuthToken(
        access_token=token,
        company_id=user.company_id,
        is_super_admin=user.is_super_admin,
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
    
    if not current_user.is_super_admin:
        query = query.filter(User.company_id == current_user.company_id)
        query = query.filter(User.is_super_admin == False)
    
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
    
    if not current_user.is_super_admin:
        query = query.filter(User.company_id == current_user.company_id)
        query = query.filter(User.is_super_admin == False)
        
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
        
    if not current_user.is_super_admin:
        if user.company_id != current_user.company_id or user.is_super_admin:
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
        
    if not admin.is_super_admin:
        if user.company_id != admin.company_id or user.is_super_admin:
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
