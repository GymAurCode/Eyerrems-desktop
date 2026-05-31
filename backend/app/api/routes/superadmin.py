"""
Super Admin API Routes — manage companies, provision schemas, view stats.

All routes verify JWT role === "superadmin".  Company tokens are rejected.
"""
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, AfterValidator
from sqlalchemy import text

from app.api.deps import require_super_admin
from app.core.config import settings
from app.core.master_db import (
    ensure_master_schema,
    provision_company_schema,
    drop_company_schema,
)
from app.core.security import hash_password
from app.models.auth import User
from app.tenant import get_master_session

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


# ── Schemas ───────────────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_email(v: str) -> str:
    if not _EMAIL_RE.match(v):
        raise ValueError("Invalid email format")
    return v


LenientEmail = Annotated[str, AfterValidator(_validate_email)]


class CompanyCreateRequest(BaseModel):
    name: str
    admin_email: LenientEmail
    admin_password: str
    phone: Optional[str] = None
    expiry_option: str = "1_year"  # 1_month, 3_months, 6_months, 1_year, custom
    custom_expiry_date: Optional[str] = None  # ISO date string for custom


class PermissionsUpdateRequest(BaseModel):
    permissions: dict


class CompanyResponse(BaseModel):
    id: str
    name: str
    admin_email: str
    phone: Optional[str]
    status: str
    schema_name: str
    expiry_date: str
    created_at: str


class StatsResponse(BaseModel):
    total_companies: int
    active_companies: int
    suspended_companies: int
    expired_companies: int


class ExtendExpiryRequest(BaseModel):
    expiry_date: Optional[str] = None
    extend_days: Optional[int] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

EXPIRY_MAP = {
    "1_month": 30,
    "3_months": 90,
    "6_months": 180,
    "1_year": 365,
}


def seed_superadmin():
    """Ensure the super admin user exists in the public schema users table."""
    db = get_master_session()
    try:
        from app.core.master_db import ensure_master_schema
        ensure_master_schema(db)
        db.execute(text("SET search_path TO public"))

        existing = db.execute(
            text("SELECT id FROM users WHERE email = :email AND is_super_admin = TRUE"),
            {"email": settings.superadmin_email},
        ).fetchone()

        if not existing:
            pw_hash = hash_password(settings.superadmin_password)
            db.execute(
                text("""
                    INSERT INTO users (email, full_name, hashed_password, is_super_admin,
                                       status, is_approved, is_active, approval_status)
                    VALUES (:email, :name, :pw, TRUE, 'active', TRUE, TRUE, 'approved')
                """),
                {
                    "email": settings.superadmin_email,
                    "name": "Super Admin",
                    "pw": pw_hash,
                },
            )
            db.commit()
            log.info(f"[SuperAdmin] Seeded superadmin user: {settings.superadmin_email}")
    except Exception as e:
        db.rollback()
        log.warning(f"[SuperAdmin] Seed superadmin skipped: {e}")
    finally:
        db.close()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsResponse)
def get_stats(
    _: User = Depends(require_super_admin),
):
    """Return company counts by status."""
    db = get_master_session()
    try:
        ensure_master_schema(db)
        rows = db.execute(
            text("""
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE status = 'active' AND expiry_date > NOW()) AS active,
                    COUNT(*) FILTER (WHERE status = 'suspended') AS suspended,
                    COUNT(*) FILTER (WHERE status = 'expired' OR expiry_date < NOW()) AS expired
                FROM master.companies
            """)
        ).fetchone()
        return StatsResponse(
            total_companies=rows[0] or 0,
            active_companies=rows[1] or 0,
            suspended_companies=rows[2] or 0,
            expired_companies=rows[3] or 0,
        )
    finally:
        db.close()


@router.get("/companies")
def list_companies(
    _: User = Depends(require_super_admin),
):
    """List all companies."""
    db = get_master_session()
    try:
        ensure_master_schema(db)
        rows = db.execute(
            text("""
                SELECT id, name, admin_email, phone, status,
                       schema_name, expiry_date, created_at
                FROM master.companies
                ORDER BY created_at DESC
            """)
        ).fetchall()
        return [
            {
                "id": str(r[0]),
                "name": r[1],
                "admin_email": r[2],
                "phone": r[3],
                "status": r[4],
                "schema_name": r[5],
                "expiry_date": r[6].isoformat() if r[6] else None,
                "created_at": r[7].isoformat() if r[7] else None,
            }
            for r in rows
        ]
    finally:
        db.close()


@router.post("/companies", status_code=201)
def create_company(
    payload: CompanyCreateRequest,
    _: User = Depends(require_super_admin),
):
    """Create a new company, provision its schema, and seed admin user."""
    db = get_master_session()
    try:
        ensure_master_schema(db)

        # Check if admin_email already exists
        existing = db.execute(
            text("SELECT id FROM master.companies WHERE admin_email = :email"),
            {"email": payload.admin_email},
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="A company with this admin email already exists")

        # Generate schema name
        schema_name = "company_" + uuid.uuid4().hex[:8]

        # Calculate expiry
        if payload.expiry_option == "custom" and payload.custom_expiry_date:
            expiry_date = datetime.fromisoformat(payload.custom_expiry_date)
        else:
            days = EXPIRY_MAP.get(payload.expiry_option, 365)
            expiry_date = datetime.now(timezone.utc) + timedelta(days=days)

        # Hash admin password
        pw_hash = hash_password(payload.admin_password)

        # Insert company into master.companies
        result = db.execute(
            text("""
                INSERT INTO master.companies (name, admin_email, admin_password_hash,
                                              phone, status, expiry_date, schema_name)
                VALUES (:name, :email, :pw, :phone, 'active', :expiry, :schema)
                RETURNING id, name, admin_email, phone, status, schema_name, expiry_date, created_at
            """),
            {
                "name": payload.name,
                "email": payload.admin_email,
                "pw": pw_hash,
                "phone": payload.phone or "",
                "expiry": expiry_date,
                "schema": schema_name,
            },
        )
        company_row = result.fetchone()
        db.commit()

        # Seed default permissions (all modules and tabs enabled)
        default_permissions = {
            "properties": {"enabled": True, "tabs": {"overview": True, "units": True, "tenants": True, "maintenance": True, "documents": True}},
            "tenants": {"enabled": True, "tabs": {"profile": True, "payments": True, "complaints": True, "documents": True}},
            "crm": {"enabled": True, "tabs": {"leads": True, "contacts": True, "deals": True}},
            "hr": {"enabled": True, "tabs": {"employees": True, "payroll": True, "attendance": True}},
            "finance": {"enabled": True, "tabs": {"income": True, "expenses": True, "reports": True, "invoices": True}},
            "maintenance": {"enabled": True, "tabs": {"open": True, "in_progress": True, "resolved": True}},
            "reports": {"enabled": True, "tabs": {}},
            "reminders": {"enabled": True, "tabs": {}},
            "settings": {"enabled": True, "tabs": {}},
        }
        db.execute(
            text("""
                UPDATE master.companies
                SET permissions = CAST(:permissions AS jsonb)
                WHERE id = :id
            """),
            {"id": str(company_row[0]), "permissions": json.dumps(default_permissions)},
        )
        db.commit()

        # Provision the schema and all tables
        provision_company_schema(db, schema_name, str(company_row[0]))

        # Create admin user in the company schema
        db.execute(text(f"SET search_path TO {schema_name},public"))

        # Seed default RBAC permissions and roles into the new schema
        from app.services.rbac_service import RBACService
        RBACService.seed_default_permissions(db)
        RBACService.seed_default_roles(db)
        db.commit()

        # Get the Admin role (now seeded) — use fully-qualified table name
        # because db.commit() may have reset the search_path on this connection.
        role = db.execute(
            text(f"SELECT id FROM {schema_name}.roles WHERE name = 'Admin' ORDER BY id LIMIT 1")
        ).fetchone()

        role_id = None
        if role:
            role_id = role[0]

        # Create the company row in tenant's own companies table
        db.execute(
            text(f"""
                INSERT INTO {schema_name}.companies (master_id, name, slug, email, status)
                VALUES (:mid, :name, :slug, :email, 'active')
            """),
            {
                "mid": str(company_row[0]),
                "name": payload.name,
                "slug": schema_name,
                "email": payload.admin_email,
            },
        )

        db.execute(
            text(f"""
                INSERT INTO {schema_name}.users (email, full_name, hashed_password,
                    company_id, status, is_approved, is_active, approval_status, role_id)
                VALUES (:email, :name, :pw, (SELECT id FROM {schema_name}.companies WHERE slug = :slug),
                        'active', TRUE, TRUE, 'approved', :role_id)
            """),
            {
                "email": payload.admin_email,
                "name": payload.name + " Admin",
                "pw": pw_hash,
                "slug": schema_name,
                "role_id": role_id,
            },
        )

        db.commit()

        return {
            "id": str(company_row[0]),
            "name": company_row[1],
            "admin_email": company_row[2],
            "phone": company_row[3],
            "status": company_row[4],
            "schema_name": company_row[5],
            "expiry_date": company_row[6].isoformat() if company_row[6] else None,
            "created_at": company_row[7].isoformat() if company_row[7] else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create company: {str(e)}")
    finally:
        db.close()


@router.patch("/companies/{company_id}/suspend")
def suspend_company(
    company_id: str,
    _: User = Depends(require_super_admin),
):
    """Suspend a company."""
    db = get_master_session()
    try:
        ensure_master_schema(db)
        result = db.execute(
            text("UPDATE master.companies SET status = 'suspended' WHERE id = :id RETURNING id, name, status"),
            {"id": company_id},
        ).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Company not found")
        db.commit()
        return {"id": str(result[0]), "name": result[1], "status": result[2]}
    finally:
        db.close()


@router.patch("/companies/{company_id}/activate")
def activate_company(
    company_id: str,
    _: User = Depends(require_super_admin),
):
    """Activate a suspended or expired company."""
    db = get_master_session()
    try:
        ensure_master_schema(db)
        result = db.execute(
            text("UPDATE master.companies SET status = 'active' WHERE id = :id RETURNING id, name, status"),
            {"id": company_id},
        ).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Company not found")
        db.commit()
        return {"id": str(result[0]), "name": result[1], "status": result[2]}
    finally:
        db.close()


@router.get("/companies/{company_id}/permissions")
def get_company_permissions(
    company_id: str,
    _: User = Depends(require_super_admin),
):
    """Get the permissions configuration for a company."""
    db = get_master_session()
    try:
        ensure_master_schema(db)
        row = db.execute(
            text("SELECT permissions FROM master.companies WHERE id = :id"),
            {"id": company_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Company not found")
        perms = row[0] or {}
        return {"permissions": perms}
    finally:
        db.close()


@router.patch("/companies/{company_id}/permissions")
def update_company_permissions(
    company_id: str,
    payload: PermissionsUpdateRequest,
    _: User = Depends(require_super_admin),
):
    """Update the permissions configuration for a company."""
    db = get_master_session()
    try:
        ensure_master_schema(db)

        row = db.execute(
            text("""
                UPDATE master.companies
                SET permissions = CAST(:permissions AS jsonb)
                WHERE id = :id
                RETURNING permissions
            """),
            {"id": company_id, "permissions": json.dumps(payload.permissions)},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Company not found")
        db.commit()
        return {"permissions": row[0]}
    finally:
        db.close()


@router.patch("/companies/{company_id}/extend-expiry")
def extend_expiry(
    company_id: str,
    payload: ExtendExpiryRequest,
    _: User = Depends(require_super_admin),
):
    """Extend a company's expiry date."""
    db = get_master_session()
    try:
        ensure_master_schema(db)

        if payload.expiry_date:
            new_expiry = datetime.fromisoformat(payload.expiry_date)
        elif payload.extend_days:
            current = db.execute(
                text("SELECT expiry_date FROM master.companies WHERE id = :id"),
                {"id": company_id},
            ).fetchone()
            if not current:
                raise HTTPException(status_code=404, detail="Company not found")
            base = current[0] or datetime.now(timezone.utc)
            new_expiry = base + timedelta(days=payload.extend_days)
        else:
            raise HTTPException(status_code=400, detail="expiry_date or extend_days required")

        result = db.execute(
            text("""
                UPDATE master.companies
                SET expiry_date = :expiry, status = 'active'
                WHERE id = :id
                RETURNING id, name, status, expiry_date
            """),
            {"id": company_id, "expiry": new_expiry},
        ).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Company not found")
        db.commit()

        return {
            "id": str(result[0]),
            "name": result[1],
            "status": result[2],
            "expiry_date": result[3].isoformat() if result[3] else None,
        }
    finally:
        db.close()


@router.delete("/companies/{company_id}")
def delete_company(
    company_id: str,
    _: User = Depends(require_super_admin),
):
    """Delete a company record and optionally drop its schema."""
    db = get_master_session()
    try:
        ensure_master_schema(db)

        company = db.execute(
            text("SELECT id, name, schema_name FROM master.companies WHERE id = :id"),
            {"id": company_id},
        ).fetchone()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        schema_name = company[2]

        # Drop the schema
        drop_company_schema(db, schema_name)

        # Delete the company record
        db.execute(
            text("DELETE FROM master.companies WHERE id = :id"),
            {"id": company_id},
        )
        db.commit()

        return {"detail": f"Company '{company[1]}' deleted successfully"}
    finally:
        db.close()


import logging
log = logging.getLogger("rems.superadmin")
