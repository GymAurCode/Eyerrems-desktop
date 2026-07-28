"""Add soft delete columns to all tables missing them.

This migration dynamically discovers every table in the ORM metadata
that has SoftDeleteMixin columns (is_deleted, deleted_at, etc.) and
adds any columns that the table does not yet have.

Revision ID: 0076
Revises: 73280885add4
Create Date: 2026-07-27
"""
import logging
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

from app.core.database import Base
from app.models import *  # noqa: F401,F403 — registers all ORM models

log = logging.getLogger("alembic.migration")

revision: str = "0076"
down_revision: Union[str, None] = "73280885add4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Columns that SoftDeleteMixin adds to models
SOFT_DELETE_COLUMNS = {
    "is_deleted": sa.Boolean(),
    "deleted_at": sa.DateTime(),
    "deleted_by": sa.Integer(),
    "restored_at": sa.DateTime(),
    "restored_by": sa.Integer(),
    "original_business_number": sa.String(100),
    "restore_count": sa.Integer(),
}

# Use server_default for is_deleted so existing rows get FALSE, not NULL
COLUMN_KWARGS = {
    "is_deleted": {"server_default": sa.text("false"), "nullable": False},
}


def _get_soft_delete_tables() -> list[str]:
    """Return all table names whose ORM model has an `is_deleted` column."""
    result = []
    for table_name, table in Base.metadata.tables.items():
        if "is_deleted" in table.c:
            result.append(table_name)
    return sorted(result)


def _column_exists(conn: Connection, table: str, column: str) -> bool:
    try:
        insp = inspect(conn)
        cols = [c["name"] for c in insp.get_columns(table)]
        return column in cols
    except Exception:
        return False


def upgrade() -> None:
    conn = op.get_bind()
    tables = _get_soft_delete_tables()
    log.info("Soft-delete migration: checking %d tables", len(tables))

    for table in tables:
        for col_name, col_type in SOFT_DELETE_COLUMNS.items():
            if not _column_exists(conn, table, col_name):
                log.info("Adding %s.%s", table, col_name)
                kwargs = COLUMN_KWARGS.get(col_name, {"nullable": True})
                with op.batch_alter_table(table) as batch_op:
                    batch_op.add_column(sa.Column(col_name, col_type, **kwargs))


def downgrade() -> None:
    conn = op.get_bind()
    tables = _get_soft_delete_tables()
    for table in tables:
        for col_name in SOFT_DELETE_COLUMNS:
            if _column_exists(conn, table, col_name):
                with op.batch_alter_table(table) as batch_op:
                    batch_op.drop_column(col_name)
