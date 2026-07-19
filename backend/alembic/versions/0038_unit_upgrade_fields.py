"""Add unit upgrade fields: unit_type, area, furnishing, property link, tenant info.

Revision ID: 0038_unit_upgrade_fields
Revises: 0037_property_upgrade_fields
Create Date: 2026-06-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0038_unit_upgrade_fields'
down_revision = '0037_property_upgrade_fields'
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    if not _column_exists("units", "unit_type"):
        op.add_column('units', sa.Column('unit_type', sa.String(50), nullable=True))
    if not _column_exists("units", "area"):
        op.add_column('units', sa.Column('area', sa.Numeric(12, 2), nullable=True))
    if not _column_exists("units", "area_unit"):
        op.add_column('units', sa.Column('area_unit', sa.String(10), nullable=True))
    if not _column_exists("units", "furnishing_status"):
        op.add_column('units', sa.Column('furnishing_status', sa.String(20), nullable=True))
    if not _column_exists("units", "security_deposit"):
        op.add_column('units', sa.Column('security_deposit', sa.Numeric(12, 2), nullable=True))
    if not _column_exists("units", "notes"):
        op.add_column('units', sa.Column('notes', sa.Text(), nullable=True))
    if not _column_exists("units", "floor_number"):
        op.add_column('units', sa.Column('floor_number', sa.Integer(), nullable=True))
    if not _column_exists("units", "property_id"):
        op.add_column('units', sa.Column('property_id', sa.Integer(), sa.ForeignKey('properties.id'), nullable=True))
    if not _column_exists("units", "current_tenant_name"):
        op.add_column('units', sa.Column('current_tenant_name', sa.String(120), nullable=True))
    if not _column_exists("units", "lease_end_date"):
        op.add_column('units', sa.Column('lease_end_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('units', 'lease_end_date')
    op.drop_column('units', 'current_tenant_name')
    op.drop_column('units', 'property_id')
    op.drop_column('units', 'floor_number')
    op.drop_column('units', 'notes')
    op.drop_column('units', 'security_deposit')
    op.drop_column('units', 'furnishing_status')
    op.drop_column('units', 'area_unit')
    op.drop_column('units', 'area')
    op.drop_column('units', 'unit_type')
