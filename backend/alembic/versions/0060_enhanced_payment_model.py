"""Enhanced Payment Model - ERP Payment Management System

Revision ID: 0060_enhanced_payment_model
Revises: 0059_enhanced_invoice_model
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect, text

revision = "0060_enhanced_payment_model"
down_revision = "0059_enhanced_invoice_model"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def _index_exists(table, index):
    conn = op.get_bind()
    indexes = [i["name"] for i in inspect(conn).get_indexes(table)]
    return index in indexes


def upgrade():
    # ── Add new columns ────────────────────────────────────────────────
    if not _column_exists("payments", "payment_number"):
        op.add_column("payments", sa.Column("payment_number", sa.String(50), nullable=True, unique=True))
        op.create_index("ix_payments_payment_number", "payments", ["payment_number"])

    if not _column_exists("payments", "receipt_number"):
        op.add_column("payments", sa.Column("receipt_number", sa.String(50), nullable=True, unique=True))

    if not _column_exists("payments", "status"):
        op.add_column("payments", sa.Column("status", sa.String(20), nullable=False, server_default="completed"))
        op.create_index("ix_payments_status", "payments", ["status"])

    if not _column_exists("payments", "payment_source"):
        op.add_column("payments", sa.Column("payment_source", sa.String(30), nullable=False, server_default="invoice"))

    if not _column_exists("payments", "overpayment"):
        op.add_column("payments", sa.Column("overpayment", sa.Boolean(), nullable=False, server_default=text("false")))

    if not _column_exists("payments", "overpayment_approved_by"):
        op.add_column("payments", sa.Column("overpayment_approved_by", sa.Integer(), nullable=True))

    if not _column_exists("payments", "method_fields"):
        op.add_column("payments", sa.Column("method_fields", postgresql.JSON(), nullable=True))

    if not _column_exists("payments", "external_transaction_id"):
        op.add_column("payments", sa.Column("external_transaction_id", sa.String(100), nullable=True))

    if not _column_exists("payments", "received_by"):
        op.add_column("payments", sa.Column("received_by", sa.String(255), nullable=True))

    if not _column_exists("payments", "party_type"):
        op.add_column("payments", sa.Column("party_type", sa.String(30), nullable=True))

    if not _column_exists("payments", "party_id"):
        op.add_column("payments", sa.Column("party_id", sa.Integer(), nullable=True))

    if not _column_exists("payments", "party_name"):
        op.add_column("payments", sa.Column("party_name", sa.String(255), nullable=True))

    if not _column_exists("payments", "party_phone"):
        op.add_column("payments", sa.Column("party_phone", sa.String(50), nullable=True))

    if not _column_exists("payments", "party_email"):
        op.add_column("payments", sa.Column("party_email", sa.String(255), nullable=True))

    if not _column_exists("payments", "branch"):
        op.add_column("payments", sa.Column("branch", sa.String(100), nullable=True))

    if not _column_exists("payments", "cash_counter"):
        op.add_column("payments", sa.Column("cash_counter", sa.String(100), nullable=True))

    if not _column_exists("payments", "cash_register"):
        op.add_column("payments", sa.Column("cash_register", sa.String(100), nullable=True))

    if not _column_exists("payments", "internal_notes"):
        op.add_column("payments", sa.Column("internal_notes", sa.Text(), nullable=True))

    if not _column_exists("payments", "customer_notes"):
        op.add_column("payments", sa.Column("customer_notes", sa.Text(), nullable=True))

    if not _column_exists("payments", "completed_at"):
        op.add_column("payments", sa.Column("completed_at", sa.DateTime(), nullable=True))

    if not _column_exists("payments", "reversed_at"):
        op.add_column("payments", sa.Column("reversed_at", sa.DateTime(), nullable=True))

    if not _column_exists("payments", "refunded_at"):
        op.add_column("payments", sa.Column("refunded_at", sa.DateTime(), nullable=True))

    if not _column_exists("payments", "cancelled_at"):
        op.add_column("payments", sa.Column("cancelled_at", sa.DateTime(), nullable=True))

    if not _column_exists("payments", "deleted_at"):
        op.add_column("payments", sa.Column("deleted_at", sa.DateTime(), nullable=True))

    if not _column_exists("payments", "updated_at"):
        op.add_column("payments", sa.Column("updated_at", sa.DateTime(), nullable=True))

    if not _column_exists("payments", "created_by_user_id"):
        op.add_column("payments", sa.Column("created_by_user_id", sa.Integer(), nullable=True))

    if not _column_exists("payments", "company_id"):
        op.add_column("payments", sa.Column("company_id", sa.Integer(), nullable=True))
        op.create_index("ix_payments_company_id", "payments", ["company_id"])

    # rename method values: bank -> bank_transfer
    op.execute(
        text("UPDATE payments SET method = 'bank_transfer' WHERE method = 'bank'")
    )

    # Set receipt_number from receipt_number column or generate
    op.execute(
        text("""
            UPDATE payments
            SET receipt_number = CONCAT('REC-', EXTRACT(YEAR FROM created_at)::text, '-', LPAD(CAST(id AS text), 6, '0'))
            WHERE receipt_number IS NULL
        """)
    )
    if not _index_exists("payments", "ix_payments_receipt_number"):
        op.create_index("ix_payments_receipt_number", "payments", ["receipt_number"])

    # Set payment_number
    op.execute(
        text("""
            UPDATE payments
            SET payment_number = CONCAT('PAY-', EXTRACT(YEAR FROM created_at)::text, '-', LPAD(CAST(id AS text), 6, '0'))
            WHERE payment_number IS NULL
        """)
    )

    # Set status for existing records
    op.execute(
        text("UPDATE payments SET status = 'completed' WHERE status IS NULL")
    )

    # Set completed_at for existing completed payments
    op.execute(
        text("UPDATE payments SET completed_at = created_at WHERE completed_at IS NULL AND status = 'completed'")
    )

    # Set updated_at for existing records
    op.execute(
        text("UPDATE payments SET updated_at = created_at WHERE updated_at IS NULL")
    )

    # Make method column larger to accommodate new method names
    with op.batch_alter_table("payments") as batch_op:
        batch_op.alter_column("method",
                              type_=sa.String(30),
                              existing_type=sa.String(20),
                              nullable=False)

    # Change notes to internal_notes copy
    if _column_exists("payments", "notes") and _column_exists("payments", "internal_notes"):
        op.execute(
            text("UPDATE payments SET internal_notes = notes WHERE internal_notes IS NULL AND notes IS NOT NULL")
        )


def downgrade():
    # Remove new columns
    drop_cols = [
        "receipt_number", "payment_number", "status", "payment_source", "overpayment",
        "overpayment_approved_by", "method_fields", "external_transaction_id",
        "received_by", "party_type", "party_id", "party_name", "party_phone",
        "party_email", "branch", "cash_counter", "cash_register",
        "internal_notes", "customer_notes", "completed_at", "reversed_at",
        "refunded_at", "cancelled_at", "deleted_at", "updated_at",
        "created_by_user_id", "company_id",
    ]
    for col in drop_cols:
        if _column_exists("payments", col):
            with op.batch_alter_table("payments") as batch_op:
                batch_op.drop_column(col)

    # Revert method names
    op.execute(
        text("UPDATE payments SET method = 'bank' WHERE method = 'bank_transfer'")
    )

    # Restore method column type
    with op.batch_alter_table("payments") as batch_op:
        batch_op.alter_column("method",
                              type_=sa.String(20),
                              existing_type=sa.String(30),
                              nullable=False)
