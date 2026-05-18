"""Shared types for the bulk import engine."""
from dataclasses import dataclass, field
from typing import Any, Callable

from sqlalchemy.orm import Session


@dataclass
class ColumnDef:
    key: str
    label: str
    required: bool = False
    sample: str = ""
    hint: str = ""
    enum_values: list[str] | None = None


@dataclass
class ImportContext:
    db: Session
    user_id: int | None
    company_id: int | None
    duplicate_mode: str  # skip | update | create_only
    file_keys_seen: dict[str, int] = field(default_factory=dict)


@dataclass
class RowValidationResult:
    status: str  # valid | invalid | warning | duplicate
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    normalized: dict[str, Any] = field(default_factory=dict)


@dataclass
class RowImportResult:
    success: bool
    action: str  # created | updated | skipped | failed
    message: str = ""
    entity_type: str | None = None
    entity_id: int | None = None


HandlerValidateFn = Callable[[dict[str, Any], ImportContext], RowValidationResult]
HandlerImportFn = Callable[[dict[str, Any], ImportContext], RowImportResult]


@dataclass
class ImportModuleHandler:
    key: str
    label: str
    description: str
    category: str
    permission: str | None
    columns: list[ColumnDef]
    validate_row: HandlerValidateFn
    import_row: HandlerImportFn
    duplicate_key: Callable[[dict[str, Any]], str | None] | None = None
