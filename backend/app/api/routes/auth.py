import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text

log = logging.getLogger("rems.auth")
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.audit import log_create, log_user_action
from app.core.database import get_db
from app.services.activity_service import ActivityService
from app.core.security import create_access_token, hash_password, verify_password
from app.models.auth import User
from app.models.company import Company
from app.schemas.auth import (
    AuthToken,
    LoginRequest,
    RegisterRequest,
    UserDetailResponse,
    UserResponse,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    from app.models.company import Company

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

    from app.core.tenant_manager import tenant_manager
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        existing = tenant_db.query(User).filter(User.email == payload.email, User.company_id == company_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

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
        )
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
            approval_status=user.approval_status,
        )
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


@router.post("/login", response_model=AuthToken)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    from app.core.config import settings as app_settings
    from app.core.master_db import ensure_master_schema
    from app.tenant import get_master_session
    from sqlalchemy import text

    if payload.email == app_settings.superadmin_email:
        sa_user = db.query(User).filter(
            User.email == payload.email,
            User.is_super_admin == True,
        ).first()

        if not sa_user:
            log.warning("Superadmin login failed: user not found for %s", payload.email)
            ActivityService.log_login(db=db, actor={"email": payload.email, "role": "superadmin"}, success=False, request=request)
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if not verify_password(payload.password, sa_user.hashed_password):
            log.warning("Superadmin login failed: wrong password for %s", payload.email)
            ActivityService.log_login(db=db, actor=sa_user, success=False, request=request)
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if not sa_user.is_active or not sa_user.is_approved:
            log.warning("Superadmin login blocked: account inactive for %s", payload.email)
            ActivityService.log_login(db=db, actor=sa_user, success=False, request=request)
            db.commit()
            raise HTTPException(status_code=403, detail="Super Admin account is not active")

        sa_user.last_login = datetime.utcnow()
        ActivityService.log_login(db=db, actor=sa_user, success=True, request=request)
        db.commit()

        token = create_access_token(subject=sa_user.email, company_id=None, is_super_admin=True)
        log.info("Superadmin login success: %s", payload.email)
        return AuthToken(
            access_token=token,
            is_super_admin=True,
            company_id=None,
            company_name=None,
        )

    company_uuid = None
    company_name = None
    company_slug = None
    login_user = None

    master_db = get_master_session()
    try:
        try:
            ensure_master_schema(master_db)
            row = master_db.execute(
                text("""
                    SELECT id, name, admin_email, admin_password_hash, status, expiry_date, schema_name
                    FROM master.companies
                    WHERE admin_email = :email
                """),
                {"email": payload.email},
            ).fetchone()
            if row:
                log.info("Company admin found in master.companies: %s", payload.email)
        except Exception as exc:
            log.warning("master.companies lookup failed for %s: %s", payload.email, exc)
            row = None

        if row:
            if not verify_password(payload.password, row[3]):
                log.warning("Company admin wrong password: %s", payload.email)
                raise HTTPException(status_code=401, detail="Invalid email or password")
            if row[4] == "suspended":
                log.warning("Company admin account suspended: %s", payload.email)
                raise HTTPException(status_code=403, detail="Account suspended. Contact your administrator.")
            if row[5] and row[5] < datetime.now(timezone.utc):
                log.warning("Company admin license expired: %s", payload.email)
                raise HTTPException(status_code=403, detail="License expired. Contact your administrator.")
            company_uuid = str(row[0])
            company_name = row[1]
            schema_name = row[6] or ""
            company_slug = schema_name.replace("company_", "") if schema_name else ""
            login_user = db.query(User).filter(User.email == payload.email).first()
        else:
            log.info("Falling back to User model lookup for %s", payload.email)
            login_user = db.query(User).filter(
                User.email == payload.email,
                User.is_super_admin == False,
            ).first()
            if not login_user:
                log.warning("Company admin not found in users table: %s", payload.email)
                ActivityService.log_login(db=db, actor={"email": payload.email, "role": "company_admin"}, success=False, request=request)
                db.commit()
                raise HTTPException(status_code=401, detail="Invalid email or password")
            if not verify_password(payload.password, login_user.hashed_password):
                log.warning("Company admin wrong password (User table): %s", payload.email)
                ActivityService.log_login(db=db, actor=login_user, success=False, request=request)
                db.commit()
                raise HTTPException(status_code=401, detail="Invalid email or password")

            company = master_db.query(Company).filter(
                Company.id == login_user.company_id
            ).first()
            if not company:
                log.warning("Company not found for user %s (company_id=%s)", payload.email, login_user.company_id)
                ActivityService.log_login(db=db, actor=login_user, success=False, request=request)
                db.commit()
                raise HTTPException(status_code=401, detail="Invalid email or password")
            if company.status == "suspended" or not login_user.is_active:
                log.warning("Company admin account suspended: %s", payload.email)
                ActivityService.log_login(db=db, actor=login_user, success=False, request=request)
                db.commit()
                raise HTTPException(status_code=403, detail="Account suspended. Contact your administrator.")

            company_uuid = str(company.id)
            company_name = company.name
            company_slug = company.slug
    finally:
        master_db.close()

    if login_user:
        if login_user.status == "pending":
            ActivityService.log_login(db=db, actor=login_user, success=False, request=request)
            db.commit()
            raise HTTPException(status_code=403, detail="Your account is awaiting admin approval")
        if login_user.status == "rejected":
            ActivityService.log_login(db=db, actor=login_user, success=False, request=request)
            db.commit()
            raise HTTPException(status_code=403, detail="Your account access was not approved")
        if login_user.status == "suspended" or not login_user.is_active:
            ActivityService.log_login(db=db, actor=login_user, success=False, request=request)
            db.commit()
            raise HTTPException(status_code=403, detail="Your account access was not approved")

    login_success = company_uuid is not None
    try:
        login_actor = login_user if login_user is not None else {"email": payload.email, "role": "company_admin"}
    except UnboundLocalError:
        login_actor = {"email": payload.email, "role": "company_admin"}

    if not login_success:
        ActivityService.log_login(db=db, actor=login_actor, success=False, request=request)
        db.commit()
        log.warning("Company admin login failed: no company_uuid resolved for %s", payload.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    ActivityService.log_login(db=db, actor=login_actor, success=True, request=request)
    db.commit()

    token = create_access_token(
        subject=payload.email,
        company_id=company_uuid,
        is_super_admin=False,
        extra_payload={"company_slug": company_slug},
    )

    return AuthToken(
        access_token=token,
        is_super_admin=False,
        company_id=company_uuid,
        company_name=company_name,
    )


@router.get("/me", response_model=UserDetailResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    features = {}
    if current_user.company_id:
        from app.models.company import CompanyFeature
        rows = db.query(CompanyFeature).filter(CompanyFeature.company_id == current_user.company_id).all()
        features = {r.feature_key: r.enabled for r in rows}

    return UserDetailResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        status=current_user.status,
        is_approved=current_user.is_approved,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        last_login=current_user.last_login,
        company_id=current_user.company_id,
        is_super_admin=current_user.is_super_admin,
        approval_status=current_user.approval_status,
        features=features,
        approved_by=current_user.approved_by,
        approved_at=current_user.approved_at,
    )


@router.post("/logout")
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ActivityService.log_logout(db=db, actor=current_user, request=request)
    db.commit()
    return {"message": "Logged out successfully"}
