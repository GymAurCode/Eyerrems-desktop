"""Finance module - Double-entry accounting system

Revision ID: 0008_finance_module
Revises: 0007_tenant_module
Create Date: 2026-04-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0008_finance_module'
down_revision = '0007_tenant_module'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create accounts table (Chart of Accounts)
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
    op.create_index(op.f('ix_accounts_code'), 'accounts', ['code'], unique=True)
    op.create_index(op.f('ix_accounts_account_type'), 'accounts', ['account_type'])

    # Create journals table
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
    op.create_index(op.f('ix_journals_date'), 'journals', ['date'])
    op.create_index(op.f('ix_journals_reference_type'), 'journals', ['reference_type'])

    # Create journal_entries table
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
    op.create_index(op.f('ix_journal_entries_journal_id'), 'journal_entries', ['journal_id'])
    op.create_index(op.f('ix_journal_entries_account_id'), 'journal_entries', ['account_id'])

    # Create invoices table
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
    op.create_index(op.f('ix_invoices_tenant_id'), 'invoices', ['tenant_id'])
    op.create_index(op.f('ix_invoices_property_id'), 'invoices', ['property_id'])
    op.create_index(op.f('ix_invoices_status'), 'invoices', ['status'])

    # Create payments table
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
    op.create_index(op.f('ix_payments_invoice_id'), 'payments', ['invoice_id'])
    op.create_index(op.f('ix_payments_date'), 'payments', ['date'])

    # Create commissions table
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
    op.create_index(op.f('ix_commissions_agent_id'), 'commissions', ['agent_id'])
    op.create_index(op.f('ix_commissions_property_id'), 'commissions', ['property_id'])
    op.create_index(op.f('ix_commissions_type'), 'commissions', ['type'])


def downgrade() -> None:
    op.drop_table('commissions')
    op.drop_table('payments')
    op.drop_table('invoices')
    op.drop_table('journal_entries')
    op.drop_table('journals')
    op.drop_table('accounts')
