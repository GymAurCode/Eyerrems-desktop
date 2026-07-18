"""Enhanced Journal Model - ERP Double-Entry Accounting Backbone

Revision ID: 0063_enhanced_journal_model
Revises: 0062_add_vendor_model
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "0063_enhanced_journal_model"
down_revision = "0062_add_vendor_model"
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
    # --- journals table ---
    new_journal_cols = [
        ("journal_number", sa.String(50)),
        ("status", sa.String(20)),
        ("approval_level", sa.Integer()),
        ("approved_by", sa.Integer()),
        ("approved_at", sa.DateTime()),
        ("submitted_by", sa.Integer()),
        ("submitted_at", sa.DateTime()),
        ("rejected_by", sa.Integer()),
        ("rejected_at", sa.DateTime()),
        ("rejection_reason", sa.Text()),
        ("posted_by", sa.Integer()),
        ("posted_at", sa.DateTime()),
        ("is_reversal", sa.Boolean()),
        ("reversal_of", sa.Integer()),
        ("reversal_reason", sa.String(500)),
        ("reversed_by", sa.Integer()),
        ("reversed_at", sa.DateTime()),
        ("approved_budget", sa.Numeric(14, 2)),
        ("budget_used", sa.Numeric(14, 2)),
        ("budget_remaining", sa.Numeric(14, 2)),
        ("budget_exceeded", sa.Boolean()),
        ("budget_approval_required", sa.Boolean()),
        ("source_module", sa.String(50)),
        ("source_document_id", sa.Integer()),
        ("source_document_number", sa.String(100)),
        ("source_document_status", sa.String(50)),
        ("source_document_date", sa.DateTime()),
        ("internal_notes", sa.Text()),
        ("remarks", sa.Text()),
        ("modified_by", sa.Integer()),
        ("modified_at", sa.DateTime()),
        ("ip_address", sa.String(50)),
        ("user_agent", sa.String(500)),
        ("updated_at", sa.DateTime()),
        ("company_id", sa.Integer()),
    ]
    for col_name, col_type in new_journal_cols:
        if not _column_exists("journals", col_name):
            op.add_column("journals", sa.Column(col_name, col_type, nullable=True))

    # Set defaults for existing rows
    conn = op.get_bind()
    if _column_exists("journals", "journal_number"):
        conn.execute(text("UPDATE journals SET journal_number = CONCAT('JE-', EXTRACT(YEAR FROM date), '-', LPAD(CAST(id AS TEXT), 6, '0')) WHERE journal_number IS NULL"))
        if not _index_exists("journals", "ix_journals_journal_number"):
            op.create_index("ix_journals_journal_number", "journals", ["journal_number"], unique=True)

    if _column_exists("journals", "status"):
        conn.execute(text("UPDATE journals SET status = 'posted' WHERE status IS NULL"))
        op.alter_column("journals", "status", nullable=False, server_default=text("'draft'"))
    if _column_exists("journals", "is_reversal"):
        conn.execute(text("UPDATE journals SET is_reversal = false WHERE is_reversal IS NULL"))
        op.alter_column("journals", "is_reversal", nullable=False, server_default=text("false"))
    if _column_exists("journals", "budget_exceeded"):
        conn.execute(text("UPDATE journals SET budget_exceeded = false WHERE budget_exceeded IS NULL"))
        op.alter_column("journals", "budget_exceeded", nullable=False, server_default=text("false"))
    if _column_exists("journals", "budget_approval_required"):
        conn.execute(text("UPDATE journals SET budget_approval_required = false WHERE budget_approval_required IS NULL"))
        op.alter_column("journals", "budget_approval_required", nullable=False, server_default=text("false"))

    # Indexes for journals
    for idx in ["ix_journals_status", "ix_journals_reversal_of", "ix_journals_company_id"]:
        tbl = "journals"
        idx_name = idx
        if not _index_exists(tbl, idx_name):
            col_name = idx.replace("ix_journals_", "")
            op.create_index(idx_name, tbl, [col_name])

    # --- journal_entries table ---
    new_entry_cols = [
        ("narration", sa.String(500)),
        ("cost_center", sa.String(100)),
        ("department", sa.String(100)),
        ("project_id", sa.Integer()),
        ("property_id", sa.Integer()),
        ("building", sa.String(100)),
        ("floor", sa.String(50)),
        ("unit_id", sa.Integer()),
        ("customer_id", sa.Integer()),
        ("vendor_id", sa.Integer()),
        ("employee_id", sa.Integer()),
        ("tax_code", sa.String(50)),
        ("tax_amount", sa.Numeric(14, 2)),
        ("reference", sa.String(200)),
        ("memo", sa.Text()),
        ("sort_order", sa.Integer()),
    ]
    for col_name, col_type in new_entry_cols:
        if not _column_exists("journal_entries", col_name):
            op.add_column("journal_entries", sa.Column(col_name, col_type, nullable=True))

    if _column_exists("journal_entries", "sort_order"):
        conn.execute(text("UPDATE journal_entries SET sort_order = id WHERE sort_order IS NULL"))
        op.alter_column("journal_entries", "sort_order", nullable=False, server_default=text("0"))

    # Change numeric precision from 12,2 to 14,2
    if _column_exists("journal_entries", "debit"):
        op.alter_column("journal_entries", "debit", type_=sa.Numeric(14, 2), existing_type=sa.Numeric(12, 2))
    if _column_exists("journal_entries", "credit"):
        op.alter_column("journal_entries", "credit", type_=sa.Numeric(14, 2), existing_type=sa.Numeric(12, 2))


def downgrade():
    drop_journal_cols = [
        "journal_number", "status", "approval_level", "approved_by", "approved_at",
        "submitted_by", "submitted_at", "rejected_by", "rejected_at", "rejection_reason",
        "posted_by", "posted_at", "is_reversal", "reversal_of", "reversal_reason",
        "reversed_by", "reversed_at", "approved_budget", "budget_used", "budget_remaining",
        "budget_exceeded", "budget_approval_required", "source_module", "source_document_id",
        "source_document_number", "source_document_status", "source_document_date",
        "internal_notes", "remarks", "modified_by", "modified_at", "ip_address",
        "user_agent", "updated_at", "company_id",
    ]
    for col in drop_journal_cols:
        if _column_exists("journals", col):
            with op.batch_alter_table("journals") as batch_op:
                batch_op.drop_column(col)

    drop_entry_cols = [
        "narration", "cost_center", "department", "project_id", "property_id",
        "building", "floor", "unit_id", "customer_id", "vendor_id", "employee_id",
        "tax_code", "tax_amount", "reference", "memo", "sort_order",
    ]
    for col in drop_entry_cols:
        if _column_exists("journal_entries", col):
            with op.batch_alter_table("journal_entries") as batch_op:
                batch_op.drop_column(col)
