"""Enhanced Expense Model - ERP Accounts Payable & Expense Management

Revision ID: 0061_enhanced_expense_model
Revises: 0060_enhanced_payment_model
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect, text

revision = "0061_enhanced_expense_model"
down_revision = "0060_enhanced_payment_model"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def _index_exists(table, index):
    conn = op.get_bind()
    indexes = [i["name"] for i in inspect(conn).get_indexes(table)]
    return index in indexes


def upgrade():
    # ── Create expense_items table ──────────────────────────────────────
    if not inspect(op.get_bind()).has_table("expense_items"):
        op.create_table(
            "expense_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("expense_id", sa.Integer(), sa.ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("description", sa.String(500), nullable=False),
            sa.Column("category", sa.String(50), nullable=True),
            sa.Column("quantity", sa.Numeric(12, 4), nullable=False, server_default=text("1")),
            sa.Column("unit", sa.String(20), nullable=True),
            sa.Column("unit_cost", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("discount_pct", sa.Numeric(8, 4), nullable=False, server_default=text("0")),
            sa.Column("tax_pct", sa.Numeric(8, 4), nullable=False, server_default=text("0")),
            sa.Column("discount_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("tax_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("line_total", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=text("0")),
        )
        op.create_index("ix_expense_items_expense_id", "expense_items", ["expense_id"])

    # ── Add new columns to expenses table ───────────────────────────────
    if not _column_exists("expenses", "expense_number"):
        op.add_column("expenses", sa.Column("expense_number", sa.String(50), nullable=True, unique=True))
        op.create_index("ix_expenses_expense_number", "expenses", ["expense_number"])

    if not _column_exists("expenses", "expense_date"):
        op.add_column("expenses", sa.Column("expense_date", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "expense_type"):
        op.add_column("expenses", sa.Column("expense_type", sa.String(50), nullable=False, server_default="miscellaneous"))

    if not _column_exists("expenses", "status"):
        op.add_column("expenses", sa.Column("status", sa.String(20), nullable=False, server_default="draft"))
        op.create_index("ix_expenses_status", "expenses", ["status"])

    if not _column_exists("expenses", "currency"):
        op.add_column("expenses", sa.Column("currency", sa.String(10), nullable=False, server_default="PKR"))

    if not _column_exists("expenses", "expense_source"):
        op.add_column("expenses", sa.Column("expense_source", sa.String(30), nullable=True))

    if not _column_exists("expenses", "source_id"):
        op.add_column("expenses", sa.Column("source_id", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "source_reference"):
        op.add_column("expenses", sa.Column("source_reference", sa.String(100), nullable=True))

    if not _column_exists("expenses", "vendor_id"):
        op.add_column("expenses", sa.Column("vendor_id", sa.Integer(), nullable=True))
        op.create_index("ix_expenses_vendor_id", "expenses", ["vendor_id"])

    if not _column_exists("expenses", "vendor_phone"):
        op.add_column("expenses", sa.Column("vendor_phone", sa.String(50), nullable=True))

    if not _column_exists("expenses", "vendor_email"):
        op.add_column("expenses", sa.Column("vendor_email", sa.String(255), nullable=True))

    if not _column_exists("expenses", "vendor_address"):
        op.add_column("expenses", sa.Column("vendor_address", sa.Text(), nullable=True))

    if not _column_exists("expenses", "vendor_ntn"):
        op.add_column("expenses", sa.Column("vendor_ntn", sa.String(50), nullable=True))

    if not _column_exists("expenses", "vendor_strn"):
        op.add_column("expenses", sa.Column("vendor_strn", sa.String(50), nullable=True))

    if not _column_exists("expenses", "vendor_outstanding"):
        op.add_column("expenses", sa.Column("vendor_outstanding", sa.Numeric(14, 2), nullable=True, server_default=text("0")))

    if not _column_exists("expenses", "vendor_invoice_date"):
        op.add_column("expenses", sa.Column("vendor_invoice_date", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "construction_project_id"):
        op.add_column("expenses", sa.Column("construction_project_id", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "building"):
        op.add_column("expenses", sa.Column("building", sa.String(100), nullable=True))

    if not _column_exists("expenses", "floor"):
        op.add_column("expenses", sa.Column("floor", sa.String(50), nullable=True))

    if not _column_exists("expenses", "unit_id"):
        op.add_column("expenses", sa.Column("unit_id", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "maintenance_ticket_id"):
        op.add_column("expenses", sa.Column("maintenance_ticket_id", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "purchase_order_id"):
        op.add_column("expenses", sa.Column("purchase_order_id", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "subtotal"):
        op.add_column("expenses", sa.Column("subtotal", sa.Numeric(14, 2), nullable=False, server_default=text("0")))

    if not _column_exists("expenses", "discount_amount"):
        op.add_column("expenses", sa.Column("discount_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")))

    if not _column_exists("expenses", "adjustment"):
        op.add_column("expenses", sa.Column("adjustment", sa.Numeric(14, 2), nullable=False, server_default=text("0")))

    if not _column_exists("expenses", "paid_amount"):
        op.add_column("expenses", sa.Column("paid_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")))

    if not _column_exists("expenses", "remaining_amount"):
        op.add_column("expenses", sa.Column("remaining_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")))

    if not _column_exists("expenses", "line_items"):
        op.add_column("expenses", sa.Column("line_items", postgresql.JSON(), nullable=True))

    if not _column_exists("expenses", "approved_budget"):
        op.add_column("expenses", sa.Column("approved_budget", sa.Numeric(14, 2), nullable=True))

    if not _column_exists("expenses", "budget_used"):
        op.add_column("expenses", sa.Column("budget_used", sa.Numeric(14, 2), nullable=True))

    if not _column_exists("expenses", "budget_remaining"):
        op.add_column("expenses", sa.Column("budget_remaining", sa.Numeric(14, 2), nullable=True))

    if not _column_exists("expenses", "budget_exceeded"):
        op.add_column("expenses", sa.Column("budget_exceeded", sa.Boolean(), nullable=False, server_default=text("false")))

    if not _column_exists("expenses", "budget_approval_required"):
        op.add_column("expenses", sa.Column("budget_approval_required", sa.Boolean(), nullable=False, server_default=text("false")))

    if not _column_exists("expenses", "bank_account"):
        op.add_column("expenses", sa.Column("bank_account", sa.String(100), nullable=True))

    if not _column_exists("expenses", "transaction_reference"):
        op.add_column("expenses", sa.Column("transaction_reference", sa.String(100), nullable=True))

    if not _column_exists("expenses", "payment_date"):
        op.add_column("expenses", sa.Column("payment_date", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "cheque_number"):
        op.add_column("expenses", sa.Column("cheque_number", sa.String(50), nullable=True))

    if not _column_exists("expenses", "approval_level"):
        op.add_column("expenses", sa.Column("approval_level", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "rejected_by"):
        op.add_column("expenses", sa.Column("rejected_by", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "rejected_at"):
        op.add_column("expenses", sa.Column("rejected_at", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "rejection_reason"):
        op.add_column("expenses", sa.Column("rejection_reason", sa.Text(), nullable=True))

    if not _column_exists("expenses", "submitted_by"):
        op.add_column("expenses", sa.Column("submitted_by", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "submitted_at"):
        op.add_column("expenses", sa.Column("submitted_at", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "internal_notes"):
        op.add_column("expenses", sa.Column("internal_notes", sa.Text(), nullable=True))

    if not _column_exists("expenses", "vendor_notes"):
        op.add_column("expenses", sa.Column("vendor_notes", sa.Text(), nullable=True))

    if not _column_exists("expenses", "remarks"):
        op.add_column("expenses", sa.Column("remarks", sa.Text(), nullable=True))

    if not _column_exists("expenses", "deleted_at"):
        op.add_column("expenses", sa.Column("deleted_at", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "updated_at"):
        op.add_column("expenses", sa.Column("updated_at", sa.DateTime(), nullable=True))

    if not _column_exists("expenses", "created_by_user_id"):
        op.add_column("expenses", sa.Column("created_by_user_id", sa.Integer(), nullable=True))

    if not _column_exists("expenses", "company_id"):
        op.add_column("expenses", sa.Column("company_id", sa.Integer(), nullable=True))
        op.create_index("ix_expenses_company_id", "expenses", ["company_id"])

    # ── Data migrations ─────────────────────────────────────────────────
    # Migrate existing data: set expense_number
    op.execute(
        text("""
            UPDATE expenses
            SET expense_number = CONCAT('EXP-', EXTRACT(YEAR FROM COALESCE(expense_date, created_at))::text, '-', LPAD(CAST(id AS text), 6, '0'))
            WHERE expense_number IS NULL
        """)
    )

    # Set expense_date from date
    op.execute(
        text("UPDATE expenses SET expense_date = date WHERE expense_date IS NULL AND date IS NOT NULL")
    )
    op.execute(
        text("UPDATE expenses SET expense_date = created_at WHERE expense_date IS NULL")
    )

    # Set status from old approval_status
    op.execute(
        text("UPDATE expenses SET status = 'draft' WHERE status IS NULL")
    )

    # Migrate old line_items JSON data from items column if it exists or create from single amount
    op.execute(
        text("""
            UPDATE expenses
            SET line_items = json_build_array(
                json_build_object(
                    'description', COALESCE(description, 'Expense'),
                    'category', expense_type,
                    'quantity', 1,
                    'unit', 'lump',
                    'unit_cost', amount,
                    'discount_pct', 0,
                    'tax_pct', 0,
                    'discount_amount', 0,
                    'tax_amount', 0,
                    'line_total', amount
                )
            )
            WHERE line_items IS NULL AND amount IS NOT NULL AND amount > 0
        """)
    )

    # Set subtotal/amount from old amount
    op.execute(
        text("UPDATE expenses SET subtotal = amount WHERE subtotal = 0 AND amount > 0")
    )

    # Set paid_amount and remaining_amount
    op.execute(
        text("UPDATE expenses SET paid_amount = CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END WHERE paid_amount IS NULL")
    )
    op.execute(
        text("UPDATE expenses SET remaining_amount = amount - paid_amount WHERE remaining_amount IS NULL")
    )

    # Set approval_status
    op.execute(
        text("UPDATE expenses SET approval_status = COALESCE(approval_status, 'draft') WHERE approval_status IS NULL")
    )

    # Set updated_at
    op.execute(
        text("UPDATE expenses SET updated_at = created_at WHERE updated_at IS NULL")
    )

    # Rename: approval_status -> status for old data mapping
    # Old approval_status values: submitted, approved
    op.execute(
        text("UPDATE expenses SET status = 'draft' WHERE status = 'draft' AND approval_status = 'submitted'")
    )

    # Copy old notes to internal_notes
    if _column_exists("expenses", "description") and _column_exists("expenses", "internal_notes"):
        op.execute(
            text("UPDATE expenses SET internal_notes = description WHERE internal_notes IS NULL AND description IS NOT NULL")
        )


def downgrade():
    # Drop expense_items table
    if inspect(op.get_bind()).has_table("expense_items"):
        op.drop_table("expense_items")

    # Remove new columns from expenses
    drop_cols = [
        "expense_number", "expense_date", "expense_type", "status", "currency",
        "expense_source", "source_id", "source_reference",
        "vendor_id", "vendor_phone", "vendor_email", "vendor_address",
        "vendor_ntn", "vendor_strn", "vendor_outstanding", "vendor_invoice_date",
        "construction_project_id", "building", "floor", "unit_id",
        "maintenance_ticket_id", "purchase_order_id",
        "subtotal", "discount_amount", "adjustment", "paid_amount", "remaining_amount",
        "line_items",
        "approved_budget", "budget_used", "budget_remaining", "budget_exceeded",
        "budget_approval_required",
        "bank_account", "transaction_reference", "payment_date", "cheque_number",
        "approval_level", "rejected_by", "rejected_at", "rejection_reason",
        "submitted_by", "submitted_at",
        "internal_notes", "vendor_notes", "remarks",
        "deleted_at", "updated_at", "created_by_user_id", "company_id",
    ]
    for col in drop_cols:
        if _column_exists("expenses", col):
            with op.batch_alter_table("expenses") as batch_op:
                batch_op.drop_column(col)
