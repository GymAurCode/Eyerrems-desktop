"""add description to accounts

Revision ID: 0011
Revises: 0010_installment_engine
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010_installment_engine"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("accounts", sa.Column("description", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("accounts", "description")
