"""add backup_dir column to backup_settings

Revision ID: 0077
Revises: 0076
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0077"
down_revision: Union[str, None] = "0076"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade() -> None:
    if not _has_column("backup_settings", "backup_dir"):
        op.add_column(
            "backup_settings",
            sa.Column("backup_dir", sa.String(512), nullable=True),
        )


def downgrade() -> None:
    if _has_column("backup_settings", "backup_dir"):
        op.drop_column("backup_settings", "backup_dir")
