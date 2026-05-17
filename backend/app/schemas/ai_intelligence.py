"""Pydantic schemas for AI Intelligence Center."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Anomaly ───────────────────────────────────────────────────────────────────

class AnomalyResponse(BaseModel):
    id:           int
    anomaly_type: str
    severity:     str
    module:       Optional[str]
    entity_type:  Optional[str]
    entity_id:    Optional[int]
    user_id:      Optional[int]
    description:  str
    risk_score:   float
    is_resolved:  bool
    created_at:   datetime

    model_config = {"from_attributes": True}


class AnomalyResolveRequest(BaseModel):
    resolved: bool = True


# ── Risk Score ────────────────────────────────────────────────────────────────

class RiskScoreResponse(BaseModel):
    id:            int
    subject_type:  str
    subject_id:    int
    score:         float
    risk_level:    str
    factors:       Optional[str]   # raw JSON string
    last_computed: datetime

    model_config = {"from_attributes": True}


# ── Alert ─────────────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    id:           int
    alert_type:   str
    severity:     str
    title:        str
    message:      str
    module:       Optional[str]
    entity_type:  Optional[str]
    entity_id:    Optional[int]
    user_id:      Optional[int]
    is_read:      bool
    is_dismissed: bool
    created_at:   datetime

    model_config = {"from_attributes": True}


class AlertUpdateRequest(BaseModel):
    is_read:      Optional[bool] = None
    is_dismissed: Optional[bool] = None


# ── Duplicate Match ───────────────────────────────────────────────────────────

class DuplicateMatchResponse(BaseModel):
    id:           int
    entity_type:  str
    entity_id_a:  int
    entity_id_b:  int
    confidence:   float
    match_fields: Optional[str]   # raw JSON string
    status:       str
    created_at:   datetime

    model_config = {"from_attributes": True}


class DuplicateReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(confirmed|dismissed|merged)$")


# ── NLQ ───────────────────────────────────────────────────────────────────────

class NLQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)


class NLQueryResponse(BaseModel):
    intent:       str
    blocked:      bool
    block_reason: Optional[str] = None
    results:      list[dict[str, Any]]
    summary:      str
    count:        int
    execution_ms: Optional[int] = None


class QueryLogResponse(BaseModel):
    id:              int
    user_id:         Optional[int]
    raw_query:       str
    detected_intent: Optional[str]
    result_summary:  Optional[str]
    result_count:    Optional[int]
    was_blocked:     bool
    created_at:      datetime

    model_config = {"from_attributes": True}


# ── Insight ───────────────────────────────────────────────────────────────────

class InsightResponse(BaseModel):
    id:              int
    period_type:     str
    period_label:    str
    summary_text:    str
    metrics:         Optional[str]   # raw JSON string
    anomaly_count:   int
    alert_count:     int
    duplicate_count: int
    high_risk_count: int
    created_at:      datetime

    model_config = {"from_attributes": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

class AIDashboardStats(BaseModel):
    total_anomalies:       int
    unresolved_anomalies:  int
    critical_anomalies:    int
    high_anomalies:        int
    total_alerts:          int
    unread_alerts:         int
    duplicate_matches:     int
    high_risk_users:       int
    deleted_finance_today: int
    after_hours_today:     int
    recent_alerts:         list[AlertResponse]
    recent_anomalies:      list[AnomalyResponse]
    latest_insight:        Optional[InsightResponse]
    risk_trend:            list[dict[str, Any]]   # [{date, count, severity}]


# ── Scan trigger ──────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    scan_type: str = Field(
        default="all",
        description="all | anomalies | duplicates | risks | insights",
    )


class ScanResponse(BaseModel):
    scan_type: str
    results:   dict[str, Any]
    duration_ms: int
