"""Installment engine + default COA columns

Revision ID: 0010_installment_engine
Revises: 0009_finance_upgrade
Create Date: 2026-04-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = '0010_installment_engine'
down_revision = '0009_finance_upgrade'
branch_labels = None
depends_on = None


def _table_exists(conn, name):
    return inspect(conn).has_table(name)


def _column_exists(conn, table, column):
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()

    # ── installment_plans: add down_payment + remaining_amount ────────────────
    if _table_exists(conn, "installment_plans"):
        if not _column_exists(conn, "installment_plans", "down_payment"):
            op.add_column("installment_plans", sa.Column(
                "down_payment", sa.Numeric(12, 2), nullable=False, server_default="0"
            ))
        if not _column_exists(conn, "installment_plans", "remaining_amount"):
            op.add_column("installment_plans", sa.Column(
                "remaining_amount", sa.Numeric(12, 2), nullable=False, server_default="0"
            ))
        if not _column_exists(conn, "installment_plans", "down_payment_status"):
            op.add_column("installment_plans", sa.Column(
                "down_payment_status", sa.String(20), nullable=False, server_default="pending"
            ))

    # ── installments: add type + partial status support ───────────────────────
    if _table_exists(conn, "installments"):
        if not _column_exists(conn, "installments", "type"):
            op.add_column("installments", sa.Column(
                "type", sa.String(20), nullable=False, server_default="custom"
            ))
        # status already exists; ensure 'partial' is a valid value (no enum constraint)

    # ── installment_payments: new table ───────────────────────────────────────
    if not _table_exists(conn, "installment_payments"):
        op.create_table(
            "installment_payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("installment_id", sa.Integer(), nullable=False),
            sa.Column("method", sa.String(20), nullable=False),  # cash | bank
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("date", sa.DateTime(), nullable=False),
            sa.Column("reference_number", sa.String(100), nullable=True),
            sa.Column("journal_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=text("NOW()")),
            sa.ForeignKeyConstraint(["installment_id"], ["installments.id"]),
            sa.ForeignKeyConstraint(["journal_id"], ["journals.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_inst_payments_installment_id", "installment_payments", ["installment_id"])
        op.create_index("ix_inst_payments_date", "installment_payments", ["date"])


def downgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "installment_payments"):
        op.drop_table("installment_payments")
    if _table_exists(conn, "installment_plans"):
        for col in ["down_payment", "remaining_amount", "down_payment_status"]:
            if _column_exists(conn, "installment_plans", col):
                with op.batch_alter_table("installment_plans") as batch_op:
                    batch_op.drop_column(col)
    if _table_exists(conn, "installments") and _column_exists(conn, "installments", "type"):
        with op.batch_alter_table("installments") as batch_op:
            batch_op.drop_column("type")
