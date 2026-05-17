"""add finance_operations table

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "finance_operations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", sa.String(20), nullable=False, index=True),  # REFUND, TRANSFER, MERGE
        sa.Column("journal_id", sa.Integer(), sa.ForeignKey("journals.id"), nullable=False),
        sa.Column("reference_journal_id", sa.Integer(), sa.ForeignKey("journals.id"), nullable=True),
        sa.Column("from_account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("to_account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("meta", sa.Text(), nullable=True),  # JSON string
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("finance_operations")
