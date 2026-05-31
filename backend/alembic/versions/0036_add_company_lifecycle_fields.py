"""Add company lifecycle fields for master tenant management.

Revision ID: 0036_add_company_lifecycle_fields
Revises: 0035_merge_heads
Create Date: 2026-05-23 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0036_add_company_lifecycle_fields'
down_revision = '0035_merge_heads'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('companies', sa.Column('email', sa.String(length=255), nullable=True))
    op.add_column('companies', sa.Column('phone', sa.String(length=60), nullable=True))
    op.add_column('companies', sa.Column('expiry_date', sa.DateTime(), nullable=True))
    op.add_column('companies', sa.Column('db_path', sa.String(length=300), nullable=True))


def downgrade():
    op.drop_column('companies', 'db_path')
    op.drop_column('companies', 'expiry_date')
    op.drop_column('companies', 'phone')
    op.drop_column('companies', 'email')
