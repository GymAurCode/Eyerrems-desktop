"""Create ledger tables (client_ledger_entries, dealer_ledger_entries, property_ledger_entries)

Revision ID: 0066a_create_ledger_tables
Revises: 0066_finance_invoice_payment_separation
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0066a_create_ledger_tables"
down_revision: Union[str, None] = "0066_finance_invoice_payment_separation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ─── client_ledger_entries ──────────────────────────────────────────────
    if not inspect(conn).has_table("client_ledger_entries"):
        op.create_table(
            "client_ledger_entries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tid", sa.String(20), nullable=False, unique=True),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("journal_id", sa.Integer(), sa.ForeignKey("journals.id", ondelete="SET NULL"), nullable=True),
            sa.Column("entry_date", sa.DateTime(), nullable=False, index=True),
            sa.Column("description", sa.String(500), nullable=False),
            sa.Column("reference_no", sa.String(100), nullable=True),
            sa.Column("entry_type", sa.String(50), nullable=False, index=True),
            sa.Column("debit", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("credit", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("running_balance", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("payment_method", sa.String(30), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'posted'")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── dealer_ledger_entries (without lead_id — added by 0067) ────────────
    if not inspect(conn).has_table("dealer_ledger_entries"):
        op.create_table(
            "dealer_ledger_entries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tid", sa.String(20), nullable=False, unique=True),
            sa.Column("dealer_id", sa.Integer(), sa.ForeignKey("dealers.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("deal_id", sa.Integer(), sa.ForeignKey("deals.id", ondelete="SET NULL"), nullable=True),
            sa.Column("journal_id", sa.Integer(), sa.ForeignKey("journals.id", ondelete="SET NULL"), nullable=True),
            sa.Column("entry_date", sa.DateTime(), nullable=False, index=True),
            sa.Column("description", sa.String(500), nullable=False),
            sa.Column("reference_no", sa.String(100), nullable=True),
            sa.Column("entry_type", sa.String(50), nullable=False),
            sa.Column("commission_rate", sa.Numeric(7, 4), nullable=True),
            sa.Column("gross_commission", sa.Numeric(14, 2), nullable=True),
            sa.Column("debit", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("credit", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("running_balance", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'posted'")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── property_ledger_entries ────────────────────────────────────────────
    if not inspect(conn).has_table("property_ledger_entries"):
        op.create_table(
            "property_ledger_entries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tid", sa.String(20), nullable=False, unique=True),
            sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("journal_id", sa.Integer(), sa.ForeignKey("journals.id", ondelete="SET NULL"), nullable=True),
            sa.Column("entry_date", sa.DateTime(), nullable=False, index=True),
            sa.Column("description", sa.String(500), nullable=False),
            sa.Column("reference_no", sa.String(100), nullable=True),
            sa.Column("entry_type", sa.String(50), nullable=False),
            sa.Column("debit", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("credit", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("running_balance", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'posted'")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    conn = op.get_bind()
    for tbl in ["property_ledger_entries", "dealer_ledger_entries", "client_ledger_entries"]:
        if inspect(conn).has_table(tbl):
            op.drop_table(tbl)
