"""
Company self-service routes — company admins manage their own features and users.
All queries are automatically scoped to request.state.company_id.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_permissions, get_db
from app.core.audit import log_update
from app.core.database import get_db
from app.models.auth import User
from app.models.company import Company, CompanyFeature
from app.schemas.company import (
    CompanyFeatureResponse,
    CompanyResponse,
    CurrencyUpdate,
    FeatureBulkUpdate,
)

router = APIRouter(prefix="/company", tags=["Company Settings"])


@router.get("", response_model=CompanyResponse)
def get_my_company(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's company details."""
    company_id = request.state.company_id
    if not company_id:
        raise HTTPException(status_code=404, detail="No company associated")
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("/features", response_model=dict)
def get_my_features(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get feature flags for the current user's company."""
    company_id = request.state.company_id
    if not company_id:
        return {}
    rows = db.query(CompanyFeature).filter(CompanyFeature.company_id == company_id).all()
    return {r.feature_key: r.enabled for r in rows}


@router.patch("/features", response_model=list[CompanyFeatureResponse])
def update_my_features(
    payload: FeatureBulkUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("admin.manage")),
):
    """Update feature flags (company admin only)."""
    company_id = request.state.company_id
    if not company_id:
        raise HTTPException(status_code=403, detail="No company context")

    for key, enabled in payload.features.items():
        feat = (
            db.query(CompanyFeature)
            .filter(CompanyFeature.company_id == company_id, CompanyFeature.feature_key == key)
            .first()
        )
        if feat:
            feat.enabled = enabled
            feat.updated_at = datetime.utcnow()
        else:
            db.add(CompanyFeature(company_id=company_id, feature_key=key, enabled=enabled))

    log_update(
        db, user_id=admin.id, entity_type="company_features", entity_id=company_id,
        company_id=company_id, module="Admin",
        description="Company features updated",
        details=payload.features,
        request=request,
    )
    db.commit()
    return db.query(CompanyFeature).filter(CompanyFeature.company_id == company_id).all()


@router.get("/users")
def list_my_company_users(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("user.view")),
):
    """List all users in the current company."""
    company_id = request.state.company_id
    query = (
        db.query(User)
        .options(joinedload(User.roles))
        .filter(User.company_id == company_id)
    )
    if not current_user.is_super_admin:
        query = query.filter(User.is_super_admin == False)
        
    users = query.order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "status": u.status,
            "is_approved": u.is_approved,
            "roles": [r.name for r in u.roles],
            "created_at": u.created_at,
        }
        for u in users
    ]


# ── Currency Settings ─────────────────────────────────────────────────────────

@router.get("/currency")
def get_currency(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current company's currency setting."""
    company_id = request.state.company_id
    if not company_id:
        return {"currency_code": "PKR"}
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"currency_code": "PKR"}
    return {"currency_code": company.currency_code or "PKR"}


@router.patch("/currency")
def update_currency(
    payload: CurrencyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permissions("admin.manage")),
):
    """Update the company's currency setting (admin only)."""
    company_id = request.state.company_id
    if not company_id:
        raise HTTPException(status_code=403, detail="No company context")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    old_currency = company.currency_code
    company.currency_code = payload.currency_code
    company.updated_at = datetime.utcnow()

    log_update(
        db, user_id=admin.id, entity_type="company", entity_id=company_id,
        company_id=company_id, module="Admin",
        description=f"Currency changed from {old_currency} to {payload.currency_code}",
        details={"old": old_currency, "new": payload.currency_code},
        request=request,
    )
    db.commit()
    return {"currency_code": company.currency_code}
