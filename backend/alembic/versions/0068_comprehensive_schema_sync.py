"""Comprehensive schema sync — adds ALL missing columns/tables from models.

This migration scans every table referenced by the current SQLAlchemy models
and adds any missing columns. It also creates any missing tables.

Safe to run multiple times — every operation checks existence first.

Revision ID: 0068_comprehensive_schema_sync
Revises: 0067_add_dealer_ledger_lead_id
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "0068_comprehensive_schema_sync"
down_revision = "0067_add_dealer_ledger_lead_id"
branch_labels = None
depends_on = None


def _table_exists(table):
    conn = op.get_bind()
    return inspect(conn).has_table(table)


def _column_exists(table, column):
    conn = op.get_bind()
    cols = {c["name"] for c in inspect(conn).get_columns(table)}
    return column in cols


def _add_column_if_missing(table, column, col_type, **kwargs):
    if not _column_exists(table, column):
        op.add_column(table, sa.Column(column, col_type, **kwargs))


def _drop_column_if_exists(table, column):
    if _column_exists(table, column):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_column(column)


def _create_table_if_missing(name, *columns):
    if not _table_exists(name):
        op.create_table(name, *columns)


def upgrade():
    conn = op.get_bind()

    # ═══════════════════════════════════════════════════════════════════════
    # leads
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("leads"):
        _add_column_if_missing("leads", "monthly_income", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("leads", "budget_min", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("leads", "budget_max", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("leads", "preferred_town", sa.String(80), nullable=True)
        _add_column_if_missing("leads", "preferred_property_type", sa.String(80), nullable=True)
        _add_column_if_missing("leads", "unit_preference", sa.String(80), nullable=True)
        _add_column_if_missing("leads", "preferred_project", sa.String(120), nullable=True)
        _add_column_if_missing("leads", "campaign", sa.String(120), nullable=True)
        _add_column_if_missing("leads", "referral", sa.String(120), nullable=True)
        _add_column_if_missing("leads", "assigned_dealer_id", sa.Integer, sa.ForeignKey("dealers.id"), nullable=True)
        _add_column_if_missing("leads", "lead_cost", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("leads", "investor_type", sa.String(20), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # clients
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("clients"):
        _add_column_if_missing("clients", "mailing_address", sa.Text, nullable=True)
        _add_column_if_missing("clients", "permanent_address", sa.Text, nullable=True)
        _add_column_if_missing("clients", "company_name", sa.String(120), nullable=True)
        _add_column_if_missing("clients", "occupation", sa.String(120), nullable=True)
        _add_column_if_missing("clients", "next_of_kin_name", sa.String(120), nullable=True)
        _add_column_if_missing("clients", "next_of_kin_cnic", sa.String(20), nullable=True)
        _add_column_if_missing("clients", "next_of_kin_phone", sa.String(50), nullable=True)
        _add_column_if_missing("clients", "dealer_id", sa.Integer, sa.ForeignKey("dealers.id"), nullable=True)
        _add_column_if_missing("clients", "interested_property_id", sa.Integer, sa.ForeignKey("properties.id"), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # dealers
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("dealers"):
        _add_column_if_missing("dealers", "cost_per_lead", sa.Numeric(14, 2), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # deals
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("deals"):
        _add_column_if_missing("deals", "client_role", sa.String(20), nullable=True)
        _add_column_if_missing("deals", "deal_type", sa.String(20), nullable=False, server_default=text("'property'"))
        _add_column_if_missing("deals", "reference_id", sa.Integer, nullable=True)
        _add_column_if_missing("deals", "deal_title", sa.String(255), nullable=True)
        _add_column_if_missing("deals", "down_payment_status", sa.String(20), nullable=False, server_default=text("'pending'"))
        _add_column_if_missing("deals", "discount", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("deals", "tax", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("deals", "commission", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("deals", "net_amount", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("deals", "proposed_installment_type", sa.String(30), nullable=True)
        _add_column_if_missing("deals", "proposed_installment_count", sa.Integer, nullable=True)
        _add_column_if_missing("deals", "negotiation_notes", sa.Text, nullable=True)
        _add_column_if_missing("deals", "deal_date", sa.Date, nullable=True)
        _add_column_if_missing("deals", "due_date", sa.Date, nullable=True)
        _add_column_if_missing("deals", "description", sa.Text, nullable=True)
        _add_column_if_missing("deals", "unit_id", sa.Integer, sa.ForeignKey("units.id"), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # followups
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("followups"):
        _add_column_if_missing("followups", "fu_id", sa.String(20), nullable=False, unique=True)
        _add_column_if_missing("followups", "assigned_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # site_visits
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("site_visits"):
        _add_column_if_missing("site_visits", "visit_id", sa.String(20), nullable=False, unique=True)
        _add_column_if_missing("site_visits", "property_id", sa.Integer, sa.ForeignKey("properties.id"), nullable=True)
        _add_column_if_missing("site_visits", "dealer_id", sa.Integer, sa.ForeignKey("dealers.id"), nullable=True)
        _add_column_if_missing("site_visits", "feedback", sa.Text, nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # Account — is_system_account (0044 should have added it, but just in case)
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("accounts"):
        _add_column_if_missing("accounts", "is_system_account", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("accounts", "opening_balance", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("accounts", "opening_balance_date", sa.DateTime, nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # Journal — deleted_at (0065)
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("journals"):
        _add_column_if_missing("journals", "deleted_at", sa.DateTime, nullable=True)
        _add_column_if_missing("journals", "description", sa.String(500), nullable=True)
        _add_column_if_missing("journals", "source", sa.String(20), nullable=True)
        _add_column_if_missing("journals", "is_editable", sa.Boolean, nullable=False, server_default=text("true"))
        _add_column_if_missing("journals", "journal_number", sa.String(50), nullable=True, unique=True)
        _add_column_if_missing("journals", "approval_level", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "approved_by", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "approved_at", sa.DateTime, nullable=True)
        _add_column_if_missing("journals", "submitted_by", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "submitted_at", sa.DateTime, nullable=True)
        _add_column_if_missing("journals", "rejected_by", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "rejected_at", sa.DateTime, nullable=True)
        _add_column_if_missing("journals", "rejection_reason", sa.Text, nullable=True)
        _add_column_if_missing("journals", "posted_by", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "posted_at", sa.DateTime, nullable=True)
        _add_column_if_missing("journals", "is_reversal", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("journals", "reversal_of", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "reversal_reason", sa.String(500), nullable=True)
        _add_column_if_missing("journals", "reversed_by", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "reversed_at", sa.DateTime, nullable=True)
        _add_column_if_missing("journals", "approved_budget", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("journals", "budget_used", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("journals", "budget_remaining", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("journals", "budget_exceeded", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("journals", "budget_approval_required", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("journals", "source_module", sa.String(50), nullable=True)
        _add_column_if_missing("journals", "source_document_id", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "source_document_number", sa.String(100), nullable=True)
        _add_column_if_missing("journals", "source_document_status", sa.String(50), nullable=True)
        _add_column_if_missing("journals", "source_document_date", sa.DateTime, nullable=True)
        _add_column_if_missing("journals", "internal_notes", sa.Text, nullable=True)
        _add_column_if_missing("journals", "remarks", sa.Text, nullable=True)
        _add_column_if_missing("journals", "modified_by", sa.Integer, nullable=True)
        _add_column_if_missing("journals", "modified_at", sa.DateTime, nullable=True)
        _add_column_if_missing("journals", "ip_address", sa.String(50), nullable=True)
        _add_column_if_missing("journals", "user_agent", sa.String(500), nullable=True)
        _add_column_if_missing("journals", "company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # JournalEntry
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("journal_entries"):
        _add_column_if_missing("journal_entries", "narration", sa.String(500), nullable=True)
        _add_column_if_missing("journal_entries", "description", sa.String(500), nullable=True)
        _add_column_if_missing("journal_entries", "cost_center", sa.String(100), nullable=True)
        _add_column_if_missing("journal_entries", "department", sa.String(100), nullable=True)
        _add_column_if_missing("journal_entries", "project_id", sa.Integer, nullable=True)
        _add_column_if_missing("journal_entries", "property_id", sa.Integer, nullable=True)
        _add_column_if_missing("journal_entries", "building", sa.String(100), nullable=True)
        _add_column_if_missing("journal_entries", "floor", sa.String(50), nullable=True)
        _add_column_if_missing("journal_entries", "unit_id", sa.Integer, nullable=True)
        _add_column_if_missing("journal_entries", "customer_id", sa.Integer, nullable=True)
        _add_column_if_missing("journal_entries", "vendor_id", sa.Integer, nullable=True)
        _add_column_if_missing("journal_entries", "employee_id", sa.Integer, nullable=True)
        _add_column_if_missing("journal_entries", "tax_code", sa.String(50), nullable=True)
        _add_column_if_missing("journal_entries", "tax_amount", sa.Numeric(14, 2), nullable=True, server_default=text("0"))
        _add_column_if_missing("journal_entries", "reference", sa.String(200), nullable=True)
        _add_column_if_missing("journal_entries", "memo", sa.Text, nullable=True)
        _add_column_if_missing("journal_entries", "sort_order", sa.Integer, nullable=False, server_default=text("0"))

    # ═══════════════════════════════════════════════════════════════════════
    # Invoice — missing columns from enhanced model
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("invoices"):
        _add_column_if_missing("invoices", "invoice_type", sa.String(30), nullable=True, server_default=text("'manual'"))
        _add_column_if_missing("invoices", "client_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "client_name", sa.String(255), nullable=True)
        _add_column_if_missing("invoices", "client_phone", sa.String(50), nullable=True)
        _add_column_if_missing("invoices", "client_email", sa.String(255), nullable=True)
        _add_column_if_missing("invoices", "client_cnic", sa.String(50), nullable=True)
        _add_column_if_missing("invoices", "client_ntn", sa.String(50), nullable=True)
        _add_column_if_missing("invoices", "client_address", sa.Text, nullable=True)
        _add_column_if_missing("invoices", "reference", sa.String(100), nullable=True)
        _add_column_if_missing("invoices", "reference_type", sa.String(30), nullable=True)
        _add_column_if_missing("invoices", "reference_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "deal_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "booking_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "lease_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "maintenance_ticket_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "construction_project_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "purchase_order_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "contract_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "payment_terms", sa.String(50), nullable=True, server_default=text("'due_immediately'"))
        _add_column_if_missing("invoices", "internal_notes", sa.Text, nullable=True)
        _add_column_if_missing("invoices", "customer_notes", sa.Text, nullable=True)
        _add_column_if_missing("invoices", "terms_conditions", sa.Text, nullable=True)
        _add_column_if_missing("invoices", "late_payment_policy", sa.Text, nullable=True)
        _add_column_if_missing("invoices", "footer_message", sa.Text, nullable=True)
        _add_column_if_missing("invoices", "auto_generated", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("invoices", "source_module", sa.String(30), nullable=True)
        _add_column_if_missing("invoices", "source_record_id", sa.Integer, nullable=True)
        _add_column_if_missing("invoices", "sent_at", sa.DateTime, nullable=True)
        _add_column_if_missing("invoices", "viewed_at", sa.DateTime, nullable=True)
        _add_column_if_missing("invoices", "cancelled_at", sa.DateTime, nullable=True)
        _add_column_if_missing("invoices", "voided_at", sa.DateTime, nullable=True)
        _add_column_if_missing("invoices", "tenant_id", sa.Integer, sa.ForeignKey("tenants.id"), nullable=True)
        _add_column_if_missing("invoices", "company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=True)
        _add_column_if_missing("invoices", "currency", sa.String(10), nullable=False, server_default=text("'PKR'"))
        _add_column_if_missing("invoices", "party_type", sa.String(30), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # InvoiceItems
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "invoice_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False, server_default=text("1")),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
        sa.Column("discount_pct", sa.Numeric(8, 4), nullable=False, server_default=text("0")),
        sa.Column("tax_pct", sa.Numeric(8, 4), nullable=False, server_default=text("0")),
        sa.Column("discount_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
        sa.Column("tax_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=text("0")),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # PaymentAllocation
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "payment_allocations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("payment_id", sa.Integer, sa.ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("allocated_amount", sa.Numeric(14, 2), nullable=False),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # CustomerCredit
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "customer_credits",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("party_type", sa.String(30), nullable=True, index=True),
        sa.Column("party_id", sa.Integer, nullable=True, index=True),
        sa.Column("party_name", sa.String(255), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("remaining_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("source_payment_id", sa.Integer, sa.ForeignKey("payments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=True, index=True),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # PaymentAttachment
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "payment_attachments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("payment_id", sa.Integer, sa.ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=True),
        sa.Column("uploaded_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Payment — missing columns from enhanced model
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("payments"):
        _add_column_if_missing("payments", "party_cnic", sa.String(50), nullable=True)
        _add_column_if_missing("payments", "party_address", sa.Text, nullable=True)
        _add_column_if_missing("payments", "party_name", sa.String(255), nullable=True)
        _add_column_if_missing("payments", "party_phone", sa.String(50), nullable=True)
        _add_column_if_missing("payments", "party_email", sa.String(255), nullable=True)
        _add_column_if_missing("payments", "payment_type", sa.String(30), nullable=False, server_default=text("'against_invoice'"))
        _add_column_if_missing("payments", "method_fields", sa.JSON, nullable=True)
        _add_column_if_missing("payments", "external_transaction_id", sa.String(100), nullable=True)
        _add_column_if_missing("payments", "received_by", sa.String(255), nullable=True)
        _add_column_if_missing("payments", "branch", sa.String(100), nullable=True)
        _add_column_if_missing("payments", "cash_counter", sa.String(100), nullable=True)
        _add_column_if_missing("payments", "posted_to_finance", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("payments", "finance_journal_id", sa.Integer, nullable=True)
        _add_column_if_missing("payments", "completed_at", sa.DateTime, nullable=True)
        _add_column_if_missing("payments", "reversed_at", sa.DateTime, nullable=True)
        _add_column_if_missing("payments", "refunded_at", sa.DateTime, nullable=True)
        _add_column_if_missing("payments", "cancelled_at", sa.DateTime, nullable=True)
        _add_column_if_missing("payments", "deleted_at", sa.DateTime, nullable=True)
        _add_column_if_missing("payments", "created_by_user_id", sa.Integer, nullable=True)
        _add_column_if_missing("payments", "company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=True)
        _add_column_if_missing("payments", "payment_number", sa.String(50), nullable=True, unique=True)

    # ═══════════════════════════════════════════════════════════════════════
    # Expense — missing columns from enhanced model
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("expenses"):
        _add_column_if_missing("expenses", "expense_number", sa.String(50), nullable=True, unique=True)
        _add_column_if_missing("expenses", "vendor_name", sa.String(255), nullable=True)
        _add_column_if_missing("expenses", "vendor_phone", sa.String(50), nullable=True)
        _add_column_if_missing("expenses", "vendor_email", sa.String(255), nullable=True)
        _add_column_if_missing("expenses", "vendor_address", sa.Text, nullable=True)
        _add_column_if_missing("expenses", "vendor_ntn", sa.String(50), nullable=True)
        _add_column_if_missing("expenses", "vendor_strn", sa.String(50), nullable=True)
        _add_column_if_missing("expenses", "vendor_outstanding", sa.Numeric(14, 2), nullable=True, server_default=text("0"))
        _add_column_if_missing("expenses", "vendor_id", sa.Integer, sa.ForeignKey("vendors.id"), nullable=True)
        _add_column_if_missing("expenses", "expense_source", sa.String(30), nullable=True)
        _add_column_if_missing("expenses", "source_id", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "source_reference", sa.String(100), nullable=True)
        _add_column_if_missing("expenses", "invoice_bill_no", sa.String(100), nullable=True)
        _add_column_if_missing("expenses", "vendor_invoice_date", sa.DateTime, nullable=True)
        _add_column_if_missing("expenses", "construction_project_id", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "building", sa.String(100), nullable=True)
        _add_column_if_missing("expenses", "floor", sa.String(50), nullable=True)
        _add_column_if_missing("expenses", "maintenance_ticket_id", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "purchase_order_id", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "department", sa.String(100), nullable=True)
        _add_column_if_missing("expenses", "subtotal", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("expenses", "tax_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("expenses", "discount_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("expenses", "adjustment", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("expenses", "paid_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("expenses", "remaining_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("expenses", "line_items", sa.JSON, nullable=True)
        _add_column_if_missing("expenses", "approved_budget", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("expenses", "budget_used", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("expenses", "budget_remaining", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("expenses", "budget_exceeded", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("expenses", "budget_approval_required", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("expenses", "account_id", sa.Integer, sa.ForeignKey("accounts.id"), nullable=True)
        _add_column_if_missing("expenses", "paid_from", sa.String(20), nullable=True)
        _add_column_if_missing("expenses", "payment_method", sa.String(30), nullable=True)
        _add_column_if_missing("expenses", "payment_status", sa.String(20), nullable=True, server_default=text("'pending'"))
        _add_column_if_missing("expenses", "paid_from_account_id", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "bank_account", sa.String(100), nullable=True)
        _add_column_if_missing("expenses", "transaction_reference", sa.String(100), nullable=True)
        _add_column_if_missing("expenses", "payment_date", sa.DateTime, nullable=True)
        _add_column_if_missing("expenses", "cheque_number", sa.String(50), nullable=True)
        _add_column_if_missing("expenses", "approval_status", sa.String(20), nullable=True, server_default=text("'draft'"))
        _add_column_if_missing("expenses", "approval_level", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "approved_by", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "approved_at", sa.DateTime, nullable=True)
        _add_column_if_missing("expenses", "rejected_by", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "rejected_at", sa.DateTime, nullable=True)
        _add_column_if_missing("expenses", "rejection_reason", sa.Text, nullable=True)
        _add_column_if_missing("expenses", "submitted_by", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "submitted_at", sa.DateTime, nullable=True)
        _add_column_if_missing("expenses", "is_recurring", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("expenses", "recurring_frequency", sa.String(20), nullable=True)
        _add_column_if_missing("expenses", "next_due_date", sa.DateTime, nullable=True)
        _add_column_if_missing("expenses", "recurring_end_date", sa.DateTime, nullable=True)
        _add_column_if_missing("expenses", "internal_notes", sa.Text, nullable=True)
        _add_column_if_missing("expenses", "vendor_notes", sa.Text, nullable=True)
        _add_column_if_missing("expenses", "remarks", sa.Text, nullable=True)
        _add_column_if_missing("expenses", "receipt_path", sa.String(500), nullable=True)
        _add_column_if_missing("expenses", "deleted_at", sa.DateTime, nullable=True)
        _add_column_if_missing("expenses", "created_by_user_id", sa.Integer, nullable=True)
        _add_column_if_missing("expenses", "company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=True)
        _add_column_if_missing("expenses", "currency", sa.String(10), nullable=False, server_default=text("'PKR'"))
        _add_column_if_missing("expenses", "expense_type", sa.String(50), nullable=False, server_default=text("'miscellaneous'"))

    # ═══════════════════════════════════════════════════════════════════════
    # ExpenseItem
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "expense_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("expense_id", sa.Integer, sa.ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True),
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
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=text("0")),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Vendor
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "vendors",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("vendor_code", sa.String(50), nullable=True, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("contact_person", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("ntn", sa.String(50), nullable=True),
        sa.Column("strn", sa.String(50), nullable=True),
        sa.Column("payment_terms", sa.String(50), nullable=True),
        sa.Column("credit_limit", sa.Numeric(14, 2), nullable=True),
        sa.Column("outstanding_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("true")),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("created_by_user_id", sa.Integer, nullable=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=True),
    )
    # Add index on vendors.name
    if _table_exists("vendors"):
        try:
            op.create_index("ix_vendors_name", "vendors", ["name"])
        except Exception:
            pass

    # ═══════════════════════════════════════════════════════════════════════
    # SyncLog
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "sync_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("source_module", sa.String(20), nullable=False),
        sa.Column("source_record_type", sa.String(30), nullable=False),
        sa.Column("source_record_id", sa.Integer, nullable=False),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=text("'failed'")),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("journal_id", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("retried_at", sa.DateTime, nullable=True),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default=text("0")),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # finance_audit_logs
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "finance_audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("record_type", sa.String(50), nullable=True),
        sa.Column("record_id", sa.String(50), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("extra_data", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Commission
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("commissions"):
        _add_column_if_missing("commissions", "agent_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True)
        _add_column_if_missing("commissions", "dealer_id", sa.Integer, sa.ForeignKey("dealers.id"), nullable=True)
        _add_column_if_missing("commissions", "sale_amount", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("commissions", "commission_rate", sa.Numeric(12, 4), nullable=True)
        _add_column_if_missing("commissions", "calculated_amount", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("commissions", "reference", sa.String(100), nullable=True)
        _add_column_if_missing("commissions", "description", sa.String(500), nullable=True)
        _add_column_if_missing("commissions", "journal_id", sa.Integer, sa.ForeignKey("journals.id"), nullable=True)
        _add_column_if_missing("commissions", "company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # crm_payments — standalone CRM payment table
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "crm_payments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("payment_id", sa.String(20), unique=True, nullable=False),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("deal_id", sa.Integer, sa.ForeignKey("deals.id"), nullable=True),
        sa.Column("booking_id", sa.Integer, sa.ForeignKey("bookings.id"), nullable=True),
        sa.Column("installment_id", sa.Integer, sa.ForeignKey("installments.id"), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_date", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("payment_method", sa.String(30), nullable=False, server_default=text("'cash'")),
        sa.Column("receipt_number", sa.String(100), nullable=True),
        sa.Column("reference", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("journal_id", sa.Integer, sa.ForeignKey("journals.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # crm_timeline_entries
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "crm_timeline_entries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", sa.Integer, nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("old_value", sa.String(255), nullable=True),
        sa.Column("new_value", sa.String(255), nullable=True),
        sa.Column("performed_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # automation_rules
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "automation_rules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("trigger", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("config", sa.JSON, nullable=True),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=text("true")),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # Booking — missing columns
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("bookings"):
        _add_column_if_missing("bookings", "project_id", sa.Integer, nullable=True)
        _add_column_if_missing("bookings", "assigned_dealer_id", sa.Integer, sa.ForeignKey("dealers.id"), nullable=True)
        _add_column_if_missing("bookings", "assigned_staff_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True)
        _add_column_if_missing("bookings", "nominee_name", sa.String(120), nullable=True)
        _add_column_if_missing("bookings", "nominee_phone", sa.String(50), nullable=True)
        _add_column_if_missing("bookings", "nominee_cnic", sa.String(20), nullable=True)
        _add_column_if_missing("bookings", "final_price", sa.Numeric(14, 2), nullable=True)
        _add_column_if_missing("bookings", "booking_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("bookings", "processing_fee", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("bookings", "possession_charges", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("bookings", "development_charges", sa.Numeric(14, 2), nullable=False, server_default=text("0"))
        _add_column_if_missing("bookings", "custom_charges", sa.Text, nullable=True)
        _add_column_if_missing("bookings", "holding_days", sa.Integer, nullable=False, server_default=text("7"))
        _add_column_if_missing("bookings", "cancellation_reason", sa.Text, nullable=True)
        _add_column_if_missing("bookings", "confirmed_at", sa.DateTime, nullable=True)
        _add_column_if_missing("bookings", "active_at", sa.DateTime, nullable=True)
        _add_column_if_missing("bookings", "completed_at", sa.DateTime, nullable=True)
        _add_column_if_missing("bookings", "cancelled_at", sa.DateTime, nullable=True)
        _add_column_if_missing("bookings", "expired_at", sa.DateTime, nullable=True)
        _add_column_if_missing("bookings", "refunded_at", sa.DateTime, nullable=True)
        _add_column_if_missing("bookings", "converted_at", sa.DateTime, nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # Company — lifecycle fields
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("companies"):
        _add_column_if_missing("companies", "email", sa.String(255), nullable=True)
        _add_column_if_missing("companies", "phone", sa.String(60), nullable=True)
        _add_column_if_missing("companies", "currency_code", sa.String(10), nullable=False, server_default=text("'PKR'"))

    # ═══════════════════════════════════════════════════════════════════════
    # Dealer ledger — lead_id (0067 should have added it)
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("dealer_ledger_entries"):
        _add_column_if_missing("dealer_ledger_entries", "lead_id", sa.Integer, sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
        _add_column_if_missing("dealer_ledger_entries", "commission_rate", sa.Numeric(7, 4), nullable=True)
        _add_column_if_missing("dealer_ledger_entries", "gross_commission", sa.Numeric(14, 2), nullable=True)

    # ═══════════════════════════════════════════════════════════════════════
    # lead_activities
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("lead_activities"):
        _add_column_if_missing("lead_activities", "scheduled_at", sa.DateTime, nullable=True)
        _add_column_if_missing("lead_activities", "notified", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("lead_activities", "updated_at", sa.DateTime, nullable=False, server_default=sa.func.now())

    # ═══════════════════════════════════════════════════════════════════════
    # Town units (town_units) — runtime sync columns
    # ═══════════════════════════════════════════════════════════════════════
    if _table_exists("town_units"):
        _add_column_if_missing("town_units", "size_unit", sa.String(20), nullable=True)
        _add_column_if_missing("town_units", "cost_price", sa.Numeric(16, 2), nullable=True)
        _add_column_if_missing("town_units", "installment_available", sa.Boolean, nullable=False, server_default=text("true"))
        _add_column_if_missing("town_units", "is_corner", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("town_units", "is_facing_park", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("town_units", "is_main_boulevard", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("town_units", "is_possession_ready", sa.Boolean, nullable=False, server_default=text("false"))
        _add_column_if_missing("town_units", "created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True)
        _add_column_if_missing("town_units", "received_amount", sa.Numeric(16, 2), nullable=False, server_default=text("0"))

    # ═══════════════════════════════════════════════════════════════════════
    # Contacts (unified CRM contact model)
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "contacts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("tid", sa.String(20), unique=True, nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default=text("'buyer'")),
        sa.Column("contact_type", sa.String(20), nullable=False, server_default=text("'individual'")),
        sa.Column("cnic", sa.String(50), nullable=True),
        sa.Column("date_of_birth", sa.Date, nullable=True),
        sa.Column("nationality", sa.String(50), nullable=True),
        sa.Column("profession", sa.String(100), nullable=True),
        sa.Column("company_name", sa.String(120), nullable=True),
        sa.Column("ntn", sa.String(50), nullable=True),
        sa.Column("company_reg_no", sa.String(50), nullable=True),
        sa.Column("authorized_person", sa.String(120), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("whatsapp", sa.String(50), nullable=True),
        sa.Column("secondary_phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("city", sa.String(80), nullable=True),
        sa.Column("tax_ntn", sa.String(50), nullable=True),
        sa.Column("source_of_funds", sa.String(50), nullable=True),
        sa.Column("annual_income_range", sa.String(30), nullable=True),
        sa.Column("bank_name", sa.String(120), nullable=True),
        sa.Column("bank_account_no", sa.String(80), nullable=True),
        sa.Column("kyc_status", sa.String(20), nullable=False, server_default=text("'pending'")),
        sa.Column("internal_notes", sa.Text, nullable=True),
        sa.Column("archived", sa.Boolean, nullable=False, server_default=text("false")),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # ContactDocument
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "contact_documents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("contact_id", sa.Integer, sa.ForeignKey("contacts.id"), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("file_path", sa.String(512), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=text("'pending'")),
        sa.Column("uploaded_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ═══════════════════════════════════════════════════════════════════════
    # ContactInteraction
    # ═══════════════════════════════════════════════════════════════════════
    _create_table_if_missing(
        "contact_interactions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("contact_id", sa.Integer, sa.ForeignKey("contacts.id"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("interaction_date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    pass  # No downgrade for a sync migration — it only adds what's missing
