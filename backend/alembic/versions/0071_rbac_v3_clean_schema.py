"""Clean RBAC v3 schema — roles, modules, actions, and role_permissions.

Replaces the complex v1+rbag2 systems with a clean module+action permission model.
Tables created:
  - rbac3_roles
  - rbac3_modules
  - rbac3_actions
  - rbac3_role_permissions  (pivot: role_id, module_id, action_id)
  - rbac3_user_permissions  (user-level overrides)

Revision ID: 0071_rbac_v3_clean
Revises: 0070_rbac_v2_tables
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0071_rbac_v3_clean"
down_revision = "0070_rbac_v2_tables"
branch_labels = None
depends_on = None


def _table_exists(table):
    conn = op.get_bind()
    return inspect(conn).has_table(table)


def upgrade():
    # ── rbac3_roles ──────────────────────────────────────────────────────────
    if not _table_exists("rbac3_roles"):
        op.create_table(
            "rbac3_roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_super_admin", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("is_system_role", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name"),
        )
        op.create_index(op.f("ix_rbac3_roles_id"), "rbac3_roles", ["id"])
        op.create_index(op.f("ix_rbac3_roles_name"), "rbac3_roles", ["name"])

    # ── rbac3_modules ────────────────────────────────────────────────────────
    if not _table_exists("rbac3_modules"):
        op.create_table(
            "rbac3_modules",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("slug", sa.String(50), nullable=False),
            sa.Column("icon", sa.String(50), nullable=True),
            sa.Column("sort_order", sa.Integer(), server_default="0"),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("slug"),
        )
        op.create_index(op.f("ix_rbac3_modules_id"), "rbac3_modules", ["id"])
        op.create_index(op.f("ix_rbac3_modules_slug"), "rbac3_modules", ["slug"])

    # ── rbac3_actions ────────────────────────────────────────────────────────
    if not _table_exists("rbac3_actions"):
        op.create_table(
            "rbac3_actions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("action_key", sa.String(30), nullable=False),
            sa.Column("name", sa.String(50), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("sort_order", sa.Integer(), server_default="0"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("action_key"),
        )
        op.create_index(op.f("ix_rbac3_actions_id"), "rbac3_actions", ["id"])
        op.create_index(op.f("ix_rbac3_actions_action_key"), "rbac3_actions", ["action_key"])

    # ── rbac3_role_permissions (pivot) ───────────────────────────────────────
    if not _table_exists("rbac3_role_permissions"):
        op.create_table(
            "rbac3_role_permissions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("role_id", sa.Integer(), sa.ForeignKey("rbac3_roles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("module_id", sa.Integer(), sa.ForeignKey("rbac3_modules.id", ondelete="CASCADE"), nullable=False),
            sa.Column("action_id", sa.Integer(), sa.ForeignKey("rbac3_actions.id", ondelete="CASCADE"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("role_id", "module_id", "action_id", name="uq_rbac3_role_module_action"),
        )
        op.create_index(op.f("ix_rbac3_role_permissions_role_id"), "rbac3_role_permissions", ["role_id"])
        op.create_index(op.f("ix_rbac3_role_permissions_module_id"), "rbac3_role_permissions", ["module_id"])

    # ── rbac3_user_roles (user → role assignment) ────────────────────────────
    if not _table_exists("rbac3_user_roles"):
        op.create_table(
            "rbac3_user_roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("role_id", sa.Integer(), sa.ForeignKey("rbac3_roles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "role_id", name="uq_rbac3_user_role"),
        )
        op.create_index(op.f("ix_rbac3_user_roles_user_id"), "rbac3_user_roles", ["user_id"])

    # ── rbac3_user_permissions (user-level overrides) ────────────────────────
    if not _table_exists("rbac3_user_permissions"):
        op.create_table(
            "rbac3_user_permissions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("module_id", sa.Integer(), sa.ForeignKey("rbac3_modules.id", ondelete="CASCADE"), nullable=False),
            sa.Column("action_id", sa.Integer(), sa.ForeignKey("rbac3_actions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("is_granted", sa.Boolean(), server_default="true", nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "module_id", "action_id", name="uq_rbac3_user_module_action"),
        )
        op.create_index(op.f("ix_rbac3_user_permissions_user_id"), "rbac3_user_permissions", ["user_id"])


def downgrade():
    op.drop_table("rbac3_user_permissions")
    op.drop_table("rbac3_user_roles")
    op.drop_table("rbac3_role_permissions")
    op.drop_table("rbac3_actions")
    op.drop_table("rbac3_modules")
    op.drop_table("rbac3_roles")
