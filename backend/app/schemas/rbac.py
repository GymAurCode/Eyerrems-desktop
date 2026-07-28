from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


# ── Role ──────────────────────────────────────────────────────────────────────


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class RoleResponse(BaseModel):
    id: int
    company_id: int
    name: str
    description: Optional[str] = None
    is_system_role: bool = False
    created_at: datetime
    updated_at: datetime
    user_count: int = 0

    class Config:
        from_attributes = True


# ── Permissions ───────────────────────────────────────────────────────────────


class PermissionEntry(BaseModel):
    module_key: str
    tab_key: str
    can_view: bool = False
    can_add: bool = False
    can_edit: bool = False
    can_delete: bool = False


class PermissionUpdate(BaseModel):
    permissions: list[PermissionEntry]


class PermissionResponse(BaseModel):
    id: int
    role_id: int
    module_key: str
    tab_key: str
    can_view: bool
    can_add: bool
    can_edit: bool
    can_delete: bool

    class Config:
        from_attributes = True


# ── Users (company-scoped) ────────────────────────────────────────────────────


class CompanyUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6)
    role_id: Optional[int] = None
    is_active: bool = True


class CompanyUserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role_id: Optional[int] = None
    is_active: Optional[bool] = None


class CompanyUserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    status: str
    is_active: bool
    is_approved: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Audit Logs ────────────────────────────────────────────────────────────────


class AuditLogFilter(BaseModel):
    user_id: Optional[int] = None
    module: Optional[str] = None
    action: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    search: Optional[str] = None


class AuditLogEntry(BaseModel):
    id: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    action: str
    module: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    description: Optional[str] = None
    old_data: Optional[Any] = None
    new_data: Optional[Any] = None
    diff: Optional[Any] = None
    ip_address: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class AuditLogPage(BaseModel):
    total: int
    page: int
    per_page: int
    logs: list[AuditLogEntry]
