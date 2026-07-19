"""Add property upgrade fields: ownership, pricing, COA linkage, document vault.

Revision ID: 0037_property_upgrade_fields
Revises: 0036_add_company_lifecycle_fields
Create Date: 2026-06-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0037_property_upgrade_fields'
down_revision = '0036_add_company_lifecycle_fields'
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    if not _column_exists("properties", "listing_status"):
        op.add_column('properties', sa.Column('listing_status', sa.String(30), nullable=True, server_default='available'))
    if not _column_exists("properties", "operational_status"):
        op.add_column('properties', sa.Column('operational_status', sa.String(30), nullable=True, server_default='active'))
    if not _column_exists("properties", "size_unit"):
        op.add_column('properties', sa.Column('size_unit', sa.String(10), nullable=True))
    if not _column_exists("properties", "owner_name"):
        op.add_column('properties', sa.Column('owner_name', sa.String(255), nullable=True))
    if not _column_exists("properties", "owner_type"):
        op.add_column('properties', sa.Column('owner_type', sa.String(20), nullable=True))
    if not _column_exists("properties", "cnic_ntn"):
        op.add_column('properties', sa.Column('cnic_ntn', sa.String(50), nullable=True))
    if not _column_exists("properties", "ownership_pct"):
        op.add_column('properties', sa.Column('ownership_pct', sa.Numeric(5, 2), nullable=True, server_default='100'))
    if not _column_exists("properties", "title_deed_number"):
        op.add_column('properties', sa.Column('title_deed_number', sa.String(100), nullable=True))
    if not _column_exists("properties", "registration_date"):
        op.add_column('properties', sa.Column('registration_date', sa.Date(), nullable=True))
    if not _column_exists("properties", "mortgage_lien"):
        op.add_column('properties', sa.Column('mortgage_lien', sa.Boolean(), nullable=True, server_default='false'))
    if not _column_exists("properties", "lender_name"):
        op.add_column('properties', sa.Column('lender_name', sa.String(255), nullable=True))
    if not _column_exists("properties", "outstanding_amount"):
        op.add_column('properties', sa.Column('outstanding_amount', sa.Numeric(14, 2), nullable=True))
    if not _column_exists("properties", "regulatory_authority"):
        op.add_column('properties', sa.Column('regulatory_authority', sa.String(30), nullable=True))
    if not _column_exists("properties", "purchase_price"):
        op.add_column('properties', sa.Column('purchase_price', sa.Numeric(14, 2), nullable=True))
    if not _column_exists("properties", "current_market_value"):
        op.add_column('properties', sa.Column('current_market_value', sa.Numeric(14, 2), nullable=True))
    if not _column_exists("properties", "asking_price"):
        op.add_column('properties', sa.Column('asking_price', sa.Numeric(14, 2), nullable=True))
    if not _column_exists("properties", "commission_pct"):
        op.add_column('properties', sa.Column('commission_pct', sa.Numeric(5, 2), nullable=True))
    if not _column_exists("properties", "income_gl_account_id"):
        op.add_column('properties', sa.Column('income_gl_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True))
    if not _column_exists("properties", "expense_gl_account_id"):
        op.add_column('properties', sa.Column('expense_gl_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True))
    if not _column_exists("properties", "asset_gl_account_id"):
        op.add_column('properties', sa.Column('asset_gl_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True))
    if not _column_exists("properties", "cost_centre"):
        op.add_column('properties', sa.Column('cost_centre', sa.String(100), nullable=True))

    # ── Property Attachments (Document Vault) ──────────────────────────────
    if not _column_exists("property_attachments", "document_type"):
        op.add_column('property_attachments', sa.Column('document_type', sa.String(50), nullable=True))
    if not _column_exists("property_attachments", "document_name"):
        op.add_column('property_attachments', sa.Column('document_name', sa.String(255), nullable=True))
    if not _column_exists("property_attachments", "expiry_date"):
        op.add_column('property_attachments', sa.Column('expiry_date', sa.Date(), nullable=True))
    if not _column_exists("property_attachments", "notes"):
        op.add_column('property_attachments', sa.Column('notes', sa.Text(), nullable=True))
    if not _column_exists("property_attachments", "uploaded_by"):
        op.add_column('property_attachments', sa.Column('uploaded_by', sa.String(120), nullable=True))


def downgrade():
    # ── Property Attachments ───────────────────────────────────────────────
    op.drop_column('property_attachments', 'uploaded_by')
    op.drop_column('property_attachments', 'notes')
    op.drop_column('property_attachments', 'expiry_date')
    op.drop_column('property_attachments', 'document_name')
    op.drop_column('property_attachments', 'document_type')

    # ── Properties ─────────────────────────────────────────────────────────
    op.drop_column('properties', 'cost_centre')
    op.drop_column('properties', 'asset_gl_account_id')
    op.drop_column('properties', 'expense_gl_account_id')
    op.drop_column('properties', 'income_gl_account_id')
    op.drop_column('properties', 'commission_pct')
    op.drop_column('properties', 'asking_price')
    op.drop_column('properties', 'current_market_value')
    op.drop_column('properties', 'purchase_price')
    op.drop_column('properties', 'regulatory_authority')
    op.drop_column('properties', 'outstanding_amount')
    op.drop_column('properties', 'lender_name')
    op.drop_column('properties', 'mortgage_lien')
    op.drop_column('properties', 'registration_date')
    op.drop_column('properties', 'title_deed_number')
    op.drop_column('properties', 'ownership_pct')
    op.drop_column('properties', 'cnic_ntn')
    op.drop_column('properties', 'owner_type')
    op.drop_column('properties', 'owner_name')
    op.drop_column('properties', 'size_unit')
    op.drop_column('properties', 'operational_status')
    op.drop_column('properties', 'listing_status')
