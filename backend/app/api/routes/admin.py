from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.audit import AuditLog
from app.schemas.admin import AuditLogResponse

router = APIRouter()


@router.get("/audit-logs", response_model=list[AuditLogResponse])
def list_audit_logs(
    module: str = None,
    action: str = None,
    user_id: int = None,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    query = db.query(AuditLog)
    
    if module:
        query = query.filter(AuditLog.module == module)
    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            action=log.action,
            module=log.module,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            description=log.description,
            created_at=log.created_at,
        )
        for log in logs
    ]
