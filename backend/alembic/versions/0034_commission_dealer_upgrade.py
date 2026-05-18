"""Commission system: dealer linkage, sale amount, rates, deal reference.

Revision ID: 0034_commission_dealer_upgrade
Revises: 0033_import_module
Create Date: 2026-05-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0034_commission_dealer_upgrade"
down_revision = "0033_import_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("commissions", sa.Column("dealer_id", sa.Integer(), nullable=True))
    op.add_column("commissions", sa.Column("deal_id", sa.Integer(), nullable=True))
    op.add_column("commissions", sa.Column("sale_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column("commissions", sa.Column("commission_rate", sa.Numeric(12, 4), nullable=True))
    op.add_column("commissions", sa.Column("calculated_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column("commissions", sa.Column("payment_status", sa.String(20), nullable=False, server_default="unpaid"))
    op.add_column("commissions", sa.Column("journal_id", sa.Integer(), nullable=True))

    op.create_foreign_key("fk_commissions_dealer", "commissions", "dealers", ["dealer_id"], ["id"])
    op.create_foreign_key("fk_commissions_deal", "commissions", "deals", ["deal_id"], ["id"])
    op.create_foreign_key("fk_commissions_journal", "commissions", "journals", ["journal_id"], ["id"])
    op.create_index("ix_commissions_dealer_id", "commissions", ["dealer_id"])
    op.create_index("ix_commissions_deal_id", "commissions", ["deal_id"])

    # agent_id optional for legacy rows
    op.alter_column("commissions", "agent_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.drop_constraint("fk_commissions_journal", "commissions", type_="foreignkey")
    op.drop_constraint("fk_commissions_deal", "commissions", type_="foreignkey")
    op.drop_constraint("fk_commissions_dealer", "commissions", type_="foreignkey")
    op.drop_index("ix_commissions_deal_id", "commissions")
    op.drop_index("ix_commissions_dealer_id", "commissions")
    op.drop_column("commissions", "journal_id")
    op.drop_column("commissions", "payment_status")
    op.drop_column("commissions", "calculated_amount")
    op.drop_column("commissions", "commission_rate")
    op.drop_column("commissions", "sale_amount")
    op.drop_column("commissions", "deal_id")
    op.drop_column("commissions", "dealer_id")
    op.alter_column("commissions", "agent_id", existing_type=sa.Integer(), nullable=False)
