"""Audit log helpers — every entry is scoped to a company schema."""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.orm import Session

log = logging.getLogger("rems.audit")


def compute_diff(old: dict, new: dict) -> dict:
    """Returns only the fields that changed with from/to values."""
    diff = {}
    all_keys = set(list(old.keys()) + list(new.keys()))
    for key in all_keys:
        if key in ("id", "created_at", "updated_at"):
            continue
        old_val = old.get(key)
        new_val = new.get(key)
        if str(old_val) != str(new_val):
            diff[key] = {"from": old_val, "to": new_val}
    return diff


def log_action(
    db: Session,
    module: str,
    action: str,
    record_id: str,
    record_label: str,
    changed_by: str,
    changed_by_role: Optional[str] = None,
    old_data: Optional[dict] = None,
    new_data: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Insert a row into the company-scoped audit_logs table."""
    try:
        diff = {}
        if action == "UPDATE" and old_data and new_data:
            diff = compute_diff(old_data, new_data)

        # Serialize JSON-safe copies
        def _safe(d: Optional[dict]) -> Optional[str]:
            if d is None:
                return None
            clean = {}
            for k, v in d.items():
                if isinstance(v, (datetime,)):
                    clean[k] = v.isoformat()
                elif not isinstance(v, (str, int, float, bool, list, dict, type(None))):
                    try:
                        clean[k] = str(v)
                    except Exception:
                        clean[k] = repr(v)
                else:
                    clean[k] = v
            return json.dumps(clean, default=str)

        db.execute(
            text("""
                INSERT INTO audit_logs
                    (module, action, record_id, record_label, changed_by, changed_by_role,
                     old_data, new_data, diff, ip_address, created_at)
                VALUES
                    (:module, :action, :record_id, :record_label, :changed_by, :changed_by_role,
                     :old_data, :new_data, :diff, :ip_address, NOW())
            """),
            {
                "module": module,
                "action": action,
                "record_id": str(record_id),
                "record_label": record_label,
                "changed_by": changed_by,
                "changed_by_role": changed_by_role,
                "old_data": _safe(old_data),
                "new_data": _safe(new_data),
                "diff": json.dumps(diff, default=str) if diff else None,
                "ip_address": ip_address,
            },
        )
        db.commit()
        log.info("audit_logs: %s %s %s | %s", action, module, record_id, record_label)
    except Exception as e:
        log.error("audit_logs INSERT failed for %s %s %s: %s", action, module, record_id, e, exc_info=True)


# ── Backward-compatible wrappers (used by admin.py / tenants.py) ──────────────

def log_user_action(
    db: Session,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    description: str,
    *,
    module: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Log an admin action (approve/reject etc) — delegates to log_action."""
    ip = request.client.host if request and request.client else None
    log_action(
        db=db,
        module=module or entity_type or "user",
        action=action,
        record_id=str(entity_id) if entity_id else "",
        record_label=description or "",
        changed_by=f"user#{user_id}",
        old_data=None,
        new_data=details,
        ip_address=ip,
    )


def log_create(
    db: Session,
    user_id: int,
    entity_type: str,
    entity_id: Optional[int],
    description: str,
    *,
    company_id: Optional[int] = None,
    module: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Backward compat — delegates to log_action."""
    ip = request.client.host if request and request.client else None
    log_action(
        db=db,
        module=module or entity_type or "unknown",
        action="CREATE",
        record_id=str(entity_id) if entity_id else "",
        record_label=description or "",
        changed_by=f"user#{user_id}",
        old_data=None,
        new_data=details,
        ip_address=ip,
    )


def log_update(
    db: Session,
    user_id: int,
    entity_type: str,
    entity_id: Optional[int],
    description: str,
    *,
    company_id: Optional[int] = None,
    module: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Backward compat — delegates to log_action."""
    ip = request.client.host if request and request.client else None
    log_action(
        db=db,
        module=module or entity_type or "unknown",
        action="UPDATE",
        record_id=str(entity_id) if entity_id else "",
        record_label=description or "",
        changed_by=f"user#{user_id}",
        old_data=None,
        new_data=details,
        ip_address=ip,
    )


def log_delete(
    db: Session,
    user_id: int,
    entity_type: str,
    entity_id: Optional[int],
    description: str,
    *,
    company_id: Optional[int] = None,
    module: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Backward compat — delegates to log_action."""
    ip = request.client.host if request and request.client else None
    log_action(
        db=db,
        module=module or entity_type or "unknown",
        action="DELETE",
        record_id=str(entity_id) if entity_id else "",
        record_label=description or "",
        changed_by=f"user#{user_id}",
        old_data=details,
        new_data=None,
        ip_address=ip,
    )
