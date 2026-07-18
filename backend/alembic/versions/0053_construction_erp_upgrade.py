"""Full construction ERP schema upgrade — adds missing columns to existing tables.

Revision ID: 0053_construction_erp_upgrade
Revises: 0052_sync_sales_contacts_schema
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0053_construction_erp_upgrade"
down_revision = "0052_sync_sales_contacts_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ══════════════════════════════════════════════════════════════════════
    # ALTER existing tables — add missing columns
    # ══════════════════════════════════════════════════════════════════════

    # ── construction_projects ────────────────────────────────────────────
    op.add_column("construction_projects", sa.Column("project_code",  sa.String(50), nullable=True))
    op.add_column("construction_projects", sa.Column("current_phase", sa.String(50), nullable=False, server_default="planning"))
    op.alter_column("construction_projects", "end_date", new_column_name="expected_end")
    op.add_column("construction_projects", sa.Column("actual_end",    sa.Date(), nullable=True))
    op.add_column("construction_projects", sa.Column("is_deleted",    sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("construction_projects", sa.Column("deleted_at",    sa.DateTime(), nullable=True))
    op.create_index("ix_construction_projects_project_code", "construction_projects", ["project_code"])
    op.create_index("ix_construction_projects_current_phase", "construction_projects", ["current_phase"])

    # ── construction_phases ──────────────────────────────────────────────
    op.add_column("construction_phases", sa.Column("progress_pct", sa.Float(), nullable=False, server_default="0"))

    # ── construction_budgets ─────────────────────────────────────────────
    op.add_column("construction_budgets", sa.Column("status",          sa.String(30),  nullable=False, server_default="draft"))
    op.add_column("construction_budgets", sa.Column("machinery_cost",  sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("construction_budgets", sa.Column("contractor_cost", sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("construction_budgets", sa.Column("utility_cost",    sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("construction_budgets", sa.Column("transport_cost",  sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("construction_budgets", sa.Column("permit_fees",     sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("construction_budgets", sa.Column("govt_charges",    sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("construction_budgets", sa.Column("approved_by",     sa.Integer(), nullable=True))
    op.add_column("construction_budgets", sa.Column("approved_at",     sa.DateTime(), nullable=True))

    # ── construction_daily_progress ──────────────────────────────────────
    op.add_column("construction_daily_progress", sa.Column("task_id",      sa.Integer(), nullable=True))
    op.add_column("construction_daily_progress", sa.Column("accidents",    sa.Text(), nullable=True))
    op.add_column("construction_daily_progress", sa.Column("delay_reasons", sa.Text(), nullable=True))
    op.add_column("construction_daily_progress", sa.Column("site_notes",   sa.Text(), nullable=True))

    # ── construction_documents ───────────────────────────────────────────
    op.add_column("construction_documents", sa.Column("folder",  sa.String(100), nullable=True))
    op.add_column("construction_documents", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("construction_documents", sa.Column("tags",    sa.Text(), nullable=True))


def downgrade() -> None:
    # ── Drop added columns (reverse order) ───────────────────────────────
    op.drop_column("construction_documents", "tags")
    op.drop_column("construction_documents", "version")
    op.drop_column("construction_documents", "folder")

    op.drop_column("construction_daily_progress", "site_notes")
    op.drop_column("construction_daily_progress", "delay_reasons")
    op.drop_column("construction_daily_progress", "accidents")
    op.drop_column("construction_daily_progress", "task_id")

    op.drop_column("construction_budgets", "approved_at")
    op.drop_column("construction_budgets", "approved_by")
    op.drop_column("construction_budgets", "govt_charges")
    op.drop_column("construction_budgets", "permit_fees")
    op.drop_column("construction_budgets", "transport_cost")
    op.drop_column("construction_budgets", "utility_cost")
    op.drop_column("construction_budgets", "contractor_cost")
    op.drop_column("construction_budgets", "machinery_cost")
    op.drop_column("construction_budgets", "status")

    op.drop_column("construction_phases", "progress_pct")

    op.alter_column("construction_projects", "expected_end", new_column_name="end_date")
    op.drop_column("construction_projects", "deleted_at")
    op.drop_column("construction_projects", "is_deleted")
    op.drop_column("construction_projects", "actual_end")
    op.drop_column("construction_projects", "current_phase")
    op.drop_column("construction_projects", "project_code")
