"""Add missing columns to attendances, branches, crm_payments, leave_types

Revision ID: 0057_add_missing_hr_crm_columns
Revises: 0056_add_exit_date_to_employees
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0057_add_missing_hr_crm_columns"
down_revision = "0056_add_exit_date_to_employees"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # attendances
    op.add_column("attendances", sa.Column("shift_template_id", sa.Integer(), sa.ForeignKey("shift_templates.id"), nullable=True))
    op.create_index("ix_attendances_shift_template_id", "attendances", ["shift_template_id"])

    # branches
    op.add_column("branches", sa.Column("contact_person", sa.String(200), nullable=True))
    op.add_column("branches", sa.Column("timezone", sa.String(50), nullable=True))

    # crm_payments
    op.add_column("crm_payments", sa.Column("journal_id", sa.Integer(), nullable=True))

    # leave_types
    op.add_column("leave_types", sa.Column("applicable_after_probation", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("leave_types", sa.Column("gender_specific", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("leave_types", sa.Column("requires_document", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("leave_types", "requires_document")
    op.drop_column("leave_types", "gender_specific")
    op.drop_column("leave_types", "applicable_after_probation")
    op.drop_column("crm_payments", "journal_id")
    op.drop_column("branches", "timezone")
    op.drop_column("branches", "contact_person")
    op.drop_index("ix_attendances_shift_template_id", table_name="attendances")
    op.drop_column("attendances", "shift_template_id")
