"""booking_financial_refactor

Move installment plans from deals to bookings.
Add full financial fields to bookings.
Refactor deal to negotiation-only.

Revision ID: 0023
Revises: 0022_booking_module
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0023_booking_financial_refactor'
down_revision = '0022_booking_module'
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. Add financial columns to bookings ──────────────────────────────────
    op.add_column('bookings', sa.Column('deal_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_bookings_deal_id', 'bookings', 'deals', ['deal_id'], ['id']
    )
    op.add_column('bookings', sa.Column('final_price',
        sa.Numeric(14, 2), nullable=True))
    op.add_column('bookings', sa.Column('discount',
        sa.Numeric(14, 2), nullable=False, server_default='0'))
    op.add_column('bookings', sa.Column('down_payment',
        sa.Numeric(14, 2), nullable=False, server_default='0'))
    op.add_column('bookings', sa.Column('down_payment_status',
        sa.String(20), nullable=False, server_default='pending'))
    op.add_column('bookings', sa.Column('processing_fee',
        sa.Numeric(14, 2), nullable=False, server_default='0'))
    op.add_column('bookings', sa.Column('possession_charges',
        sa.Numeric(14, 2), nullable=False, server_default='0'))
    op.add_column('bookings', sa.Column('development_charges',
        sa.Numeric(14, 2), nullable=False, server_default='0'))
    op.add_column('bookings', sa.Column('custom_charges',
        sa.Text(), nullable=True))
    op.add_column('bookings', sa.Column('active_at',
        sa.DateTime(), nullable=True))
    op.add_column('bookings', sa.Column('completed_at',
        sa.DateTime(), nullable=True))
    op.add_column('bookings', sa.Column('refunded_at',
        sa.DateTime(), nullable=True))
    op.create_index('ix_bookings_deal_id', 'bookings', ['deal_id'])

    # ── 2. Add negotiation columns to deals ───────────────────────────────────
    op.add_column('deals', sa.Column('proposed_discount',
        sa.Numeric(14, 2), nullable=True))
    op.add_column('deals', sa.Column('proposed_installment_type',
        sa.String(30), nullable=True))
    op.add_column('deals', sa.Column('proposed_installment_count',
        sa.Integer(), nullable=True))
    op.add_column('deals', sa.Column('negotiation_notes',
        sa.Text(), nullable=True))

    # ── 3. Migrate installment_plans: add booking_id column ───────────────────
    op.add_column('installment_plans', sa.Column('booking_id',
        sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_installment_plans_booking_id',
        'installment_plans', 'bookings',
        ['booking_id'], ['id']
    )
    op.create_index('ix_installment_plans_booking_id',
                    'installment_plans', ['booking_id'])

    # NOTE: Run the data migration script BEFORE making booking_id NOT NULL:
    #   python -m app.scripts.migrate_installments_to_bookings
    # After that script completes, run:
    #   ALTER TABLE installment_plans ALTER COLUMN booking_id SET NOT NULL;
    #   ALTER TABLE installment_plans DROP COLUMN deal_id;  (optional, after verification)


def downgrade():
    op.drop_index('ix_installment_plans_booking_id',
                  table_name='installment_plans')
    op.drop_constraint('fk_installment_plans_booking_id',
                       'installment_plans', type_='foreignkey')
    op.drop_column('installment_plans', 'booking_id')

    op.drop_column('deals', 'negotiation_notes')
    op.drop_column('deals', 'proposed_installment_count')
    op.drop_column('deals', 'proposed_installment_type')
    op.drop_column('deals', 'proposed_discount')

    op.drop_index('ix_bookings_deal_id', table_name='bookings')
    op.drop_constraint('fk_bookings_deal_id', 'bookings', type_='foreignkey')
    op.drop_column('bookings', 'refunded_at')
    op.drop_column('bookings', 'completed_at')
    op.drop_column('bookings', 'active_at')
    op.drop_column('bookings', 'custom_charges')
    op.drop_column('bookings', 'development_charges')
    op.drop_column('bookings', 'possession_charges')
    op.drop_column('bookings', 'processing_fee')
    op.drop_column('bookings', 'down_payment_status')
    op.drop_column('bookings', 'down_payment')
    op.drop_column('bookings', 'discount')
    op.drop_column('bookings', 'final_price')
    op.drop_column('bookings', 'deal_id')
