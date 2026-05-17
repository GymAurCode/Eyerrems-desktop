"""Finance Operations Engine — extend finance_operations with sub_type, entity fields

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def _column_exists(conn, table, column):
    return column in [c["name"] for c in inspect(conn).get_columns(table)]


def upgrade():
    conn = op.get_bind()
    with op.batch_alter_table("finance_operations") as batch:
        if not _column_exists(conn, "finance_operations", "sub_type"):
            batch.add_column(sa.Column("sub_type", sa.String(50), nullable=True))
        if not _column_exists(conn, "finance_operations", "entity_type"):
            batch.add_column(sa.Column("entity_type", sa.String(30), nullable=True))
        if not _column_exists(conn, "finance_operations", "entity_id"):
            batch.add_column(sa.Column("entity_id", sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table("finance_operations") as batch:
        batch.drop_column("entity_id")
        batch.drop_column("entity_type")
        batch.drop_column("sub_type")
