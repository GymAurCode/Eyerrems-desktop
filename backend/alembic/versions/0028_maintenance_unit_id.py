"""Add unit_id to maintenance_records for Property → Unit → Tenant hierarchy.

Revision ID: 0028_maintenance_unit_id
Revises: 0027_maintenance_upgrade
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0028_maintenance_unit_id"
down_revision = "0027_maintenance_upgrade"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "maintenance_records",
        sa.Column("unit_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_maint_unit_id",
        "maintenance_records", "units",
        ["unit_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_maintenance_unit_id", "maintenance_records", ["unit_id"])


def downgrade() -> None:
    op.drop_index("ix_maintenance_unit_id", "maintenance_records")
    op.drop_constraint("fk_maint_unit_id", "maintenance_records", type_="foreignkey")
    op.drop_column("maintenance_records", "unit_id")
