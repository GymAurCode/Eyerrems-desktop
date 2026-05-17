"""Finance module - Double-entry accounting system

Revision ID: 0008_finance_module
Revises: 0007_tenant_module
Create Date: 2026-04-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = '0008_finance_module'
down_revision = '0007_tenant_module'
branch_labels = None
depends_on = None


def _table_exists(conn, name: str) -> bool:
    return inspect(conn).has_table(name)


def _index_exists(conn, index_name: str, table_name: str) -> bool:
    indexes = inspect(conn).get_indexes(table_name)
    return any(ix["name"] == index_name for ix in indexes)


def upgrade() -> None:
    conn = op.get_bind()

    # ── accounts ──────────────────────────────────────────────────────────────
    # May already exist from 0002_erp_extensions — skip if so.
    if not _table_exists(conn, "accounts"):
        op.create_table(
            'accounts',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('code', sa.String(40), nullable=False, unique=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('account_type', sa.String(30), nullable=False),
            sa.Column('parent_id', sa.Integer(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['parent_id'], ['accounts.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    if not _index_exists(conn, 'ix_accounts_code', 'accounts'):
        op.create_index(op.f('ix_accounts_code'), 'accounts', ['code'], unique=True)
    if not _index_exists(conn, 'ix_accounts_account_type', 'accounts'):
        op.create_index(op.f('ix_accounts_account_type'), 'accounts', ['account_type'])

    # ── journals ──────────────────────────────────────────────────────────────
    if not _table_exists(conn, "journals"):
        op.create_table(
            'journals',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('date', sa.DateTime(), nullable=False),
            sa.Column('reference_type', sa.String(50), nullable=False),
            sa.Column('reference_id', sa.String(100), nullable=True),
            sa.Column('description', sa.String(500), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('created_by_user_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    if not _index_exists(conn, 'ix_journals_date', 'journals'):
        op.create_index(op.f('ix_journals_date'), 'journals', ['date'])
    if not _index_exists(conn, 'ix_journals_reference_type', 'journals'):
        op.create_index(op.f('ix_journals_reference_type'), 'journals', ['reference_type'])

    # ── journal_entries ───────────────────────────────────────────────────────
    # The old schema (from 0002) has ledger_id; the new schema has journal_id.
    # If the old table exists, rename it so 0009 can handle the migration.
    if _table_exists(conn, "journal_entries"):
        cols = [c["name"] for c in inspect(conn).get_columns("journal_entries")]
        if "ledger_id" in cols:
            op.rename_table("journal_entries", "journal_entries_legacy")

    if not _table_exists(conn, "journal_entries"):
        op.create_table(
            'journal_entries',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('journal_id', sa.Integer(), nullable=False),
            sa.Column('account_id', sa.Integer(), nullable=False),
            sa.Column('debit', sa.Numeric(12, 2), nullable=False, server_default='0'),
            sa.Column('credit', sa.Numeric(12, 2), nullable=False, server_default='0'),
            sa.Column('description', sa.String(500), nullable=True),
            sa.ForeignKeyConstraint(['journal_id'], ['journals.id'], ),
            sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    if not _index_exists(conn, 'ix_journal_entries_journal_id', 'journal_entries'):
        op.create_index(op.f('ix_journal_entries_journal_id'), 'journal_entries', ['journal_id'])
    if not _index_exists(conn, 'ix_journal_entries_account_id', 'journal_entries'):
        op.create_index(op.f('ix_journal_entries_account_id'), 'journal_entries', ['account_id'])

    # ── invoices ──────────────────────────────────────────────────────────────
    if not _table_exists(conn, "invoices"):
        op.create_table(
            'invoices',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tenant_id', sa.Integer(), nullable=False),
            sa.Column('property_id', sa.Integer(), nullable=False),
            sa.Column('unit_id', sa.Integer(), nullable=True),
            sa.Column('amount', sa.Numeric(12, 2), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
            sa.Column('due_date', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
            sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ),
            sa.ForeignKeyConstraint(['unit_id'], ['units.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    if not _index_exists(conn, 'ix_invoices_tenant_id', 'invoices'):
        op.create_index(op.f('ix_invoices_tenant_id'), 'invoices', ['tenant_id'])
    if not _index_exists(conn, 'ix_invoices_property_id', 'invoices'):
        op.create_index(op.f('ix_invoices_property_id'), 'invoices', ['property_id'])
    if not _index_exists(conn, 'ix_invoices_status', 'invoices'):
        op.create_index(op.f('ix_invoices_status'), 'invoices', ['status'])

    # ── payments ──────────────────────────────────────────────────────────────
    if not _table_exists(conn, "payments"):
        op.create_table(
            'payments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('invoice_id', sa.Integer(), nullable=False),
            sa.Column('method', sa.String(20), nullable=False),
            sa.Column('amount', sa.Numeric(12, 2), nullable=False),
            sa.Column('date', sa.DateTime(), nullable=False),
            sa.Column('reference_number', sa.String(100), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    if not _index_exists(conn, 'ix_payments_invoice_id', 'payments'):
        op.create_index(op.f('ix_payments_invoice_id'), 'payments', ['invoice_id'])
    if not _index_exists(conn, 'ix_payments_date', 'payments'):
        op.create_index(op.f('ix_payments_date'), 'payments', ['date'])

    # ── commissions ───────────────────────────────────────────────────────────
    if not _table_exists(conn, "commissions"):
        op.create_table(
            'commissions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('agent_id', sa.Integer(), nullable=False),
            sa.Column('property_id', sa.Integer(), nullable=False),
            sa.Column('amount', sa.Numeric(12, 2), nullable=False),
            sa.Column('type', sa.String(20), nullable=False),
            sa.Column('date', sa.DateTime(), nullable=False),
            sa.Column('reference', sa.String(100), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['agent_id'], ['users.id'], ),
            sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    if not _index_exists(conn, 'ix_commissions_agent_id', 'commissions'):
        op.create_index(op.f('ix_commissions_agent_id'), 'commissions', ['agent_id'])
    if not _index_exists(conn, 'ix_commissions_property_id', 'commissions'):
        op.create_index(op.f('ix_commissions_property_id'), 'commissions', ['property_id'])
    if not _index_exists(conn, 'ix_commissions_type', 'commissions'):
        op.create_index(op.f('ix_commissions_type'), 'commissions', ['type'])


def downgrade() -> None:
    conn = op.get_bind()
    for tbl in ['commissions', 'payments', 'invoices', 'journal_entries', 'journals']:
        if _table_exists(conn, tbl):
            op.drop_table(tbl)
    if _table_exists(conn, 'journal_entries_legacy'):
        op.rename_table('journal_entries_legacy', 'journal_entries')
    if not _table_exists(conn, 'accounts'):
        # Only drop if we created it (0002 will handle its own downgrade)
        pass
