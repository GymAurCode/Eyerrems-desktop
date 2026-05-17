"""
Mail Sync Scheduler — Periodic IMAP inbox sync for all active, verified accounts.
Runs every 5 minutes using the existing APScheduler instance.
"""
from __future__ import annotations

import logging

from app.core.database import SessionLocal
from app.models.mail import EmailAccount
from app.services.mail.mail_service import MailService
from app.services.reminder_scheduler import get_scheduler

log = logging.getLogger("mail_sync_scheduler")


async def _sync_all_accounts() -> None:
    """Sync inbox for every active, verified email account."""
    db = SessionLocal()
    try:
        accounts = (
            db.query(EmailAccount)
            .filter(
                EmailAccount.is_active.is_(True),
                EmailAccount.is_verified.is_(True),
            )
            .all()
        )
        for account in accounts:
            try:
                new_count = MailService.sync_inbox(db, account)
                if new_count:
                    log.info("Mail sync: %d new message(s) for %s", new_count, account.email_address)
            except Exception as exc:
                log.warning("Mail sync failed for %s: %s", account.email_address, exc)
    except Exception as exc:
        log.exception("Mail sync scheduler error: %s", exc)
    finally:
        db.close()


def register_mail_sync_job() -> None:
    """Register the mail sync job with the shared APScheduler instance."""
    scheduler = get_scheduler()
    scheduler.add_job(
        _sync_all_accounts,
        trigger="interval",
        minutes=5,
        id="mail_sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    log.info("Mail sync job registered (every 5 minutes).")
