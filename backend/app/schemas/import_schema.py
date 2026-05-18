"""Pydantic schemas for bulk import API."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


DuplicateMode = Literal["skip", "update", "create_only"]
FileFormat = Literal["csv", "xlsx"]


class ImportModuleOut(BaseModel):
    key: str
    label: str
    description: str
    category: str
    permission: str | None = None
    columns: list[dict[str, Any]]


class ImportRowPreview(BaseModel):
    row_number: int
    data: dict[str, Any]
    status: Literal["valid", "invalid", "warning", "duplicate"]
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ImportValidateResponse(BaseModel):
    module_key: str
    file_name: str
    total_rows: int
    valid_count: int
    invalid_count: int
    warning_count: int
    duplicate_count: int
    rows: list[ImportRowPreview]
    batch_id: int | None = None


class ImportExecuteRequest(BaseModel):
    module_key: str
    duplicate_mode: DuplicateMode = "skip"
    row_numbers: list[int] | None = None  # None = all valid rows
    batch_id: int | None = None


class ImportExecuteResponse(BaseModel):
    batch_id: int
    status: str
    imported: int
    updated: int
    skipped: int
    failed: int
    message: str


class ImportBatchOut(BaseModel):
    id: int
    module_key: str
    file_name: str
    file_format: str
    duplicate_mode: str
    status: str
    total_rows: int
    valid_rows: int
    imported_rows: int
    skipped_rows: int
    failed_rows: int
    error_summary: str | None
    imported_by: int | None
    created_at: datetime
    completed_at: datetime | None

    class Config:
        from_attributes = True


class ImportRowLogOut(BaseModel):
    id: int
    row_number: int
    status: str
    message: str | None
    entity_type: str | None
    entity_id: int | None

    class Config:
        from_attributes = True
