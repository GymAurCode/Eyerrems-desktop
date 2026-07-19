"""Enhanced Invoice Model - ERP Invoice Management System

Revision ID: 0059_enhanced_invoice_model
Revises: 0058_fix_gender_specific_column_type
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "0059_enhanced_invoice_model"
down_revision = "0058_fix_gender_specific_column_type"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade() -> None:
    conn = op.get_bind()
    # Widen status column and add new columns to invoices
    try:
        op.alter_column("invoices", "status", type_=sa.String(30), nullable=False, server_default="draft")
    except Exception:
        pass
    try:
        op.alter_column("invoices", "invoice_type", type_=sa.String(30), nullable=True)
    except Exception:
        pass

    if not _column_exists("invoices", "invoice_number"):
        op.add_column("invoices", sa.Column("invoice_number", sa.String(50), nullable=True, unique=True))
    if not _column_exists("invoices", "invoice_date"):
        op.add_column("invoices", sa.Column("invoice_date", sa.DateTime(), nullable=True))
    if not _column_exists("invoices", "subtotal"):
        op.add_column("invoices", sa.Column("subtotal", sa.Numeric(14, 2), nullable=False, server_default="0"))
    if not _column_exists("invoices", "discount_amount"):
        op.add_column("invoices", sa.Column("discount_amount", sa.Numeric(14, 2), nullable=False, server_default="0"))
    if not _column_exists("invoices", "tax_amount"):
        op.add_column("invoices", sa.Column("tax_amount", sa.Numeric(14, 2), nullable=False, server_default="0"))
    if not _column_exists("invoices", "adjustment"):
        op.add_column("invoices", sa.Column("adjustment", sa.Numeric(14, 2), nullable=False, server_default="0"))
    if not _column_exists("invoices", "currency"):
        op.add_column("invoices", sa.Column("currency", sa.String(10), nullable=False, server_default="PKR"))
    if not _column_exists("invoices", "line_items"):
        op.add_column("invoices", sa.Column("line_items", postgresql.JSON(), nullable=True))
    if not _column_exists("invoices", "party_type"):
        op.add_column("invoices", sa.Column("party_type", sa.String(30), nullable=True))
    if not _column_exists("invoices", "party_id"):
        op.add_column("invoices", sa.Column("party_id", sa.Integer(), nullable=True, index=True))
    if not _column_exists("invoices", "client_phone"):
        op.add_column("invoices", sa.Column("client_phone", sa.String(50), nullable=True))
    if not _column_exists("invoices", "client_email"):
        op.add_column("invoices", sa.Column("client_email", sa.String(255), nullable=True))
    if not _column_exists("invoices", "client_cnic"):
        op.add_column("invoices", sa.Column("client_cnic", sa.String(50), nullable=True))
    if not _column_exists("invoices", "client_ntn"):
        op.add_column("invoices", sa.Column("client_ntn", sa.String(50), nullable=True))
    if not _column_exists("invoices", "client_address"):
        op.add_column("invoices", sa.Column("client_address", sa.Text(), nullable=True))
    if not _column_exists("invoices", "reference_type"):
        op.add_column("invoices", sa.Column("reference_type", sa.String(30), nullable=True))
    if not _column_exists("invoices", "reference_id"):
        op.add_column("invoices", sa.Column("reference_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "deal_id"):
        op.add_column("invoices", sa.Column("deal_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "booking_id"):
        op.add_column("invoices", sa.Column("booking_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "lease_id"):
        op.add_column("invoices", sa.Column("lease_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "maintenance_ticket_id"):
        op.add_column("invoices", sa.Column("maintenance_ticket_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "construction_project_id"):
        op.add_column("invoices", sa.Column("construction_project_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "purchase_order_id"):
        op.add_column("invoices", sa.Column("purchase_order_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "contract_id"):
        op.add_column("invoices", sa.Column("contract_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "payment_terms"):
        op.add_column("invoices", sa.Column("payment_terms", sa.String(50), nullable=True, server_default="due_immediately"))
    if not _column_exists("invoices", "payment_method"):
        op.add_column("invoices", sa.Column("payment_method", sa.String(50), nullable=True))
    if not _column_exists("invoices", "internal_notes"):
        op.add_column("invoices", sa.Column("internal_notes", sa.Text(), nullable=True))
    if not _column_exists("invoices", "customer_notes"):
        op.add_column("invoices", sa.Column("customer_notes", sa.Text(), nullable=True))
    if not _column_exists("invoices", "terms_conditions"):
        op.add_column("invoices", sa.Column("terms_conditions", sa.Text(), nullable=True))
    if not _column_exists("invoices", "late_payment_policy"):
        op.add_column("invoices", sa.Column("late_payment_policy", sa.Text(), nullable=True))
    if not _column_exists("invoices", "footer_message"):
        op.add_column("invoices", sa.Column("footer_message", sa.Text(), nullable=True))
    if not _column_exists("invoices", "auto_generated"):
        op.add_column("invoices", sa.Column("auto_generated", sa.Boolean(), nullable=False, server_default="false"))
    if not _column_exists("invoices", "source_module"):
        op.add_column("invoices", sa.Column("source_module", sa.String(30), nullable=True))
    if not _column_exists("invoices", "source_record_id"):
        op.add_column("invoices", sa.Column("source_record_id", sa.Integer(), nullable=True))
    if not _column_exists("invoices", "sent_at"):
        op.add_column("invoices", sa.Column("sent_at", sa.DateTime(), nullable=True))
    if not _column_exists("invoices", "viewed_at"):
        op.add_column("invoices", sa.Column("viewed_at", sa.DateTime(), nullable=True))
    if not _column_exists("invoices", "cancelled_at"):
        op.add_column("invoices", sa.Column("cancelled_at", sa.DateTime(), nullable=True))
    if not _column_exists("invoices", "voided_at"):
        op.add_column("invoices", sa.Column("voided_at", sa.DateTime(), nullable=True))

    existing_indexes = {idx["name"] for idx in inspect(conn).get_indexes("invoices")}
    if "ix_invoices_invoice_number" not in existing_indexes:
        op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"], unique=True)
    if "ix_invoices_party_type" not in existing_indexes:
        op.create_index("ix_invoices_party_type", "invoices", ["party_type"])
    if "ix_invoices_source_module" not in existing_indexes:
        op.create_index("ix_invoices_source_module", "invoices", ["source_module"])

    # Backfill existing invoices
    op.execute("UPDATE invoices SET invoice_number = 'INV-2020-' || LPAD(id::text, 6, '0') WHERE invoice_number IS NULL")
    op.execute("UPDATE invoices SET invoice_date = created_at WHERE invoice_date IS NULL")
    op.execute("UPDATE invoices SET subtotal = amount WHERE subtotal = 0")
    op.execute("UPDATE invoices SET currency = 'PKR' WHERE currency IS NULL")
    op.execute("UPDATE invoices SET payment_terms = 'due_immediately' WHERE payment_terms IS NULL")
    op.execute("UPDATE invoices SET line_items = ('[{\"description\": \"Invoice Item\", \"quantity\": 1, \"unit\": \"lump\", \"unit_price\": ' || amount || ', \"discount_pct\": 0, \"tax_pct\": 0, \"amount\": ' || amount || '}]')::json WHERE line_items IS NULL")

    # Migrate statuses
    op.execute("UPDATE invoices SET status = 'partially_paid' WHERE status = 'partial'")
    op.execute("UPDATE invoices SET status = 'draft' WHERE status NOT IN ('draft','pending','sent','partially_paid','paid','overdue','cancelled','void')")

    # Set invoice_number to NOT NULL after backfill
    try:
        op.alter_column("invoices", "invoice_number", nullable=False)
    except Exception:
        pass
    try:
        op.alter_column("invoices", "invoice_date", nullable=False)
    except Exception:
        pass


def downgrade() -> None:
    op.drop_column("invoices", "voided_at")
    op.drop_column("invoices", "cancelled_at")
    op.drop_column("invoices", "viewed_at")
    op.drop_column("invoices", "sent_at")
    op.drop_column("invoices", "source_record_id")
    op.drop_column("invoices", "source_module")
    op.drop_column("invoices", "auto_generated")
    op.drop_column("invoices", "footer_message")
    op.drop_column("invoices", "late_payment_policy")
    op.drop_column("invoices", "terms_conditions")
    op.drop_column("invoices", "customer_notes")
    op.drop_column("invoices", "internal_notes")
    op.drop_column("invoices", "payment_method")
    op.drop_column("invoices", "payment_terms")
    op.drop_column("invoices", "contract_id")
    op.drop_column("invoices", "purchase_order_id")
    op.drop_column("invoices", "construction_project_id")
    op.drop_column("invoices", "maintenance_ticket_id")
    op.drop_column("invoices", "lease_id")
    op.drop_column("invoices", "booking_id")
    op.drop_column("invoices", "deal_id")
    op.drop_column("invoices", "reference_id")
    op.drop_column("invoices", "reference_type")
    op.drop_column("invoices", "client_address")
    op.drop_column("invoices", "client_ntn")
    op.drop_column("invoices", "client_cnic")
    op.drop_column("invoices", "client_email")
    op.drop_column("invoices", "client_phone")
    op.drop_column("invoices", "party_id")
    op.drop_column("invoices", "party_type")
    op.drop_column("invoices", "line_items")
    op.drop_column("invoices", "currency")
    op.drop_column("invoices", "adjustment")
    op.drop_column("invoices", "tax_amount")
    op.drop_column("invoices", "discount_amount")
    op.drop_column("invoices", "subtotal")
    op.drop_column("invoices", "invoice_date")
    op.drop_column("invoices", "invoice_number")

    op.alter_column("invoices", "status", type_=sa.String(20), nullable=False, server_default="pending")
    op.alter_column("invoices", "invoice_type", type_=sa.String(20), nullable=True)
    op.execute("UPDATE invoices SET status = 'partial' WHERE status = 'partially_paid'")
