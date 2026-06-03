"""Add feedback column to site_visits for post-visit client feedback.

site_visits is created via Base.metadata.create_all at app startup, not via a
migration. This migration ensures the table exists before adding the column,
so it works on a fresh database.

Revision ID: 0041_site_visit_feedback
Revises: 0040_crm_payments
Create Date: 2026-06-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0041_site_visit_feedback'
down_revision = '0040_crm_payments'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'site_visits' not in inspector.get_table_names():
        op.create_table('site_visits',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('visit_id', sa.String(20), nullable=False),
            sa.Column('lead_id', sa.Integer(), nullable=False),
            sa.Column('property_id', sa.Integer(), nullable=True),
            sa.Column('dealer_id', sa.Integer(), nullable=True),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('time', sa.String(10), nullable=True),
            sa.Column('sv_status', sa.String(20), nullable=False, server_default='scheduled'),
            sa.Column('remarks', sa.Text(), nullable=True),
            sa.Column('feedback', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('visit_id'),
            sa.ForeignKeyConstraint(['lead_id'], ['leads.id'], ),
            sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ),
            sa.ForeignKeyConstraint(['dealer_id'], ['dealers.id'], ),
        )
        return
    columns = [c['name'] for c in inspector.get_columns('site_visits')]
    if 'feedback' not in columns:
        op.add_column('site_visits', sa.Column('feedback', sa.Text(), nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'site_visits' not in inspector.get_table_names():
        return
    columns = [c['name'] for c in inspector.get_columns('site_visits')]
    if 'feedback' in columns:
        op.drop_column('site_visits', 'feedback')
