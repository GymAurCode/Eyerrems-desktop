"""Add currency_code to companies table.

Revision ID: 0025_currency_settings
Revises: 0024_reports_module
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "0025_currency_settings"
down_revision = "0024_reports_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add currency_code column with default PKR (backward compatible)
    op.add_column(
        "companies",
        sa.Column(
            "currency_code",
            sa.String(10),
            nullable=False,
            server_default="PKR",
        ),
    )


def downgrade() -> None:
    op.drop_column("companies", "currency_code")
