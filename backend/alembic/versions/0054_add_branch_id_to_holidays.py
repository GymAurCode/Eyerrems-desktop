"""Add branch_id column to holidays table

Revision ID: 0054_add_branch_id_to_holidays
Revises: 0053_construction_erp_upgrade
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0054_add_branch_id_to_holidays"
down_revision = "0053_construction_erp_upgrade"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("holidays", sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id"), nullable=True))
    op.create_index("ix_holidays_branch_id", "holidays", ["branch_id"])


def downgrade() -> None:
    op.drop_index("ix_holidays_branch_id", table_name="holidays")
    op.drop_column("holidays", "branch_id")
