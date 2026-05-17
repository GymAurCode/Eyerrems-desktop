"""Finance upgrade - reconcile partial state, add all missing tables/columns

Revision ID: 0009_finance_upgrade
Revises: 0008_finance_module
Create Date: 2026-04-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = '0009_finance_upgrade'
down_revision = '0008_finance_module'
branch_labels = None
depends_on = None


def _table_exists(conn, name):
    return inspect(conn).has_table(name)


def _column_exists(conn, table, column):
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()

    # accounts: add missing updated_at
    if _table_exists(conn, "accounts") and not _column_exists(conn, "accounts", "updated_at"):
        op.add_column("accounts", sa.Column(
            "updated_at", sa.DateTime(), nullable=False,
            server_default=text("NOW()")
        ))

    # old journal_entries (ledger_id schema) → rename to legacy
    if _table_exists(conn, "journal_entries") and _column_exists(conn, "journal_entries", "ledger_id"):
        op.rename_table("journal_entries", "journal_entries_legacy")

    # journals
    if not _table_exists(conn, "journals"):
        op.create_table(
            "journals",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("date", sa.DateTime(), nullable=False),
            sa.Column("reference_type", sa.String(50), nullable=False),
            sa.Column("reference_id", sa.String(100), nullable=True),
            sa.Column("description", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=text("NOW()")),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_journals_date", "journals", ["date"])
        op.create_index("ix_journals_reference_type", "journals", ["reference_type"])

    # journal_entries (new double-entry schema)
    if not _table_exists(conn, "journal_entries"):
        op.create_table(
            "journal_entries",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("journal_id", sa.Integer(), nullable=False),
            sa.Column("account_id", sa.Integer(), nullable=False),
            sa.Column("debit", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("credit", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("description", sa.String(500), nullable=True),
            sa.ForeignKeyConstraint(["journal_id"], ["journals.id"]),
            sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_journal_entries_journal_id", "journal_entries", ["journal_id"])
        op.create_index("ix_journal_entries_account_id", "journal_entries", ["account_id"])

    # invoices
    if not _table_exists(conn, "invoices"):
        op.create_table(
            "invoices",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("property_id", sa.Integer(), nullable=False),
            sa.Column("unit_id", sa.Integer(), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("due_date", sa.DateTime(), nullable=False),
            sa.Column("description", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=text("NOW()")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=text("NOW()")),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["property_id"], ["properties.id"]),
            sa.ForeignKeyConstraint(["unit_id"], ["units.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_invoices_tenant_id", "invoices", ["tenant_id"])
        op.create_index("ix_invoices_property_id", "invoices", ["property_id"])
        op.create_index("ix_invoices_status", "invoices", ["status"])

    # payments
    if not _table_exists(conn, "payments"):
        op.create_table(
            "payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("invoice_id", sa.Integer(), nullable=False),
            sa.Column("method", sa.String(20), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("date", sa.DateTime(), nullable=False),
            sa.Column("reference_number", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=text("NOW()")),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_payments_invoice_id", "payments", ["invoice_id"])
        op.create_index("ix_payments_date", "payments", ["date"])

    # commissions
    if not _table_exists(conn, "commissions"):
        op.create_table(
            "commissions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("agent_id", sa.Integer(), nullable=False),
            sa.Column("property_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("type", sa.String(20), nullable=False),
            sa.Column("date", sa.DateTime(), nullable=False),
            sa.Column("reference", sa.String(100), nullable=True),
            sa.Column("description", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=text("NOW()")),
            sa.ForeignKeyConstraint(["agent_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["property_id"], ["properties.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_commissions_agent_id", "commissions", ["agent_id"])
        op.create_index("ix_commissions_property_id", "commissions", ["property_id"])
        op.create_index("ix_commissions_type", "commissions", ["type"])

    # expenses
    if not _table_exists(conn, "expenses"):
        op.create_table(
            "expenses",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("account_id", sa.Integer(), nullable=False),
            sa.Column("paid_from", sa.String(20), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("date", sa.DateTime(), nullable=False),
            sa.Column("description", sa.String(500), nullable=False),
            sa.Column("reference", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=text("NOW()")),
            sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_expenses_account_id", "expenses", ["account_id"])
        op.create_index("ix_expenses_date", "expenses", ["date"])


def downgrade() -> None:
    conn = op.get_bind()
    for tbl in ["expenses", "commissions", "payments", "invoices", "journal_entries", "journals"]:
        if _table_exists(conn, tbl):
            op.drop_table(tbl)
    if _table_exists(conn, "journal_entries_legacy"):
        op.rename_table("journal_entries_legacy", "journal_entries")
    if _table_exists(conn, "accounts") and _column_exists(conn, "accounts", "updated_at"):
        with op.batch_alter_table("accounts") as batch_op:
            batch_op.drop_column("updated_at")
