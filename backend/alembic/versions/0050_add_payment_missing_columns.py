"""Add missing columns to payments table to match SQLAlchemy model

Revision ID: 0050_add_payment_missing_columns
Revises: 0049_add_invoice_missing_columns
Create Date: 2026-06-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "0050_add_payment_missing_columns"
down_revision = "0049_add_invoice_missing_columns"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    if not _column_exists("payments", "payment_type"):
        op.add_column("payments", sa.Column("payment_type", sa.String(30), nullable=True))

    if not _column_exists("payments", "source"):
        op.add_column("payments", sa.Column("source", sa.String(20), nullable=True))

    if not _column_exists("payments", "source_id"):
        op.add_column("payments", sa.Column("source_id", sa.Integer(), nullable=True))

    if not _column_exists("payments", "posted_to_finance"):
        op.add_column("payments", sa.Column("posted_to_finance", sa.Boolean(), nullable=False, server_default=text("false")))

    if not _column_exists("payments", "finance_journal_id"):
        op.add_column("payments", sa.Column("finance_journal_id", sa.Integer(), nullable=True))

    if not _column_exists("payments", "notes"):
        op.add_column("payments", sa.Column("notes", sa.String(500), nullable=True))

    if not _column_exists("payments", "receipt_path"):
        op.add_column("payments", sa.Column("receipt_path", sa.String(500), nullable=True))


def downgrade():
    for col in [
        "receipt_path", "notes", "finance_journal_id", "posted_to_finance",
        "source_id", "source", "payment_type",
    ]:
        if _column_exists("payments", col):
            with op.batch_alter_table("payments") as batch_op:
                batch_op.drop_column(col)
