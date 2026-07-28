"""Add rbac_user_approvals table and company settings for auto-approve.

Revision ID: 0074_rbac_user_approvals
Revises: 0073_add_parent_module_id
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0074_rbac_user_approvals"
down_revision = "0073_add_parent_module_id"
branch_labels = None
depends_on = None


def _has_column(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def _has_index(table, index_name):
    conn = op.get_bind()
    insp = inspect(conn)
    indexes = [ix["name"] for ix in insp.get_indexes(table)]
    return index_name in indexes


def _has_table(name):
    return inspect(op.get_bind()).has_table(name)


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)

    # ── rbac_user_approvals ───────────────────────────────────────────────────
    if not inspector.has_table("rbac_user_approvals"):
        op.create_table(
            "rbac_user_approvals",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("action", sa.String(20), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("old_roles", sa.Text(), nullable=True),
            sa.Column("new_roles", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _has_index("rbac_user_approvals", "ix_rbac_user_approvals_user_id"):
        op.create_index(op.f("ix_rbac_user_approvals_user_id"), "rbac_user_approvals", ["user_id"])

    # ── Company settings: auto_approve_admin_created ──────────────────────────
    if not _has_column("companies", "auto_approve_admin_created"):
        op.add_column("companies", sa.Column("auto_approve_admin_created", sa.Boolean(), server_default="false", nullable=False))

    # ── rbac3_modules: ensure description column exists ───────────────────────
    if not _has_column("rbac3_modules", "description"):
        op.add_column("rbac3_modules", sa.Column("description", sa.Text(), nullable=True))

    # ── rbac3_modules: ensure parent_module_id exists ─────────────────────────
    if not _has_column("rbac3_modules", "parent_module_id"):
        op.add_column("rbac3_modules", sa.Column("parent_module_id", sa.Integer(), sa.ForeignKey("rbac3_modules.id", ondelete="SET NULL"), nullable=True))


def downgrade():
    if _has_table("rbac_user_approvals"):
        op.drop_table("rbac_user_approvals")
    if _has_column("companies", "auto_approve_admin_created"):
        op.drop_column("companies", "auto_approve_admin_created")
