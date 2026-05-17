"""Audit log helpers — all entries are scoped to a company."""
import json
from typing import Any, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def write_audit_log(
    db: Session,
    *,
    action: str,
    user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    module: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    description: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    if request:
        if not ip_address:
            ip_address = request.client.host if request.client else None
        if not user_agent:
            user_agent = request.headers.get("user-agent")

    row = AuditLog(
        company_id=company_id,
        user_id=user_id,
        action=action,
        module=module,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        details=json.dumps(details) if details is not None else None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(row)
    db.flush()
    return row


# ── Convenience wrappers ──────────────────────────────────────────────────────

def log_user_action(
    db: Session,
    user_id: int,
    action: str,
    description: str,
    *,
    company_id: Optional[int] = None,
    module: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    return write_audit_log(
        db, action=action, user_id=user_id, company_id=company_id,
        module=module, entity_type=entity_type, entity_id=entity_id,
        description=description, details=details, request=request,
    )


def log_login(
    db: Session,
    user_id: int,
    email: str,
    success: bool = True,
    company_id: Optional[int] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    return write_audit_log(
        db,
        action="LOGIN" if success else "LOGIN_FAILED",
        user_id=user_id if success else None,
        company_id=company_id,
        module="Auth",
        description=f"User {email} {'logged in' if success else 'failed to login'}",
        details={"email": email, "success": success},
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
) -> AuditLog:
    return write_audit_log(
        db, action="CREATE", user_id=user_id, company_id=company_id,
        module=module, entity_type=entity_type, entity_id=entity_id,
        description=description, details=details, request=request,
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
) -> AuditLog:
    return write_audit_log(
        db, action="UPDATE", user_id=user_id, company_id=company_id,
        module=module, entity_type=entity_type, entity_id=entity_id,
        description=description, details=details, request=request,
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
) -> AuditLog:
    return write_audit_log(
        db, action="DELETE", user_id=user_id, company_id=company_id,
        module=module, entity_type=entity_type, entity_id=entity_id,
        description=description, details=details, request=request,
    )
