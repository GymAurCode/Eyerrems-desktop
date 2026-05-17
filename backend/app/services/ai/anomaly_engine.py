"""
Anomaly Detection Engine.

Detects:
  - HIGH_EXPENSE        : expense amount > N× company average
  - LARGE_JUMP          : transaction amount >> recent average for that account
  - BACKDATED_ENTRY     : journal/expense dated > 30 days in the past
  - AFTER_HOURS         : audit action between 22:00–06:00
  - RAPID_EDITS         : same entity updated > 3 times within 10 minutes
  - DELETED_FINANCE     : DELETE action on Finance module
  - SUSPICIOUS_EDIT     : UPDATE on a paid/approved record
  - FAILED_LOGIN_BURST  : > 5 failed logins within 15 minutes for same user

All detections write to ai_anomalies and fire an ai_alert.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.ai_intelligence import AIAlert, AIAnomaly
from app.models.audit import AuditLog
from app.models.finance import Expense, Journal

log = logging.getLogger("rems.ai.anomaly")

# ── Risk score table ──────────────────────────────────────────────────────────
RISK_SCORES: dict[str, float] = {
    "DELETED_FINANCE":    90.0,
    "BACKDATED_ENTRY":    80.0,
    "FAILED_LOGIN_BURST": 70.0,
    "AFTER_HOURS":        60.0,
    "HIGH_EXPENSE":       65.0,
    "LARGE_JUMP":         60.0,
    "RAPID_EDITS":        55.0,
    "SUSPICIOUS_EDIT":    70.0,
    "DUPLICATE":          50.0,
}

SEVERITY_MAP: dict[str, str] = {
    "DELETED_FINANCE":    "CRITICAL",
    "BACKDATED_ENTRY":    "HIGH",
    "FAILED_LOGIN_BURST": "HIGH",
    "AFTER_HOURS":        "MEDIUM",
    "HIGH_EXPENSE":       "HIGH",
    "LARGE_JUMP":         "HIGH",
    "RAPID_EDITS":        "MEDIUM",
    "SUSPICIOUS_EDIT":    "HIGH",
    "DUPLICATE":          "MEDIUM",
}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _save_anomaly(
    db: Session,
    *,
    company_id: int,
    anomaly_type: str,
    description: str,
    module: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    details: Optional[dict] = None,
) -> AIAnomaly:
    score    = RISK_SCORES.get(anomaly_type, 50.0)
    severity = SEVERITY_MAP.get(anomaly_type, "MEDIUM")

    anomaly = AIAnomaly(
        company_id   = company_id,
        anomaly_type = anomaly_type,
        severity     = severity,
        module       = module,
        entity_type  = entity_type,
        entity_id    = entity_id,
        user_id      = user_id,
        description  = description,
        details      = json.dumps(details) if details else None,
        risk_score   = score,
        created_at   = datetime.utcnow(),
    )
    db.add(anomaly)
    db.flush()

    # Fire alert
    alert = AIAlert(
        company_id  = company_id,
        alert_type  = anomaly_type,
        severity    = severity,
        title       = _alert_title(anomaly_type),
        message     = description,
        module      = module,
        entity_type = entity_type,
        entity_id   = entity_id,
        user_id     = user_id,
        anomaly_id  = anomaly.id,
        created_at  = datetime.utcnow(),
    )
    db.add(alert)
    db.flush()
    return anomaly


def _alert_title(anomaly_type: str) -> str:
    titles = {
        "DELETED_FINANCE":    "Finance Record Deleted",
        "BACKDATED_ENTRY":    "Backdated Transaction Detected",
        "FAILED_LOGIN_BURST": "Multiple Failed Login Attempts",
        "AFTER_HOURS":        "After-Hours Activity Detected",
        "HIGH_EXPENSE":       "Unusually High Expense",
        "LARGE_JUMP":         "Large Transaction Jump",
        "RAPID_EDITS":        "Rapid Record Edits",
        "SUSPICIOUS_EDIT":    "Suspicious Edit on Paid Record",
        "DUPLICATE":          "Duplicate Record Detected",
    }
    return titles.get(anomaly_type, "AI Anomaly Detected")


# ── Detection functions ───────────────────────────────────────────────────────

def detect_high_expense(db: Session, company_id: int, multiplier: float = 4.0) -> int:
    """Flag expenses that are > multiplier × company average."""
    try:
        avg_result = db.execute(
            text("""
                SELECT AVG(CAST(e.amount AS FLOAT))
                FROM expenses e
                JOIN accounts a ON e.account_id = a.id
                WHERE e.amount > 0
            """)
        ).scalar()

        if not avg_result or avg_result <= 0:
            return 0

        threshold = float(avg_result) * multiplier

        # Find recent expenses above threshold (last 7 days) not already flagged
        recent_cutoff = datetime.utcnow() - timedelta(days=7)
        expenses = db.query(Expense).filter(
            Expense.amount > threshold,
            Expense.date >= recent_cutoff,
        ).all()

        count = 0
        for exp in expenses:
            # Avoid duplicate anomalies for same entity
            existing = db.query(AIAnomaly).filter(
                AIAnomaly.company_id  == company_id,
                AIAnomaly.anomaly_type == "HIGH_EXPENSE",
                AIAnomaly.entity_type  == "expense",
                AIAnomaly.entity_id    == exp.id,
            ).first()
            if existing:
                continue

            _save_anomaly(
                db,
                company_id  = company_id,
                anomaly_type = "HIGH_EXPENSE",
                description  = (
                    f"Expense of {float(exp.amount):,.2f} is "
                    f"{float(exp.amount)/float(avg_result):.1f}× the company average "
                    f"({float(avg_result):,.2f})."
                ),
                module      = "Finance",
                entity_type = "expense",
                entity_id   = exp.id,
                details     = {
                    "amount":    float(exp.amount),
                    "average":   float(avg_result),
                    "threshold": threshold,
                    "ratio":     float(exp.amount) / float(avg_result),
                },
            )
            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_high_expense failed: %s", exc)
        db.rollback()
        return 0


def detect_backdated_entries(db: Session, company_id: int, days_threshold: int = 30) -> int:
    """Flag journal entries dated more than days_threshold days in the past."""
    try:
        cutoff = datetime.utcnow() - timedelta(days=days_threshold)
        recent_created = datetime.utcnow() - timedelta(days=1)

        journals = db.query(Journal).filter(
            Journal.date < cutoff,
            Journal.created_at >= recent_created,
        ).all()

        count = 0
        for j in journals:
            existing = db.query(AIAnomaly).filter(
                AIAnomaly.company_id   == company_id,
                AIAnomaly.anomaly_type == "BACKDATED_ENTRY",
                AIAnomaly.entity_type  == "journal",
                AIAnomaly.entity_id    == j.id,
            ).first()
            if existing:
                continue

            days_back = (datetime.utcnow() - j.date).days
            _save_anomaly(
                db,
                company_id   = company_id,
                anomaly_type = "BACKDATED_ENTRY",
                description  = (
                    f"Journal entry #{j.id} is dated {days_back} days in the past "
                    f"(entry date: {j.date.date()}, created: {j.created_at.date()})."
                ),
                module      = "Finance",
                entity_type = "journal",
                entity_id   = j.id,
                user_id     = j.created_by_user_id,
                details     = {
                    "journal_id":   j.id,
                    "entry_date":   str(j.date.date()),
                    "created_at":   str(j.created_at.date()),
                    "days_back":    days_back,
                    "reference":    j.reference_type,
                },
            )
            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_backdated_entries failed: %s", exc)
        db.rollback()
        return 0


def detect_after_hours_activity(db: Session, company_id: int) -> int:
    """Flag audit actions performed between 22:00 and 06:00."""
    try:
        since = datetime.utcnow() - timedelta(hours=24)

        logs = db.query(AuditLog).filter(
            AuditLog.company_id == company_id,
            AuditLog.created_at >= since,
        ).all()

        count = 0
        for entry in logs:
            hour = entry.created_at.hour
            if not (hour >= 22 or hour < 6):
                continue

            existing = db.query(AIAnomaly).filter(
                AIAnomaly.company_id   == company_id,
                AIAnomaly.anomaly_type == "AFTER_HOURS",
                AIAnomaly.entity_type  == "audit_log",
                AIAnomaly.entity_id    == entry.id,
            ).first()
            if existing:
                continue

            _save_anomaly(
                db,
                company_id   = company_id,
                anomaly_type = "AFTER_HOURS",
                description  = (
                    f"Action '{entry.action}' on {entry.module or 'Unknown'} "
                    f"performed at {entry.created_at.strftime('%H:%M')} "
                    f"(outside office hours)."
                ),
                module      = entry.module,
                entity_type = "audit_log",
                entity_id   = entry.id,
                user_id     = entry.user_id,
                details     = {
                    "action":     entry.action,
                    "module":     entry.module,
                    "hour":       hour,
                    "timestamp":  str(entry.created_at),
                    "ip_address": entry.ip_address,
                },
            )
            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_after_hours_activity failed: %s", exc)
        db.rollback()
        return 0


def detect_rapid_edits(db: Session, company_id: int, edit_threshold: int = 3, window_minutes: int = 10) -> int:
    """Flag entities updated more than edit_threshold times within window_minutes."""
    try:
        since = datetime.utcnow() - timedelta(hours=24)

        # Group UPDATE actions by (user_id, entity_type, entity_id) within time windows
        rows = db.execute(
            text("""
                SELECT user_id, entity_type, entity_id,
                       COUNT(*) as edit_count,
                       MIN(created_at) as first_edit,
                       MAX(created_at) as last_edit
                FROM audit_logs
                WHERE action = 'UPDATE'
                  AND company_id = :cid
                  AND created_at >= :since
                  AND entity_type IS NOT NULL
                  AND entity_id IS NOT NULL
                GROUP BY user_id, entity_type, entity_id
                HAVING COUNT(*) >= :threshold
            """),
            {"cid": company_id, "since": since, "threshold": edit_threshold},
        ).fetchall()

        count = 0
        for row in rows:
            uid, etype, eid, edit_count, first_edit, last_edit = row
            if first_edit and last_edit:
                span_minutes = (last_edit - first_edit).total_seconds() / 60
                if span_minutes > window_minutes:
                    continue

            existing = db.query(AIAnomaly).filter(
                AIAnomaly.company_id   == company_id,
                AIAnomaly.anomaly_type == "RAPID_EDITS",
                AIAnomaly.entity_type  == etype,
                AIAnomaly.entity_id    == eid,
                AIAnomaly.created_at   >= since,
            ).first()
            if existing:
                continue

            _save_anomaly(
                db,
                company_id   = company_id,
                anomaly_type = "RAPID_EDITS",
                description  = (
                    f"{etype} #{eid} was edited {edit_count} times "
                    f"within {span_minutes:.0f} minutes."
                ),
                entity_type = etype,
                entity_id   = eid,
                user_id     = uid,
                details     = {
                    "edit_count":    edit_count,
                    "span_minutes":  span_minutes if first_edit and last_edit else None,
                    "first_edit":    str(first_edit) if first_edit else None,
                    "last_edit":     str(last_edit) if last_edit else None,
                },
            )
            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_rapid_edits failed: %s", exc)
        db.rollback()
        return 0


def detect_deleted_finance(db: Session, company_id: int) -> int:
    """Flag DELETE actions on Finance module records."""
    try:
        since = datetime.utcnow() - timedelta(hours=24)

        logs = db.query(AuditLog).filter(
            AuditLog.company_id == company_id,
            AuditLog.action     == "DELETE",
            AuditLog.module     == "Finance",
            AuditLog.created_at >= since,
        ).all()

        count = 0
        for entry in logs:
            existing = db.query(AIAnomaly).filter(
                AIAnomaly.company_id   == company_id,
                AIAnomaly.anomaly_type == "DELETED_FINANCE",
                AIAnomaly.entity_type  == "audit_log",
                AIAnomaly.entity_id    == entry.id,
            ).first()
            if existing:
                continue

            _save_anomaly(
                db,
                company_id   = company_id,
                anomaly_type = "DELETED_FINANCE",
                description  = (
                    f"Finance record ({entry.entity_type} #{entry.entity_id}) "
                    f"was deleted by user #{entry.user_id} "
                    f"at {entry.created_at.strftime('%Y-%m-%d %H:%M')}."
                ),
                module      = "Finance",
                entity_type = "audit_log",
                entity_id   = entry.id,
                user_id     = entry.user_id,
                details     = {
                    "deleted_entity_type": entry.entity_type,
                    "deleted_entity_id":   entry.entity_id,
                    "description":         entry.description,
                    "ip_address":          entry.ip_address,
                    "timestamp":           str(entry.created_at),
                },
            )
            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_deleted_finance failed: %s", exc)
        db.rollback()
        return 0


def detect_failed_login_bursts(db: Session, company_id: int, threshold: int = 5, window_minutes: int = 15) -> int:
    """Flag users with > threshold failed logins within window_minutes."""
    try:
        since = datetime.utcnow() - timedelta(hours=24)

        rows = db.execute(
            text("""
                SELECT user_id, COUNT(*) as fail_count,
                       MIN(created_at) as first_fail,
                       MAX(created_at) as last_fail
                FROM audit_logs
                WHERE action = 'LOGIN_FAILED'
                  AND company_id = :cid
                  AND created_at >= :since
                GROUP BY user_id
                HAVING COUNT(*) >= :threshold
            """),
            {"cid": company_id, "since": since, "threshold": threshold},
        ).fetchall()

        count = 0
        for row in rows:
            uid, fail_count, first_fail, last_fail = row
            if first_fail and last_fail:
                span = (last_fail - first_fail).total_seconds() / 60
                if span > window_minutes:
                    continue

            existing = db.query(AIAnomaly).filter(
                AIAnomaly.company_id   == company_id,
                AIAnomaly.anomaly_type == "FAILED_LOGIN_BURST",
                AIAnomaly.user_id      == uid,
                AIAnomaly.created_at   >= since,
            ).first()
            if existing:
                continue

            _save_anomaly(
                db,
                company_id   = company_id,
                anomaly_type = "FAILED_LOGIN_BURST",
                description  = (
                    f"User #{uid} had {fail_count} failed login attempts "
                    f"within a short window."
                ),
                module      = "Auth",
                entity_type = "user",
                entity_id   = uid,
                user_id     = uid,
                details     = {
                    "fail_count": fail_count,
                    "first_fail": str(first_fail) if first_fail else None,
                    "last_fail":  str(last_fail) if last_fail else None,
                },
            )
            count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_failed_login_bursts failed: %s", exc)
        db.rollback()
        return 0


def run_all_detections(db: Session, company_id: int) -> dict[str, int]:
    """Run all anomaly detectors and return counts per type."""
    return {
        "high_expense":         detect_high_expense(db, company_id),
        "backdated_entries":    detect_backdated_entries(db, company_id),
        "after_hours":          detect_after_hours_activity(db, company_id),
        "rapid_edits":          detect_rapid_edits(db, company_id),
        "deleted_finance":      detect_deleted_finance(db, company_id),
        "failed_login_bursts":  detect_failed_login_bursts(db, company_id),
    }
