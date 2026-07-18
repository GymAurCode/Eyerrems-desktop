"""Add ForeignKey constraint on expenses.vendor_id → vendors.id

Revision ID: 0064_add_expense_vendor_fk
Revises: 0063_enhanced_journal_model
Create Date: 2026-07-17
"""
from alembic import op
from sqlalchemy import inspect, text

revision = "0064_add_expense_vendor_fk"
down_revision = "0063_enhanced_journal_model"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    conn = op.get_bind()

    # Clean up orphaned vendor_id values before adding the FK constraint
    conn.execute(
        text("""
            UPDATE expenses
            SET vendor_id = NULL
            WHERE vendor_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM vendors WHERE vendors.id = expenses.vendor_id)
        """)
    )

    # Add foreign key constraint
    if _column_exists("expenses", "vendor_id"):
        op.create_foreign_key(
            "fk_expenses_vendor_id_vendors",
            "expenses", "vendors",
            ["vendor_id"], ["id"],
        )


def downgrade():
    if _column_exists("expenses", "vendor_id"):
        op.drop_constraint("fk_expenses_vendor_id_vendors", "expenses", type_="foreignkey")
