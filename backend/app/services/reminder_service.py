import calendar
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.reminders import NotificationLog, Reminder, ReminderTemplate

log = logging.getLogger("reminder-service")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _to_utc(dt: datetime) -> datetime:
    dt = _ensure_tz(dt)
    return dt.astimezone(timezone.utc)


def _apply_variables(text: str, variables: dict) -> str:
    def repl(m: re.Match) -> str:
        key = m.group(1)
        return variables.get(key, m.group(0))
    return re.sub(r"\{\{(\w+)\}\}", repl, text)


def _next_repeat_time(remind_at: datetime, repeat: str) -> Optional[datetime]:
    remind_at = _ensure_tz(remind_at)
    if repeat == "none":
        return None
    if repeat == "daily":
        return remind_at + timedelta(days=1)
    if repeat == "weekly":
        return remind_at + timedelta(weeks=1)
    if repeat == "monthly":
        year = remind_at.year
        month = remind_at.month + 1
        if month > 12:
            month = 1
            year += 1
        max_day = calendar.monthrange(year, month)[1]
        day = min(remind_at.day, max_day)
        return remind_at.replace(year=year, month=month, day=day)
    if repeat == "yearly":
        try:
            return remind_at.replace(year=remind_at.year + 1)
        except ValueError:
            return remind_at + timedelta(days=365)
    return None


def _compute_fire_time(reminder: Reminder) -> datetime:
    return reminder.remind_at - timedelta(minutes=reminder.reminder_before)


def _compute_status(reminder: Reminder) -> str:
    now = _now()
    if reminder.status in ("completed", "cancelled", "snoozed"):
        return reminder.status
    remind_at = _ensure_tz(reminder.remind_at)
    if remind_at < now:
        return "overdue"
    fire_at = _compute_fire_time(reminder)
    if fire_at <= now:
        return "due_soon"
    if fire_at <= now + timedelta(hours=1):
        return "upcoming"
    return "pending"


def _should_fire(reminder: Reminder) -> bool:
    if reminder.notification_sent:
        log.info("[SVC] _should_fire=False already_sent id=%s", reminder.id)
        return False
    if reminder.status in ("completed", "cancelled"):
        log.info("[SVC] _should_fire=False terminal_status id=%s status=%s", reminder.id, reminder.status)
        return False
    now = _now()
    if reminder.status == "snoozed":
        if reminder.snoozed_until is None or _ensure_tz(reminder.snoozed_until) > now:
            log.info("[SVC] _should_fire=False snoozed id=%s snoozed_until=%s", reminder.id, reminder.snoozed_until)
            return False
    fire_at = _compute_fire_time(reminder)
    if now < fire_at:
        log.info("[SVC] _should_fire=False not_yet id=%s fire_at=%s now=%s", reminder.id, fire_at, now)
        return False
    log.info("[SVC] _should_fire=True id=%s title=%s status=%s remind_at=%s fire_at=%s", reminder.id, reminder.title, reminder.status, reminder.remind_at, fire_at)
    return True


def get_due_reminders(db: Session) -> list[Reminder]:
    now = _now()
    reminders = (
        db.query(Reminder)
        .filter(
            Reminder.status.in_(["pending", "snoozed"]),
            Reminder.notification_sent == False,
        )
        .all()
    )
    due = []
    for r in reminders:
        if _should_fire(r):
            due.append(r)
    log.info("[SVC] get_due_reminders: %s due out of %s candidates", len(due), len(reminders))
    return due


def mark_notification_sent(db: Session, reminder_id: int) -> bool:
    r = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if r:
        r.notification_sent = True
        db.commit()
        return True
    return False


def mark_missed(db: Session) -> int:
    now = _now()
    cutoff = now - timedelta(hours=1)
    missed = (
        db.query(Reminder)
        .filter(
            Reminder.remind_at < cutoff,
            Reminder.status.in_(["pending", "upcoming", "due_soon"]),
            Reminder.notification_sent == False,
        )
        .all()
    )
    count = 0
    for r in missed:
        existing = (
            db.query(NotificationLog)
            .filter(
                NotificationLog.reminder_id == r.id,
                NotificationLog.status == "missed",
            )
            .first()
        )
        if not existing:
            db.add(NotificationLog(
                reminder_id=r.id,
                status="missed",
                triggered_at=now,
            ))
            count += 1
    if count:
        db.commit()
        log.info("[SVC] mark_missed: %s new missed reminders", count)
    return count


def get_missed_reminders(db: Session, user_id: int) -> list[Reminder]:
    now = _now()
    return (
        db.query(Reminder)
        .filter(
            Reminder.user_id == user_id,
            Reminder.status.in_(["pending", "due_soon"]),
            Reminder.notification_sent == False,
            Reminder.remind_at < now,
        )
        .all()
    )


def get_recovery_data(db: Session, user_id: int) -> dict:
    missed = get_missed_reminders(db, user_id)
    items = [
        {"id": r.id, "title": r.title, "remind_at": r.remind_at.isoformat(), "priority": r.priority}
        for r in missed[:20]
    ]
    return {"missed_count": len(items), "missed": items}


def create_reminder(db: Session, user_id: int, data: dict) -> Reminder:
    remind_at = _to_utc(data["remind_at"])
    r = Reminder(
        user_id=user_id,
        title=data["title"],
        description=data.get("description"),
        category=data.get("category"),
        remind_at=remind_at,
        priority=data.get("priority", "medium"),
        repeat=data.get("repeat", "none"),
        reminder_before=data.get("reminder_before", 0),
        template_id=data.get("template_id"),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def update_reminder(db: Session, user_id: int, reminder_id: int, data: dict) -> Optional[Reminder]:
    r = db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.user_id == user_id).first()
    if not r:
        return None
    if "title" in data:
        r.title = data["title"]
    if "description" in data:
        r.description = data["description"]
    if "category" in data:
        r.category = data["category"]
    if "remind_at" in data:
        r.remind_at = _to_utc(data["remind_at"])
    if "priority" in data:
        r.priority = data["priority"]
    if "repeat" in data:
        r.repeat = data["repeat"]
    if "reminder_before" in data:
        r.reminder_before = data["reminder_before"]
    if "template_id" in data:
        r.template_id = data["template_id"]
    db.commit()
    db.refresh(r)
    return r


def delete_reminder(db: Session, user_id: int, reminder_id: int) -> bool:
    r = db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.user_id == user_id).first()
    if not r:
        return False
    db.delete(r)
    db.commit()
    return True


def get_reminder(db: Session, user_id: int, reminder_id: int) -> Optional[Reminder]:
    return db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.user_id == user_id).first()


def list_reminders(
    db: Session,
    user_id: int,
    filter_by: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "remind_at",
    sort_dir: str = "asc",
) -> list[Reminder]:
    q = db.query(Reminder).filter(Reminder.user_id == user_id)
    now = _now()
    if filter_by == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        q = q.filter(Reminder.remind_at >= start, Reminder.remind_at < end)
    elif filter_by == "tomorrow":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        end = start + timedelta(days=1)
        q = q.filter(Reminder.remind_at >= start, Reminder.remind_at < end)
    elif filter_by == "upcoming":
        q = q.filter(Reminder.remind_at >= now, ~Reminder.status.in_(["completed", "cancelled"]))
    elif filter_by == "completed":
        q = q.filter(Reminder.status == "completed")
    elif filter_by == "overdue":
        q = q.filter(Reminder.remind_at < now, ~Reminder.status.in_(["completed", "cancelled", "snoozed"]))
    elif filter_by == "high_priority":
        q = q.filter(Reminder.priority.in_(["high", "critical"]))

    if search:
        pattern = f"%{search}%"
        q = q.filter(
            Reminder.title.ilike(pattern) | Reminder.description.ilike(pattern)
        )

    sort_col = getattr(Reminder, sort_by, Reminder.remind_at)
    if sort_dir == "desc":
        q = q.order_by(sort_col.desc())
    else:
        q = q.order_by(sort_col.asc())

    return q.all()


def snooze_reminder(db: Session, user_id: int, reminder_id: int, minutes: int) -> Optional[Reminder]:
    r = db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.user_id == user_id).first()
    if not r:
        return None
    now = _now()
    r.remind_at = now + timedelta(minutes=minutes)
    r.status = "snoozed"
    r.notification_sent = False
    r.snoozed_until = now + timedelta(minutes=minutes)
    db.add(NotificationLog(
        reminder_id=r.id,
        status="delivered",
        user_action="snoozed",
        snooze_minutes=minutes,
    ))
    db.commit()
    db.refresh(r)
    return r


def complete_reminder(db: Session, user_id: int, reminder_id: int) -> Optional[Reminder]:
    r = db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.user_id == user_id).first()
    if not r:
        return None
    now = _now()
    db.add(NotificationLog(reminder_id=r.id, status="delivered", user_action="completed"))
    if r.repeat != "none":
        next_time = _next_repeat_time(r.remind_at, r.repeat)
        if next_time:
            r.remind_at = next_time
            r.status = "pending"
            r.notification_sent = False
            r.completed_at = now
    else:
        r.status = "completed"
        r.completed_at = now
    db.commit()
    db.refresh(r)
    return r


def cancel_reminder(db: Session, user_id: int, reminder_id: int) -> Optional[Reminder]:
    r = db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.user_id == user_id).first()
    if not r:
        return None
    r.status = "cancelled"
    db.commit()
    db.refresh(r)
    return r


def bulk_action(db: Session, user_id: int, ids: list[int], action: str) -> int:
    affected = 0
    for rid in ids:
        if action == "complete":
            if complete_reminder(db, user_id, rid):
                affected += 1
        elif action == "delete":
            if delete_reminder(db, user_id, rid):
                affected += 1
    return affected


def get_dashboard(db: Session, user_id: int) -> dict:
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    upcoming_end = now + timedelta(hours=24)

    upcoming_24h = (
        db.query(Reminder)
        .filter(
            Reminder.user_id == user_id,
            Reminder.remind_at >= now,
            Reminder.remind_at < upcoming_end,
            ~Reminder.status.in_(["completed", "cancelled"]),
        )
        .order_by(Reminder.remind_at)
        .all()
    )

    overdue = (
        db.query(Reminder)
        .filter(
            Reminder.user_id == user_id,
            Reminder.remind_at < now,
            ~Reminder.status.in_(["completed", "cancelled"]),
        )
        .order_by(Reminder.remind_at)
        .all()
    )

    today_total = (
        db.query(func.count(Reminder.id))
        .filter(Reminder.user_id == user_id, Reminder.remind_at >= today_start, Reminder.remind_at < today_end)
        .scalar() or 0
    )
    today_completed = (
        db.query(func.count(Reminder.id))
        .filter(Reminder.user_id == user_id, Reminder.status == "completed", Reminder.remind_at >= today_start, Reminder.remind_at < today_end)
        .scalar() or 0
    )
    today_pending = (
        db.query(func.count(Reminder.id))
        .filter(Reminder.user_id == user_id, Reminder.remind_at >= today_start, Reminder.remind_at < today_end, Reminder.status == "pending")
        .scalar() or 0
    )

    return {
        "upcoming_24h": upcoming_24h,
        "overdue": overdue,
        "today_total": today_total,
        "today_completed": today_completed,
        "today_pending": today_pending,
    }


def list_templates(db: Session, user_id: int) -> list[ReminderTemplate]:
    return db.query(ReminderTemplate).filter(ReminderTemplate.user_id == user_id).all()


def create_template(db: Session, user_id: int, data: dict) -> ReminderTemplate:
    t = ReminderTemplate(
        user_id=user_id,
        name=data["name"],
        title_template=data["title_template"],
        description_template=data.get("description_template"),
        priority=data.get("priority", "medium"),
        repeat=data.get("repeat", "none"),
        reminder_before=data.get("reminder_before", 0),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def delete_template(db: Session, user_id: int, template_id: int) -> bool:
    t = db.query(ReminderTemplate).filter(ReminderTemplate.id == template_id, ReminderTemplate.user_id == user_id).first()
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True


def apply_template(db: Session, user_id: int, template_id: int, remind_at: datetime, variables: dict) -> Optional[Reminder]:
    t = db.query(ReminderTemplate).filter(ReminderTemplate.id == template_id, ReminderTemplate.user_id == user_id).first()
    if not t:
        return None
    title = _apply_variables(t.title_template, variables)
    description = _apply_variables(t.description_template or "", variables) if t.description_template else None
    r = Reminder(
        user_id=user_id,
        title=title,
        description=description,
        remind_at=_to_utc(remind_at),
        priority=t.priority,
        repeat=t.repeat,
        reminder_before=t.reminder_before,
        template_id=template_id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def get_logs(
    db: Session,
    user_id: int,
    reminder_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
) -> list[dict]:
    q = (
        db.query(NotificationLog, Reminder.title, Reminder.priority, Reminder.category)
        .join(Reminder, NotificationLog.reminder_id == Reminder.id)
        .filter(Reminder.user_id == user_id)
    )
    if reminder_id is not None:
        q = q.filter(NotificationLog.reminder_id == reminder_id)
    if status_filter:
        q = q.filter(NotificationLog.status == status_filter)
    if search:
        pattern = f"%{search}%"
        q = q.filter(Reminder.title.ilike(pattern))
    q = q.order_by(NotificationLog.triggered_at.desc()).limit(limit)
    results = []
    for log_entry, r_title, r_priority, r_category in q.all():
        results.append({
            "id": log_entry.id,
            "reminder_id": log_entry.reminder_id,
            "reminder_title": r_title,
            "reminder_priority": r_priority,
            "reminder_category": r_category,
            "triggered_at": log_entry.triggered_at,
            "status": log_entry.status,
            "user_action": log_entry.user_action,
            "snooze_minutes": log_entry.snooze_minutes,
        })
    return results


def export_logs_csv(db: Session, user_id: int) -> str:
    logs = get_logs(db, user_id, limit=10000)
    lines = ["id,reminder_id,reminder_title,triggered_at,status,user_action,snooze_minutes"]
    for l in logs:
        lines.append(
            f"{l['id']},{l['reminder_id']},\"{l['reminder_title'] or ''}\","
            f"{l['triggered_at'].isoformat() if l['triggered_at'] else ''},"
            f"{l['status'] or ''},{l['user_action'] or ''},{l['snooze_minutes'] or ''}"
        )
    return "\n".join(lines)
