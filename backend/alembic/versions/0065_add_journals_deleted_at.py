"""Add missing deleted_at column to journals table

Revision ID: 0065_add_journals_deleted_at
Revises: 0064_add_expense_vendor_fk
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0065_add_journals_deleted_at"
down_revision = "0064_add_expense_vendor_fk"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    if _column_exists("journals", "deleted_at"):
        return
    op.add_column("journals", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index("ix_journals_deleted_at", "journals", ["deleted_at"])


def downgrade():
    if not _column_exists("journals", "deleted_at"):
        return
    with op.batch_alter_table("journals") as batch_op:
        batch_op.drop_index("ix_journals_deleted_at")
        batch_op.drop_column("deleted_at")
