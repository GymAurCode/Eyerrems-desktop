"""Add exit_date column to employees table

Revision ID: 0056_add_exit_date_to_employees
Revises: 0055_add_shift_template_id_to_employees
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0056_add_exit_date_to_employees"
down_revision = "0055_add_shift_template_id_to_employees"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employees", sa.Column("exit_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("employees", "exit_date")
