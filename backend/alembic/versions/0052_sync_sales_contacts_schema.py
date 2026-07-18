"""Add missing columns to property_sales and create contacts tables.

Revision ID: 0052_sync_sales_contacts_schema
Revises: 0051
Create Date: 2026-07-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0052_sync_sales_contacts_schema"
down_revision = "0051"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def _table_exists(table):
    conn = op.get_bind()
    return table in inspect(conn).get_table_names()


def upgrade():
    # ── property_sales missing columns ──────────────────────────────────────
    additions = {
        "buyer_contact_id":   sa.Integer(),
        "seller_contact_id":  sa.Integer(),
        "token_amount":       sa.Numeric(12, 2),
        "token_date":         sa.Date(),
        "payment_type":       sa.String(30),
        "bank_name":          sa.String(120),
        "loan_amount":        sa.Numeric(12, 2),
        "approval_date":      sa.Date(),
        "commission_pct":     sa.Numeric(5, 2),
        "commission_amount":  sa.Numeric(12, 2),
        "commission_paid_to": sa.String(120),
        "stamp_duty":         sa.Numeric(12, 2),
        "registration_fee":   sa.Numeric(12, 2),
        "agreement_date":     sa.Date(),
        "transfer_date":      sa.Date(),
        "transfer_deed_number": sa.String(100),
        "sale_stage":         sa.String(30),
        "cancellation_reason": sa.Text(),
    }
    for col_name, col_type in additions.items():
        if not _column_exists("property_sales", col_name):
            op.add_column("property_sales", sa.Column(col_name, col_type, nullable=True))

    # Set sale_stage default for existing rows that have no value
    if _column_exists("property_sales", "sale_stage"):
        op.execute("UPDATE property_sales SET sale_stage = 'enquiry' WHERE sale_stage IS NULL")

    # ── contacts table ──────────────────────────────────────────────────────
    if not _table_exists("contacts"):
        op.create_table(
            "contacts",
            sa.Column("id",                  sa.Integer(),   primary_key=True),
            sa.Column("tid",                 sa.String(20),  nullable=False, unique=True),
            sa.Column("name",                sa.String(120), nullable=False),
            sa.Column("role",                sa.String(50),  nullable=False, server_default="buyer"),
            sa.Column("contact_type",        sa.String(20),  nullable=False, server_default="individual"),
            sa.Column("cnic",                sa.String(50)),
            sa.Column("date_of_birth",       sa.Date()),
            sa.Column("nationality",         sa.String(50)),
            sa.Column("profession",          sa.String(100)),
            sa.Column("company_name",        sa.String(120)),
            sa.Column("ntn",                 sa.String(50)),
            sa.Column("company_reg_no",      sa.String(50)),
            sa.Column("authorized_person",   sa.String(120)),
            sa.Column("email",               sa.String(255)),
            sa.Column("phone",               sa.String(50)),
            sa.Column("whatsapp",            sa.String(50)),
            sa.Column("secondary_phone",     sa.String(50)),
            sa.Column("address",             sa.Text()),
            sa.Column("city",                sa.String(80)),
            sa.Column("tax_ntn",             sa.String(50)),
            sa.Column("source_of_funds",     sa.String(50)),
            sa.Column("annual_income_range", sa.String(30)),
            sa.Column("bank_name",           sa.String(120)),
            sa.Column("bank_account_no",     sa.String(80)),
            sa.Column("kyc_status",          sa.String(20),  nullable=False, server_default="pending"),
            sa.Column("internal_notes",      sa.Text()),
            sa.Column("archived",            sa.Boolean(),   nullable=False, server_default=sa.text("false")),
            sa.Column("created_at",          sa.DateTime(),  server_default=sa.func.now(), nullable=False),
        )

    # ── contact_documents table ─────────────────────────────────────────────
    if not _table_exists("contact_documents"):
        op.create_table(
            "contact_documents",
            sa.Column("id",            sa.Integer(),    primary_key=True),
            sa.Column("contact_id",    sa.Integer(),    sa.ForeignKey("contacts.id"), nullable=False),
            sa.Column("document_type", sa.String(50)),
            sa.Column("file_path",     sa.String(512),  nullable=False),
            sa.Column("filename",      sa.String(255),  nullable=False),
            sa.Column("status",        sa.String(20),   nullable=False, server_default="pending"),
            sa.Column("uploaded_at",   sa.DateTime(),   server_default=sa.func.now(), nullable=False),
        )

    # ── contact_interactions table ──────────────────────────────────────────
    if not _table_exists("contact_interactions"):
        op.create_table(
            "contact_interactions",
            sa.Column("id",              sa.Integer(),   primary_key=True),
            sa.Column("contact_id",      sa.Integer(),   sa.ForeignKey("contacts.id"), nullable=False),
            sa.Column("type",            sa.String(20),  nullable=False),
            sa.Column("notes",           sa.Text()),
            sa.Column("interaction_date", sa.Date(),     nullable=False),
            sa.Column("created_at",      sa.DateTime(),  server_default=sa.func.now(), nullable=False),
        )


def downgrade():
    pass
