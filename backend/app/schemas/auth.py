from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ============= Auth Schemas =============
class LoginRequest(BaseModel):
    email: str  # Changed from EmailStr to str for compatibility
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8)
    company_slug: Optional[str] = None   # which company to register under


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Multi-tenant fields returned on login so frontend can store them
    company_id: Optional[int] = None
    is_super_admin: bool = False


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    status: str
    is_approved: bool
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    # Multi-tenant
    company_id: Optional[int] = None
    is_super_admin: bool = False

    # Legacy fields for backward compatibility
    role: Optional[str] = None
    approval_status: str

    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    roles: list[str] = []
    permissions: list[str] = []
    features: dict[str, bool] = {}   # company feature flags
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None


# ============= Permission Schemas =============
class PermissionBase(BaseModel):
    name: str = Field(description="Permission name, e.g., 'hr.view'")
    module: str = Field(description="Module name, e.g., 'HR', 'Finance'")
    description: Optional[str] = None


class PermissionCreate(PermissionBase):
    pass


class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============= Role Schemas =============
class RoleBase(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permission_ids: list[int] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    permission_ids: Optional[list[int]] = None


class RoleResponse(RoleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoleDetailResponse(RoleResponse):
    permissions: list[PermissionResponse] = []


# ============= User Management Schemas =============
class UserApprovalRequest(BaseModel):
    approved: bool = Field(description="True to approve, False to reject")


class UserStatusUpdate(BaseModel):
    status: str = Field(description="Status: active, suspended")


class AssignRolesRequest(BaseModel):
    role_ids: list[int] = Field(description="List of role IDs to assign")


class AssignPermissionsRequest(BaseModel):
    permission_ids: list[int] = Field(description="List of permission IDs to assign as overrides")


class UserListResponse(BaseModel):
    id: int
    email: str
    full_name: str
    status: str
    is_approved: bool
    company_id: Optional[int] = None
    roles: list[str] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ============= Audit Schemas =============
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    module: Optional[str]
    entity_type: Optional[str]
    entity_id: Optional[int]
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogDetailResponse(AuditLogResponse):
    details: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    user_email: Optional[str] = None


# ============= Permission Check Schemas =============
class PermissionCheckRequest(BaseModel):
    permissions: list[str] = Field(description="List of permissions to check")


class PermissionCheckResponse(BaseModel):
    has_all: bool
    has_any: bool
    granted: list[str]
    missing: list[str]
