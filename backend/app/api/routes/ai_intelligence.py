"""
AI Intelligence Center — API routes.

Endpoints:
  GET  /ai/dashboard              — dashboard stats
  GET  /ai/anomalies              — list anomalies (filterable)
  POST /ai/anomalies/{id}/resolve — mark anomaly resolved
  GET  /ai/alerts                 — list alerts
  POST /ai/alerts/{id}            — update alert (read/dismiss)
  POST /ai/alerts/dismiss-all     — dismiss all alerts
  GET  /ai/risk-scores            — list risk scores
  POST /ai/risk-scores/recompute  — trigger risk recomputation
  GET  /ai/duplicates             — list duplicate matches
  POST /ai/duplicates/{id}/review — review a duplicate match
  POST /ai/query                  — natural language query
  GET  /ai/queries                — query history log
  GET  /ai/insights               — list insights
  POST /ai/insights/generate      — generate new insight
  POST /ai/scan                   — trigger full AI scan
  GET  /ai/audit-monitor          — enhanced audit trail view
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, require_permissions
from app.models.ai_intelligence import (
    AIAlert, AIAnomaly, AIDuplicateMatch, AIInsight, AIQuery, AIRiskScore,
)
from app.models.audit import AuditLog
from app.models.auth import User
from app.schemas.ai_intelligence import (
    AIDashboardStats,
    AlertResponse,
    AlertUpdateRequest,
    AnomalyResponse,
    AnomalyResolveRequest,
    DuplicateMatchResponse,
    DuplicateReviewRequest,
    InsightResponse,
    NLQueryRequest,
    NLQueryResponse,
    QueryLogResponse,
    RiskScoreResponse,
    ScanRequest,
    ScanResponse,
)
from app.services.ai.anomaly_engine import run_all_detections
from app.services.ai.duplicate_detector import run_all_duplicate_checks
from app.services.ai.insight_generator import generate_insight, get_latest_insight
from app.services.ai.nlq_engine import process_query
from app.services.ai.risk_scorer import compute_all_user_risks

router = APIRouter(prefix="/ai", tags=["AI Intelligence"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _company_id(request: Request) -> int:
    cid = request.state.company_id
    if not cid:
        raise HTTPException(status_code=403, detail="No company context")
    return cid


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=AIDashboardStats)
def get_dashboard(
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total_anomalies = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id == cid
    ).scalar() or 0

    unresolved = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id == cid,
        AIAnomaly.is_resolved == False,
    ).scalar() or 0

    critical = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id == cid,
        AIAnomaly.severity   == "CRITICAL",
        AIAnomaly.is_resolved == False,
    ).scalar() or 0

    high = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id == cid,
        AIAnomaly.severity   == "HIGH",
        AIAnomaly.is_resolved == False,
    ).scalar() or 0

    total_alerts = db.query(func.count(AIAlert.id)).filter(
        AIAlert.company_id == cid
    ).scalar() or 0

    unread_alerts = db.query(func.count(AIAlert.id)).filter(
        AIAlert.company_id  == cid,
        AIAlert.is_read     == False,
        AIAlert.is_dismissed == False,
    ).scalar() or 0

    duplicates = db.query(func.count(AIDuplicateMatch.id)).filter(
        AIDuplicateMatch.company_id == cid,
        AIDuplicateMatch.status     == "pending",
    ).scalar() or 0

    high_risk_users = db.query(func.count(AIRiskScore.id)).filter(
        AIRiskScore.company_id   == cid,
        AIRiskScore.subject_type == "user",
        AIRiskScore.risk_level.in_(["HIGH", "CRITICAL"]),
    ).scalar() or 0

    deleted_finance_today = db.query(func.count(AuditLog.id)).filter(
        AuditLog.company_id == cid,
        AuditLog.action     == "DELETE",
        AuditLog.module     == "Finance",
        AuditLog.created_at >= today,
    ).scalar() or 0

    after_hours_today = db.query(func.count(AIAnomaly.id)).filter(
        AIAnomaly.company_id   == cid,
        AIAnomaly.anomaly_type == "AFTER_HOURS",
        AIAnomaly.created_at   >= today,
    ).scalar() or 0

    recent_alerts = (
        db.query(AIAlert)
        .filter(AIAlert.company_id == cid, AIAlert.is_dismissed == False)
        .order_by(AIAlert.created_at.desc())
        .limit(8)
        .all()
    )

    recent_anomalies = (
        db.query(AIAnomaly)
        .filter(AIAnomaly.company_id == cid, AIAnomaly.is_resolved == False)
        .order_by(AIAnomaly.created_at.desc())
        .limit(8)
        .all()
    )

    latest_insight = get_latest_insight(db, cid, "daily")

    # Risk trend — last 7 days anomaly counts by severity
    risk_trend: list[dict] = []
    for i in range(6, -1, -1):
        day_start = today - timedelta(days=i)
        day_end   = day_start + timedelta(days=1)
        day_counts = {
            "date":     day_start.strftime("%Y-%m-%d"),
            "total":    0,
            "critical": 0,
            "high":     0,
            "medium":   0,
            "low":      0,
        }
        rows = db.query(AIAnomaly.severity, func.count(AIAnomaly.id)).filter(
            AIAnomaly.company_id == cid,
            AIAnomaly.created_at >= day_start,
            AIAnomaly.created_at <  day_end,
        ).group_by(AIAnomaly.severity).all()
        for sev, cnt in rows:
            day_counts[sev.lower()] = cnt
            day_counts["total"] += cnt
        risk_trend.append(day_counts)

    return AIDashboardStats(
        total_anomalies       = total_anomalies,
        unresolved_anomalies  = unresolved,
        critical_anomalies    = critical,
        high_anomalies        = high,
        total_alerts          = total_alerts,
        unread_alerts         = unread_alerts,
        duplicate_matches     = duplicates,
        high_risk_users       = high_risk_users,
        deleted_finance_today = deleted_finance_today,
        after_hours_today     = after_hours_today,
        recent_alerts         = recent_alerts,
        recent_anomalies      = recent_anomalies,
        latest_insight        = latest_insight,
        risk_trend            = risk_trend,
    )


# ── Anomalies ─────────────────────────────────────────────────────────────────

@router.get("/anomalies", response_model=list[AnomalyResponse])
def list_anomalies(
    request: Request,
    severity:     Optional[str] = Query(None),
    anomaly_type: Optional[str] = Query(None),
    module:       Optional[str] = Query(None),
    is_resolved:  Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    q = db.query(AIAnomaly).filter(AIAnomaly.company_id == cid)
    if severity:
        q = q.filter(AIAnomaly.severity == severity.upper())
    if anomaly_type:
        q = q.filter(AIAnomaly.anomaly_type == anomaly_type.upper())
    if module:
        q = q.filter(AIAnomaly.module == module)
    if is_resolved is not None:
        q = q.filter(AIAnomaly.is_resolved == is_resolved)
    return q.order_by(AIAnomaly.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/anomalies/{anomaly_id}/resolve", response_model=AnomalyResponse)
def resolve_anomaly(
    anomaly_id: int,
    payload: AnomalyResolveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("ai.manage")),
):
    cid = _company_id(request)
    anomaly = db.query(AIAnomaly).filter(
        AIAnomaly.id == anomaly_id,
        AIAnomaly.company_id == cid,
    ).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    anomaly.is_resolved = payload.resolved
    anomaly.resolved_by = current_user.id
    anomaly.resolved_at = datetime.utcnow() if payload.resolved else None
    db.commit()
    db.refresh(anomaly)
    return anomaly


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=list[AlertResponse])
def list_alerts(
    request: Request,
    severity:     Optional[str]  = Query(None),
    alert_type:   Optional[str]  = Query(None),
    is_read:      Optional[bool] = Query(None),
    is_dismissed: Optional[bool] = Query(False),
    skip:  int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    q = db.query(AIAlert).filter(AIAlert.company_id == cid)
    if severity:
        q = q.filter(AIAlert.severity == severity.upper())
    if alert_type:
        q = q.filter(AIAlert.alert_type == alert_type.upper())
    if is_read is not None:
        q = q.filter(AIAlert.is_read == is_read)
    if is_dismissed is not None:
        q = q.filter(AIAlert.is_dismissed == is_dismissed)
    return q.order_by(AIAlert.created_at.desc()).offset(skip).limit(limit).all()


@router.patch("/alerts/{alert_id}", response_model=AlertResponse)
def update_alert(
    alert_id: int,
    payload: AlertUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    alert = db.query(AIAlert).filter(
        AIAlert.id == alert_id,
        AIAlert.company_id == cid,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if payload.is_read is not None:
        alert.is_read = payload.is_read
    if payload.is_dismissed is not None:
        alert.is_dismissed = payload.is_dismissed
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/alerts/dismiss-all", status_code=status.HTTP_204_NO_CONTENT)
def dismiss_all_alerts(
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    db.query(AIAlert).filter(
        AIAlert.company_id  == cid,
        AIAlert.is_dismissed == False,
    ).update({"is_dismissed": True, "is_read": True})
    db.commit()


# ── Risk Scores ───────────────────────────────────────────────────────────────

@router.get("/risk-scores", response_model=list[RiskScoreResponse])
def list_risk_scores(
    request: Request,
    subject_type: Optional[str] = Query("user"),
    risk_level:   Optional[str] = Query(None),
    skip:  int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    q = db.query(AIRiskScore).filter(AIRiskScore.company_id == cid)
    if subject_type:
        q = q.filter(AIRiskScore.subject_type == subject_type)
    if risk_level:
        q = q.filter(AIRiskScore.risk_level == risk_level.upper())
    return q.order_by(AIRiskScore.score.desc()).offset(skip).limit(limit).all()


@router.post("/risk-scores/recompute")
def recompute_risk_scores(
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.manage")),
):
    cid = _company_id(request)
    count = compute_all_user_risks(db, cid)
    return {"recomputed": count, "message": f"Risk scores updated for {count} users."}


# ── Duplicates ────────────────────────────────────────────────────────────────

@router.get("/duplicates", response_model=list[DuplicateMatchResponse])
def list_duplicates(
    request: Request,
    entity_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    skip:  int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    q = db.query(AIDuplicateMatch).filter(AIDuplicateMatch.company_id == cid)
    if entity_type:
        q = q.filter(AIDuplicateMatch.entity_type == entity_type)
    if status_filter:
        q = q.filter(AIDuplicateMatch.status == status_filter)
    else:
        q = q.filter(AIDuplicateMatch.status == "pending")
    return q.order_by(AIDuplicateMatch.confidence.desc()).offset(skip).limit(limit).all()


@router.patch("/duplicates/{match_id}", response_model=DuplicateMatchResponse)
def review_duplicate(
    match_id: int,
    payload: DuplicateReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("ai.manage")),
):
    cid = _company_id(request)
    match = db.query(AIDuplicateMatch).filter(
        AIDuplicateMatch.id == match_id,
        AIDuplicateMatch.company_id == cid,
    ).first()
    if not match:
        raise HTTPException(status_code=404, detail="Duplicate match not found")
    match.status      = payload.status
    match.reviewed_by = current_user.id
    match.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(match)
    return match


# ── Natural Language Query ────────────────────────────────────────────────────

@router.post("/query", response_model=NLQueryResponse)
def natural_language_query(
    payload: NLQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("ai.query")),
):
    cid = _company_id(request)
    result = process_query(db, cid, current_user.id, payload.query)
    return NLQueryResponse(**result)


@router.get("/queries", response_model=list[QueryLogResponse])
def list_query_logs(
    request: Request,
    skip:  int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    return (
        db.query(AIQuery)
        .filter(AIQuery.company_id == cid)
        .order_by(AIQuery.created_at.desc())
        .offset(skip).limit(limit)
        .all()
    )


# ── Insights ──────────────────────────────────────────────────────────────────

@router.get("/insights", response_model=list[InsightResponse])
def list_insights(
    request: Request,
    period_type: Optional[str] = Query(None),
    skip:  int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    q = db.query(AIInsight).filter(AIInsight.company_id == cid)
    if period_type:
        q = q.filter(AIInsight.period_type == period_type)
    return q.order_by(AIInsight.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/insights/generate", response_model=InsightResponse)
def trigger_insight(
    request: Request,
    period_type: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.manage")),
):
    cid = _company_id(request)
    insight = generate_insight(db, cid, period_type)
    return insight


# ── Full Scan ─────────────────────────────────────────────────────────────────

@router.post("/scan", response_model=ScanResponse)
def trigger_scan(
    payload: ScanRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.manage")),
):
    cid = _company_id(request)
    t0 = time.time()
    results: dict = {}

    scan = payload.scan_type.lower()

    if scan in ("all", "anomalies"):
        results["anomalies"] = run_all_detections(db, cid)

    if scan in ("all", "duplicates"):
        results["duplicates"] = run_all_duplicate_checks(db, cid)

    if scan in ("all", "risks"):
        results["risks"] = {"users_recomputed": compute_all_user_risks(db, cid)}

    if scan in ("all", "insights"):
        insight = generate_insight(db, cid, "daily")
        results["insights"] = {"generated": True, "period": insight.period_label}

    duration_ms = int((time.time() - t0) * 1000)
    return ScanResponse(scan_type=payload.scan_type, results=results, duration_ms=duration_ms)


# ── Enhanced Audit Monitor ────────────────────────────────────────────────────

@router.get("/audit-monitor")
def audit_monitor(
    request: Request,
    action:  Optional[str] = Query(None),
    module:  Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    days:    int = Query(7, ge=1, le=90),
    skip:    int = Query(0, ge=0),
    limit:   int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("ai.view")),
):
    cid = _company_id(request)
    since = datetime.utcnow() - timedelta(days=days)

    q = db.query(AuditLog).filter(
        AuditLog.company_id == cid,
        AuditLog.created_at >= since,
    )
    if action:
        q = q.filter(AuditLog.action == action.upper())
    if module:
        q = q.filter(AuditLog.module == module)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)

    total = q.count()
    logs  = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    # Action breakdown
    breakdown = db.query(AuditLog.action, func.count(AuditLog.id)).filter(
        AuditLog.company_id == cid,
        AuditLog.created_at >= since,
    ).group_by(AuditLog.action).all()

    return {
        "total": total,
        "breakdown": {row[0]: row[1] for row in breakdown},
        "logs": [
            {
                "id":          l.id,
                "action":      l.action,
                "module":      l.module,
                "entity_type": l.entity_type,
                "entity_id":   l.entity_id,
                "user_id":     l.user_id,
                "description": l.description,
                "ip_address":  l.ip_address,
                "created_at":  str(l.created_at),
            }
            for l in logs
        ],
    }
