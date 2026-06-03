"""Add monthly_target column to dealers table

Revision ID: 0045_add_dealer_monthly_target
Revises: 0044_finance_sync_audit
Create Date: 2026-06-03 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0045_add_dealer_monthly_target"
down_revision = "0044_finance_sync_audit"
branch_labels = None
depends_on = None


def _column_exists(conn, table, column):
    cols = {c["name"] for c in inspect(conn).get_columns(table)}
    return column in cols


def upgrade():
    conn = op.get_bind()
    if not _column_exists(conn, "dealers", "monthly_target"):
        op.add_column("dealers", sa.Column("monthly_target", sa.Numeric(12, 2), nullable=True))


def downgrade():
    conn = op.get_bind()
    if _column_exists(conn, "dealers", "monthly_target"):
        with op.batch_alter_table("dealers") as batch_op:
            batch_op.drop_column("monthly_target")
