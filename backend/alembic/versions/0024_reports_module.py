"""Reports module — report templates, saved reports, schedules, logs.

Revision ID: 0024_reports_module
Revises: 0023_booking_financial_refactor
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers
revision = "0024_reports_module"
down_revision = "0023_booking_financial_refactor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── report_templates ─────────────────────────────────────────────────────
    op.create_table(
        "report_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("template_key", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("default_filters", sa.JSON(), nullable=True),
        sa.Column("default_columns", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_key"),
    )
    op.create_index("ix_report_templates_template_key", "report_templates", ["template_key"])
    op.create_index("ix_report_templates_category", "report_templates", ["category"])

    # ── saved_reports ─────────────────────────────────────────────────────────
    op.create_table(
        "saved_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("template_key", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("filters", sa.JSON(), nullable=True),
        sa.Column("columns", sa.JSON(), nullable=True),
        sa.Column("sort_config", sa.JSON(), nullable=True),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_reports_company_id", "saved_reports", ["company_id"])
    op.create_index("ix_saved_reports_user_id", "saved_reports", ["user_id"])
    op.create_index("ix_saved_reports_template_key", "saved_reports", ["template_key"])

    # ── report_schedules ──────────────────────────────────────────────────────
    op.create_table(
        "report_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("saved_report_id", sa.Integer(), nullable=True),
        sa.Column("template_key", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("schedule_type", sa.String(20), nullable=False),
        sa.Column("schedule_config", sa.JSON(), nullable=True),
        sa.Column("delivery_method", sa.String(20), nullable=False, server_default="email"),
        sa.Column("recipients", sa.JSON(), nullable=True),
        sa.Column("format", sa.String(20), nullable=False, server_default="pdf"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["saved_report_id"], ["saved_reports.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── report_logs ───────────────────────────────────────────────────────────
    op.create_table(
        "report_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("template_key", sa.String(100), nullable=False),
        sa.Column("report_name", sa.String(255), nullable=False),
        sa.Column("format", sa.String(20), nullable=False),
        sa.Column("filters_applied", sa.JSON(), nullable=True),
        sa.Column("record_count", sa.Integer(), nullable=True),
        sa.Column("generation_time_ms", sa.Integer(), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_logs_company_id", "report_logs", ["company_id"])
    op.create_index("ix_report_logs_template_key", "report_logs", ["template_key"])
    op.create_index("ix_report_logs_created_at", "report_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("report_logs")
    op.drop_table("report_schedules")
    op.drop_table("saved_reports")
    op.drop_table("report_templates")
