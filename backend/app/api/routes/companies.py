"""
Super-Admin company management routes.

All routes here require is_super_admin = True.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_super_admin, get_db
from app.core.audit import log_create, log_update
from app.core.database import get_db
from app.core.security import hash_password
from app.models.auth import Permission, Role, User
from app.models.company import Company, CompanyFeature
from app.schemas.company import (
    AdminUserCreate,
    CompanyCreate,
    CompanyCreateResponse,
    CompanyFeatureResponse,
    CompanyResponse,
    CompanyStatusUpdate,
    CompanyUpdate,
    CompanyUserCreate,
    CompanyUserResponse,
    FeatureBulkUpdate,
    FeatureUpdate,
)
from app.services.rbac_service import RBACService

router = APIRouter(prefix="/companies", tags=["Super Admin — Companies"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _seed_features(db: Session, company_id: int) -> None:
    """Create default feature flags for a new company."""
    for key in CompanyFeature.DEFAULT_FEATURES:
        db.add(CompanyFeature(company_id=company_id, feature_key=key, enabled=True))


def _seed_company_roles(db: Session, company_id: int) -> Role:
    """
    Create company-scoped Admin / Manager / Staff roles.

    Returns the Admin role so it can be assigned to the initial admin user.
    Roles are scoped to this company (company_id set) so they don't bleed
    across tenants.
    """
    # Ensure system-level permissions exist (idempotent)
    RBACService.seed_default_permissions(db)

    all_permissions = db.query(Permission).all()

    roles_config = {
        "Admin": {
            "description": "Full system access — all permissions",
            "permissions": all_permissions,
        },
        "Manager": {
            "description": "Department management access",
            "permissions": db.query(Permission).filter(
                Permission.name.in_([
                    "user.view", "dashboard.view", "dashboard:view",
                    "hr.view", "hr.create", "hr.update",
                    "finance.view", "finance.create", "finance.update",
                    "crm.view", "crm.create", "crm.update",
                    "property.view", "property.create", "property.update",
                    "tenant.view", "tenant.create", "tenant.update",
                    "construction.view", "construction.create", "construction.update",
                ])
            ).all(),
        },
        "Staff": {
            "description": "Basic staff access",
            "permissions": db.query(Permission).filter(
                Permission.name.in_([
                    "dashboard.view", "dashboard:view",
                    "hr.view", "finance.view",
                    "crm.view", "crm.create", "crm.update",
                    "property.view", "tenant.view", "construction.view",
                    "mail.view", "mail.send",
                ])
            ).all(),
        },
    }

    admin_role: Role | None = None
    for role_name, config in roles_config.items():
        # Check if this company already has this role (idempotent)
        existing = (
            db.query(Role)
            .filter(Role.name == role_name, Role.company_id == company_id)
            .first()
        )
        if existing:
            if role_name == "Admin":
                admin_role = existing
            continue

        role = Role(
            name=role_name,
            description=config["description"],
            company_id=company_id,
            permissions=config["permissions"],
        )
        db.add(role)
        db.flush()
        if role_name == "Admin":
            admin_role = role

    if admin_role is None:
        raise RuntimeError("Failed to create or find Admin role for company")

    return admin_role


# ── Company CRUD ──────────────────────────────────────────────────────────────

@router.post("", response_model=CompanyCreateResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: CompanyCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """
    Create a new tenant company with an initial admin user (super-admin only).

    The admin_user is created atomically with the company — if either step fails
    the entire transaction is rolled back so we never end up with an admin-less company.
    """
    # ── 1. Slug uniqueness check ──────────────────────────────────────────────
    if db.query(Company).filter(Company.slug == payload.slug).first():
        raise HTTPException(status_code=400, detail="Slug already taken")

    try:
        # ── 3. Create company in master.db ────────────────────────────────────
        company = Company(name=payload.name, slug=payload.slug, plan=payload.plan)
        db.add(company)
        db.flush()  # get company.id without committing

        # ── 4. Initialize company-specific database and seed features/roles ───
        from app.core.tenant_manager import tenant_manager
        tenant_manager.initialize_tenant_db(company.id, company.slug)

        # ── 5. Create initial admin user in the tenant's isolated database ────
        tenant_db = tenant_manager.get_tenant_session(company.slug)
        try:
            # Check if email is globally unique or already in tenant db
            if tenant_db.query(User).filter(User.email == payload.admin_user.email).first():
                raise HTTPException(
                    status_code=400,
                    detail=f"Email '{payload.admin_user.email}' is already registered in the system",
                )

            # Retrieve the created Admin role in the tenant database
            admin_role = (
                tenant_db.query(Role)
                .filter(Role.name == "Admin", Role.company_id == company.id)
                .first()
            )
            if not admin_role:
                raise RuntimeError("Admin role not found in tenant database")

            new_admin = User(
                email=payload.admin_user.email,
                full_name=payload.admin_user.name,
                hashed_password=hash_password(payload.admin_user.password),
                company_id=company.id,
                is_super_admin=False,
                status="active",
                is_approved=True,
                is_active=True,
                approval_status="approved",
                approved_by=admin.id,
                approved_at=datetime.utcnow(),
            )
            new_admin.roles = [admin_role]
            tenant_db.add(new_admin)
            tenant_db.commit()
            tenant_db.refresh(new_admin)

            # Copy admin attributes for response serialization
            admin_id = new_admin.id
            admin_email = new_admin.email
            admin_name = new_admin.full_name
            admin_status = new_admin.status
            admin_is_approved = new_admin.is_approved
            admin_company_id = new_admin.company_id
            admin_roles = [r.name for r in new_admin.roles]
            admin_created_at = new_admin.created_at
        except Exception as t_exc:
            tenant_db.rollback()
            raise t_exc
        finally:
            tenant_db.close()

        # ── 6. Audit log in master.db ─────────────────────────────────────────
        log_create(
            db, user_id=admin.id, entity_type="company", entity_id=company.id,
            company_id=None, module="SuperAdmin",
            description=f"Company '{company.name}' created with admin user '{payload.admin_user.email}'",
            details={"slug": company.slug, "plan": company.plan, "admin_email": payload.admin_user.email},
            request=request,
        )

        db.commit()
        db.refresh(company)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Company creation failed and was rolled back: {str(exc)}",
        ) from exc

    return CompanyCreateResponse(
        id=company.id,
        name=company.name,
        slug=company.slug,
        status=company.status,
        plan=company.plan,
        created_at=company.created_at,
        updated_at=company.updated_at,
        admin_user=CompanyUserResponse(
            id=admin_id,
            email=admin_email,
            full_name=admin_name,
            status=admin_status,
            is_approved=admin_is_approved,
            company_id=admin_company_id,
            roles=admin_roles,
            created_at=admin_created_at,
        ),
    )


@router.get("", response_model=list[CompanyResponse])
def list_companies(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """List all tenant companies."""
    return db.query(Company).order_by(Company.created_at.desc()).all()


@router.post("/{company_id}/create-admin", response_model=CompanyUserResponse, status_code=201)
def create_company_admin(
    company_id: int,
    payload: AdminUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """
    Assign an admin user to an existing company (super-admin only).

    Use this if the company was created without an admin, or to add a second admin.
    The user is created with status=active and the company's Admin role.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    from app.core.tenant_manager import tenant_manager
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        if tenant_db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(
                status_code=400,
                detail=f"Email '{payload.email}' is already registered in the system",
            )

        # Ensure company roles exist in the tenant database
        admin_role = (
            tenant_db.query(Role)
            .filter(Role.name == "Admin", Role.company_id == company_id)
            .first()
        )
        if not admin_role:
            tenant_manager.initialize_tenant_db(company_id, company.slug)
            admin_role = (
                tenant_db.query(Role)
                .filter(Role.name == "Admin", Role.company_id == company_id)
                .first()
            )

        new_admin = User(
            email=payload.email,
            full_name=payload.name,
            hashed_password=hash_password(payload.password),
            company_id=company_id,
            is_super_admin=False,
            status="active",
            is_approved=True,
            is_active=True,
            approval_status="approved",
            approved_by=admin.id,
            approved_at=datetime.utcnow(),
        )
        new_admin.roles = [admin_role]
        tenant_db.add(new_admin)
        tenant_db.commit()
        tenant_db.refresh(new_admin)

        # Create log entry in master database
        log_create(
            db, user_id=admin.id, entity_type="user", entity_id=new_admin.id,
            company_id=company_id, module="SuperAdmin",
            description=f"Admin user '{new_admin.email}' created for company '{company.name}'",
            request=request,
        )
        db.commit()

        return CompanyUserResponse(
            id=new_admin.id,
            email=new_admin.email,
            full_name=new_admin.full_name,
            status=new_admin.status,
            is_approved=new_admin.is_approved,
            company_id=new_admin.company_id,
            roles=[r.name for r in new_admin.roles],
            created_at=new_admin.created_at,
        )
    except HTTPException:
        tenant_db.rollback()
        raise
    except Exception as e:
        tenant_db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_db.close()


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if payload.name is not None:
        company.name = payload.name
    if payload.plan is not None:
        company.plan = payload.plan
    company.updated_at = datetime.utcnow()

    log_update(
        db, user_id=admin.id, entity_type="company", entity_id=company.id,
        company_id=None, module="SuperAdmin",
        description=f"Company '{company.name}' updated",
        request=request,
    )
    db.commit()
    db.refresh(company)
    return company


@router.patch("/{company_id}/status", response_model=CompanyResponse)
def update_company_status(
    company_id: int,
    payload: CompanyStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """Activate or suspend a company."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    old_status = company.status
    company.status = payload.status
    company.updated_at = datetime.utcnow()

    log_update(
        db, user_id=admin.id, entity_type="company", entity_id=company.id,
        company_id=None, module="SuperAdmin",
        description=f"Company '{company.name}' status changed {old_status} → {payload.status}",
        details={"old": old_status, "new": payload.status},
        request=request,
    )
    db.commit()
    db.refresh(company)
    return company


# ── Feature management (super-admin) ─────────────────────────────────────────

@router.get("/{company_id}/features", response_model=list[CompanyFeatureResponse])
def get_company_features(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    from app.core.tenant_manager import tenant_manager
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        return tenant_db.query(CompanyFeature).filter(CompanyFeature.company_id == company_id).all()
    finally:
        tenant_db.close()


@router.patch("/{company_id}/features", response_model=list[CompanyFeatureResponse])
def update_company_features(
    company_id: int,
    payload: FeatureBulkUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """Enable/disable feature flags for a company."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    from app.core.tenant_manager import tenant_manager
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        for key, enabled in payload.features.items():
            feat = (
                tenant_db.query(CompanyFeature)
                .filter(CompanyFeature.company_id == company_id, CompanyFeature.feature_key == key)
                .first()
            )
            if feat:
                feat.enabled = enabled
                feat.updated_at = datetime.utcnow()
            else:
                tenant_db.add(CompanyFeature(company_id=company_id, feature_key=key, enabled=enabled))

        log_update(
            db, user_id=admin.id, entity_type="company_features", entity_id=company_id,
            company_id=None, module="SuperAdmin",
            description=f"Features updated for company '{company.name}'",
            details=payload.features,
            request=request,
        )
        tenant_db.commit()
        return tenant_db.query(CompanyFeature).filter(CompanyFeature.company_id == company_id).all()
    except Exception as e:
        tenant_db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_db.close()


# ── User management inside a company (super-admin) ───────────────────────────

@router.get("/{company_id}/users", response_model=list[CompanyUserResponse])
def list_company_users(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    from app.core.tenant_manager import tenant_manager
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        users = (
            tenant_db.query(User)
            .options(joinedload(User.roles))
            .filter(User.company_id == company_id)
            .order_by(User.created_at.desc())
            .all()
        )
        return [
            CompanyUserResponse(
                id=u.id, email=u.email, full_name=u.full_name,
                status=u.status, is_approved=u.is_approved,
                company_id=u.company_id,
                roles=[r.name for r in u.roles],
                created_at=u.created_at,
            )
            for u in users
        ]
    finally:
        tenant_db.close()


@router.post("/{company_id}/users", response_model=CompanyUserResponse, status_code=201)
def create_company_user(
    company_id: int,
    payload: CompanyUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """Create a user directly inside a company (super-admin only)."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    from app.core.tenant_manager import tenant_manager
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        existing = tenant_db.query(User).filter(User.email == payload.email, User.company_id == company_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered in this company")

        roles = tenant_db.query(Role).filter(Role.id.in_(payload.role_ids)).all() if payload.role_ids else []

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            company_id=company_id,
            is_super_admin=False,
            status="active",
            is_approved=True,
            is_active=True,
            approval_status="approved",
            approved_by=admin.id,
            approved_at=datetime.utcnow(),
        )
        user.roles = roles
        tenant_db.add(user)
        tenant_db.flush()

        log_create(
            db, user_id=admin.id, entity_type="user", entity_id=user.id,
            company_id=company_id, module="SuperAdmin",
            description=f"User {user.email} created in company {company.name}",
            request=request,
        )
        tenant_db.commit()
        tenant_db.refresh(user)

        return CompanyUserResponse(
            id=user.id, email=user.email, full_name=user.full_name,
            status=user.status, is_approved=user.is_approved,
            company_id=user.company_id,
            roles=[r.name for r in user.roles],
            created_at=user.created_at,
        )
    except HTTPException:
        tenant_db.rollback()
        raise
    except Exception as e:
        tenant_db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_db.close()


# ── System audit logs (super-admin) ──────────────────────────────────────────

@router.get("/audit-logs/all")
def all_audit_logs(
    company_id: int = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """View audit logs across all tenants."""
    from app.models.audit import AuditLog
    query = db.query(AuditLog)
    if company_id:
        query = query.filter(AuditLog.company_id == company_id)
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
