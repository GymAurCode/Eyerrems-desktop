"""Add whatsapp column to leads and clients for CRM.

Revision ID: 0042_add_whatsapp_columns
Revises: 0041_site_visit_feedback
Create Date: 2026-06-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0042_add_whatsapp_columns'
down_revision = '0041_site_visit_feedback'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    leads_cols = [c['name'] for c in inspector.get_columns('leads')]
    if 'whatsapp' not in leads_cols:
        op.add_column('leads', sa.Column('whatsapp', sa.String(50), nullable=True))

    clients_cols = [c['name'] for c in inspector.get_columns('clients')]
    if 'whatsapp' not in clients_cols:
        op.add_column('clients', sa.Column('whatsapp', sa.String(50), nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    leads_cols = [c['name'] for c in inspector.get_columns('leads')]
    if 'whatsapp' in leads_cols:
        op.drop_column('leads', 'whatsapp')

    clients_cols = [c['name'] for c in inspector.get_columns('clients')]
    if 'whatsapp' in clients_cols:
        op.drop_column('clients', 'whatsapp')
