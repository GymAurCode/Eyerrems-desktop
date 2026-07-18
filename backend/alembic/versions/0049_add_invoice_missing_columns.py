"""Add missing columns to invoices table to match SQLAlchemy model

Revision ID: 0049_add_invoice_missing_columns
Revises: 0048_add_expense_missing_columns
Create Date: 2026-06-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0049_add_invoice_missing_columns"
down_revision = "0048_add_expense_missing_columns"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    if not _column_exists("invoices", "client_id"):
        op.add_column("invoices", sa.Column("client_id", sa.Integer(), nullable=True))

    if not _column_exists("invoices", "client_name"):
        op.add_column("invoices", sa.Column("client_name", sa.String(255), nullable=True))

    if not _column_exists("invoices", "reference"):
        op.add_column("invoices", sa.Column("reference", sa.String(100), nullable=True))

    if not _column_exists("invoices", "paid_amount"):
        op.add_column("invoices", sa.Column("paid_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")))

    if not _column_exists("invoices", "remaining_amount"):
        op.add_column("invoices", sa.Column("remaining_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")))


def downgrade():
    for col in ["remaining_amount", "paid_amount", "reference", "client_name", "client_id"]:
        if _column_exists("invoices", col):
            with op.batch_alter_table("invoices") as batch_op:
                batch_op.drop_column(col)
