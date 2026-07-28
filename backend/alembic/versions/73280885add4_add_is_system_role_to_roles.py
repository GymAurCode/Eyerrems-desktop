"""add is_system_role to roles

Revision ID: 73280885add4
Revises: 0075_rbac_v4_company_scoped
Create Date: 2026-07-25 16:18:43.625765
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '73280885add4'
down_revision: Union[str, None] = '0075_rbac_v4_company_scoped'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade() -> None:
    if not _has_column("roles", "is_system_role"):
        op.add_column(
            "roles",
            sa.Column(
                "is_system_role",
                sa.Boolean(),
                server_default="false",
                nullable=False,
            ),
        )


def downgrade() -> None:
    if _has_column("roles", "is_system_role"):
        op.drop_column("roles", "is_system_role")
