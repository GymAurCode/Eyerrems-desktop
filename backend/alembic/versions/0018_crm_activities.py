"""crm_activities — Quick Actions activity log

Revision ID: 0018_crm_activities
Revises: 0017_mail_module
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0018_crm_activities"
down_revision = "0017_mail_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_type", sa.String(20), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False, index=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="initiated"),
        sa.Column("notified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_lead_activities_entity", "lead_activities", ["entity_type", "entity_id"])
    op.create_index("ix_lead_activities_type", "lead_activities", ["type"])
    op.create_index("ix_lead_activities_scheduled", "lead_activities", ["scheduled_at"])


def downgrade() -> None:
    op.drop_index("ix_lead_activities_scheduled", "lead_activities")
    op.drop_index("ix_lead_activities_type", "lead_activities")
    op.drop_index("ix_lead_activities_entity", "lead_activities")
    op.drop_table("lead_activities")
