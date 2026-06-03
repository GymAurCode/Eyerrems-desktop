"""Add company lifecycle fields for master tenant management.

Revision ID: 0036_add_company_lifecycle_fields
Revises: 0035_merge_heads
Create Date: 2026-05-23 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0036_add_company_lifecycle_fields'
down_revision = '0035_merge_heads'
branch_labels = None
depends_on = None


def column_exists(table, column):
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table)]
    return column in columns


def upgrade():
    if not column_exists("companies", "email"):
        op.add_column('companies', sa.Column('email', sa.String(length=255), nullable=True))
    if not column_exists("companies", "phone"):
        op.add_column('companies', sa.Column('phone', sa.String(length=60), nullable=True))
    if not column_exists("companies", "expiry_date"):
        op.add_column('companies', sa.Column('expiry_date', sa.DateTime(), nullable=True))
    if not column_exists("companies", "db_path"):
        op.add_column('companies', sa.Column('db_path', sa.String(length=300), nullable=True))


def downgrade():
    if column_exists("companies", "db_path"):
        op.drop_column('companies', 'db_path')
    if column_exists("companies", "expiry_date"):
        op.drop_column('companies', 'expiry_date')
    if column_exists("companies", "phone"):
        op.drop_column('companies', 'phone')
    if column_exists("companies", "email"):
        op.drop_column('companies', 'email')
