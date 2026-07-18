"""Audit Log API — company-scoped activity history."""
import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.auth import User

router = APIRouter()

MODULE_FILTERS = [
    "property", "tenant", "crm", "hr", "maintenance",
    "finance", "invoice", "user", "settings", "construction",
]


@router.get("/logs")
def list_audit_logs(
    module: str = Query(None, description="Filter by module name"),
    action: str = Query(None, pattern="^(CREATE|UPDATE|DELETE)?$"),
    changed_by: str = Query(None, description="Filter by user email/name"),
    date_from: str = Query(None, description="ISO date string"),
    date_to: str = Query(None, description="ISO date string"),
    period: str = Query(None, pattern="^(today|week|month|year)?$"),
    record_id: str = Query(None, description="Filter by record UUID"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get paginated audit logs with filters."""
    conditions = ["1=1"]
    params: dict = {}

    if module:
        conditions.append("module = :module")
        params["module"] = module
    if action:
        conditions.append("action = :action")
        params["action"] = action
    if changed_by:
        conditions.append("changed_by ILIKE :changed_by")
        params["changed_by"] = f"%{changed_by}%"
    if record_id:
        conditions.append("record_id = :record_id")
        params["record_id"] = record_id

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

    where = " AND ".join(conditions)

    # Count
    count_sql = f"SELECT COUNT(*) FROM audit_logs WHERE {where}"
    total = db.execute(text(count_sql), params).scalar() or 0

    # Fetch
    offset = (page - 1) * per_page
    fetch_sql = f"""
        SELECT id, module, action, record_id, record_label,
               changed_by, changed_by_role,
               old_data, new_data, diff, ip_address, created_at
        FROM audit_logs
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """
    params["limit"] = per_page
    params["offset"] = offset
    rows = db.execute(text(fetch_sql), params).fetchall()

    logs = []
    for row in rows:
        r = row._mapping
        logs.append({
            "id": str(r["id"]),
            "module": r["module"],
            "action": r["action"],
            "record_id": r["record_id"],
            "record_label": r["record_label"],
            "changed_by": r["changed_by"],
            "changed_by_role": r["changed_by_role"],
            "old_data": json.loads(r["old_data"]) if r["old_data"] else None,
            "new_data": json.loads(r["new_data"]) if r["new_data"] else None,
            "diff": json.loads(r["diff"]) if r["diff"] else None,
            "ip_address": r["ip_address"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        })

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
    """Return all audit logs for a specific record."""
    rows = db.execute(
        text("""
            SELECT id, module, action, record_id, record_label,
                   changed_by, changed_by_role,
                   old_data, new_data, diff, ip_address, created_at
            FROM audit_logs
            WHERE record_id = :record_id
            ORDER BY created_at DESC
        """),
        {"record_id": record_id},
    ).fetchall()

    logs = []
    for row in rows:
        r = row._mapping
        logs.append({
            "id": str(r["id"]),
            "module": r["module"],
            "action": r["action"],
            "record_id": r["record_id"],
            "record_label": r["record_label"],
            "changed_by": r["changed_by"],
            "changed_by_role": r["changed_by_role"],
            "old_data": json.loads(r["old_data"]) if r["old_data"] else None,
            "new_data": json.loads(r["new_data"]) if r["new_data"] else None,
            "diff": json.loads(r["diff"]) if r["diff"] else None,
            "ip_address": r["ip_address"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        })

    return logs


@router.get("/stats")
def audit_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return summary counts for the audit dashboard."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    def _count_since(dt):
        return db.execute(
            text("SELECT COUNT(*) FROM audit_logs WHERE created_at >= :dt"),
            {"dt": dt.isoformat()},
        ).scalar() or 0

    total_today = _count_since(today_start)
    total_week = _count_since(week_start)
    total_month = _count_since(month_start)
    total_year = _count_since(year_start)
    total_all = db.execute(text("SELECT COUNT(*) FROM audit_logs")).scalar() or 0

    # By module
    module_rows = db.execute(
        text("SELECT module, COUNT(*) as cnt FROM audit_logs GROUP BY module ORDER BY cnt DESC")
    ).fetchall()
    by_module = {r._mapping["module"]: r._mapping["cnt"] for r in module_rows}

    # By action
    action_rows = db.execute(
        text("SELECT action, COUNT(*) as cnt FROM audit_logs GROUP BY action ORDER BY cnt DESC")
    ).fetchall()
    by_action = {r._mapping["action"]: r._mapping["cnt"] for r in action_rows}

    # By user (top 20)
    user_rows = db.execute(
        text("""
            SELECT changed_by, COUNT(*) as cnt
            FROM audit_logs
            GROUP BY changed_by
            ORDER BY cnt DESC
            LIMIT 20
        """)
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
    """Debug — return raw row count and sample from audit_logs."""
    total = db.execute(text("SELECT COUNT(*) FROM audit_logs")).scalar() or 0
    sample = db.execute(
        text("SELECT id, module, action, record_id, record_label, changed_by, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5")
    ).fetchall()
    rows = [
        {"id": str(r[0]), "module": r[1], "action": r[2], "record_id": r[3],
         "record_label": r[4], "changed_by": r[5], "created_at": str(r[6]) if r[6] else None}
        for r in sample
    ]
    exists = db.execute(
        text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs')")
    ).scalar() or False
    return {"table_exists": exists, "total_rows": total, "sample": rows}
