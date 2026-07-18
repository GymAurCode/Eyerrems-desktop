from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class SheetInfo(BaseModel):
    name: str
    label: str
    icon: str


class ColumnMeta(BaseModel):
    name: str
    label: str
    type: str
    nullable: bool
    primary_key: bool
    editable: bool = True
    visible: bool = True


class CellUpdate(BaseModel):
    row_id: int
    column: str
    value: Any = None


class RowInsert(BaseModel):
    data: dict[str, Any]


class BulkUpdate(BaseModel):
    row_ids: list[int]
    column: str
    value: Any = None


class SpreadsheetData(BaseModel):
    columns: list[ColumnMeta]
    rows: list[dict]
    total: int
    offset: int = 0
    limit: int = 100


class SaveResult(BaseModel):
    success: bool
    row_id: int
    updated_row: dict
    error: Optional[str] = None


class AuditLogEntry(BaseModel):
    id: int
    user_name: str
    sheet_name: str
    row_id: Optional[int] = None
    column_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    action: str
    created_at: datetime

    model_config = {"from_attributes": True}
