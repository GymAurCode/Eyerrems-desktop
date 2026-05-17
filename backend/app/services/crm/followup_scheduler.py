"""
Follow-up Scheduler — fires every minute, finds pending follow-ups that are due,
marks them as notified, and broadcasts a WebSocket event so the frontend can
show an in-app alert.
"""
from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.websocket_manager import ws_manager
from app.models.crm import LeadActivity

log = logging.getLogger("followup_scheduler")


async def _fire_followups() -> None:
    """Tick: find due follow-ups, broadcast alerts, mark notified."""
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        due = (
            db.query(LeadActivity)
            .filter(
                LeadActivity.type == "followup",
                LeadActivity.status == "pending",
                LeadActivity.notified.is_(False),
                LeadActivity.scheduled_at <= now,
            )
            .all()
        )

        for activity in due:
            activity.notified = True
            db.flush()

            await ws_manager.broadcast("followup_due", {
                "activity_id": activity.id,
                "entity_type": activity.entity_type,
                "entity_id": activity.entity_id,
                "message": activity.message or "Follow-up is due",
                "scheduled_at": activity.scheduled_at.isoformat() if activity.scheduled_at else None,
            })
            log.info(
                "Follow-up #%d fired for %s #%d",
                activity.id, activity.entity_type, activity.entity_id,
            )

        db.commit()
    except Exception as exc:
        log.exception("Follow-up scheduler tick error: %s", exc)
        db.rollback()
    finally:
        db.close()


def register_followup_job(scheduler) -> None:  # type: ignore[type-arg]
    """Register the follow-up tick job on an existing APScheduler instance."""
    scheduler.add_job(
        _fire_followups,
        trigger="interval",
        seconds=60,
        id="followup_tick",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    log.info("Follow-up scheduler job registered.")
