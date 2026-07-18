"""Add Vendor Model - ERP Vendor/Supplier Management

Revision ID: 0062_add_vendor_model
Revises: 0061_enhanced_expense_model
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "0062_add_vendor_model"
down_revision = "0061_enhanced_expense_model"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def _index_exists(table, index):
    conn = op.get_bind()
    indexes = [i["name"] for i in inspect(conn).get_indexes(table)]
    return index in indexes


def upgrade():
    if not inspect(op.get_bind()).has_table("vendors"):
        op.create_table(
            "vendors",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("vendor_code", sa.String(50), nullable=True, unique=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("contact_person", sa.String(255), nullable=True),
            sa.Column("phone", sa.String(50), nullable=True),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("address", sa.Text(), nullable=True),
            sa.Column("ntn", sa.String(50), nullable=True),
            sa.Column("strn", sa.String(50), nullable=True),
            sa.Column("payment_terms", sa.String(50), nullable=True),
            sa.Column("credit_limit", sa.Numeric(14, 2), nullable=True),
            sa.Column("outstanding_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=text("true")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("deleted_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=text("now()")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=text("now()")),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True),
        )
        op.create_index("ix_vendors_vendor_code", "vendors", ["vendor_code"])
        op.create_index("ix_vendors_name", "vendors", ["name"])
        op.create_index("ix_vendors_company_id", "vendors", ["company_id"])


def downgrade():
    if inspect(op.get_bind()).has_table("vendors"):
        op.drop_table("vendors")
