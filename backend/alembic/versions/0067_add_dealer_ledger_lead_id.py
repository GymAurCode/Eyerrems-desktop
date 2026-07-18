"""Add lead_id column to dealer_ledger_entries

Revision ID: 0067_add_dealer_ledger_lead_id
Revises: 0066_finance_invoice_payment_separation
Create Date: 2026-07-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0067_add_dealer_ledger_lead_id"
down_revision = "0066_finance_invoice_payment_separation"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    if not _column_exists("dealer_ledger_entries", "lead_id"):
        op.add_column("dealer_ledger_entries",
            sa.Column("lead_id", sa.Integer(), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
        )


def downgrade():
    if _column_exists("dealer_ledger_entries", "lead_id"):
        op.drop_column("dealer_ledger_entries", "lead_id")
