"""Add lease upgrade fields: terms, late payment, payment method, renewal, PDC, payments.

Revision ID: 0039_lease_upgrade_fields
Revises: 0038_unit_upgrade_fields
Create Date: 2026-06-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0039_lease_upgrade_fields'
down_revision = '0038_unit_upgrade_fields'
branch_labels = None
depends_on = None


def upgrade():
    # ── leases: new columns ───────────────────────────────────────────────────
    op.add_column('leases', sa.Column('property_id', sa.Integer(), sa.ForeignKey('properties.id'), nullable=True))
    op.add_column('leases', sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=True))
    op.add_column('leases', sa.Column('annual_rent', sa.Numeric(14, 2), nullable=True))
    op.add_column('leases', sa.Column('payment_frequency', sa.String(30), nullable=False, server_default='monthly'))
    op.add_column('leases', sa.Column('first_payment_due_date', sa.Date(), nullable=True))
    op.add_column('leases', sa.Column('security_deposit', sa.Numeric(12, 2), nullable=True))
    op.add_column('leases', sa.Column('deposit_status', sa.String(20), nullable=True, server_default='pending'))
    op.add_column('leases', sa.Column('notice_period', sa.Integer(), nullable=True, server_default='30'))
    op.add_column('leases', sa.Column('grace_period', sa.Integer(), nullable=True, server_default='5'))
    op.add_column('leases', sa.Column('late_fee_type', sa.String(20), nullable=True))
    op.add_column('leases', sa.Column('late_fee_value', sa.Numeric(12, 2), nullable=True))
    op.add_column('leases', sa.Column('payment_method', sa.String(30), nullable=True, server_default='cash'))
    op.add_column('leases', sa.Column('pdc_count', sa.Integer(), nullable=True))
    op.add_column('leases', sa.Column('bank_name', sa.String(120), nullable=True))
    op.add_column('leases', sa.Column('bank_account_details', sa.String(255), nullable=True))
    op.add_column('leases', sa.Column('auto_renewal', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('leases', sa.Column('renewal_duration_months', sa.Integer(), nullable=True))
    op.add_column('leases', sa.Column('rent_increase_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('leases', sa.Column('termination_date', sa.Date(), nullable=True))
    op.add_column('leases', sa.Column('termination_reason', sa.String(50), nullable=True))
    op.add_column('leases', sa.Column('renewed_from_lease_id', sa.Integer(), sa.ForeignKey('leases.id'), nullable=True))
    # Make end_date NOT NULL (was nullable before)
    op.alter_column('leases', 'end_date', existing_type=sa.Date(), nullable=False)
    # Make monthly_rent NOT NULL (already not null)

    # ── lease_payments ────────────────────────────────────────────────────────
    op.create_table(
        'lease_payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tid', sa.String(20), unique=True, nullable=False),
        sa.Column('lease_id', sa.Integer(), sa.ForeignKey('leases.id'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False),
        sa.Column('payment_method', sa.String(30), nullable=True),
        sa.Column('reference_no', sa.String(80), nullable=True),
        sa.Column('cheque_no', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # ── lease_pdcs ────────────────────────────────────────────────────────────
    op.create_table(
        'lease_pdcs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('lease_id', sa.Integer(), sa.ForeignKey('leases.id'), nullable=False),
        sa.Column('cheque_no', sa.String(50), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
    )

    # ── lease_documents ───────────────────────────────────────────────────────
    op.create_table(
        'lease_documents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('lease_id', sa.Integer(), sa.ForeignKey('leases.id'), nullable=False),
        sa.Column('file_path', sa.String(512), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=True, server_default='lease_agreement'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('lease_documents')
    op.drop_table('lease_pdcs')
    op.drop_table('lease_payments')
    op.drop_column('leases', 'renewed_from_lease_id')
    op.drop_column('leases', 'termination_reason')
    op.drop_column('leases', 'termination_date')
    op.drop_column('leases', 'rent_increase_pct')
    op.drop_column('leases', 'renewal_duration_months')
    op.drop_column('leases', 'auto_renewal')
    op.drop_column('leases', 'bank_account_details')
    op.drop_column('leases', 'bank_name')
    op.drop_column('leases', 'pdc_count')
    op.drop_column('leases', 'payment_method')
    op.drop_column('leases', 'late_fee_value')
    op.drop_column('leases', 'late_fee_type')
    op.drop_column('leases', 'grace_period')
    op.drop_column('leases', 'notice_period')
    op.drop_column('leases', 'deposit_status')
    op.drop_column('leases', 'security_deposit')
    op.drop_column('leases', 'first_payment_due_date')
    op.drop_column('leases', 'payment_frequency')
    op.drop_column('leases', 'annual_rent')
    op.drop_column('leases', 'tenant_id')
    op.drop_column('leases', 'property_id')
