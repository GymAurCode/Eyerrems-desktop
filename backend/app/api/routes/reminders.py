"""Reminder & Notification API Routes."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.websocket_manager import ws_manager
from app.models.auth import User
from app.models.reminders import (
    Notification, NotificationLog, Reminder,
    ReminderAssignment, ReminderSettings, ReminderTemplate,
)
from app.schemas.reminders import (
    NotificationLogOut, NotificationOut,
    ReminderCreate, ReminderDashboard, ReminderOut,
    ReminderSettingsOut, ReminderSettingsUpdate,
    ReminderUpdate, SnoozeRequest,
    TemplateCreate, TemplateOut, TemplateUpdate,
)

router = APIRouter()


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _compute_next_fire(reminder: Reminder) -> None:
    """Set initial next_fire_at considering pre_alert_minutes."""
    fire_at = reminder.due_time - timedelta(minutes=reminder.pre_alert_minutes)
    reminder.next_fire_at = fire_at


def _reminder_out(r: Reminder) -> ReminderOut:
    assigned = [
        {"id": a.user.id, "full_name": a.user.full_name, "email": a.user.email}
        for a in r.assignments
        if a.user
    ]
    data = ReminderOut.model_validate(r)
    data.assigned_users = assigned  # type: ignore[assignment]
    return data


# â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/dashboard", response_model=ReminderDashboard)
def reminder_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now   = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end   = today_start + timedelta(days=1)
    upcoming_end = today_start + timedelta(days=7)

    base_q = (
        db.query(Reminder)
        .options(joinedload(Reminder.assignments).joinedload(ReminderAssignment.user))
        .filter(
            Reminder.status.in_(["pending", "snoozed"]),
            (Reminder.created_by == current_user.id) |
            Reminder.assignments.any(ReminderAssignment.user_id == current_user.id),
        )
    )

    today_reminders = base_q.filter(
        Reminder.due_time >= today_start,
        Reminder.due_time < today_end,
    ).order_by(Reminder.due_time).all()

    overdue_reminders = base_q.filter(
        Reminder.due_time < today_start,
    ).order_by(Reminder.due_time).all()

    upcoming_reminders = base_q.filter(
        Reminder.due_time >= today_end,
        Reminder.due_time < upcoming_end,
    ).order_by(Reminder.due_time).all()

    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )

    return ReminderDashboard(
        today_count=len(today_reminders),
        upcoming_count=len(upcoming_reminders),
        overdue_count=len(overdue_reminders),
        unread_notifications=unread_count,
        today=[_reminder_out(r) for r in today_reminders],
        overdue=[_reminder_out(r) for r in overdue_reminders],
        upcoming=[_reminder_out(r) for r in upcoming_reminders],
    )


# â”€â”€ Notifications â€” MUST be before /{reminder_id} to avoid 422 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/notifications/me", response_model=list[NotificationOut])
def my_notifications(
    is_read: Optional[bool] = Query(None),
    module_name: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if is_read is not None:
        q = q.filter(Notification.is_read == is_read)
    if module_name:
        q = q.filter(Notification.module_name == module_name)
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


@router.get("/notifications/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return {"count": count}


@router.post("/notifications/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read == False
    ).update({"is_read": True, "read_at": now})
    db.commit()
    return {"ok": True}


@router.post("/notifications/{notif_id}/read", response_model=NotificationOut)
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notif_id, Notification.user_id == current_user.id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    n.read_at = datetime.utcnow()
    if n.log:
        n.log.read_at = n.read_at
        n.log.status = "clicked"
    db.commit()
    db.refresh(n)
    return n


@router.delete("/notifications/{notif_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notif_id, Notification.user_id == current_user.id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(n)
    db.commit()


# â”€â”€ Notification Logs â€” MUST be before /{reminder_id} â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/logs", response_model=list[NotificationLogOut])
def notification_logs(
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "Staff", "Accountant")),
):
    return (
        db.query(NotificationLog)
        .filter(NotificationLog.user_id == current_user.id)
        .order_by(NotificationLog.triggered_at.desc())
        .limit(limit)
        .all()
    )


# â”€â”€ Templates â€” MUST be before /{reminder_id} to avoid 422 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/templates", response_model=list[TemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(ReminderTemplate).filter(ReminderTemplate.is_active == True).all()


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    body: TemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Staff")),
):
    t = ReminderTemplate(**body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.patch("/templates/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: int,
    body: TemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Staff")),
):
    t = db.query(ReminderTemplate).filter(ReminderTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(t, field, val)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    t = db.query(ReminderTemplate).filter(ReminderTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()


# â”€â”€ User Settings â€” MUST be before /{reminder_id} â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/settings/me", response_model=ReminderSettingsOut)
def get_my_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(ReminderSettings).filter(ReminderSettings.user_id == current_user.id).first()
    if not s:
        s = ReminderSettings(user_id=current_user.id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.patch("/settings/me", response_model=ReminderSettingsOut)
def update_my_settings(
    body: ReminderSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(ReminderSettings).filter(ReminderSettings.user_id == current_user.id).first()
    if not s:
        s = ReminderSettings(user_id=current_user.id)
        db.add(s)
        db.flush()
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return s


# â”€â”€ Reminders CRUD â€” /{reminder_id} MUST come LAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/", response_model=list[ReminderOut])
def list_reminders(
    module_name: Optional[str] = Query(None),
    record_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(Reminder)
        .options(joinedload(Reminder.assignments).joinedload(ReminderAssignment.user))
        .filter(
            (Reminder.created_by == current_user.id) |
            Reminder.assignments.any(ReminderAssignment.user_id == current_user.id)
        )
    )
    if module_name:
        q = q.filter(Reminder.module_name == module_name)
    if record_id:
        q = q.filter(Reminder.record_id == record_id)
    if status_filter:
        q = q.filter(Reminder.status == status_filter)
    if priority:
        q = q.filter(Reminder.priority == priority)
    return [_reminder_out(r) for r in q.order_by(Reminder.due_time).all()]


@router.post("/", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    body: ReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder = Reminder(
        title=body.title,
        description=body.description,
        module_name=body.module_name,
        record_id=body.record_id,
        due_time=body.due_time,
        recurrence=body.recurrence,
        cron_expr=body.cron_expr,
        priority=body.priority,
        pre_alert_minutes=body.pre_alert_minutes,
        template_id=body.template_id,
        created_by=current_user.id,
    )
    _compute_next_fire(reminder)
    db.add(reminder)
    db.flush()

    for uid in set(body.assigned_user_ids):
        db.add(ReminderAssignment(reminder_id=reminder.id, user_id=uid))

    db.commit()
    db.refresh(reminder)
    return _reminder_out(reminder)


@router.get("/{reminder_id}", response_model=ReminderOut)
def get_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = (
        db.query(Reminder)
        .options(joinedload(Reminder.assignments).joinedload(ReminderAssignment.user))
        .filter(Reminder.id == reminder_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _reminder_out(r)


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: int,
    body: ReminderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")

    for field, val in body.model_dump(exclude_none=True, exclude={"assigned_user_ids"}).items():
        setattr(r, field, val)

    if body.assigned_user_ids is not None:
        db.query(ReminderAssignment).filter(ReminderAssignment.reminder_id == r.id).delete()
        for uid in set(body.assigned_user_ids):
            db.add(ReminderAssignment(reminder_id=r.id, user_id=uid))

    if body.due_time or body.pre_alert_minutes is not None:
        _compute_next_fire(r)

    db.commit()
    db.refresh(r)
    return _reminder_out(r)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(r)
    db.commit()


@router.post("/{reminder_id}/complete", response_model=ReminderOut)
def complete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    r.status = "completed"
    r.next_fire_at = None
    db.commit()
    db.refresh(r)
    return _reminder_out(r)


@router.post("/{reminder_id}/snooze", response_model=ReminderOut)
def snooze_reminder(
    reminder_id: int,
    body: SnoozeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    r.status = "snoozed"
    r.snoozed_until = body.snooze_until
    r.next_fire_at = body.snooze_until
    db.commit()
    db.refresh(r)
    return _reminder_out(r)



