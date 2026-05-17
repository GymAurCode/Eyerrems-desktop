"""booking_module

Revision ID: 0022
Revises: 0021
Create Date: 2026-05-07 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0022_booking_module'
down_revision = '0021_town_module'
branch_labels = None
depends_on = None


def upgrade():
    # Create bookings table
    op.create_table(
        'bookings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('booking_id', sa.String(length=20), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=True),
        sa.Column('unit_id', sa.Integer(), nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('assigned_dealer_id', sa.Integer(), nullable=True),
        sa.Column('assigned_staff_id', sa.Integer(), nullable=True),
        sa.Column('nominee_name', sa.String(length=120), nullable=True),
        sa.Column('nominee_phone', sa.String(length=50), nullable=True),
        sa.Column('nominee_cnic', sa.String(length=20), nullable=True),
        sa.Column('booking_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('property_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('booking_date', sa.DateTime(), nullable=False),
        sa.Column('expiry_date', sa.DateTime(), nullable=False),
        sa.Column('holding_days', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.Column('expired_at', sa.DateTime(), nullable=True),
        sa.Column('converted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ),
        sa.ForeignKeyConstraint(['unit_id'], ['units.id'], ),
        sa.ForeignKeyConstraint(['assigned_dealer_id'], ['dealers.id'], ),
        sa.ForeignKeyConstraint(['assigned_staff_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bookings_booking_id'), 'bookings', ['booking_id'], unique=True)
    op.create_index(op.f('ix_bookings_client_id'), 'bookings', ['client_id'], unique=False)
    op.create_index(op.f('ix_bookings_property_id'), 'bookings', ['property_id'], unique=False)
    op.create_index(op.f('ix_bookings_unit_id'), 'bookings', ['unit_id'], unique=False)
    op.create_index(op.f('ix_bookings_status'), 'bookings', ['status'], unique=False)

    # Create booking_logs table
    op.create_table(
        'booking_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('booking_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('old_value', sa.String(length=255), nullable=True),
        sa.Column('new_value', sa.String(length=255), nullable=True),
        sa.Column('performed_by_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
        sa.ForeignKeyConstraint(['performed_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_booking_logs_booking_id'), 'booking_logs', ['booking_id'], unique=False)

    # Create booking_attachments table
    op.create_table(
        'booking_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('booking_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=512), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('booking_attachments')
    op.drop_index(op.f('ix_booking_logs_booking_id'), table_name='booking_logs')
    op.drop_table('booking_logs')
    op.drop_index(op.f('ix_bookings_status'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_unit_id'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_property_id'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_client_id'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_booking_id'), table_name='bookings')
    op.drop_table('bookings')
