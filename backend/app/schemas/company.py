"""Pydantic schemas for Company and CompanyFeature."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


# ── Admin user embedded in company creation ───────────────────────────────────

class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Admin name cannot be empty")
        return v.strip()


# ── Company ───────────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str
    slug: str
    plan: str = "free"
    admin_user: AdminUserCreate  # required — every company must have an admin

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        import re
        v = v.lower().strip()
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug may only contain lowercase letters, digits, and hyphens")
        return v


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    currency_code: Optional[str] = None


class CurrencyUpdate(BaseModel):
    currency_code: str

    @field_validator("currency_code")
    @classmethod
    def valid_currency(cls, v: str) -> str:
        allowed = {"PKR", "USD"}
        if v.upper() not in allowed:
            raise ValueError(f"currency_code must be one of: {', '.join(sorted(allowed))}")
        return v.upper()


class CompanyStatusUpdate(BaseModel):
    status: str  # active | suspended

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in ("active", "suspended"):
            raise ValueError("status must be 'active' or 'suspended'")
        return v


class CompanyResponse(BaseModel):
    id: int
    name: str
    slug: str
    status: str
    plan: str
    currency_code: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanyCreateResponse(BaseModel):
    """Returned after company creation — includes the new admin user's credentials."""
    id: int
    name: str
    slug: str
    status: str
    plan: str
    created_at: datetime
    updated_at: datetime
    admin_user: "CompanyUserResponse"

    model_config = {"from_attributes": True}


# ── CompanyFeature ────────────────────────────────────────────────────────────

class FeatureUpdate(BaseModel):
    feature_key: str
    enabled: bool


class FeatureBulkUpdate(BaseModel):
    features: dict[str, bool]   # {"hr_module": True, "ai_module": False}


class CompanyFeatureResponse(BaseModel):
    feature_key: str
    enabled: bool

    model_config = {"from_attributes": True}


# ── User invite / create inside a company ────────────────────────────────────

class CompanyUserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role_ids: list[int] = []


class CompanyUserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    status: str
    is_approved: bool
    company_id: Optional[int]
    roles: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# Resolve forward reference
CompanyCreateResponse.model_rebuild()
