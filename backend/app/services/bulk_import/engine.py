"""Bulk import validation and execution engine."""
import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.import_batch import ImportBatch, ImportRowLog
from app.services.bulk_import.registry import import_registry
from app.services.bulk_import.types import ImportContext, RowValidationResult


BATCH_SIZE = 200


def validate_rows(
    module_key: str,
    raw_rows: list[dict[str, str]],
    ctx: ImportContext,
) -> list[dict[str, Any]]:
    handler = import_registry.get(module_key)
    if not handler:
        raise ValueError(f"Unknown import module: {module_key}")

    ctx.file_keys_seen = {}
    previews = []
    for i, row in enumerate(raw_rows, start=2):  # row 1 = header in spreadsheet
        result: RowValidationResult = handler.validate_row(row, ctx, i)

        # DB duplicate detection
        if result.status == "valid" and handler.duplicate_key:
            dkey = handler.duplicate_key(row)
            if dkey and ctx.duplicate_mode == "skip":
                pass  # import phase handles skip

        previews.append({
            "row_number": i,
            "data": dict(row),
            "status": result.status,
            "errors": result.errors,
            "warnings": result.warnings,
        })
    return previews


def execute_import(
    db: Session,
    module_key: str,
    raw_rows: list[dict[str, str]],
    row_numbers: list[int] | None,
    ctx: ImportContext,
    batch: ImportBatch,
) -> dict[str, int]:
    handler = import_registry.get(module_key)
    if not handler:
        raise ValueError(f"Unknown import module: {module_key}")

    valid_set = set(row_numbers) if row_numbers else None
    imported = updated = skipped = failed = 0

    for i, row in enumerate(raw_rows, start=2):
        if valid_set is not None and i not in valid_set:
            continue

        preview_status = None
        vr = handler.validate_row(row, ctx, i)
        if vr.status == "invalid":
            _log_row(db, batch.id, i, "failed", "; ".join(vr.errors), row)
            failed += 1
            continue

        nested = db.begin_nested()
        try:
            result = handler.import_row(row, ctx)
            if result.action == "created":
                imported += 1
                log_status = "imported"
            elif result.action == "updated":
                updated += 1
                log_status = "updated"
            elif result.action == "skipped":
                skipped += 1
                log_status = "skipped"
            else:
                failed += 1
                log_status = "failed"
            nested.commit()
            _log_row(db, batch.id, i, log_status, result.message, row, result.entity_type, result.entity_id)
            if (imported + updated + skipped + failed) % BATCH_SIZE == 0:
                db.commit()
        except Exception as exc:
            nested.rollback()
            failed += 1
            _log_row(db, batch.id, i, "failed", str(exc), row)

    db.commit()
    return {"imported": imported, "updated": updated, "skipped": skipped, "failed": failed}


def _log_row(
    db: Session,
    batch_id: int,
    row_number: int,
    status: str,
    message: str,
    row: dict,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> None:
    db.add(ImportRowLog(
        batch_id=batch_id,
        row_number=row_number,
        status=status,
        message=message,
        row_data_json=json.dumps(row, default=str),
        entity_type=entity_type,
        entity_id=entity_id,
    ))


def create_batch(
    db: Session,
    module_key: str,
    file_name: str,
    file_format: str,
    duplicate_mode: str,
    total_rows: int,
    valid_rows: int,
    user_id: int | None,
    company_id: int | None,
) -> ImportBatch:
    batch = ImportBatch(
        module_key=module_key,
        file_name=file_name,
        file_format=file_format,
        duplicate_mode=duplicate_mode,
        status="validated",
        total_rows=total_rows,
        valid_rows=valid_rows,
        company_id=company_id,
        imported_by=user_id,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch
