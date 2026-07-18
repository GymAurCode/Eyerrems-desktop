from app.models.rbac import ActivityLog
from sqlalchemy.orm import Session
from datetime import datetime


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
    """
    Call this in any route that creates, updates, or deletes data.

    Usage:
    log_activity(
        db=db,
        user=current_user,
        action="create",
        module="crm",
        record_type="lead",
        record_id=new_lead.id,
        record_label=f"Lead {new_lead.name}",
        new_values=new_lead.to_dict()
    )

    compatible with both User model objects and role_user dict payloads.
    """
    try:
        user_email = None
        user_name = None
        user_id = None

        if isinstance(user, dict):
            user_email = user.get("email", "system")
            user_name = user.get("full_name", user.get("name"))
            user_id = user.get("id") or user.get("user_id")
        else:
            user_email = getattr(user, 'email', 'system')
            user_name = getattr(user, 'full_name', None) or getattr(user, 'name', None)
            user_id = getattr(user, 'id', None)

        log = ActivityLog(
            user_id=str(user_id) if user_id else None,
            user_email=user_email,
            user_name=user_name,
            action=action,
            module=module,
            record_type=record_type,
            record_id=str(record_id),
            record_label=record_label,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            timestamp=datetime.utcnow()
        )
        db.add(log)
        db.flush()
    except Exception as e:
        db.rollback()
        print(f"[ActivityLog] Failed to log: {e}")
