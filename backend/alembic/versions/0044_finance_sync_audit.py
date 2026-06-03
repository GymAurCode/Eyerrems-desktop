"""Add finance sync/audit tables + missing columns (opening_balance, source, etc.)

Adds to accounts:  opening_balance, opening_balance_date, is_system_account
Adds to journals:  source, is_editable
Creates tables:    sync_logs, finance_audit_logs

Revision ID: 0044_finance_sync_audit
Revises: 0043_sync_crm_columns
Create Date: 2026-06-02 01:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0044_finance_sync_audit"
down_revision = "0043_sync_crm_columns"
branch_labels = None
depends_on = None


def _column_exists(conn, table, column):
    cols = {c["name"] for c in inspect(conn).get_columns(table)}
    return column in cols


def _table_exists(conn, name):
    return inspect(conn).has_table(name)


def upgrade():
    conn = op.get_bind()

    # ── accounts ─────────────────────────────────────────────────────────────
    if _table_exists(conn, "accounts"):
        if not _column_exists(conn, "accounts", "opening_balance"):
            op.add_column("accounts", sa.Column(
                "opening_balance", sa.Numeric(14, 2),
                nullable=False, server_default=sa.text("0")
            ))
        if not _column_exists(conn, "accounts", "opening_balance_date"):
            op.add_column("accounts", sa.Column(
                "opening_balance_date", sa.DateTime(), nullable=True
            ))
        if not _column_exists(conn, "accounts", "is_system_account"):
            op.add_column("accounts", sa.Column(
                "is_system_account", sa.Boolean(),
                nullable=False, server_default=sa.text("false")
            ))

    # ── journals ─────────────────────────────────────────────────────────────
    if _table_exists(conn, "journals"):
        if not _column_exists(conn, "journals", "source"):
            op.add_column("journals", sa.Column(
                "source", sa.String(20), nullable=True, index=True
            ))
        if not _column_exists(conn, "journals", "is_editable"):
            op.add_column("journals", sa.Column(
                "is_editable", sa.Boolean(),
                nullable=False, server_default=sa.text("true")
            ))

    # ── sync_logs ────────────────────────────────────────────────────────────
    if not _table_exists(conn, "sync_logs"):
        op.create_table(
            "sync_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("source_module", sa.String(20), nullable=False),
            sa.Column("source_record_type", sa.String(30), nullable=False),
            sa.Column("source_record_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(30), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="failed"),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("journal_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("retried_at", sa.DateTime(), nullable=True),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_sync_logs_source_module", "sync_logs", ["source_module"])
        op.create_index("ix_sync_logs_status", "sync_logs", ["status"])

    # ── finance_audit_logs ───────────────────────────────────────────────────
    if not _table_exists(conn, "finance_audit_logs"):
        op.create_table(
            "finance_audit_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("user_email", sa.String(255), nullable=True),
            sa.Column("action", sa.String(50), nullable=False),
            sa.Column("module", sa.String(50), nullable=False),
            sa.Column("record_type", sa.String(50), nullable=True),
            sa.Column("record_id", sa.String(50), nullable=True),
            sa.Column("description", sa.String(500), nullable=True),
            sa.Column("amount", sa.Numeric(14, 2), nullable=True),
            sa.Column("extra_data", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade():
    conn = op.get_bind()

    if _table_exists(conn, "finance_audit_logs"):
        op.drop_table("finance_audit_logs")
    if _table_exists(conn, "sync_logs"):
        op.drop_table("sync_logs")
    if _table_exists(conn, "journals"):
        if _column_exists(conn, "journals", "is_editable"):
            with op.batch_alter_table("journals") as batch_op:
                batch_op.drop_column("is_editable")
        if _column_exists(conn, "journals", "source"):
            with op.batch_alter_table("journals") as batch_op:
                batch_op.drop_column("source")
    if _table_exists(conn, "accounts"):
        if _column_exists(conn, "accounts", "is_system_account"):
            with op.batch_alter_table("accounts") as batch_op:
                batch_op.drop_column("is_system_account")
        if _column_exists(conn, "accounts", "opening_balance_date"):
            with op.batch_alter_table("accounts") as batch_op:
                batch_op.drop_column("opening_balance_date")
        if _column_exists(conn, "accounts", "opening_balance"):
            with op.batch_alter_table("accounts") as batch_op:
                batch_op.drop_column("opening_balance")
