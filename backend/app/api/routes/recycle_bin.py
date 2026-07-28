"""Recycle Bin API — unified restore, permanent delete, and statistics."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.rbac import require_permission
from app.models.auth import User
from app.models.rbac import Role
from app.services.soft_delete_service import (
    MODULE_REGISTRY,
    RecycleBinService,
    RestoreService,
)

log = logging.getLogger("rems.recycle_bin")

router = APIRouter(prefix="/recycle-bin", tags=["recycle-bin"])


def _get_model(module_key: str):
    reg = MODULE_REGISTRY.get(module_key)
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown module: {module_key}",
        )
    return reg["model_class"]


@router.get("")
def list_recycle_bin(
    module: Optional[str] = Query(None, alias="module"),
    search: Optional[str] = Query(None),
    deleted_by: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    restore_status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("recycle_bin", "general", "view")),
):
    records = RecycleBinService.get_deleted_records(
        db=db,
        module_filter=module,
        search=search,
        deleted_by=deleted_by,
        date_from=date_from,
        date_to=date_to,
        restore_status=restore_status,
        limit=limit,
        offset=offset,
    )
    return {"records": records, "total": len(records)}


@router.get("/statistics")
def recycle_bin_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("recycle_bin", "general", "view")),
):
    stats = RecycleBinService.get_statistics(db)
    return stats


@router.get("/modules")
def list_modules(
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("recycle_bin", "general", "view")),
):
    modules = [
        {"key": k, "label": v["module_label"]}
        for k, v in MODULE_REGISTRY.items()
    ]
    modules.sort(key=lambda m: m["label"])
    return {"modules": modules}


@router.get("/detail/{module_key}/{record_id}")
def recycle_bin_detail(
    module_key: str,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("recycle_bin", "general", "view")),
):
    model_class = _get_model(module_key)
    instance = db.query(model_class).filter(
        model_class.id == record_id,
        model_class.is_deleted == True,  # noqa: E712
    ).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Deleted record not found")

    reg = MODULE_REGISTRY.get(module_key, {})
    name_field = reg.get("name_field", "name")
    display_id_field = reg.get("display_id_field") or reg.get("business_number_field")
    status_field = reg.get("status_field")

    deleted_by_user = None
    restored_by_user = None
    uid = getattr(instance, "deleted_by", None)
    if uid:
        u = db.query(User).filter(User.id == uid).first()
        if u:
            role_name = ""
            if u.role_id:
                r = db.query(Role).filter(Role.id == u.role_id).first()
                if r:
                    role_name = r.name
            deleted_by_user = {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role_name": role_name,
                "avatar": getattr(u, "avatar", None) or "",
            }
    rid = getattr(instance, "restored_by", None)
    if rid:
        u = db.query(User).filter(User.id == rid).first()
        if u:
            role_name = ""
            if u.role_id:
                r = db.query(Role).filter(Role.id == u.role_id).first()
                if r:
                    role_name = r.name
            restored_by_user = {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role_name": role_name,
                "avatar": getattr(u, "avatar", None) or "",
            }

    from sqlalchemy import text as sa_text
    rid_str = str(record_id)
    raw_rows = db.execute(
        sa_text("""
            SELECT id, action, module,
                   COALESCE(entity_type, module) AS entity_type,
                   COALESCE(entity_id, record_id) AS entity_id,
                   entity_name,
                   full_name, changed_by, old_data, new_data,
                   ip_address, browser, created_at
            FROM audit_logs
            WHERE (
                (entity_type IS NOT NULL AND entity_type = :et1 AND entity_id = :eid1)
                OR
                (entity_type IS NULL AND module = :et2 AND record_id = :eid2)
            )
            ORDER BY created_at ASC
            LIMIT 50
        """),
        {"et1": module_key, "eid1": rid_str, "et2": module_key, "eid2": rid_str},
    ).fetchall()

    return {
        "module": module_key,
        "module_label": reg.get("module_label", module_key),
        "record_id": getattr(instance, "id", None),
        "original_id": str(getattr(instance, display_id_field, "")) if display_id_field else str(getattr(instance, "id", "")),
        "record_name": str(getattr(instance, name_field, "")),
        "status": str(getattr(instance, status_field, "")) if status_field else "",
        "original_business_number": getattr(instance, "original_business_number", None),
        "current_business_number": str(getattr(instance, reg.get("business_number_field", ""), "")) if reg.get("business_number_field") else str(getattr(instance, display_id_field, "")),
        "deleted_by": uid,
        "deleted_by_user": deleted_by_user,
        "deleted_at": getattr(instance, "deleted_at", None),
        "restored_by_user": restored_by_user,
        "restored_at": getattr(instance, "restored_at", None),
        "restore_count": getattr(instance, "restore_count", 0),
        "created_at": getattr(instance, "created_at", None),
        "updated_at": getattr(instance, "updated_at", None),
        "company_id": getattr(instance, "company_id", None),
        "audit_logs": [
            {
                "id": str(r[0]),
                "action": r[1],
                "module": r[2],
                "entity_type": r[3],
                "entity_id": r[4],
                "entity_name": r[5],
                "actor_name": r[6] or r[7],
                "actor_email": r[7],
                "old_values": r[8],
                "new_values": r[9],
                "ip_address": r[10],
                "user_agent": r[11],
                "created_at": r[12].isoformat() if r[12] else None,
            }
            for r in raw_rows
        ],
    }


@router.post("/restore/{module_key}/{record_id}")
def restore_record(
    module_key: str,
    record_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("recycle_bin", "general", "edit")),
):
    model_class = _get_model(module_key)
    instance = db.query(model_class).filter(
        model_class.id == record_id,
        model_class.is_deleted == True,  # noqa: E712
    ).first()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted record not found",
        )

    result = RestoreService.restore(db, instance, current_user, module_key, request=request)
    db.commit()

    return result


@router.delete("/{module_key}/{record_id}")
def permanent_delete(
    module_key: str,
    record_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("recycle_bin", "general", "delete")),
):
    model_class = _get_model(module_key)
    instance = db.query(model_class).filter(
        model_class.id == record_id,
        model_class.is_deleted == True,  # noqa: E712
    ).first()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted record not found",
        )

    reg = MODULE_REGISTRY.get(module_key, {})
    name_field = reg.get("name_field", "name")
    record_name = str(getattr(instance, name_field, ""))

    from app.services.activity_service import AuditLogService
    AuditLogService.log(
        db=db,
        actor=current_user,
        action="PERMANENT_DELETE",
        module=module_key,
        entity_type=module_key,
        entity_id=record_id,
        entity_name=record_name,
        request=request,
    )

    db.delete(instance)
    db.commit()

    log.info(
        "Permanently deleted %s id=%s name=%s by user=%s",
        module_key, record_id, record_name, current_user.id,
    )

    return {"success": True, "message": f"Record permanently deleted from {module_key}"}