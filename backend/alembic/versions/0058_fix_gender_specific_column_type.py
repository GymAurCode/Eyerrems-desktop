"""Fix gender_specific column type in leave_types (Boolean -> String(20))

Revision ID: 0058_fix_gender_specific_column_type
Revises: 0057_add_missing_hr_crm_columns
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0058_fix_gender_specific_column_type"
down_revision = "0057_add_missing_hr_crm_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("leave_types", "gender_specific")
    op.add_column("leave_types", sa.Column("gender_specific", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("leave_types", "gender_specific")
    op.add_column("leave_types", sa.Column("gender_specific", sa.Boolean(), nullable=False, server_default=sa.text("false")))
