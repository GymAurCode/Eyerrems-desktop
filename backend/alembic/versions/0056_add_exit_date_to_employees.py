"""Add exit_date column to employees table

Revision ID: 0056_add_exit_date_to_employees
Revises: 0055_add_shift_template_id_to_employees
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0056_add_exit_date_to_employees"
down_revision = "0055_add_shift_template_id_to_employees"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade() -> None:
    if not _column_exists("employees", "exit_date"):
        op.add_column("employees", sa.Column("exit_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("employees", "exit_date")
