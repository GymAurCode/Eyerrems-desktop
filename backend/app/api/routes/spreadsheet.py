from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.auth import User
from app.schemas.spreadsheet import BulkUpdate, CellUpdate, RowInsert
from app.services.spreadsheet_service import (
    _safe_col,
    _safe_table,
    bulk_update_cells,
    delete_row,
    duplicate_row,
    get_audit_logs,
    get_rows,
    get_sheet_config,
    get_table_columns,
    insert_row,
    list_sheets,
    update_cell,
)

router = APIRouter(prefix="/spreadsheet", tags=["spreadsheet"])


@router.get("/sheets")
def api_list_sheets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_sheets(db)


@router.get("/sheets/{sheet_name}/columns")
def api_get_columns(
    sheet_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = get_sheet_config(sheet_name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_name}' not found")
    exclude = config.get("exclude_columns", [])
    return get_table_columns(db, config["table"], exclude)


@router.get("/sheets/{sheet_name}/rows")
def api_get_rows(
    sheet_name: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = get_sheet_config(sheet_name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_name}' not found")
    exclude = config.get("exclude_columns", [])
    return get_rows(
        db, config["table"], offset, limit, search, sort_by, sort_dir, exclude,
    )


@router.put("/sheets/{sheet_name}/cells/{row_id}")
def api_update_cell(
    sheet_name: str,
    row_id: int,
    body: CellUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = get_sheet_config(sheet_name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_name}' not found")
    try:
        result = update_cell(
            db, config["table"], row_id, body.column, body.value, current_user.full_name or current_user.email,
        )
        return {"success": True, "row_id": row_id, "updated_row": result, "error": None}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sheets/{sheet_name}/rows")
def api_insert_row(
    sheet_name: str,
    body: RowInsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = get_sheet_config(sheet_name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_name}' not found")
    exclude = config.get("exclude_columns", [])
    try:
        result = insert_row(db, config["table"], body.data, exclude, current_user.full_name or current_user.email)
        return {"success": True, "row_id": result.get("id"), "updated_row": result, "error": None}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/sheets/{sheet_name}/rows/{row_id}", status_code=204)
def api_delete_row(
    sheet_name: str,
    row_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = get_sheet_config(sheet_name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_name}' not found")
    try:
        delete_row(db, config["table"], row_id, current_user.full_name or current_user.email)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sheets/{sheet_name}/rows/{row_id}/duplicate")
def api_duplicate_row(
    sheet_name: str,
    row_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = get_sheet_config(sheet_name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_name}' not found")
    try:
        result = duplicate_row(db, config["table"], row_id, current_user.full_name or current_user.email)
        return {"success": True, "row_id": result.get("id"), "updated_row": result, "error": None}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/sheets/{sheet_name}/bulk")
def api_bulk_update(
    sheet_name: str,
    body: BulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = get_sheet_config(sheet_name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_name}' not found")
    try:
        results = bulk_update_cells(
            db, config["table"], body.row_ids, body.column, body.value,
            current_user.full_name or current_user.email,
        )
        return {"success": True, "count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audit")
def api_get_audit_logs(
    sheet_name: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_audit_logs(db, sheet_name, limit, offset)
