"""Add RBAC v2 tables: modules, tabs, actions, role_tab_permissions, audit_logs.

Revision ID: 0070_rbac_v2_tables
Revises: 0069_report_settings
Create Date: 2026-07-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0070_rbac_v2_tables"
down_revision = "0069_report_settings"
branch_labels = None
depends_on = None


def _table_exists(table):
    conn = op.get_bind()
    return inspect(conn).has_table(table)


def upgrade():
    # ── rbac2_modules ──────────────────────────────────────────────────────────
    if not _table_exists("rbac2_modules"):
        op.create_table(
            "rbac2_modules",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("module_key", sa.String(50), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("icon", sa.String(50), nullable=True),
            sa.Column("sort_order", sa.Integer(), server_default="0"),
            sa.Column("is_active", sa.Boolean(), server_default="true"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("module_key"),
        )
        op.create_index(op.f("ix_rbac2_modules_module_key"), "rbac2_modules", ["module_key"])
        op.create_index(op.f("ix_rbac2_modules_id"), "rbac2_modules", ["id"])

    # ── rbac2_tabs ──────────────────────────────────────────────────────────────
    if not _table_exists("rbac2_tabs"):
        op.create_table(
            "rbac2_tabs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("module_id", sa.Integer(), sa.ForeignKey("rbac2_modules.id", ondelete="CASCADE"), nullable=False),
            sa.Column("tab_key", sa.String(100), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("sort_order", sa.Integer(), server_default="0"),
            sa.Column("is_active", sa.Boolean(), server_default="true"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_rbac2_tabs_id"), "rbac2_tabs", ["id"])
        op.create_index(op.f("ix_rbac2_tabs_module_id"), "rbac2_tabs", ["module_id"])

    # ── rbac2_actions ───────────────────────────────────────────────────────────
    if not _table_exists("rbac2_actions"):
        op.create_table(
            "rbac2_actions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("action_key", sa.String(50), nullable=False),
            sa.Column("name", sa.String(50), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("sort_order", sa.Integer(), server_default="0"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("action_key"),
        )
        op.create_index(op.f("ix_rbac2_actions_action_key"), "rbac2_actions", ["action_key"])
        op.create_index(op.f("ix_rbac2_actions_id"), "rbac2_actions", ["id"])

    # ── rbac2_roles ─────────────────────────────────────────────────────────────
    if not _table_exists("rbac2_roles"):
        op.create_table(
            "rbac2_roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_super_admin", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name"),
        )
        op.create_index(op.f("ix_rbac2_roles_id"), "rbac2_roles", ["id"])
        op.create_index(op.f("ix_rbac2_roles_name"), "rbac2_roles", ["name"])

    # ── rbac2_role_tab_permissions ──────────────────────────────────────────────
    if not _table_exists("rbac2_role_tab_permissions"):
        op.create_table(
            "rbac2_role_tab_permissions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("role_id", sa.Integer(), sa.ForeignKey("rbac2_roles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("tab_id", sa.Integer(), sa.ForeignKey("rbac2_tabs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("action_id", sa.Integer(), sa.ForeignKey("rbac2_actions.id", ondelete="CASCADE"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("role_id", "tab_id", "action_id", name="uq_role_tab_action"),
        )
        op.create_index(op.f("ix_rbac2_role_tab_permissions_id"), "rbac2_role_tab_permissions", ["id"])
        op.create_index(op.f("ix_rbac2_role_tab_permissions_role_id"), "rbac2_role_tab_permissions", ["role_id"])

    # ── rbac2_audit_logs ────────────────────────────────────────────────────────
    if not _table_exists("rbac2_audit_logs"):
        op.create_table(
            "rbac2_audit_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("role_id", sa.Integer(), sa.ForeignKey("rbac2_roles.id", ondelete="SET NULL"), nullable=True),
            sa.Column("role_name", sa.String(100), nullable=True),
            sa.Column("changed_by_user_id", sa.Integer(), nullable=True),
            sa.Column("changed_by_email", sa.String(255), nullable=True),
            sa.Column("change_type", sa.String(20), nullable=False),
            sa.Column("old_permissions", sa.JSON(), nullable=True),
            sa.Column("new_permissions", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_rbac2_audit_logs_id"), "rbac2_audit_logs", ["id"])
        op.create_index(op.f("ix_rbac2_audit_logs_created_at"), "rbac2_audit_logs", ["created_at"])


    # ── Add rbac2_role_id to users table (after rbac2_roles exists) ────────────
    conn = op.get_bind()
    inspector = inspect(conn)
    if "users" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("users")]
        if "rbac2_role_id" not in columns:
            op.add_column("users", sa.Column("rbac2_role_id", sa.Integer(), sa.ForeignKey("rbac2_roles.id", ondelete="SET NULL"), nullable=True))
            op.create_index("ix_users_rbac2_role_id", "users", ["rbac2_role_id"])


def downgrade():
    op.drop_index("ix_users_rbac2_role_id", table_name="users")
    op.drop_column("users", "rbac2_role_id")
    op.drop_table("rbac2_audit_logs")
    op.drop_table("rbac2_role_tab_permissions")
    op.drop_table("rbac2_roles")
    op.drop_table("rbac2_actions")
    op.drop_table("rbac2_tabs")
    op.drop_table("rbac2_modules")
