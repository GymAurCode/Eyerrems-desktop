"""construction module

Revision ID: 0014_construction_module
Revises: 0013_operations_engine
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_construction_module"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "construction_projects",
        sa.Column("id",           sa.Integer(),      primary_key=True),
        sa.Column("name",         sa.String(255),    nullable=False),
        sa.Column("location",     sa.String(500),    nullable=False),
        sa.Column("description",  sa.Text(),         nullable=True),
        sa.Column("start_date",   sa.Date(),         nullable=False),
        sa.Column("end_date",     sa.Date(),         nullable=True),
        sa.Column("status",       sa.String(30),     nullable=False, server_default="planning"),
        sa.Column("total_budget", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("created_by",   sa.Integer(),      sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at",   sa.DateTime(),     nullable=False),
        sa.Column("updated_at",   sa.DateTime(),     nullable=False),
    )
    op.create_index("ix_construction_projects_status", "construction_projects", ["status"])

    op.create_table(
        "construction_phases",
        sa.Column("id",          sa.Integer(),   primary_key=True),
        sa.Column("project_id",  sa.Integer(),   sa.ForeignKey("construction_projects.id"), nullable=False),
        sa.Column("name",        sa.String(255), nullable=False),
        sa.Column("description", sa.Text(),      nullable=True),
        sa.Column("start_date",  sa.Date(),      nullable=False),
        sa.Column("end_date",    sa.Date(),      nullable=True),
        sa.Column("status",      sa.String(30),  nullable=False, server_default="pending"),
        sa.Column("order_index", sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("created_at",  sa.DateTime(),  nullable=False),
    )
    op.create_index("ix_construction_phases_project_id", "construction_phases", ["project_id"])

    op.create_table(
        "construction_budgets",
        sa.Column("id",             sa.Integer(),      primary_key=True),
        sa.Column("project_id",     sa.Integer(),      sa.ForeignKey("construction_projects.id"), nullable=False, unique=True),
        sa.Column("material_cost",  sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("labor_cost",     sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("equipment_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("misc_cost",      sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_cost",     sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("created_at",     sa.DateTime(),     nullable=False),
        sa.Column("updated_at",     sa.DateTime(),     nullable=False),
    )

    op.create_table(
        "construction_contractors",
        sa.Column("id",             sa.Integer(),      primary_key=True),
        sa.Column("name",           sa.String(255),    nullable=False),
        sa.Column("phone",          sa.String(50),     nullable=True),
        sa.Column("email",          sa.String(255),    nullable=True),
        sa.Column("company",        sa.String(255),    nullable=True),
        sa.Column("contract_type",  sa.String(50),     nullable=False),
        sa.Column("rate",           sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("specialization", sa.String(255),    nullable=True),
        sa.Column("is_active",      sa.Boolean(),      nullable=False, server_default="1"),
        sa.Column("notes",          sa.Text(),         nullable=True),
        sa.Column("created_at",     sa.DateTime(),     nullable=False),
    )

    op.create_table(
        "construction_project_contractors",
        sa.Column("id",             sa.Integer(),      primary_key=True),
        sa.Column("project_id",     sa.Integer(),      sa.ForeignKey("construction_projects.id"),    nullable=False),
        sa.Column("contractor_id",  sa.Integer(),      sa.ForeignKey("construction_contractors.id"), nullable=False),
        sa.Column("role",           sa.String(255),    nullable=True),
        sa.Column("start_date",     sa.Date(),         nullable=True),
        sa.Column("end_date",       sa.Date(),         nullable=True),
        sa.Column("contract_value", sa.Numeric(14, 2), nullable=True),
        sa.Column("status",         sa.String(30),     nullable=False, server_default="active"),
        sa.Column("created_at",     sa.DateTime(),     nullable=False),
    )
    op.create_index("ix_proj_contractors_project",    "construction_project_contractors", ["project_id"])
    op.create_index("ix_proj_contractors_contractor", "construction_project_contractors", ["contractor_id"])

    op.create_table(
        "construction_procurements",
        sa.Column("id",           sa.Integer(),      primary_key=True),
        sa.Column("project_id",   sa.Integer(),      sa.ForeignKey("construction_projects.id"), nullable=False),
        sa.Column("item_name",    sa.String(255),    nullable=False),
        sa.Column("description",  sa.Text(),         nullable=True),
        sa.Column("quantity",     sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("unit",         sa.String(50),     nullable=True),
        sa.Column("unit_cost",    sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("cost",         sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("vendor",       sa.String(255),    nullable=True),
        sa.Column("status",       sa.String(30),     nullable=False, server_default="requested"),
        sa.Column("requested_by", sa.Integer(),      sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by",  sa.Integer(),      sa.ForeignKey("users.id"), nullable=True),
        sa.Column("requested_at", sa.DateTime(),     nullable=False),
        sa.Column("approved_at",  sa.DateTime(),     nullable=True),
        sa.Column("received_at",  sa.DateTime(),     nullable=True),
        sa.Column("notes",        sa.Text(),         nullable=True),
    )
    op.create_index("ix_construction_procurements_project", "construction_procurements", ["project_id"])
    op.create_index("ix_construction_procurements_status",  "construction_procurements", ["status"])

    op.create_table(
        "construction_daily_progress",
        sa.Column("id",                  sa.Integer(),  primary_key=True),
        sa.Column("project_id",          sa.Integer(),  sa.ForeignKey("construction_projects.id"), nullable=False),
        sa.Column("phase_id",            sa.Integer(),  sa.ForeignKey("construction_phases.id"),   nullable=True),
        sa.Column("date",                sa.Date(),     nullable=False),
        sa.Column("work_done",           sa.Text(),     nullable=False),
        sa.Column("progress_percentage", sa.Float(),    nullable=False, server_default="0"),
        sa.Column("workers_count",       sa.Integer(),  nullable=True),
        sa.Column("weather",             sa.String(100), nullable=True),
        sa.Column("issues",              sa.Text(),     nullable=True),
        sa.Column("reported_by",         sa.Integer(),  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at",          sa.DateTime(), nullable=False),
    )
    op.create_index("ix_construction_progress_project", "construction_daily_progress", ["project_id"])
    op.create_index("ix_construction_progress_date",    "construction_daily_progress", ["date"])

    op.create_table(
        "construction_expenses",
        sa.Column("id",           sa.Integer(),      primary_key=True),
        sa.Column("project_id",   sa.Integer(),      sa.ForeignKey("construction_projects.id"), nullable=False),
        sa.Column("expense_id",   sa.Integer(),      sa.ForeignKey("expenses.id"), nullable=True),
        sa.Column("amount",       sa.Numeric(14, 2), nullable=False),
        sa.Column("expense_type", sa.String(50),     nullable=False),
        sa.Column("description",  sa.String(500),    nullable=False),
        sa.Column("reference_id", sa.String(100),    nullable=True),
        sa.Column("date",         sa.Date(),         nullable=False),
        sa.Column("created_at",   sa.DateTime(),     nullable=False),
    )
    op.create_index("ix_construction_expenses_project", "construction_expenses", ["project_id"])

    op.create_table(
        "construction_documents",
        sa.Column("id",          sa.Integer(),    primary_key=True),
        sa.Column("project_id",  sa.Integer(),    sa.ForeignKey("construction_projects.id"), nullable=False),
        sa.Column("name",        sa.String(255),  nullable=False),
        sa.Column("file_url",    sa.String(1000), nullable=False),
        sa.Column("doc_type",    sa.String(100),  nullable=False),
        sa.Column("file_size",   sa.Integer(),    nullable=True),
        sa.Column("uploaded_by", sa.Integer(),    sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at",  sa.DateTime(),   nullable=False),
    )
    op.create_index("ix_construction_documents_project", "construction_documents", ["project_id"])


def downgrade() -> None:
    op.drop_table("construction_documents")
    op.drop_table("construction_expenses")
    op.drop_table("construction_daily_progress")
    op.drop_table("construction_procurements")
    op.drop_table("construction_project_contractors")
    op.drop_table("construction_contractors")
    op.drop_table("construction_budgets")
    op.drop_table("construction_phases")
    op.drop_table("construction_projects")
