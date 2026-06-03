"""Add invoice_type column to invoices table

Revision ID: 0046_add_invoice_type_column
Revises: 0045_add_dealer_monthly_target
Create Date: 2026-06-03 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0046_add_invoice_type_column"
down_revision = "0045_add_dealer_monthly_target"
branch_labels = None
depends_on = None


def _column_exists(conn, table, column):
    cols = {c["name"] for c in inspect(conn).get_columns(table)}
    return column in cols


def upgrade():
    conn = op.get_bind()
    if not _column_exists(conn, "invoices", "invoice_type"):
        op.add_column("invoices", sa.Column("invoice_type", sa.String(20), nullable=True))


def downgrade():
    conn = op.get_bind()
    if _column_exists(conn, "invoices", "invoice_type"):
        with op.batch_alter_table("invoices") as batch_op:
            batch_op.drop_column("invoice_type")
