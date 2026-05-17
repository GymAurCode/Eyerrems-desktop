"""
AI Insight Summary Generator.

Generates rule-based insight summaries for daily, weekly, and monthly periods.
No external AI API required — uses statistical comparison against previous periods.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.ai_intelligence import AIAlert, AIAnomaly, AIDuplicateMatch, AIInsight, AIRiskScore
from app.models.audit import AuditLog

log = logging.getLogger("rems.ai.insights")


def _period_bounds(period_type: str) -> tuple[datetime, datetime, datetime, datetime]:
    """Return (current_start, current_end, prev_start, prev_end)."""
    now = datetime.utcnow()
    if period_type == "daily":
        cur_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        cur_end   = now
        prev_start = cur_start - timedelta(days=1)
        prev_end   = cur_start
    elif period_type == "weekly":
        days_since_monday = now.weekday()
        cur_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        cur_end   = now
        prev_start = cur_start - timedelta(weeks=1)
        prev_end   = cur_start
    else:  # monthly
        cur_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        cur_end   = now
        if cur_start.month == 1:
            prev_start = cur_start.replace(year=cur_start.year - 1, month=12)
        else:
            prev_start = cur_start.replace(month=cur_start.month - 1)
        prev_end = cur_start

    return cur_start, cur_end, prev_start, prev_end


def _pct_change(current: int, previous: int) -> str:
    if previous == 0:
        return "new" if current > 0 else "unchanged"
    change = ((current - previous) / previous) * 100
    if change > 0:
        return f"up {change:.0f}%"
    elif change < 0:
        return f"down {abs(change):.0f}%"
    return "unchanged"


def generate_insight(db: Session, company_id: int, period_type: str = "daily") -> AIInsight:
    """Generate and persist an insight summary for the given period."""
    cur_start, cur_end, prev_start, prev_end = _period_bounds(period_type)

    # ── Current period metrics ────────────────────────────────────────────────
    cur_anomalies = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id == company_id,
        AIAnomaly.created_at >= cur_start,
        AIAnomaly.created_at <  cur_end,
    ).scalar() or 0

    cur_alerts = db.query(func.count(AIAlert.id)).filter(
        AIAlert.company_id == company_id,
        AIAlert.created_at >= cur_start,
        AIAlert.created_at <  cur_end,
    ).scalar() or 0

    cur_duplicates = db.query(func.count(AIDuplicateMatch.id)).filter(
        AIDuplicateMatch.company_id == company_id,
        AIDuplicateMatch.created_at >= cur_start,
        AIDuplicateMatch.created_at <  cur_end,
    ).scalar() or 0

    cur_high_risk = db.query(func.count(AIRiskScore.id)).filter(
        AIRiskScore.company_id  == company_id,
        AIRiskScore.risk_level.in_(["HIGH", "CRITICAL"]),
        AIRiskScore.last_computed >= cur_start,
    ).scalar() or 0

    cur_deletes = db.query(func.count(AuditLog.id)).filter(
        AuditLog.company_id == company_id,
        AuditLog.action     == "DELETE",
        AuditLog.created_at >= cur_start,
        AuditLog.created_at <  cur_end,
    ).scalar() or 0

    cur_fin_edits = db.query(func.count(AuditLog.id)).filter(
        AuditLog.company_id == company_id,
        AuditLog.action     == "UPDATE",
        AuditLog.module     == "Finance",
        AuditLog.created_at >= cur_start,
        AuditLog.created_at <  cur_end,
    ).scalar() or 0

    cur_after_hours = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id   == company_id,
        AIAnomaly.anomaly_type == "AFTER_HOURS",
        AIAnomaly.created_at   >= cur_start,
        AIAnomaly.created_at   <  cur_end,
    ).scalar() or 0

    # ── Previous period metrics ───────────────────────────────────────────────
    prev_anomalies = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id == company_id,
        AIAnomaly.created_at >= prev_start,
        AIAnomaly.created_at <  prev_end,
    ).scalar() or 0

    prev_fin_edits = db.query(func.count(AuditLog.id)).filter(
        AuditLog.company_id == company_id,
        AuditLog.action     == "UPDATE",
        AuditLog.module     == "Finance",
        AuditLog.created_at >= prev_start,
        AuditLog.created_at <  prev_end,
    ).scalar() or 0

    prev_after_hours = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id   == company_id,
        AIAnomaly.anomaly_type == "AFTER_HOURS",
        AIAnomaly.created_at   >= prev_start,
        AIAnomaly.created_at   <  prev_end,
    ).scalar() or 0

    # ── Build summary text ────────────────────────────────────────────────────
    period_label = {
        "daily":   cur_start.strftime("%Y-%m-%d"),
        "weekly":  cur_start.strftime("%Y-W%W"),
        "monthly": cur_start.strftime("%Y-%m"),
    }[period_type]

    lines: list[str] = []

    if cur_anomalies > 0:
        lines.append(
            f"{cur_anomalies} anomalies detected this {period_type.rstrip('ly')} "
            f"({_pct_change(cur_anomalies, prev_anomalies)} vs previous period)."
        )
    else:
        lines.append(f"No anomalies detected this {period_type.rstrip('ly')}.")

    if cur_alerts > 0:
        lines.append(f"{cur_alerts} AI alert{'s' if cur_alerts != 1 else ''} generated.")

    if cur_duplicates > 0:
        lines.append(f"{cur_duplicates} potential duplicate record{'s' if cur_duplicates != 1 else ''} found.")

    if cur_high_risk > 0:
        lines.append(f"{cur_high_risk} high-risk user{'s' if cur_high_risk != 1 else ''} identified.")

    if cur_deletes > 0:
        lines.append(f"{cur_deletes} record deletion{'s' if cur_deletes != 1 else ''} logged.")

    if cur_fin_edits > 0:
        change_str = _pct_change(cur_fin_edits, prev_fin_edits)
        lines.append(f"Finance edits: {cur_fin_edits} ({change_str} vs previous period).")

    if cur_after_hours > 0:
        change_str = _pct_change(cur_after_hours, prev_after_hours)
        lines.append(f"After-hours activity: {cur_after_hours} events ({change_str}).")

    if not lines:
        lines.append("System activity is within normal parameters.")

    summary_text = " ".join(lines)

    metrics = {
        "anomalies":    cur_anomalies,
        "alerts":       cur_alerts,
        "duplicates":   cur_duplicates,
        "high_risk":    cur_high_risk,
        "deletes":      cur_deletes,
        "fin_edits":    cur_fin_edits,
        "after_hours":  cur_after_hours,
        "prev_anomalies":   prev_anomalies,
        "prev_fin_edits":   prev_fin_edits,
        "prev_after_hours": prev_after_hours,
    }

    insight = AIInsight(
        company_id      = company_id,
        period_type     = period_type,
        period_label    = period_label,
        summary_text    = summary_text,
        metrics         = json.dumps(metrics),
        anomaly_count   = cur_anomalies,
        alert_count     = cur_alerts,
        duplicate_count = cur_duplicates,
        high_risk_count = cur_high_risk,
        created_at      = datetime.utcnow(),
    )
    db.add(insight)
    db.commit()
    db.refresh(insight)
    return insight


def get_latest_insight(db: Session, company_id: int, period_type: str = "daily") -> Optional[AIInsight]:
    return (
        db.query(AIInsight)
        .filter(
            AIInsight.company_id == company_id,
            AIInsight.period_type == period_type,
        )
        .order_by(AIInsight.created_at.desc())
        .first()
    )
