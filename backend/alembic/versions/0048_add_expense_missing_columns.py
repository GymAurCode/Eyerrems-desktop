"""Add missing columns to expenses table to match SQLAlchemy model

Revision ID: 0048_add_expense_missing_columns
Revises: 0047_make_invoice_tenant_property_nullable
Create Date: 2026-06-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "0048_add_expense_missing_columns"
down_revision = "0047_make_invoice_tenant_property_nullable"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    conn = op.get_bind()

    # vendor_name may already exist via raw SQL in main.py
    if not _column_exists("expenses", "vendor_name"):
        op.add_column("expenses", sa.Column("vendor_name", sa.String(255), nullable=True))

    if not _column_exists("expenses", "invoice_bill_no"):
        op.add_column("expenses", sa.Column("invoice_bill_no", sa.String(100), nullable=True))

    if not _column_exists("expenses", "payment_method"):
        op.add_column("expenses", sa.Column("payment_method", sa.String(30), nullable=True))

    if not _column_exists("expenses", "payment_status"):
        op.add_column("expenses", sa.Column("payment_status", sa.String(20), nullable=True, server_default="pending"))

    if not _column_exists("expenses", "paid_from_account_id"):
        op.add_column("expenses", sa.Column("paid_from_account_id", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "receipt_path"):
        op.add_column("expenses", sa.Column("receipt_path", sa.String(500), nullable=True))

    if not _column_exists("expenses", "property_id"):
        op.add_column("expenses", sa.Column("property_id", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "department"):
        op.add_column("expenses", sa.Column("department", sa.String(100), nullable=True))

    if not _column_exists("expenses", "is_recurring"):
        op.add_column("expenses", sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=text("false")))

    if not _column_exists("expenses", "recurring_frequency"):
        op.add_column("expenses", sa.Column("recurring_frequency", sa.String(20), nullable=True))

    if not _column_exists("expenses", "next_due_date"):
        op.add_column("expenses", sa.Column("next_due_date", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "recurring_end_date"):
        op.add_column("expenses", sa.Column("recurring_end_date", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "approval_status"):
        op.add_column("expenses", sa.Column("approval_status", sa.String(20), nullable=True, server_default="submitted"))

    if not _column_exists("expenses", "approved_by"):
        op.add_column("expenses", sa.Column("approved_by", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "approved_at"):
        op.add_column("expenses", sa.Column("approved_at", sa.DateTime(), nullable=True))


def downgrade():
    for col in [
        "approved_at", "approved_by", "approval_status",
        "recurring_end_date", "next_due_date", "recurring_frequency",
        "is_recurring", "department", "property_id", "receipt_path",
        "paid_from_account_id", "payment_status", "payment_method",
        "invoice_bill_no", "vendor_name",
    ]:
        if _column_exists("expenses", col):
            with op.batch_alter_table("expenses") as batch_op:
                batch_op.drop_column(col)
