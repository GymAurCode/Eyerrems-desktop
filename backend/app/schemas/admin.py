from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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


class RolePermissionResponse(BaseModel):
    role_id: int
    role_name: str
    permissions: list[str]
