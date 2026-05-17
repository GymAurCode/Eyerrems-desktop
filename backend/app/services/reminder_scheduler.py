"""
Reminder Scheduler — APScheduler-based background engine.

Runs every minute, finds reminders whose next_fire_at <= now,
creates Notification rows, broadcasts via WebSocket, then
advances next_fire_at for recurring reminders.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.websocket_manager import ws_manager
from app.models.reminders import (
    Notification, NotificationLog, Reminder, ReminderAssignment,
)

log = logging.getLogger("reminder_scheduler")

_scheduler: AsyncIOScheduler | None = None


def _advance_next_fire(reminder: Reminder) -> None:
    """Compute and set next_fire_at for recurring reminders."""
    base = reminder.due_time
    rec  = reminder.recurrence
    if rec == "none":
        reminder.status = "completed"
        reminder.next_fire_at = None
        return
    now = datetime.utcnow()
    if rec == "daily":
        delta = timedelta(days=1)
    elif rec == "weekly":
        delta = timedelta(weeks=1)
    elif rec == "monthly":
        # Approximate — add 30 days
        delta = timedelta(days=30)
    else:
        # custom cron — not advanced automatically here; handled by APScheduler cron job
        reminder.next_fire_at = None
        return

    nxt = base
    while nxt <= now:
        nxt += delta
    reminder.next_fire_at = nxt


async def _fire_reminders() -> None:
    """Core tick: find due reminders, emit notifications."""
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        due = (
            db.query(Reminder)
            .filter(
                Reminder.status.in_(["pending", "snoozed"]),
                Reminder.next_fire_at <= now,
            )
            .all()
        )

        for reminder in due:
            # Skip snoozed reminders that haven't expired yet
            if reminder.status == "snoozed" and reminder.snoozed_until and reminder.snoozed_until > now:
                continue

            # Collect target users: creator + assigned
            user_ids: set[int] = {reminder.created_by}
            for a in db.query(ReminderAssignment).filter(
                ReminderAssignment.reminder_id == reminder.id
            ).all():
                user_ids.add(a.user_id)

            for uid in user_ids:
                notif = Notification(
                    user_id=uid,
                    reminder_id=reminder.id,
                    title=reminder.title,
                    message=reminder.description or reminder.title,
                    channel="in_app",
                    notif_type=_priority_to_type(reminder.priority),
                    module_name=reminder.module_name,
                    record_id=reminder.record_id,
                )
                db.add(notif)
                db.flush()

                log_entry = NotificationLog(
                    notification_id=notif.id,
                    reminder_id=reminder.id,
                    user_id=uid,
                    triggered_at=now,
                    delivered_at=now,
                    status="delivered",
                )
                db.add(log_entry)

            # Advance or complete
            _advance_next_fire(reminder)
            if reminder.status == "snoozed":
                reminder.status = "pending"

        db.commit()

        # Broadcast via WebSocket after commit
        for reminder in due:
            await ws_manager.broadcast("reminder_fired", {
                "reminder_id": reminder.id,
                "title": reminder.title,
                "priority": reminder.priority,
                "module_name": reminder.module_name,
                "record_id": reminder.record_id,
            })

    except Exception as exc:
        log.exception("Scheduler tick error: %s", exc)
        db.rollback()
    finally:
        db.close()


def _priority_to_type(priority: str) -> str:
    return {"urgent": "error", "high": "warning", "medium": "info", "low": "info"}.get(priority, "info")


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
        _scheduler.add_job(
            _fire_reminders,
            trigger="interval",
            seconds=60,
            id="reminder_tick",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
    return _scheduler


def start_scheduler() -> None:
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        log.info("Reminder scheduler started.")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Reminder scheduler stopped.")
