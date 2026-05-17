"""
Natural Language Query Engine.

Architecture (injection-safe):
  User Prompt
    → Intent Detection (keyword matching, no LLM required)
    → Allowed Query Mapping (whitelist of safe parameterized queries)
    → Safe SQL Execution (SQLAlchemy ORM, never raw user input in SQL)
    → Result Formatting
    → AI Summary Generation (rule-based, no external API required)

Supported intents:
  SUSPICIOUS_TRANSACTIONS  — "show suspicious transactions"
  DELETED_FINANCE          — "deleted finance entries"
  TOP_EDITORS              — "who edited most records"
  HIGH_RISK_USERS          — "high risk users / employees"
  DUPLICATE_TENANTS        — "duplicate tenants / clients"
  RENT_RECOVERY            — "rent recovery / collection"
  ANOMALY_SUMMARY          — "anomalies / suspicious activity"
  AUDIT_TRAIL              — "audit log / recent actions"
  AFTER_HOURS              — "after hours / midnight activity"
  UNKNOWN                  — anything else → blocked
"""
from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.ai_intelligence import AIAnomaly, AIAlert, AIQuery
from app.models.audit import AuditLog
from app.models.auth import User

log = logging.getLogger("rems.ai.nlq")

# ── Intent patterns ───────────────────────────────────────────────────────────
# Each intent maps to a list of keyword patterns (any match → intent detected)

INTENT_PATTERNS: dict[str, list[str]] = {
    "SUSPICIOUS_TRANSACTIONS": [
        r"suspicious\s+trans", r"unusual\s+trans", r"fraud", r"suspicious\s+payment",
        r"suspicious\s+edit", r"edited\s+paid",
    ],
    "DELETED_FINANCE": [
        r"deleted?\s+finance", r"deleted?\s+record", r"removed\s+finance",
        r"finance\s+delet", r"deleted?\s+journal", r"deleted?\s+expense",
    ],
    "TOP_EDITORS": [
        r"who\s+edited", r"most\s+edit", r"top\s+editor", r"most\s+update",
        r"who\s+changed", r"most\s+changes",
    ],
    "HIGH_RISK_USERS": [
        r"high.?risk\s+user", r"high.?risk\s+employ", r"risky\s+user",
        r"dangerous\s+user", r"risk\s+score", r"critical\s+user",
    ],
    "DUPLICATE_TENANTS": [
        r"duplicate\s+tenant", r"duplicate\s+client", r"duplicate\s+record",
        r"duplicate\s+property", r"similar\s+record", r"same\s+cnic",
        r"same\s+phone",
    ],
    "RENT_RECOVERY": [
        r"rent\s+recover", r"rent\s+collect", r"total\s+rent", r"rent\s+paid",
        r"rent\s+last\s+month", r"monthly\s+rent",
    ],
    "ANOMALY_SUMMARY": [
        r"anomal", r"suspicious\s+activit", r"detected\s+today",
        r"ai\s+alert", r"risk\s+summar", r"security\s+issue",
    ],
    "AUDIT_TRAIL": [
        r"audit\s+log", r"recent\s+action", r"who\s+did", r"activity\s+log",
        r"what\s+happened", r"recent\s+activit",
    ],
    "AFTER_HOURS": [
        r"after.?hours", r"midnight", r"late.?night", r"night\s+activit",
        r"outside\s+office", r"off.?hours",
    ],
}

# ── Injection guard ───────────────────────────────────────────────────────────
INJECTION_PATTERNS = [
    r";\s*(drop|delete|truncate|alter|create|insert|update)\s",
    r"--\s",
    r"/\*.*\*/",
    r"union\s+select",
    r"exec\s*\(",
    r"xp_cmdshell",
    r"information_schema",
    r"pg_catalog",
    r"sys\.",
]


def _is_injection_attempt(query: str) -> bool:
    q = query.lower()
    return any(re.search(p, q) for p in INJECTION_PATTERNS)


def _detect_intent(query: str) -> str:
    q = query.lower()
    for intent, patterns in INTENT_PATTERNS.items():
        if any(re.search(p, q) for p in patterns):
            return intent
    return "UNKNOWN"


# ── Safe query executors ──────────────────────────────────────────────────────

def _exec_suspicious_transactions(db: Session, company_id: int) -> tuple[list[dict], str]:
    rows = db.query(AIAnomaly).filter(
        AIAnomaly.company_id   == company_id,
        AIAnomaly.anomaly_type.in_(["SUSPICIOUS_EDIT", "DELETED_FINANCE", "LARGE_JUMP"]),
        AIAnomaly.is_resolved  == False,
    ).order_by(AIAnomaly.created_at.desc()).limit(20).all()

    results = [
        {
            "id":          r.id,
            "type":        r.anomaly_type,
            "severity":    r.severity,
            "description": r.description,
            "module":      r.module,
            "created_at":  str(r.created_at),
        }
        for r in rows
    ]
    summary = (
        f"Found {len(results)} suspicious transaction anomalies. "
        + (f"Most recent: {results[0]['description'][:80]}..." if results else "No suspicious transactions detected.")
    )
    return results, summary


def _exec_deleted_finance(db: Session, company_id: int) -> tuple[list[dict], str]:
    rows = db.query(AuditLog).filter(
        AuditLog.company_id == company_id,
        AuditLog.action     == "DELETE",
        AuditLog.module     == "Finance",
    ).order_by(AuditLog.created_at.desc()).limit(20).all()

    results = [
        {
            "id":          r.id,
            "entity_type": r.entity_type,
            "entity_id":   r.entity_id,
            "user_id":     r.user_id,
            "description": r.description,
            "created_at":  str(r.created_at),
        }
        for r in rows
    ]
    summary = (
        f"Found {len(results)} deleted finance records. "
        + (f"Last deletion: {results[0]['description'] or 'No description'}" if results else "No deleted finance records found.")
    )
    return results, summary


def _exec_top_editors(db: Session, company_id: int) -> tuple[list[dict], str]:
    since = datetime.utcnow() - timedelta(days=30)
    rows = db.execute(
        text("""
            SELECT al.user_id, u.full_name, u.email,
                   COUNT(*) as edit_count
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.user_id
            WHERE al.action = 'UPDATE'
              AND al.company_id = :cid
              AND al.created_at >= :since
            GROUP BY al.user_id, u.full_name, u.email
            ORDER BY edit_count DESC
            LIMIT 10
        """),
        {"cid": company_id, "since": since},
    ).fetchall()

    results = [
        {
            "user_id":    r[0],
            "full_name":  r[1] or "Unknown",
            "email":      r[2] or "—",
            "edit_count": r[3],
        }
        for r in rows
    ]
    summary = (
        f"Top editor this month: {results[0]['full_name']} with {results[0]['edit_count']} edits."
        if results else "No edit activity found this month."
    )
    return results, summary


def _exec_high_risk_users(db: Session, company_id: int) -> tuple[list[dict], str]:
    from app.models.ai_intelligence import AIRiskScore
    rows = db.query(AIRiskScore).filter(
        AIRiskScore.company_id   == company_id,
        AIRiskScore.subject_type == "user",
        AIRiskScore.risk_level.in_(["HIGH", "CRITICAL"]),
    ).order_by(AIRiskScore.score.desc()).limit(10).all()

    results = [
        {
            "user_id":    r.subject_id,
            "score":      r.score,
            "risk_level": r.risk_level,
            "computed":   str(r.last_computed),
        }
        for r in rows
    ]
    summary = (
        f"Found {len(results)} high-risk users. "
        + (f"Highest risk: User #{results[0]['user_id']} with score {results[0]['score']:.0f} ({results[0]['risk_level']})." if results else "No high-risk users detected.")
    )
    return results, summary


def _exec_duplicate_tenants(db: Session, company_id: int) -> tuple[list[dict], str]:
    from app.models.ai_intelligence import AIDuplicateMatch
    rows = db.query(AIDuplicateMatch).filter(
        AIDuplicateMatch.company_id  == company_id,
        AIDuplicateMatch.entity_type.in_(["tenant", "client"]),
        AIDuplicateMatch.status      == "pending",
    ).order_by(AIDuplicateMatch.confidence.desc()).limit(20).all()

    results = [
        {
            "id":          r.id,
            "entity_type": r.entity_type,
            "id_a":        r.entity_id_a,
            "id_b":        r.entity_id_b,
            "confidence":  f"{r.confidence * 100:.0f}%",
            "fields":      r.match_fields,
        }
        for r in rows
    ]
    summary = (
        f"Found {len(results)} potential duplicate tenant/client records. "
        + (f"Highest confidence: {results[0]['confidence']} match between #{results[0]['id_a']} and #{results[0]['id_b']}." if results else "No duplicates detected.")
    )
    return results, summary


def _exec_rent_recovery(db: Session, company_id: int) -> tuple[list[dict], str]:
    since = datetime.utcnow() - timedelta(days=30)
    result = db.execute(
        text("""
            SELECT
                COUNT(*)                                    as total_records,
                SUM(CAST(amount AS FLOAT))                  as total_amount,
                SUM(CASE WHEN status='paid' THEN CAST(amount AS FLOAT) ELSE 0 END) as paid_amount,
                SUM(CASE WHEN status='pending' THEN CAST(amount AS FLOAT) ELSE 0 END) as pending_amount
            FROM invoices
            WHERE created_at >= :since
        """),
        {"since": since},
    ).fetchone()

    total = result[0] or 0
    total_amt = float(result[1] or 0)
    paid_amt = float(result[2] or 0)
    pending_amt = float(result[3] or 0)

    results = [{
        "period":         "Last 30 days",
        "total_invoices": total,
        "total_amount":   total_amt,
        "paid_amount":    paid_amt,
        "pending_amount": pending_amt,
        "recovery_rate":  f"{(paid_amt / total_amt * 100):.1f}%" if total_amt > 0 else "0%",
    }]
    summary = (
        f"Rent recovery last 30 days: {paid_amt:,.0f} collected out of {total_amt:,.0f} "
        f"({results[0]['recovery_rate']} recovery rate). {total} invoices total."
    )
    return results, summary


def _exec_anomaly_summary(db: Session, company_id: int) -> tuple[list[dict], str]:
    since = datetime.utcnow() - timedelta(days=7)
    rows = db.query(AIAnomaly).filter(
        AIAnomaly.company_id  == company_id,
        AIAnomaly.created_at  >= since,
        AIAnomaly.is_resolved == False,
    ).order_by(AIAnomaly.risk_score.desc()).limit(20).all()

    results = [
        {
            "id":          r.id,
            "type":        r.anomaly_type,
            "severity":    r.severity,
            "description": r.description,
            "risk_score":  r.risk_score,
            "created_at":  str(r.created_at),
        }
        for r in rows
    ]
    critical = sum(1 for r in rows if r.severity == "CRITICAL")
    high     = sum(1 for r in rows if r.severity == "HIGH")
    summary = (
        f"Last 7 days: {len(results)} anomalies detected "
        f"({critical} critical, {high} high severity). "
        + (f"Top issue: {results[0]['description'][:80]}..." if results else "")
    )
    return results, summary


def _exec_audit_trail(db: Session, company_id: int) -> tuple[list[dict], str]:
    rows = db.query(AuditLog).filter(
        AuditLog.company_id == company_id,
    ).order_by(AuditLog.created_at.desc()).limit(20).all()

    results = [
        {
            "id":          r.id,
            "action":      r.action,
            "module":      r.module,
            "entity_type": r.entity_type,
            "entity_id":   r.entity_id,
            "user_id":     r.user_id,
            "description": r.description,
            "created_at":  str(r.created_at),
        }
        for r in rows
    ]
    summary = f"Showing {len(results)} most recent audit log entries."
    return results, summary


def _exec_after_hours(db: Session, company_id: int) -> tuple[list[dict], str]:
    since = datetime.utcnow() - timedelta(days=7)
    rows = db.query(AIAnomaly).filter(
        AIAnomaly.company_id   == company_id,
        AIAnomaly.anomaly_type == "AFTER_HOURS",
        AIAnomaly.created_at   >= since,
    ).order_by(AIAnomaly.created_at.desc()).limit(20).all()

    results = [
        {
            "id":          r.id,
            "user_id":     r.user_id,
            "description": r.description,
            "severity":    r.severity,
            "created_at":  str(r.created_at),
        }
        for r in rows
    ]
    summary = (
        f"Found {len(results)} after-hours activity events in the last 7 days. "
        + (f"Most recent: {results[0]['description'][:80]}..." if results else "No after-hours activity detected.")
    )
    return results, summary


# ── Intent → executor map ─────────────────────────────────────────────────────
INTENT_EXECUTORS = {
    "SUSPICIOUS_TRANSACTIONS": _exec_suspicious_transactions,
    "DELETED_FINANCE":         _exec_deleted_finance,
    "TOP_EDITORS":             _exec_top_editors,
    "HIGH_RISK_USERS":         _exec_high_risk_users,
    "DUPLICATE_TENANTS":       _exec_duplicate_tenants,
    "RENT_RECOVERY":           _exec_rent_recovery,
    "ANOMALY_SUMMARY":         _exec_anomaly_summary,
    "AUDIT_TRAIL":             _exec_audit_trail,
    "AFTER_HOURS":             _exec_after_hours,
}


# ── Public API ────────────────────────────────────────────────────────────────

def process_query(
    db: Session,
    company_id: int,
    user_id: Optional[int],
    raw_query: str,
) -> dict[str, Any]:
    """
    Process a natural language query safely.
    Returns a structured response with intent, results, and summary.
    """
    start_ms = int(time.time() * 1000)

    # Security: injection guard
    if _is_injection_attempt(raw_query):
        log_entry = AIQuery(
            company_id      = company_id,
            user_id         = user_id,
            raw_query       = raw_query[:500],
            detected_intent = "BLOCKED",
            was_blocked     = True,
            block_reason    = "Potential SQL injection detected",
            created_at      = datetime.utcnow(),
        )
        db.add(log_entry)
        db.commit()
        return {
            "intent":       "BLOCKED",
            "blocked":      True,
            "block_reason": "Query contains potentially unsafe patterns and was blocked.",
            "results":      [],
            "summary":      "Query blocked for security reasons.",
            "count":        0,
        }

    # Detect intent
    intent = _detect_intent(raw_query)

    if intent == "UNKNOWN":
        log_entry = AIQuery(
            company_id      = company_id,
            user_id         = user_id,
            raw_query       = raw_query[:500],
            detected_intent = "UNKNOWN",
            was_blocked     = True,
            block_reason    = "No matching intent found",
            result_count    = 0,
            execution_ms    = int(time.time() * 1000) - start_ms,
            created_at      = datetime.utcnow(),
        )
        db.add(log_entry)
        db.commit()
        return {
            "intent":   "UNKNOWN",
            "blocked":  True,
            "block_reason": (
                "I couldn't understand that query. Try asking about: "
                "suspicious transactions, deleted finance records, top editors, "
                "high-risk users, duplicate tenants, rent recovery, anomalies, "
                "audit trail, or after-hours activity."
            ),
            "results":  [],
            "summary":  "Query not understood.",
            "count":    0,
        }

    # Execute safe query
    executor = INTENT_EXECUTORS[intent]
    try:
        results, summary = executor(db, company_id)
    except Exception as exc:
        log.warning("NLQ executor failed for intent %s: %s", intent, exc)
        results, summary = [], f"Query failed: {exc}"

    elapsed = int(time.time() * 1000) - start_ms

    # Log query
    log_entry = AIQuery(
        company_id      = company_id,
        user_id         = user_id,
        raw_query       = raw_query[:500],
        detected_intent = intent,
        mapped_query    = intent,
        result_summary  = summary[:500],
        result_count    = len(results),
        execution_ms    = elapsed,
        was_blocked     = False,
        created_at      = datetime.utcnow(),
    )
    db.add(log_entry)
    db.commit()

    return {
        "intent":       intent,
        "blocked":      False,
        "results":      results,
        "summary":      summary,
        "count":        len(results),
        "execution_ms": elapsed,
    }
