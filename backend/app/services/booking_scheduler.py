"""Booking scheduler — auto-expire old bookings."""
import logging

from apscheduler.schedulers.base import BaseScheduler

from app.core.database import SessionLocal
from app.services.booking_service import BookingService

log = logging.getLogger("rems.booking_scheduler")


def expire_old_bookings_job():
    """
    Scheduled job to auto-expire bookings past their expiry date.
    Runs every hour.
    """
    db = SessionLocal()
    try:
        count = BookingService.expire_old_bookings(db)
        if count > 0:
            log.info(f"[Booking Scheduler] Auto-expired {count} booking(s)")
    except Exception as e:
        log.error(f"[Booking Scheduler] Error expiring bookings: {e}")
        db.rollback()
    finally:
        db.close()


def register_booking_expiry_job(scheduler: BaseScheduler):
    """Register booking expiry job with the scheduler."""
    scheduler.add_job(
        expire_old_bookings_job,
        trigger="interval",
        hours=1,  # Run every hour
        id="expire_old_bookings",
        replace_existing=True,
        max_instances=1,
    )
    log.info("[Booking Scheduler] Registered booking expiry job (runs every hour)")
