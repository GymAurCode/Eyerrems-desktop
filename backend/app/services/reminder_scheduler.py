import asyncio
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.websocket_manager import ws_manager
from app.models.reminders import NotificationLog
from app.services.reminder_service import get_due_reminders, mark_missed, mark_notification_sent

log = logging.getLogger("reminder-scheduler")

_scheduler: BackgroundScheduler | None = None
_main_loop: asyncio.AbstractEventLoop | None = None


def _fire_reminders_job() -> None:
    db: Session = SessionLocal()
    try:
        due = get_due_reminders(db)
        for reminder in due:
            uid = reminder.user_id or 0
            log.info("[SCHED] Firing reminder id=%s title='%s' user_id=%s", reminder.id, reminder.title, uid)
            db.add(NotificationLog(
                reminder_id=reminder.id,
                status="delivered",
            ))
            mark_notification_sent(db, reminder.id)
            payload = {
                "type": "reminder_due",
                "reminder": {
                    "id": reminder.id,
                    "user_id": uid,
                    "title": reminder.title,
                    "description": reminder.description,
                    "category": reminder.category,
                    "remind_at": reminder.remind_at.isoformat() if reminder.remind_at else None,
                    "priority": reminder.priority,
                    "repeat": reminder.repeat,
                    "status": reminder.status,
                    "reminder_before": reminder.reminder_before,
                    "notification_sent": reminder.notification_sent,
                    "snoozed_until": reminder.snoozed_until.isoformat() if reminder.snoozed_until else None,
                    "completed_at": reminder.completed_at.isoformat() if reminder.completed_at else None,
                    "template_id": reminder.template_id,
                    "created_at": reminder.created_at.isoformat() if reminder.created_at else None,
                    "updated_at": reminder.updated_at.isoformat() if reminder.updated_at else None,
                },
            }
            if uid:
                try:
                    if _main_loop and _main_loop.is_running():
                        asyncio.run_coroutine_threadsafe(
                            ws_manager.send_to_user(uid, payload),
                            _main_loop,
                        )
                    else:
                        loop = asyncio.new_event_loop()
                        loop.run_until_complete(ws_manager.send_to_user(uid, payload))
                        loop.close()
                except Exception as exc:
                    log.exception("[SCHED] WS send failed for reminder %s: %s", reminder.id, exc)

        missed = mark_missed(db)
        if missed:
            log.info("[SCHED] Marked %s reminders as missed", missed)
    except Exception as exc:
        log.exception("[SCHED] Scheduler tick error: %s", exc)
        db.rollback()
    finally:
        db.close()


def start_scheduler(main_loop: asyncio.AbstractEventLoop | None = None) -> BackgroundScheduler:
    global _scheduler, _main_loop
    if main_loop:
        _main_loop = main_loop
    if _scheduler and _scheduler.running:
        log.warning("[SCHED] Scheduler already running")
        return _scheduler
    if _main_loop is None:
        try:
            _main_loop = asyncio.get_running_loop()
        except RuntimeError:
            _main_loop = asyncio.new_event_loop()
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _fire_reminders_job,
        trigger="interval",
        seconds=15,
        id="reminder_check",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    log.info("[SCHED] Reminder scheduler started (interval=15s)")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("[SCHED] Reminder scheduler stopped")


def get_scheduler() -> BackgroundScheduler | None:
    global _scheduler
    return _scheduler


def get_scheduler_status() -> dict:
    global _scheduler, _main_loop
    running = _scheduler is not None and _scheduler.running
    loop_alive = _main_loop is not None and _main_loop.is_running()
    return {"running": running, "loop_alive": loop_alive}
