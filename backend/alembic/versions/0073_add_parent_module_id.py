"""Add parent_module_id and description to rbac3_modules for tab support.

Also adds is_active to rbac3_actions for consistency.

Revision ID: 0073_add_parent_module_id
Revises: 0072_add_company_master_id
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0073_add_parent_module_id"
down_revision = "0072_add_company_master_id"
branch_labels = None
depends_on = None


def _has_column(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    if not _has_column("rbac3_modules", "parent_module_id"):
        op.add_column(
            "rbac3_modules",
            sa.Column("parent_module_id", sa.Integer(), sa.ForeignKey("rbac3_modules.id", ondelete="SET NULL"), nullable=True),
        )
        op.create_index(op.f("ix_rbac3_modules_parent_module_id"), "rbac3_modules", ["parent_module_id"])

    if not _has_column("rbac3_modules", "description"):
        op.add_column(
            "rbac3_modules",
            sa.Column("description", sa.Text(), nullable=True),
        )


def downgrade():
    if _has_column("rbac3_modules", "parent_module_id"):
        op.drop_index(op.f("ix_rbac3_modules_parent_module_id"), table_name="rbac3_modules")
        op.drop_column("rbac3_modules", "parent_module_id")
    if _has_column("rbac3_modules", "description"):
        op.drop_column("rbac3_modules", "description")
