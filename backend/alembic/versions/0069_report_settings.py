"""Add report_settings table for centralized report configuration.

Revision ID: 0069_report_settings
Revises: 0068_comprehensive_schema_sync
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0069_report_settings"
down_revision = "0068_comprehensive_schema_sync"
branch_labels = None
depends_on = None


def _table_exists(table):
    conn = op.get_bind()
    return inspect(conn).has_table(table)


def upgrade():
    if not _table_exists("report_settings"):
        op.create_table(
            "report_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("company_name", sa.String(255), nullable=False, server_default=""),
            sa.Column("tagline", sa.String(255), nullable=True, server_default=""),
            sa.Column("address", sa.Text(), nullable=True, server_default=""),
            sa.Column("phone", sa.String(60), nullable=True, server_default=""),
            sa.Column("whatsapp", sa.String(60), nullable=True, server_default=""),
            sa.Column("email", sa.String(255), nullable=True, server_default=""),
            sa.Column("uan_helpline", sa.String(60), nullable=True, server_default=""),
            sa.Column("logo_url", sa.String(512), nullable=True, server_default=""),
            sa.Column("currency_symbol", sa.String(10), nullable=False, server_default="PKR"),
            sa.Column("currency_code", sa.String(10), nullable=False, server_default="PKR"),
            sa.Column("thousands_separator", sa.String(2), nullable=False, server_default=","),
            sa.Column("decimal_places", sa.Integer(), nullable=False, server_default="2"),
            sa.Column("default_paper_size", sa.String(10), nullable=False, server_default="A4"),
            sa.Column("default_orientation", sa.String(10), nullable=False, server_default="portrait"),
            sa.Column("show_seal_config", sa.Text(), nullable=True),
            sa.Column("footer_note", sa.Text(), nullable=True, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade():
    if _table_exists("report_settings"):
        op.drop_table("report_settings")
