"""
Risk Scoring System.

Computes a composite risk score (0–100) for each user based on:
  - Number of DELETE actions
  - Number of Finance module actions
  - After-hours activity count
  - Failed login attempts
  - Rapid edit anomalies
  - Backdated entry anomalies

Risk levels:
  0–25   → LOW
  26–50  → MEDIUM
  51–75  → HIGH
  76–100 → CRITICAL
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.ai_intelligence import AIAnomaly, AIRiskScore
from app.models.audit import AuditLog
from app.models.auth import User

log = logging.getLogger("rems.ai.risk")


def _risk_level(score: float) -> str:
    if score >= 76:
        return "CRITICAL"
    if score >= 51:
        return "HIGH"
    if score >= 26:
        return "MEDIUM"
    return "LOW"


def compute_user_risk(db: Session, company_id: int, user_id: int, window_days: int = 30) -> AIRiskScore:
    """Compute and persist risk score for a single user."""
    since = datetime.utcnow() - timedelta(days=window_days)
    factors: list[dict] = []
    score = 0.0

    # ── Factor 1: DELETE actions ──────────────────────────────────────────────
    delete_count = db.query(func.count(AuditLog.id)).filter(
        AuditLog.company_id == company_id,
        AuditLog.user_id    == user_id,
        AuditLog.action     == "DELETE",
        AuditLog.created_at >= since,
    ).scalar() or 0

    if delete_count > 0:
        pts = min(30.0, delete_count * 10.0)
        score += pts
        factors.append({"factor": "delete_actions", "count": delete_count, "points": pts})

    # ── Factor 2: Finance DELETE actions ─────────────────────────────────────
    fin_delete = db.query(func.count(AuditLog.id)).filter(
        AuditLog.company_id == company_id,
        AuditLog.user_id    == user_id,
        AuditLog.action     == "DELETE",
        AuditLog.module     == "Finance",
        AuditLog.created_at >= since,
    ).scalar() or 0

    if fin_delete > 0:
        pts = min(25.0, fin_delete * 15.0)
        score += pts
        factors.append({"factor": "finance_deletes", "count": fin_delete, "points": pts})

    # ── Factor 3: After-hours anomalies ───────────────────────────────────────
    after_hours = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id   == company_id,
        AIAnomaly.user_id      == user_id,
        AIAnomaly.anomaly_type == "AFTER_HOURS",
        AIAnomaly.created_at   >= since,
    ).scalar() or 0

    if after_hours > 0:
        pts = min(20.0, after_hours * 5.0)
        score += pts
        factors.append({"factor": "after_hours", "count": after_hours, "points": pts})

    # ── Factor 4: Failed login bursts ─────────────────────────────────────────
    failed_logins = db.query(func.count(AuditLog.id)).filter(
        AuditLog.company_id == company_id,
        AuditLog.user_id    == user_id,
        AuditLog.action     == "LOGIN_FAILED",
        AuditLog.created_at >= since,
    ).scalar() or 0

    if failed_logins >= 3:
        pts = min(15.0, failed_logins * 3.0)
        score += pts
        factors.append({"factor": "failed_logins", "count": failed_logins, "points": pts})

    # ── Factor 5: Rapid edit anomalies ────────────────────────────────────────
    rapid_edits = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id   == company_id,
        AIAnomaly.user_id      == user_id,
        AIAnomaly.anomaly_type == "RAPID_EDITS",
        AIAnomaly.created_at   >= since,
    ).scalar() or 0

    if rapid_edits > 0:
        pts = min(10.0, rapid_edits * 5.0)
        score += pts
        factors.append({"factor": "rapid_edits", "count": rapid_edits, "points": pts})

    # ── Factor 6: Backdated entries ───────────────────────────────────────────
    backdated = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id   == company_id,
        AIAnomaly.user_id      == user_id,
        AIAnomaly.anomaly_type == "BACKDATED_ENTRY",
        AIAnomaly.created_at   >= since,
    ).scalar() or 0

    if backdated > 0:
        pts = min(15.0, backdated * 8.0)
        score += pts
        factors.append({"factor": "backdated_entries", "count": backdated, "points": pts})

    score = min(100.0, score)
    level = _risk_level(score)

    # Upsert risk score
    existing = db.query(AIRiskScore).filter(
        AIRiskScore.company_id   == company_id,
        AIRiskScore.subject_type == "user",
        AIRiskScore.subject_id   == user_id,
    ).first()

    now = datetime.utcnow()
    if existing:
        existing.score         = score
        existing.risk_level    = level
        existing.factors       = json.dumps(factors)
        existing.last_computed = now
        db.flush()
        return existing
    else:
        rs = AIRiskScore(
            company_id    = company_id,
            subject_type  = "user",
            subject_id    = user_id,
            score         = score,
            risk_level    = level,
            factors       = json.dumps(factors),
            last_computed = now,
            created_at    = now,
        )
        db.add(rs)
        db.flush()
        return rs


def compute_all_user_risks(db: Session, company_id: int) -> int:
    """Recompute risk scores for all users in a company."""
    try:
        users = db.query(User).filter(
            User.company_id == company_id,
            User.is_active  == True,
        ).all()

        for user in users:
            compute_user_risk(db, company_id, user.id)

        db.commit()
        return len(users)

    except Exception as exc:
        log.warning("compute_all_user_risks failed: %s", exc)
        db.rollback()
        return 0


def get_high_risk_users(db: Session, company_id: int, min_level: str = "HIGH") -> list[AIRiskScore]:
    """Return risk scores at or above min_level."""
    level_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    min_ord = level_order.get(min_level, 2)

    scores = db.query(AIRiskScore).filter(
        AIRiskScore.company_id  == company_id,
        AIRiskScore.subject_type == "user",
    ).all()

    return [s for s in scores if level_order.get(s.risk_level, 0) >= min_ord]
