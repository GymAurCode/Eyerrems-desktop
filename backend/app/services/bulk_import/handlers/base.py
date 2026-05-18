"""Base helpers for import handlers."""
from typing import Any

from app.services.bulk_import.types import ImportContext, RowValidationResult, RowImportResult
from app.services.bulk_import import validator as v


def merge_errors(*parts: str | None) -> list[str]:
    return [p for p in parts if p]


def base_validate(
    row: dict[str, Any],
    ctx: ImportContext,
    row_number: int,
    columns_required: list[tuple[str, str]],
    dup_key: str | None = None,
    extra_checks: list[str | None] | None = None,
) -> RowValidationResult:
    errors = []
    for field, label in columns_required:
        err = v.req(row, field, label)
        if err:
            errors.append(err)
    if extra_checks:
        errors.extend([e for e in extra_checks if e])
    dup_err = v.check_in_file_duplicate(ctx, dup_key, row_number) if dup_key else None
    if dup_err:
        errors.append(dup_err)
    normalized = {k: (v.opt_str(row, k) or "") for k in row}
    for k in row:
        if k not in normalized:
            normalized[k] = v.opt_str(row, k) or ""
    if errors:
        return RowValidationResult(status="invalid", errors=errors, normalized=normalized)
    if dup_key and dup_err is None:
        pass
    return RowValidationResult(status="valid", normalized=normalized)
