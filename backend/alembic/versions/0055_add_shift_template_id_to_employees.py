"""Add shift_template_id column to employees table

Revision ID: 0055_add_shift_template_id_to_employees
Revises: 0054_add_branch_id_to_holidays
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0055_add_shift_template_id_to_employees"
down_revision = "0054_add_branch_id_to_holidays"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns("employees")]
    if "shift_template_id" not in cols:
        op.add_column("employees", sa.Column("shift_template_id", sa.Integer(), sa.ForeignKey("shift_templates.id"), nullable=True))
    existing_indexes = {idx["name"] for idx in inspect(conn).get_indexes("employees")}
    if "ix_employees_shift_template_id" not in existing_indexes:
        op.create_index("ix_employees_shift_template_id", "employees", ["shift_template_id"])


def downgrade() -> None:
    op.drop_index("ix_employees_shift_template_id", table_name="employees")
    op.drop_column("employees", "shift_template_id")
