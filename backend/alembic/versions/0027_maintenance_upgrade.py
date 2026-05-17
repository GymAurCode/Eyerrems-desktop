"""Maintenance module upgrade — status workflow, categories, assignments, ledger integration.

Revision ID: 0027_maintenance_upgrade
Revises: 0026_ai_intelligence_module
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0027_maintenance_upgrade"
down_revision = "0026_ai_intelligence_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend maintenance_records ────────────────────────────────────────────
    op.add_column("maintenance_records", sa.Column("status",         sa.String(30),  nullable=False, server_default="pending"))
    op.add_column("maintenance_records", sa.Column("priority",       sa.String(20),  nullable=False, server_default="normal"))
    op.add_column("maintenance_records", sa.Column("category",       sa.String(50),  nullable=False, server_default="repair"))
    op.add_column("maintenance_records", sa.Column("title",          sa.String(255), nullable=True))
    op.add_column("maintenance_records", sa.Column("estimated_cost", sa.Numeric(12, 2), nullable=True))
    op.add_column("maintenance_records", sa.Column("actual_cost",    sa.Numeric(12, 2), nullable=True))
    op.add_column("maintenance_records", sa.Column("notes",          sa.Text(),      nullable=True))
    op.add_column("maintenance_records", sa.Column("assigned_to",    sa.Integer(),   nullable=True))
    op.add_column("maintenance_records", sa.Column("vendor_name",    sa.String(120), nullable=True))
    op.add_column("maintenance_records", sa.Column("vendor_phone",   sa.String(50),  nullable=True))
    op.add_column("maintenance_records", sa.Column("completed_date", sa.Date(),      nullable=True))
    op.add_column("maintenance_records", sa.Column("expense_posted", sa.Boolean(),   nullable=False, server_default="false"))
    op.add_column("maintenance_records", sa.Column("ledger_posted",  sa.Boolean(),   nullable=False, server_default="false"))
    op.add_column("maintenance_records", sa.Column("created_by",     sa.Integer(),   nullable=True))
    op.add_column("maintenance_records", sa.Column("updated_at",     sa.DateTime(),  nullable=True))

    op.create_foreign_key("fk_maint_assigned_to", "maintenance_records", "employees", ["assigned_to"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_maint_created_by",  "maintenance_records", "users",     ["created_by"],  ["id"], ondelete="SET NULL")

    op.create_index("ix_maintenance_status",   "maintenance_records", ["status"])
    op.create_index("ix_maintenance_priority", "maintenance_records", ["priority"])
    op.create_index("ix_maintenance_category", "maintenance_records", ["category"])

    # ── maintenance_activity_logs ─────────────────────────────────────────────
    op.create_table(
        "maintenance_activity_logs",
        sa.Column("id",             sa.Integer(),   nullable=False),
        sa.Column("maintenance_id", sa.Integer(),   nullable=False),
        sa.Column("user_id",        sa.Integer(),   nullable=True),
        sa.Column("action",         sa.String(80),  nullable=False),
        sa.Column("old_status",     sa.String(30),  nullable=True),
        sa.Column("new_status",     sa.String(30),  nullable=True),
        sa.Column("note",           sa.Text(),      nullable=True),
        sa.Column("created_at",     sa.DateTime(),  nullable=False),
        sa.ForeignKeyConstraint(["maintenance_id"], ["maintenance_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"],        ["users.id"],               ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_maint_activity_maintenance_id", "maintenance_activity_logs", ["maintenance_id"])
    op.create_index("ix_maint_activity_created_at",     "maintenance_activity_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("maintenance_activity_logs")

    op.drop_index("ix_maintenance_category", "maintenance_records")
    op.drop_index("ix_maintenance_priority", "maintenance_records")
    op.drop_index("ix_maintenance_status",   "maintenance_records")

    for col in ["updated_at", "created_by", "ledger_posted", "expense_posted",
                "completed_date", "vendor_phone", "vendor_name", "assigned_to",
                "notes", "actual_cost", "estimated_cost", "title",
                "category", "priority", "status"]:
        op.drop_column("maintenance_records", col)
