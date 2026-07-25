"""Audit log helpers — backward-compatible wrappers around AuditLogService."""
import logging
from typing import Any, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.services.activity_service import AuditLogService

log = logging.getLogger("rems.audit")


def compute_diff(old: dict, new: dict) -> dict:
    """Legacy ``{field: {from: …, to: …}}`` format — delegates to new compute_diff."""
    from app.services.activity_service import compute_diff as _new_diff
    result = {}
    for entry in _new_diff(old, new):
        result[entry["field"]] = {"from": entry["old_value"], "to": entry["new_value"]}
    return result


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
    request: Optional[Request] = None,
) -> None:
    """Legacy wrapper — delegates to AuditLogService."""
    actor = {"email": changed_by, "role": changed_by_role}
    AuditLogService.log(
        db=db, actor=actor, action=action, module=module,
        entity_id=record_id, entity_name=record_label,
        old_data=old_data, new_data=new_data,
        ip_address=ip_address, request=request,
    )


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
    """Backward compat — delegates to log_action."""
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
        request=request,
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
        request=request,
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
        request=request,
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
        request=request,
    )