from sqlalchemy.orm import Session
from app.services.activity_service import AuditLogService


def log_activity(
    db: Session,
    user,
    action: str,
    module: str,
    record_type: str,
    record_id: str,
    record_label: str,
    old_values: dict = None,
    new_values: dict = None,
    ip_address: str = None
):
    try:
        AuditLogService.log(
            db=db,
            actor=user,
            action=action.upper(),
            module=module,
            entity_type=record_type,
            entity_id=str(record_id),
            entity_name=record_label,
            old_data=old_values,
            new_data=new_values,
            ip_address=ip_address,
        )
    except Exception as e:
        print(f"[ActivityLog] Failed to log: {e}")
