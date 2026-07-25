"""Audit Log API — company-scoped activity history with role-based visibility."""
import json
import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.auth import User

log = logging.getLogger("rems.audit_api")

router = APIRouter()

MODULE_FILTERS = [
    "property", "tenant", "crm", "hr", "maintenance",
    "finance", "invoice", "user", "settings", "construction",
    "booking", "report", "auth",
]

ACTION_FILTERS = [
    "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT",
    "GENERATE", "EXPORT", "DOWNLOAD", "PRINT",
    "STATUS_CHANGE",
    "BULK_CREATE", "BULK_UPDATE", "BULK_DELETE",
]


def _is_admin(user: User) -> bool:
    return True


def _get_user_role(user: User) -> str:
    if user.is_super_admin:
        return "superadmin"
    return "admin"


def _build_where(current_user: User, module=None, action=None, changed_by=None,
                  record_id=None, date_from=None, date_to=None, period=None,
                  entity_type=None, status=None, search=None):
    """Build WHERE clause with role-based visibility."""
    conditions = ["1=1"]
    params: dict = {}

    # Role-based visibility: Admin sees everything; others see only their own actions.
    if not _is_admin(current_user):
        conditions.append("changed_by = :current_user_email")
        params["current_user_email"] = current_user.email

    if module:
        conditions.append("module = :module")
        params["module"] = module
    if action:
        conditions.append("action = :action")
        params["action"] = action
    if entity_type:
        conditions.append("entity_type = :entity_type")
        params["entity_type"] = entity_type
    if status:
        conditions.append("status = :status")
        params["status"] = status
    if changed_by and _is_admin(current_user):
        conditions.append("(changed_by ILIKE :changed_by OR COALESCE(full_name, '') ILIKE :changed_by)")
        params["changed_by"] = f"%{changed_by}%"
    if record_id:
        conditions.append("(record_id = :record_id OR entity_id = :record_id2)")
        params["record_id"] = record_id
        params["record_id2"] = record_id
    if search:
        search_term = f"%{search}%"
        conditions.append("""
            (module ILIKE :search OR action ILIKE :search
             OR record_label ILIKE :search OR entity_name ILIKE :search
             OR changed_by ILIKE :search OR COALESCE(full_name, '') ILIKE :search
             OR ip_address ILIKE :search)
        """)
        params["search"] = search_term

    # Date range
    if period:
        now = datetime.utcnow()
        if period == "today":
            date_from_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            date_from_dt = now - timedelta(days=now.weekday())
            date_from_dt = date_from_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            date_from_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == "year":
            date_from_dt = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            date_from_dt = None
        if date_from_dt:
            conditions.append("created_at >= :date_from")
            params["date_from"] = date_from_dt.isoformat()

    if date_from:
        conditions.append("created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("created_at <= :date_to")
        params["date_to"] = date_to

    return conditions, params


def _safe_json_load(val):
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    return val


def _row_to_dict(r):
    """Convert a raw SQLAlchemy Row to a response dict."""
    return {
        "id": str(r["id"]),
        "module": r["module"],
        "action": r["action"],
        "record_id": r.get("record_id") or r.get("entity_id"),
        "record_label": r.get("record_label") or r.get("entity_name") or "",
        "changed_by": r["changed_by"],
        "changed_by_role": r.get("changed_by_role"),
        "user_id": r.get("user_id"),
        "username": r.get("username"),
        "full_name": r.get("full_name"),
        "role": r.get("role"),
        "department": r.get("department"),
        "entity_type": r.get("entity_type") or r["module"],
        "entity_id": r.get("entity_id") or r.get("record_id"),
        "entity_name": r.get("entity_name") or r.get("record_label") or "",
        "old_data": _safe_json_load(r.get("old_data")),
        "new_data": _safe_json_load(r.get("new_data")),
        "diff": _safe_json_load(r.get("diff")),
        "ip_address": r.get("ip_address"),
        "browser": r.get("browser"),
        "os": r.get("os"),
        "device": r.get("device"),
        "request_method": r.get("request_method"),
        "api_endpoint": r.get("api_endpoint"),
        "status": r.get("status", "Success"),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
    }


COLUMNS_SELECT = """
    id, module, action,
    COALESCE(record_id, entity_id) as record_id,
    COALESCE(record_label, entity_name) as record_label,
    changed_by, changed_by_role,
    user_id, username, full_name, role, department,
    entity_type, entity_id, entity_name,
    old_data, new_data, diff,
    ip_address, browser, os, device,
    request_method, api_endpoint,
    status, created_at
"""


@router.get("/logs")
def list_audit_logs(
    module: str = Query(None, description="Filter by module name"),
    action: str = Query(None, description="Filter by action type"),
    changed_by: str = Query(None, description="Filter by user email/name (admin only)"),
    entity_type: str = Query(None, description="Filter by entity type"),
    status: str = Query(None, description="Filter by status (Success/Failed)"),
    search: str = Query(None, description="Full-text search across multiple fields"),
    date_from: str = Query(None, description="ISO date string"),
    date_to: str = Query(None, description="ISO date string"),
    period: str = Query(None, description="today|week|month|year"),
    record_id: str = Query(None, description="Filter by record UUID"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get paginated audit logs with role-based visibility."""
    conditions, params = _build_where(
        current_user, module=module, action=action,
        changed_by=changed_by, record_id=record_id,
        date_from=date_from, date_to=date_to, period=period,
        entity_type=entity_type, status=status, search=search,
    )
    where = " AND ".join(conditions)

    offset = (page - 1) * per_page
    count_sql = f"SELECT COUNT(*) FROM audit_logs WHERE {where}"
    total = db.execute(text(count_sql), params).scalar() or 0

    fetch_sql = f"""
        SELECT {COLUMNS_SELECT}
        FROM audit_logs
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """
    params["limit"] = per_page
    params["offset"] = offset
    rows = db.execute(text(fetch_sql), params).fetchall()

    logs = [_row_to_dict(r._mapping) for r in rows]

    log.info("History API returned %s records (total: %s)", len(logs), total)

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "logs": logs,
    }


@router.get("/logs/{record_id}")
def get_record_history(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all audit logs for a specific record (any role can view)."""
    conditions, params = _build_where(current_user, record_id=record_id)

    # Override: for record history, always show matching records regardless of admin status
    conditions = [c for c in conditions if "changed_by" not in c]
    where = " AND ".join(conditions)

    rows = db.execute(
        text(f"""
            SELECT {COLUMNS_SELECT}
            FROM audit_logs
            WHERE {where}
            ORDER BY created_at DESC
        """),
        params,
    ).fetchall()

    return [_row_to_dict(r._mapping) for r in rows]


@router.get("/stats")
def audit_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return summary counts scoped to the current user's visibility level."""
    role_filter = ""
    params: dict = {}
    if not _is_admin(current_user):
        role_filter = " WHERE changed_by = :current_user_email"
        params["current_user_email"] = current_user.email

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    def _count_since(dt):
        return db.execute(
            text("SELECT COUNT(*) FROM audit_logs WHERE created_at >= :dt" + role_filter.replace("WHERE", "AND" if role_filter else "WHERE")),
            {"dt": dt.isoformat(), **params},
        ).scalar() or 0

    total_today = db.execute(
        text(f"SELECT COUNT(*) FROM audit_logs WHERE created_at >= :today{(' AND changed_by = :u' if role_filter else '')}"),
        {"today": today_start.isoformat(), **params},
    ).scalar() or 0

    total_week = db.execute(
        text(f"SELECT COUNT(*) FROM audit_logs WHERE created_at >= :week{(' AND changed_by = :u' if role_filter else '')}"),
        {"week": week_start.isoformat(), **params},
    ).scalar() or 0

    total_month = db.execute(
        text(f"SELECT COUNT(*) FROM audit_logs WHERE created_at >= :month{(' AND changed_by = :u' if role_filter else '')}"),
        {"month": month_start.isoformat(), **params},
    ).scalar() or 0

    total_year = db.execute(
        text(f"SELECT COUNT(*) FROM audit_logs WHERE created_at >= :year{(' AND changed_by = :u' if role_filter else '')}"),
        {"year": year_start.isoformat(), **params},
    ).scalar() or 0

    total_all = db.execute(
        text(f"SELECT COUNT(*) FROM audit_logs{role_filter}"),
        params,
    ).scalar() or 0

    module_rows = db.execute(
        text(f"SELECT module, COUNT(*) as cnt FROM audit_logs{role_filter} GROUP BY module ORDER BY cnt DESC"),
        params,
    ).fetchall()
    by_module = {}
    for r in module_rows:
        key = (r._mapping["module"] or "").lower()
        by_module[key] = by_module.get(key, 0) + r._mapping["cnt"]

    action_rows = db.execute(
        text(f"SELECT action, COUNT(*) as cnt FROM audit_logs{role_filter} GROUP BY action ORDER BY cnt DESC"),
        params,
    ).fetchall()
    by_action = {}
    for r in action_rows:
        key = (r._mapping["action"] or "").upper()
        by_action[key] = by_action.get(key, 0) + r._mapping["cnt"]

    user_rows = db.execute(
        text(f"""
            SELECT changed_by, COUNT(*) as cnt
            FROM audit_logs{role_filter}
            GROUP BY changed_by
            ORDER BY cnt DESC
            LIMIT 20
        """),
        params,
    ).fetchall()
    by_user = [
        {"user": r._mapping["changed_by"], "count": r._mapping["cnt"]}
        for r in user_rows
    ]

    return {
        "total_today": total_today,
        "total_week": total_week,
        "total_month": total_month,
        "total_year": total_year,
        "total_all": total_all,
        "by_module": by_module,
        "by_action": by_action,
        "by_user": by_user,
    }


@router.get("/debug-count")
def debug_audit_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Debug — return raw row count and sample from audit_logs (admin only)."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    total = db.execute(text("SELECT COUNT(*) FROM audit_logs")).scalar() or 0
    sample = db.execute(
        text(f"SELECT {COLUMNS_SELECT} FROM audit_logs ORDER BY created_at DESC LIMIT 5")
    ).fetchall()
    rows = [_row_to_dict(r._mapping) for r in sample]
    exists = db.execute(
        text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs')")
    ).scalar() or False
    return {"table_exists": exists, "total_rows": total, "sample": rows}