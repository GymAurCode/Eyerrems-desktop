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
    # Check if columns already exist before adding them
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Get existing columns in commissions table
    existing_columns = set()
    try:
        columns_info = inspector.get_columns("commissions")
        existing_columns = {col["name"] for col in columns_info}
    except Exception:
        existing_columns = set()
    
    # Add columns only if they don't exist
    if "dealer_id" not in existing_columns:
        op.add_column("commissions", sa.Column("dealer_id", sa.Integer(), nullable=True))
    else:
        print("dealer_id column already exists, skipping")
        
    if "deal_id" not in existing_columns:
        op.add_column("commissions", sa.Column("deal_id", sa.Integer(), nullable=True))
    else:
        print("deal_id column already exists, skipping")
        
    if "sale_amount" not in existing_columns:
        op.add_column("commissions", sa.Column("sale_amount", sa.Numeric(14, 2), nullable=True))
    else:
        print("sale_amount column already exists, skipping")
        
    if "commission_rate" not in existing_columns:
        op.add_column("commissions", sa.Column("commission_rate", sa.Numeric(12, 4), nullable=True))
    else:
        print("commission_rate column already exists, skipping")
        
    if "calculated_amount" not in existing_columns:
        op.add_column("commissions", sa.Column("calculated_amount", sa.Numeric(14, 2), nullable=True))
    else:
        print("calculated_amount column already exists, skipping")
        
    if "payment_status" not in existing_columns:
        op.add_column("commissions", sa.Column("payment_status", sa.String(20), nullable=False, server_default="unpaid"))
    else:
        print("payment_status column already exists, skipping")
        
    if "journal_id" not in existing_columns:
        op.add_column("commissions", sa.Column("journal_id", sa.Integer(), nullable=True))
    else:
        print("journal_id column already exists, skipping")

    # Create foreign keys and indexes only if columns exist
    # Refresh existing columns after potential additions
    try:
        columns_info = inspector.get_columns("commissions")
        current_columns = {col["name"] for col in columns_info}
    except Exception:
        current_columns = existing_columns
    
    try:
        # Check if foreign keys already exist
        existing_fks = inspector.get_foreign_keys("commissions")
        existing_fk_names = {fk["name"] for fk in existing_fks}
        
        if "fk_commissions_dealer" not in existing_fk_names and "dealer_id" in current_columns:
            op.create_foreign_key("fk_commissions_dealer", "commissions", "dealers", ["dealer_id"], ["id"])
        
        if "fk_commissions_deal" not in existing_fk_names and "deal_id" in current_columns:
            op.create_foreign_key("fk_commissions_deal", "commissions", "deals", ["deal_id"], ["id"])
            
        if "fk_commissions_journal" not in existing_fk_names and "journal_id" in current_columns:
            op.create_foreign_key("fk_commissions_journal", "commissions", "journals", ["journal_id"], ["id"])
    except Exception as e:
        print(f"Foreign key creation skipped: {e}")
    
    # Create indexes if they don't exist
    try:
        existing_indexes = inspector.get_indexes("commissions")
        existing_index_names = {idx["name"] for idx in existing_indexes}
        
        if "ix_commissions_dealer_id" not in existing_index_names and "dealer_id" in current_columns:
            op.create_index("ix_commissions_dealer_id", "commissions", ["dealer_id"])
            
        if "ix_commissions_deal_id" not in existing_index_names and "deal_id" in current_columns:
            op.create_index("ix_commissions_deal_id", "commissions", ["deal_id"])
    except Exception as e:
        print(f"Index creation skipped: {e}")

    # Make agent_id optional for legacy rows (only if column exists)
    if "agent_id" in current_columns:
        try:
            op.alter_column("commissions", "agent_id", existing_type=sa.Integer(), nullable=True)
        except Exception as e:
            print(f"Column alteration skipped: {e}")


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
