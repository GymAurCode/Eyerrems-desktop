"""Create shift_templates table

Revision ID: 0054a_create_shift_templates
Revises: 0054_add_branch_id_to_holidays
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0054a_create_shift_templates"
down_revision: Union[str, None] = "0054_add_branch_id_to_holidays"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    if not inspect(conn).has_table("shift_templates"):
        op.create_table(
            "shift_templates",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("shift_name", sa.String(255), nullable=False, unique=True),
            sa.Column("start_time", sa.String(10), nullable=False),
            sa.Column("end_time", sa.String(10), nullable=False),
            sa.Column("break_duration", sa.Integer(), nullable=False, server_default=sa.text("60")),
            sa.Column("grace_period_minutes", sa.Integer(), nullable=False, server_default=sa.text("10")),
            sa.Column("half_day_threshold_hours", sa.Numeric(4, 1), nullable=False, server_default=sa.text("4.0")),
            sa.Column("full_day_required_hours", sa.Numeric(4, 1), nullable=False, server_default=sa.text("8.0")),
            sa.Column("weekly_off_days", sa.String(50), nullable=True),
            sa.Column("is_flexible", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_shift_templates_shift_name", "shift_templates", ["shift_name"])


def downgrade() -> None:
    conn = op.get_bind()
    if inspect(conn).has_table("shift_templates"):
        op.drop_index("ix_shift_templates_shift_name", table_name="shift_templates")
        op.drop_table("shift_templates")
