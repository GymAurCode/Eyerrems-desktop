"""Add company-scoped roles and role_permissions tables for new RBAC v4.

Tables:
  - roles (company-scoped per-tenant)
  - role_permissions (module/tab-level CRUD per role)

Revision ID: 0075_rbac_v4_company_scoped
Revises: 0074_rbac_user_approvals
Create Date: 2026-07-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0075_rbac_v4_company_scoped"
down_revision = "0074_rbac_user_approvals"
branch_labels = None
depends_on = None


def _has_column(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)

    # ── roles ─────────────────────────────────────────────────────────────────
    if not inspector.has_table("roles"):
        op.create_table(
            "roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_system_role", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_roles_id"), "roles", ["id"])
        op.create_index(op.f("ix_roles_company_id"), "roles", ["company_id"])

    # ── role_permissions ──────────────────────────────────────────────────────
    if not inspector.has_table("role_permissions"):
        op.create_table(
            "role_permissions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("module_key", sa.String(50), nullable=False, index=True),
            sa.Column("tab_key", sa.String(100), nullable=False),
            sa.Column("can_view", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("can_add", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("can_edit", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("can_delete", sa.Boolean(), server_default="false", nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("role_id", "module_key", "tab_key", name="uq_role_module_tab"),
        )
        op.create_index(op.f("ix_role_permissions_id"), "role_permissions", ["id"])
        op.create_index(op.f("ix_role_permissions_role_id"), "role_permissions", ["role_id"])
        op.create_index(op.f("ix_role_permissions_module_key"), "role_permissions", ["module_key"])

    # ── role_id on users (if not already present) ─────────────────────────────
    if not _has_column("users", "role_id"):
        op.add_column("users", sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True))
        op.create_index("ix_users_role_id", "users", ["role_id"])


def downgrade():
    if _has_column("users", "role_id"):
        op.drop_index("ix_users_role_id", table_name="users")
        op.drop_column("users", "role_id")
    op.drop_table("role_permissions")
    op.drop_table("roles")
