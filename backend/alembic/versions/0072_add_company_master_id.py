"""Add master_id column to companies table.

The master_id column stores the UUID from master.companies.id,
linking each tenant's companies row to its master schema record.
This column was previously added via raw DDL at startup; this
migration makes it a proper schema version change.

Revision ID: 0072_add_company_master_id
Revises: 0071_rbac_v3_clean
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0072_add_company_master_id"
down_revision = "0071_rbac_v3_clean"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    insp = inspect(conn)
    if not insp.has_table(table):
        return False
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade():
    if not _column_exists("companies", "master_id"):
        op.add_column(
            "companies",
            sa.Column(
                "master_id",
                sa.String(36),
                nullable=True,
                comment="UUID from master.companies.id",
            ),
        )


def downgrade():
    if _column_exists("companies", "master_id"):
        op.drop_column("companies", "master_id")
