import logging
from datetime import datetime, timezone

from apscheduler.schedulers.base import BaseScheduler
from sqlalchemy import text

from app.core.database import SessionLocal
from app.models.backup import BackupSetting
from app.services.backup_service import BackupService

log = logging.getLogger("rems.backup_scheduler")

_INTERVAL_CRON_MAP = {
    "6h": {"trigger": "interval", "hours": 6},
    "12h": {"trigger": "interval", "hours": 12},
    "24h": {"trigger": "interval", "hours": 24},
    "weekly": {"trigger": "cron", "day_of_week": "mon", "hour": 2, "minute": 0},
    "monthly": {"trigger": "cron", "day": 1, "hour": 2, "minute": 0},
}


def _get_system_user():
    """Return a minimal user-like object for scheduled backups."""
    class SystemUser:
        id = 0
        email = "system@backup"
        full_name = "System Backup"
        is_super_admin = True
        company_id = None
        role = None

    return SystemUser()


def run_scheduled_backup():
    """Called by APScheduler — creates automatic backups for all companies."""
    system_user = _get_system_user()

    try:
        db = SessionLocal()
        try:
            settings_list = db.query(BackupSetting).filter(
                BackupSetting.auto_backup_enabled == True  # noqa: E712
            ).all()

            if not settings_list:
                log.info("No backup settings enabled for auto-backup")
                return

            for setting in settings_list:
                try:
                    BackupService.create_backup(
                        db=db,
                        user=system_user,
                        backup_type="automatic",
                        notes="Scheduled automatic backup",
                    )
                    setting.last_scheduled_run = datetime.now(timezone.utc)

                    interval = setting.schedule_interval or "24h"
                    setting.next_scheduled_run = BackupService.compute_next_run(interval)

                    db.commit()
                    log.info(
                        "Scheduled backup created for company %s",
                        setting.company_id or "all",
                    )
                except Exception as e:
                    log.error(
                        "Scheduled backup failed for company %s: %s",
                        setting.company_id or "all", e,
                    )
                    db.rollback()

        finally:
            db.close()
    except Exception as e:
        log.error("Scheduled backup runner failed: %s", e)


def register_backup_job(scheduler: BaseScheduler):
    """Register the backup job with the scheduler."""
    scheduler.add_job(
        run_scheduled_backup,
        trigger="interval",
        hours=24,
        id="rems_auto_backup",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    log.info("[Backup Scheduler] Registered auto-backup job (runs every 24 hours by default)")
