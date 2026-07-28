import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Request
from sqlalchemy import func, text
from sqlalchemy.orm import Session

log = logging.getLogger("rems.activity")

SENSITIVE_FIELDS = frozenset({
    "password", "hashed_password", "password_hash",
    "token", "access_token", "refresh_token",
    "secret", "api_key", "api_secret",
    "card_number", "cvv", "cvc", "pin",
    "bank_account", "iban", "routing_number",
})


def _now_expr(db: Session) -> str:
    """Return the appropriate SQL timestamp expression based on database dialect."""
    dialect = db.bind.dialect.name if db.bind and db.bind.dialect else "postgresql"
    if dialect == "sqlite":
        return "datetime('now')"
    return "NOW()"


def _safe_json(d: Optional[dict]) -> Optional[str]:
    if d is None:
        return None
    clean = {}
    for k, v in d.items():
        if isinstance(v, datetime):
            clean[k] = v.isoformat()
        elif not isinstance(v, (str, int, float, bool, list, dict, type(None))):
            try:
                clean[k] = str(v)
            except Exception:
                clean[k] = repr(v)
        else:
            clean[k] = v
    return json.dumps(clean, default=str)


def _mask_sensitive(data: dict) -> dict:
    masked = {}
    for k, v in data.items():
        if k.lower() in SENSITIVE_FIELDS or any(s in k.lower() for s in SENSITIVE_FIELDS):
            masked[k] = "••••••"
        else:
            masked[k] = v
    return masked


def compute_diff(old: dict, new: dict) -> list[dict]:
    diff = []
    all_keys = set(list(old.keys()) + list(new.keys()))
    skip_keys = {"id", "created_at", "updated_at", "deleted_at"}
    for key in sorted(all_keys):
        if key in skip_keys:
            continue
        old_val = old.get(key)
        new_val = new.get(key)
        if str(old_val) != str(new_val):
            field_lower = key.lower()
            if field_lower in SENSITIVE_FIELDS or any(s in field_lower for s in SENSITIVE_FIELDS):
                old_val = "••••••" if old_val is not None else None
                new_val = "••••••" if new_val is not None else None
            diff.append({
                "field": key,
                "old_value": old_val,
                "new_value": new_val,
            })
    return diff


def _extract_actor_info(actor) -> tuple:
    """Return (user_id, email, full_name, role, department) from a User model or dict."""
    if actor is None:
        return None, "system", None, None, None
    if isinstance(actor, dict):
        uid = str(actor.get("id") or "") or None
        email = actor.get("email") or actor.get("full_name") or actor.get("name") or "unknown"
        full_name = actor.get("full_name") or actor.get("name")
        role = actor.get("role") or actor.get("changed_by_role")
        department = actor.get("department")
        return uid, email, full_name, role, department
    uid = str(getattr(actor, "id", "") or "") or None
    email = getattr(actor, "email", None) or getattr(actor, "full_name", None) or "unknown"
    full_name = getattr(actor, "full_name", None) or getattr(actor, "name", None)
    role_obj = getattr(actor, "role", None)
    role = getattr(role_obj, "name", None) if role_obj else getattr(actor, "changed_by_role", None)
    department = None
    if hasattr(actor, "department"):
        dept = getattr(actor, "department", None)
        department = getattr(dept, "name", None) if dept else None
    return uid, email, full_name, role, department


def _extract_request_meta(request: Optional[Request]) -> dict:
    """Extract browser, OS, device, method, endpoint from request."""
    meta = {
        "ip_address": None,
        "browser": None,
        "os": None,
        "device": None,
        "request_method": None,
        "api_endpoint": None,
    }
    if request is None:
        return meta

    if request.client:
        meta["ip_address"] = request.client.host

    meta["request_method"] = request.method
    meta["api_endpoint"] = str(request.url.path)

    user_agent = request.headers.get("user-agent", "")
    if user_agent:
        ua = user_agent.lower()
        if "chrome" in ua and "edge" not in ua and "opr" not in ua:
            meta["browser"] = "Chrome"
        elif "firefox" in ua:
            meta["browser"] = "Firefox"
        elif "safari" in ua and "chrome" not in ua:
            meta["browser"] = "Safari"
        elif "edge" in ua:
            meta["browser"] = "Edge"
        elif "opr" in ua or "opera" in ua:
            meta["browser"] = "Opera"
        else:
            meta["browser"] = "Unknown"

        if "windows" in ua:
            meta["os"] = "Windows"
        elif "mac" in ua:
            meta["os"] = "macOS"
        elif "linux" in ua:
            meta["os"] = "Linux"
        elif "android" in ua:
            meta["os"] = "Android"
        elif "ios" in ua or "iphone" in ua or "ipad" in ua:
            meta["os"] = "iOS"
        else:
            meta["os"] = "Unknown"

        if "mobile" in ua:
            meta["device"] = "Mobile"
        elif "tablet" in ua or "ipad" in ua:
            meta["device"] = "Tablet"
        elif "bot" in ua:
            meta["device"] = "Bot"
        else:
            meta["device"] = "Desktop"

    return meta


class AuditLogService:
    """Single entry-point for recording audit events across all modules."""

    INSERT_COLS = """
        id, company_id, module, action, record_id, record_label,
        changed_by, changed_by_role,
        user_id, username, full_name, role, department,
        entity_type, entity_id, entity_name,
        old_data, new_data, diff,
        ip_address, browser, os, device,
        request_method, api_endpoint,
        status, created_at
    """

    INSERT_PARAMS = """
        :id, :company_id, :module, :action, :record_id, :record_label,
        :changed_by, :changed_by_role,
        :user_id, :username, :full_name, :role, :department,
        :entity_type, :entity_id, :entity_name,
        :old_data, :new_data, :diff,
        :ip_address, :browser, :os, :device,
        :request_method, :api_endpoint,
        :status, {ts}
    """

    @staticmethod
    def log(
        db: Session,
        actor,
        action: str,
        module: str,
        *,
        entity_type: Optional[str] = None,
        entity_id=None,
        entity_name: Optional[str] = None,
        old_data: Optional[dict] = None,
        new_data: Optional[dict] = None,
        ip_address: Optional[str] = None,
        request: Optional[Request] = None,
        status: str = "Success",
        company_id: Optional[int] = None,
    ) -> None:
        """Record one audit event. Never raises — logs failures."""
        log.info("AuditService: action=%s module=%s entity=%s/%s",
                 action, module, entity_type, entity_id)

        user_id, email, full_name, role, department = _extract_actor_info(actor)
        meta = _extract_request_meta(request)

        # Resolve company_id from actor if not provided
        if company_id is None and actor is not None and not isinstance(actor, dict):
            company_id = getattr(actor, "company_id", None)

        # Override ip if explicitly provided
        if ip_address:
            meta["ip_address"] = ip_address

        # Mask sensitive data
        safe_old = _mask_sensitive(old_data) if old_data else None
        safe_new = _mask_sensitive(new_data) if new_data else None

        # Compute diff for updates
        diff = None
        if action.lower() in ("update", "status_change") and safe_old is not None and safe_new is not None:
            diff = compute_diff(safe_old, safe_new)

        action_upper = action.upper().replace(" ", "_")
        entity_type_value = entity_type or module

        log_id = str(uuid.uuid4())
        try:
            with db.begin_nested():
                db.execute(
                    text(f"""
                        INSERT INTO audit_logs ({AuditLogService.INSERT_COLS})
                        VALUES ({AuditLogService.INSERT_PARAMS.format(ts=_now_expr(db))})
                    """),
                    {
                        "id": log_id,
                        "company_id": company_id,
                        "module": module,
                        "action": action_upper,
                        "record_id": str(entity_id) if entity_id is not None else None,
                        "record_label": entity_name or "",
                        "changed_by": email or "system",
                        "changed_by_role": role,
                        "user_id": user_id,
                        "username": email,
                        "full_name": full_name,
                        "role": role,
                        "department": department,
                        "entity_type": entity_type_value,
                        "entity_id": str(entity_id) if entity_id is not None else None,
                        "entity_name": entity_name,
                        "old_data": _safe_json(safe_old),
                        "new_data": _safe_json(safe_new),
                        "diff": json.dumps(diff, default=str) if diff else None,
                        "ip_address": meta["ip_address"],
                        "browser": meta["browser"],
                        "os": meta["os"],
                        "device": meta["device"],
                        "request_method": meta["request_method"],
                        "api_endpoint": meta["api_endpoint"],
                        "status": status,
                    },
                )
                db.flush()

            # Broadcast audit event via WebSocket
            if company_id:
                try:
                    import asyncio
                    from app.core.websocket_manager import ws_manager
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.ensure_future(ws_manager.broadcast_to_company(
                            company_id,
                            "audit_log.created",
                            {
                                "id": log_id,
                                "module": module,
                                "action": action_upper,
                                "user_id": user_id,
                                "full_name": full_name,
                                "entity_name": entity_name,
                                "entity_type": entity_type_value,
                                "created_at": datetime.utcnow().isoformat(),
                            },
                        ))
                except Exception as ws_err:
                    log.debug("Audit WS broadcast skipped: %s", ws_err)

            log.info("AuditService: INSERT OK — %s %s %s", action, module, entity_id)
        except Exception as e:
            log.error("AuditService: INSERT FAILED — %s %s %s: %s",
                      action, module, entity_id, e, exc_info=True)

    # ── Convenience shortcuts ──────────────────────────────────────────────

    @staticmethod
    def log_create(db, actor, module, entity_type=None, entity_id=None, entity_name=None,
                   *, new_data=None, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="CREATE", module=module,
            entity_type=entity_type, entity_id=entity_id, entity_name=entity_name,
            new_data=new_data, request=request,
        )

    @staticmethod
    def log_update(db, actor, module, entity_type=None, entity_id=None, entity_name=None,
                   *, old_data=None, new_data=None, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="UPDATE", module=module,
            entity_type=entity_type, entity_id=entity_id, entity_name=entity_name,
            old_data=old_data, new_data=new_data, request=request,
        )

    @staticmethod
    def log_delete(db, actor, module, entity_type=None, entity_id=None, entity_name=None,
                   *, old_data=None, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="DELETE", module=module,
            entity_type=entity_type, entity_id=entity_id, entity_name=entity_name,
            old_data=old_data, request=request,
        )

    @staticmethod
    def log_login(db, actor, *, success=True, request=None):
        status = "Success" if success else "Failed"
        return AuditLogService.log(
            db=db, actor=actor, action="LOGIN", module="auth",
            entity_type="auth",
            entity_name=f"Login {'successful' if success else 'failed'}",
            new_data={"success": success} if success else None,
            request=request, status=status,
        )

    @staticmethod
    def log_logout(db, actor, *, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="LOGOUT", module="auth",
            entity_type="auth",
            entity_name=f"Logout",
            request=request,
        )

    @staticmethod
    def log_report(db, actor, report_type, module="report", entity_type=None, entity_id=None,
                   *, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="GENERATE", module=module,
            entity_type=entity_type or "report",
            entity_name=f"Report: {report_type}",
            new_data={"report_type": report_type, "entity_type": entity_type, "entity_id": entity_id},
            request=request,
        )

    @staticmethod
    def log_export(db, actor, export_type, module, entity_type=None, entity_id=None,
                   *, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="EXPORT", module=module,
            entity_type=entity_type or module,
            entity_name=f"Export {export_type}",
            new_data={"export_type": export_type, "entity_type": entity_type, "entity_id": entity_id},
            request=request,
        )

    @staticmethod
    def log_download(db, actor, filename, module, entity_type=None, entity_id=None,
                     *, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="DOWNLOAD", module=module,
            entity_type=entity_type or module,
            entity_name=f"Download: {filename}",
            new_data={"filename": filename},
            request=request,
        )

    @staticmethod
    def log_print(db, actor, print_target, module, entity_type=None, entity_id=None,
                  *, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="PRINT", module=module,
            entity_type=entity_type or module,
            entity_name=f"Print: {print_target}",
            new_data={"target": print_target},
            request=request,
        )

    @staticmethod
    def log_status_change(db, actor, module, entity_type=None, entity_id=None, entity_name=None,
                          *, old_data=None, new_data=None, request=None):
        return AuditLogService.log(
            db=db, actor=actor, action="STATUS_CHANGE", module=module,
            entity_type=entity_type, entity_id=entity_id, entity_name=entity_name,
            old_data=old_data, new_data=new_data, request=request,
        )

    @staticmethod
    def log_bulk(db, actor, action, module, entity_type=None, entity_ids: list = None,
                 entity_name_prefix="", *, request=None):
        count = len(entity_ids) if entity_ids else 0
        return AuditLogService.log(
            db=db, actor=actor, action=f"BULK_{action}", module=module,
            entity_type=entity_type,
            entity_name=f"Bulk {action} {count} {entity_type}(s) — {entity_name_prefix}" if entity_name_prefix else f"Bulk {action} {count} {entity_type}(s)",
            new_data={"count": count, "ids": [str(i) for i in (entity_ids or [])]},
            request=request,
        )


# ── Backward-compatible alias ─────────────────────────────────────────────
ActivityService = AuditLogService