from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: str
    password: str
    company_slug: Optional[str] = None
    company_code: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8)
    company_slug: Optional[str] = None


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_super_admin: bool = False
    company_id: Optional[str] = None
    company_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    status: str
    is_approved: bool
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    company_id: Optional[int] = None
    is_super_admin: bool = False

    approval_status: str

    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    features: dict[str, bool] = {}
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None


class UserApprovalRequest(BaseModel):
    approved: bool


class UserStatusUpdate(BaseModel):
    status: str


class UserListResponse(BaseModel):
    id: int
    email: str
    full_name: str
    status: str
    is_approved: bool
    company_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
