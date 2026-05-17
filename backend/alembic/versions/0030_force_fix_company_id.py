"""dummy migration alt to satisfy Alembic scanner

Revision ID: 0030_dummy_alt
Revises: 0030_dummy
Create Date: 2026-05-17
"""
from alembic import op

revision = "0030_dummy_alt"
down_revision = "0030_dummy"
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
