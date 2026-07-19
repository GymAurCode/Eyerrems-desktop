"""Create crm_payments table for standalone CRM payment records.

Revision ID: 0040_crm_payments
Revises: 0039_lease_upgrade_fields
Create Date: 2026-06-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0040_crm_payments'
down_revision = '0039_lease_upgrade_fields'
branch_labels = None
depends_on = None


def upgrade():
    if inspect(op.get_bind()).has_table("crm_payments"):
        return
    op.create_table(
        'crm_payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('payment_id', sa.String(20), unique=True, nullable=False),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False, index=True),
        sa.Column('deal_id', sa.Integer(), sa.ForeignKey('deals.id'), nullable=True),
        sa.Column('booking_id', sa.Integer(), sa.ForeignKey('bookings.id'), nullable=True),
        sa.Column('installment_id', sa.Integer(), sa.ForeignKey('installments.id'), nullable=True),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('payment_date', sa.DateTime(), nullable=False),
        sa.Column('payment_method', sa.String(30), nullable=False, server_default='cash'),
        sa.Column('receipt_number', sa.String(100), nullable=True),
        sa.Column('reference', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('crm_payments')
