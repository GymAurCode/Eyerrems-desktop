"""dummy migration to satisfy Alembic scanner

Revision ID: 0030_dummy
Revises: 0029_fix_missing_company_id
Create Date: 2026-05-17
"""
from alembic import op

revision = "0030_dummy"
down_revision = "0029_fix_missing_company_id"
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
