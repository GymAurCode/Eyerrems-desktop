"""Bulk import API — templates, validate, execute, history."""
import csv
import io
import json
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.auth import User
from app.models.import_batch import ImportBatch, ImportRowLog
from app.schemas.import_schema import (
    ImportBatchOut,
    ImportExecuteRequest,
    ImportExecuteResponse,
    ImportModuleOut,
    ImportRowPreview,
    ImportValidateResponse,
)
from app.services.bulk_import.engine import create_batch, execute_import, validate_rows
from app.services.bulk_import.parser import parse_upload
from app.services.bulk_import.registry import import_registry
from app.services.bulk_import.template_service import build_template
from app.services.bulk_import.types import ImportContext

router = APIRouter()

# In-memory validation cache: batch_id -> (rows, module_key, duplicate_mode)
_validation_cache: dict[int, tuple[list[dict[str, str]], str, str]] = {}


def _company_id(user: User) -> int | None:
    return None if user.is_super_admin else user.company_id


def _user_can_import(user: User, permission: str | None) -> bool:
    if user.is_super_admin:
        return True
    if _is_admin(user):
        return True
    if not permission:
        return True
    perms = set()
    for role in user.roles or []:
        for p in role.permissions or []:
            perms.add(p.name)
    if user.role:
        for p in user.role.permissions or []:
            perms.add(p.name)
    for p in user.direct_permissions or []:
        perms.add(p.name)
    return permission in perms


def _is_admin(user: User) -> bool:
    for role in user.roles or []:
        if role.name.lower() == "admin":
            return True
    if user.role and user.role.name.lower() == "admin":
        return True
    return False


def _get_handler(module_key: str):
    handler = import_registry.get(module_key)
    if not handler:
        raise HTTPException(404, f"Unknown import module: {module_key}")
    return handler


@router.get("/modules", response_model=list[ImportModuleOut])
def list_modules(
    user: User = Depends(get_current_user),
    _: User = Depends(require_roles("Admin", "Manager", "Staff", "Accountant")),
):
    out = []
    for h in import_registry.list_modules():
        if _user_can_import(user, h.permission):
            out.append(ImportModuleOut(**import_registry.module_dict(h)))
    return out


@router.get("/templates/{module_key}")
def download_template(
    module_key: str,
    format: Literal["csv", "xlsx"] = "xlsx",
    user: User = Depends(get_current_user),
    _: User = Depends(require_roles("Admin", "Manager", "Staff", "Accountant")),
):
    handler = _get_handler(module_key)
    if not _user_can_import(user, handler.permission):
        raise HTTPException(403, "Insufficient permissions for this import module")
    content, media_type, filename = build_template(handler, format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/validate", response_model=ImportValidateResponse)
async def validate_import(
    module_key: str = Form(...),
    duplicate_mode: Literal["skip", "update", "create_only"] = Form("skip"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_roles("Admin", "Manager", "Staff", "Accountant")),
):
    handler = _get_handler(module_key)
    if not _user_can_import(user, handler.permission):
        raise HTTPException(403, "Insufficient permissions")

    content = await file.read()
    rows, fmt = parse_upload(content, file.filename or "upload.csv")

    ctx = ImportContext(
        db=db,
        user_id=user.id,
        company_id=_company_id(user),
        duplicate_mode=duplicate_mode,
    )
    previews = validate_rows(module_key, rows, ctx)

    valid_count = sum(1 for p in previews if p["status"] == "valid")
    invalid_count = sum(1 for p in previews if p["status"] == "invalid")
    warning_count = sum(1 for p in previews if p["status"] == "warning")
    duplicate_count = sum(1 for p in previews if p["status"] == "duplicate")

    batch = create_batch(
        db, module_key, file.filename or "upload", fmt, duplicate_mode,
        len(rows), valid_count, user.id, _company_id(user),
    )
    _validation_cache[batch.id] = (rows, module_key, duplicate_mode)

    return ImportValidateResponse(
        module_key=module_key,
        file_name=file.filename or "upload",
        total_rows=len(rows),
        valid_count=valid_count,
        invalid_count=invalid_count,
        warning_count=warning_count,
        duplicate_count=duplicate_count,
        rows=[ImportRowPreview(**p) for p in previews],
        batch_id=batch.id,
    )


@router.post("/execute", response_model=ImportExecuteResponse)
def run_import(
    payload: ImportExecuteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_roles("Admin", "Manager")),
):
    handler = _get_handler(payload.module_key)
    if not _user_can_import(user, handler.permission):
        raise HTTPException(403, "Insufficient permissions")

    cached = _validation_cache.get(payload.batch_id) if payload.batch_id else None
    if not cached:
        raise HTTPException(400, "Validation session expired — please re-upload and validate")

    rows, module_key, duplicate_mode = cached
    if module_key != payload.module_key:
        raise HTTPException(400, "Module mismatch")

    batch = db.query(ImportBatch).filter(ImportBatch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(404, "Import batch not found")

    mode = payload.duplicate_mode or duplicate_mode
    ctx = ImportContext(db=db, user_id=user.id, company_id=_company_id(user), duplicate_mode=mode)

    row_numbers = payload.row_numbers
    if row_numbers is None:
        previews = validate_rows(module_key, rows, ctx)
        row_numbers = [p["row_number"] for p in previews if p["status"] == "valid"]

    counts = execute_import(db, module_key, rows, row_numbers, ctx, batch)

    batch.status = "completed" if counts["failed"] == 0 else "partial"
    batch.imported_rows = counts["imported"] + counts["updated"]
    batch.skipped_rows = counts["skipped"]
    batch.failed_rows = counts["failed"]
    from datetime import datetime
    batch.completed_at = datetime.utcnow()
    db.commit()

    if payload.batch_id in _validation_cache:
        del _validation_cache[payload.batch_id]

    return ImportExecuteResponse(
        batch_id=batch.id,
        status=batch.status,
        imported=counts["imported"],
        updated=counts["updated"],
        skipped=counts["skipped"],
        failed=counts["failed"],
        message=f"Import finished: {counts['imported']} created, {counts['updated']} updated.",
    )


@router.get("/history", response_model=list[ImportBatchOut])
def import_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_roles("Admin", "Manager")),
):
    q = db.query(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(limit)
    cid = _company_id(user)
    if cid is not None:
        q = q.filter(ImportBatch.company_id == cid)
    return q.all()


@router.get("/history/{batch_id}/errors")
def download_errors(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_roles("Admin", "Manager")),
):
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(404, "Batch not found")

    logs = (
        db.query(ImportRowLog)
        .filter(ImportRowLog.batch_id == batch_id, ImportRowLog.status.in_(["failed", "invalid"]))
        .order_by(ImportRowLog.row_number)
        .all()
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["row_number", "status", "error", "row_data"])
    for log in logs:
        writer.writerow([log.row_number, log.status, log.message or "", log.row_data_json or ""])

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="import_errors_{batch_id}.csv"'},
    )
