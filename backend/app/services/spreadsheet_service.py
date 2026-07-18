import re
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.models.spreadsheet_audit import SpreadsheetAuditLog

COLUMN_LABELS: dict[str, dict[str, str]] = {
    "products": {
        "name": "Product Name",
        "sku": "SKU / Ref No",
        "barcode_number": "Barcode",
        "category": "Category",
        "cost_price": "Cost Price",
        "selling_price": "Selling Price",
        "stock": "Stock Qty",
        "low_stock_threshold": "Low Stock Threshold",
        "description": "Description",
        "created_at": "Created At",
        "updated_at": "Updated At",
    },
    "suppliers": {
        "name": "Supplier Name",
        "phone": "Phone",
        "address": "Address",
        "email": "Email",
        "opening_balance": "Opening Balance",
    },
    "customers": {
        "name": "Customer Name",
        "phone": "Phone",
        "email": "Email",
        "address": "Address",
    },
    "sales": {
        "invoice_number": "Invoice No",
        "customer": "Customer",
        "product_sku": "Product SKU",
        "quantity": "Quantity",
        "unit_price": "Unit Price",
        "total": "Total",
        "date": "Date",
    },
    "purchases": {
        "invoice_number": "Invoice No",
        "supplier": "Supplier",
        "product_sku": "Product SKU",
        "quantity": "Quantity",
        "purchase_price": "Purchase Price",
        "date": "Date",
    },
    "expenses": {
        "description": "Description",
        "amount": "Amount",
        "category": "Category",
        "date": "Date",
        "vendor_name": "Vendor",
        "payment_method": "Payment Method",
    },
    "invoices": {
        "invoice_number": "Invoice No",
        "client_name": "Client",
        "amount": "Amount",
        "status": "Status",
        "due_date": "Due Date",
        "issued_date": "Issued Date",
    },
    "payments": {
        "amount": "Amount",
        "payment_type": "Payment Type",
        "payment_method": "Method",
        "received_from": "Received From",
        "date": "Date",
        "reference": "Reference",
    },
    "shops": {
        "name": "Shop Name",
        "location": "Location",
        "phone": "Phone",
        "email": "Email",
    },
    "devices": {
        "name": "Device Name",
        "type": "Type",
        "serial_number": "Serial No",
        "status": "Status",
        "shop_id": "Shop",
    },
    "employees": {
        "full_name": "Full Name",
        "email": "Email",
        "phone": "Phone",
        "position": "Position",
        "department": "Department",
        "salary": "Salary",
    },
    "accounts": {
        "name": "Account Name",
        "code": "Account Code",
        "type": "Type",
        "balance": "Balance",
    },
    "reminders": {
        "title": "Title",
        "message": "Message",
        "due_date": "Due Date",
        "status": "Status",
        "priority": "Priority",
    },
    "users": {
        "email": "Email",
        "full_name": "Full Name",
        "role": "Role",
        "status": "Status",
        "is_active": "Active",
    },
}

SHEET_DEFS: list[dict] = [
    {"name": "products", "label": "Products", "icon": "ti-package", "table": "products"},
    {"name": "suppliers", "label": "Suppliers", "icon": "ti-truck", "table": "suppliers"},
    {"name": "customers", "label": "Customers", "icon": "ti-users", "table": "customers"},
    {"name": "sales", "label": "Sales", "icon": "ti-shopping-cart", "table": "sales"},
    {"name": "purchases", "label": "Purchases", "icon": "ti-archive", "table": "purchases"},
    {"name": "expenses", "label": "Expenses", "icon": "ti-currency-dollar", "table": "expenses"},
    {"name": "invoices", "label": "Invoices", "icon": "ti-file-text", "table": "invoices"},
    {"name": "payments", "label": "Payments", "icon": "ti-cash", "table": "payments"},
    {"name": "shops", "label": "Shops", "icon": "ti-store", "table": "shops"},
    {"name": "devices", "label": "Devices", "icon": "ti-device-desktop", "table": "devices"},
    {"name": "employees", "label": "Employees", "icon": "ti-briefcase", "table": "employees"},
    {"name": "accounts", "label": "Accounts", "icon": "ti-book", "table": "accounts"},
    {"name": "reminders", "label": "Reminders", "icon": "ti-bell", "table": "reminders"},
    {
        "name": "users",
        "label": "Users",
        "icon": "ti-user-cog",
        "table": "users",
        "exclude_columns": ["hashed_password"],
    },
]

NON_EDITABLE_TABLES = {"spreadsheet_audit_logs", "alembic_version"}

IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _safe_table(name: str) -> str:
    if not IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid table name: {name}")
    return f'"{name}"'


def _safe_col(name: str) -> str:
    if not IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid column name: {name}")
    return f'"{name}"'


def list_sheets(db: Session) -> list[dict]:
    inspector = inspect(db.bind)
    existing_tables = set(inspector.get_table_names())
    result = []
    for s in SHEET_DEFS:
        if s["table"] in existing_tables and s["table"] not in NON_EDITABLE_TABLES:
            result.append({"name": s["name"], "label": s["label"], "icon": s["icon"]})
    return result


def get_sheet_config(sheet_name: str) -> Optional[dict]:
    for s in SHEET_DEFS:
        if s["name"] == sheet_name:
            return s
    return None


def get_table_columns(
    db: Session, table_name: str, exclude: Optional[list[str]] = None
) -> list[dict]:
    if exclude is None:
        exclude = []
    inspector = inspect(db.bind)
    columns = inspector.get_columns(table_name)
    result = []
    for col in columns:
        if col["name"] in exclude:
            continue
        col_type = str(col.get("type", ""))
        result.append(
            {
                "name": col["name"],
                "label": COLUMN_LABELS.get(table_name, {}).get(
                    col["name"], col["name"].replace("_", " ").title()
                ),
                "type": col_type,
                "nullable": col.get("nullable", True),
                "primary_key": col.get("primary_key", False),
                "editable": col["name"] not in ("id", "created_at", "updated_at"),
                "visible": True,
            }
        )
    return result


def _serialize_value(val: Any) -> Any:
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    if hasattr(val, "isoformat"):
        try:
            return val.isoformat()
        except Exception:
            return str(val)
    return val


def get_rows(
    db: Session,
    table_name: str,
    offset: int = 0,
    limit: int = 200,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "desc",
    exclude_columns: Optional[list[str]] = None,
) -> dict:
    if exclude_columns is None:
        exclude_columns = []
    safe_table = _safe_table(table_name)

    inspector = inspect(db.bind)
    all_columns = inspector.get_columns(table_name)
    col_names = [c["name"] for c in all_columns if c["name"] not in exclude_columns]
    safe_col_names = [_safe_col(c) for c in col_names]

    query = f"SELECT {', '.join(safe_col_names)} FROM {safe_table}"
    count_query = f"SELECT COUNT(*) FROM {safe_table}"
    params: dict[str, Any] = {}

    where_clauses = []
    if search:
        text_cols = [
            _safe_col(c["name"])
            for c in all_columns
            if "CHAR" in str(c.get("type", "")).upper() or "TEXT" in str(c.get("type", "")).upper() or "VARCHAR" in str(c.get("type", "")).upper()
        ]
        if text_cols:
            like_clauses = [f"{c} LIKE :search" for c in text_cols]
            where_clauses.append(f"({' OR '.join(like_clauses)})")
            params["search"] = f"%{search}%"

    if where_clauses:
        where_sql = " WHERE " + " AND ".join(where_clauses)
        query += where_sql
        count_query += where_sql

    if sort_by and sort_by in col_names:
        safe_sort = _safe_col(sort_by)
        dir_sql = "ASC" if sort_dir.lower() == "asc" else "DESC"
        query += f" ORDER BY {safe_sort} {dir_sql}"
    else:
        query += " ORDER BY id DESC"

    query += f" LIMIT :limit OFFSET :offset"
    params["limit"] = min(limit, 1000)
    params["offset"] = offset

    total = db.execute(text(count_query), params).scalar() or 0
    rows_raw = db.execute(text(query), params).fetchall()

    rows = [
        {col_names[i]: _serialize_value(row[i]) for i in range(len(col_names))}
        for row in rows_raw
    ]

    return {"rows": rows, "total": total, "offset": offset, "limit": limit}


def update_cell(
    db: Session, table_name: str, row_id: int, column: str, value: Any, user_name: str
) -> dict:
    safe_table = _safe_table(table_name)
    safe_col = _safe_col(column)

    old_row = db.execute(
        text(f"SELECT {safe_col} FROM {safe_table} WHERE id = :id"), {"id": row_id}
    ).fetchone()
    old_value = _serialize_value(old_row[0]) if old_row else None

    db.execute(
        text(f"UPDATE {safe_table} SET {safe_col} = :value WHERE id = :id"),
        {"value": value, "id": row_id},
    )
    db.commit()

    updated = db.execute(
        text(f"SELECT * FROM {safe_table} WHERE id = :id"), {"id": row_id}
    ).fetchone()
    col_names = [c["name"] for c in inspect(db.bind).get_columns(table_name)]
    updated_row = {col_names[i]: _serialize_value(updated[i]) for i in range(len(col_names))}

    _log_audit(
        db, user_name, table_name, row_id, column, str(old_value) if old_value is not None else None,
        str(value) if value is not None else None, "edit",
    )

    return updated_row


def insert_row(
    db: Session, table_name: str, data: dict, exclude_columns: Optional[list[str]] = None, user_name: str = ""
) -> dict:
    if exclude_columns is None:
        exclude_columns = []
    inspector = inspect(db.bind)
    all_columns = [c for c in inspector.get_columns(table_name) if c["name"] not in exclude_columns and c["name"] != "id"]
    editable_cols = [c["name"] for c in all_columns if c["name"] not in ("id", "created_at", "updated_at")]

    safe_table = _safe_table(table_name)
    safe_cols = [_safe_col(c) for c in editable_cols]
    placeholders = [f":{c}" for c in editable_cols]

    params = {}
    for col in editable_cols:
        params[col] = data.get(col)

    db.execute(
        text(f"INSERT INTO {safe_table} ({', '.join(safe_cols)}) VALUES ({', '.join(placeholders)})"),
        params,
    )
    db.commit()

    new_id = db.execute(text("SELECT lastval()")).scalar()

    inserted = db.execute(
        text(f"SELECT * FROM {safe_table} WHERE id = :id"), {"id": new_id}
    ).fetchone()
    col_names = [c["name"] for c in inspect(db.bind).get_columns(table_name)]
    created_row = {col_names[i]: _serialize_value(inserted[i]) for i in range(len(col_names))}

    _log_audit(db, user_name, table_name, new_id, None, None, None, "insert")

    return created_row


def delete_row(
    db: Session, table_name: str, row_id: int, user_name: str
) -> None:
    safe_table = _safe_table(table_name)
    old_row = db.execute(
        text(f"SELECT * FROM {safe_table} WHERE id = :id"), {"id": row_id}
    ).fetchone()
    col_names = [c["name"] for c in inspect(db.bind).get_columns(table_name)]
    old_data = {col_names[i]: _serialize_value(old_row[i]) for i in range(len(col_names))} if old_row else {}

    db.execute(text(f"DELETE FROM {safe_table} WHERE id = :id"), {"id": row_id})
    db.commit()

    _log_audit(
        db, user_name, table_name, row_id, None, str(old_data) if old_data else None, None, "delete",
    )


def duplicate_row(
    db: Session, table_name: str, row_id: int, user_name: str
) -> dict:
    safe_table = _safe_table(table_name)
    old_row = db.execute(
        text(f"SELECT * FROM {safe_table} WHERE id = :id"), {"id": row_id}
    ).fetchone()
    col_names = [c["name"] for c in inspect(db.bind).get_columns(table_name)]
    old_data = {col_names[i]: _serialize_value(old_row[i]) for i in range(len(col_names))} if old_row else {}

    exclude_columns = {"id", "created_at", "updated_at"}
    data = {k: v for k, v in old_data.items() if k not in exclude_columns}
    return insert_row(db, table_name, data, user_name=user_name)


def bulk_update_cells(
    db: Session, table_name: str, row_ids: list[int], column: str, value: Any, user_name: str
) -> list[dict]:
    results = []
    for rid in row_ids:
        try:
            updated = update_cell(db, table_name, rid, column, value, user_name)
            results.append(updated)
        except Exception:
            continue
    return results


def get_audit_logs(
    db: Session, sheet_name: Optional[str] = None, limit: int = 100, offset: int = 0
) -> list[dict]:
    query = db.query(SpreadsheetAuditLog)
    if sheet_name:
        query = query.filter(SpreadsheetAuditLog.sheet_name == sheet_name)
    logs = (
        query.order_by(SpreadsheetAuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "user_name": log.user_name,
            "sheet_name": log.sheet_name,
            "row_id": log.row_id,
            "column_name": log.column_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "action": log.action,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


def _log_audit(
    db: Session,
    user_name: str,
    sheet_name: str,
    row_id: Optional[int] = None,
    column_name: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    action: str = "edit",
) -> None:
    entry = SpreadsheetAuditLog(
        user_name=user_name,
        sheet_name=sheet_name,
        row_id=row_id,
        column_name=column_name,
        old_value=old_value,
        new_value=new_value,
        action=action,
    )
    db.add(entry)
    db.commit()
