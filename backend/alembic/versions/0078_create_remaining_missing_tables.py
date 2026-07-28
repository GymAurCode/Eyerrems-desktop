"""Create remaining missing tables not created by any prior migration

Creates:
  followups, contracts, receipt_vouchers, transfers, handovers,
  after_sales_tickets, spreadsheet_audit_logs, attachments,
  lookup_values, employee_tasks, performance_reviews

Revision ID: 0078
Revises: 0077
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0078"
down_revision: Union[str, None] = "0077"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    return inspect(conn).has_table(name)


def upgrade() -> None:
    # ─── followups ────────────────────────────────────────────────────────
    if not _table_exists("followups"):
        op.create_table(
            "followups",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("fu_id", sa.String(20), nullable=False, unique=True),
            sa.Column("lead_id", sa.Integer(), sa.ForeignKey("leads.id"), nullable=False, index=True),
            sa.Column("assigned_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("time", sa.String(10), nullable=True),
            sa.Column("fu_type", sa.String(20), nullable=False, server_default=sa.text("'call'")),
            sa.Column("fu_status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("reminded", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── contracts ────────────────────────────────────────────────────────
    if not _table_exists("contracts"):
        op.create_table(
            "contracts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("contract_id", sa.String(20), nullable=False, unique=True, index=True),
            sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), nullable=False, index=True),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False, index=True),
            sa.Column("deal_id", sa.Integer(), sa.ForeignKey("deals.id"), nullable=True),
            sa.Column("agreement_doc_url", sa.String(512), nullable=True),
            sa.Column("signed_date", sa.DateTime(), nullable=True),
            sa.Column("effective_date", sa.DateTime(), nullable=True),
            sa.Column("expiry_date", sa.DateTime(), nullable=True),
            sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("down_payment_amount", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("installment_count", sa.Integer(), nullable=True),
            sa.Column("installment_freq", sa.String(20), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'draft'")),
            sa.Column("terms_text", sa.Text(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("signed_by", sa.String(120), nullable=True),
            sa.Column("witness", sa.String(120), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── receipt_vouchers ─────────────────────────────────────────────────
    if not _table_exists("receipt_vouchers"):
        op.create_table(
            "receipt_vouchers",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("voucher_no", sa.String(30), nullable=False, unique=True, index=True),
            sa.Column("voucher_type", sa.String(20), nullable=False, server_default=sa.text("'receipt'")),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=True, index=True),
            sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), nullable=True),
            sa.Column("installment_id", sa.Integer(), sa.ForeignKey("installments.id"), nullable=True),
            sa.Column("deal_id", sa.Integer(), sa.ForeignKey("deals.id"), nullable=True),
            sa.Column("journal_id", sa.Integer(), sa.ForeignKey("journals.id"), nullable=True),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("payment_mode", sa.String(20), nullable=False, server_default=sa.text("'cash'")),
            sa.Column("payment_date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("reference_no", sa.String(100), nullable=True),
            sa.Column("description", sa.String(500), nullable=True),
            sa.Column("receipt_type", sa.String(30), nullable=False, server_default=sa.text("'installment'")),
            sa.Column("posted_to_ledger", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("posted_to_subsidiary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── transfers ────────────────────────────────────────────────────────
    if not _table_exists("transfers"):
        op.create_table(
            "transfers",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("transfer_id", sa.String(20), nullable=False, unique=True, index=True),
            sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), nullable=False, index=True),
            sa.Column("from_client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
            sa.Column("to_client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
            sa.Column("transfer_fee", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("transfer_date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("approved_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── handovers ────────────────────────────────────────────────────────
    if not _table_exists("handovers"):
        op.create_table(
            "handovers",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("handover_id", sa.String(20), nullable=False, unique=True, index=True),
            sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), nullable=False, index=True),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
            sa.Column("unit_id", sa.Integer(), sa.ForeignKey("units.id"), nullable=True),
            sa.Column("possession_date", sa.DateTime(), nullable=False),
            sa.Column("snag_list_status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("snag_list_notes", sa.Text(), nullable=True),
            sa.Column("handover_notes", sa.Text(), nullable=True),
            sa.Column("doc_url", sa.String(512), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── after_sales_tickets ──────────────────────────────────────────────
    if not _table_exists("after_sales_tickets"):
        op.create_table(
            "after_sales_tickets",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("ticket_id", sa.String(20), nullable=False, unique=True, index=True),
            sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False, index=True),
            sa.Column("unit_id", sa.Integer(), sa.ForeignKey("units.id"), nullable=True),
            sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), nullable=True),
            sa.Column("ticket_type", sa.String(40), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("priority", sa.String(20), nullable=False, server_default=sa.text("'medium'")),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'open'")),
            sa.Column("chargeable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("charge_amount", sa.Numeric(14, 2), nullable=True),
            sa.Column("assigned_to_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("resolved_at", sa.DateTime(), nullable=True),
            sa.Column("resolution_notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── spreadsheet_audit_logs ───────────────────────────────────────────
    if not _table_exists("spreadsheet_audit_logs"):
        op.create_table(
            "spreadsheet_audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_name", sa.String(120), nullable=False),
            sa.Column("sheet_name", sa.String(120), nullable=False),
            sa.Column("row_id", sa.Integer(), nullable=True),
            sa.Column("column_name", sa.String(120), nullable=True),
            sa.Column("old_value", sa.Text(), nullable=True),
            sa.Column("new_value", sa.Text(), nullable=True),
            sa.Column("action", sa.String(40), nullable=False, server_default=sa.text("'edit'")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # ─── attachments ──────────────────────────────────────────────────────
    if not _table_exists("attachments"):
        op.create_table(
            "attachments",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("module", sa.String(50), nullable=False),
            sa.Column("record_id", sa.String(36), nullable=False),
            sa.Column("document_name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("document_status", sa.String(20), server_default=sa.text("'VERIFIED'")),
            sa.Column("file_data", sa.LargeBinary(), nullable=False),
            sa.Column("file_size_kb", sa.Numeric(10, 2), nullable=True),
            sa.Column("file_type", sa.String(100), nullable=False),
            sa.Column("serial_no", sa.Integer(), autoincrement=True),
            sa.Column("uploaded_by", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("idx_attachments_module_record", "attachments", ["module", "record_id"])

    # ─── lookup_values ────────────────────────────────────────────────────
    if not _table_exists("lookup_values"):
        op.create_table(
            "lookup_values",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("category", sa.String(100), nullable=False, index=True),
            sa.Column("label", sa.String(255), nullable=False),
            sa.Column("value", sa.String(255), nullable=False),
            sa.Column("sort_order", sa.Integer(), server_default=sa.text("0")),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
            sa.Column("is_default", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint("category", "value", name="uq_lookup_category_value"),
        )
        op.create_index("idx_lookup_category", "lookup_values", ["category"])

    # ─── employee_tasks ───────────────────────────────────────────────────
    if not _table_exists("employee_tasks"):
        op.create_table(
            "employee_tasks",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False),
            sa.Column("assigned_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("deadline", sa.Date(), nullable=True),
            sa.Column("priority", sa.String(20), nullable=False, server_default=sa.text("'medium'")),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("assigned_date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("completed_date", sa.DateTime(), nullable=True),
            sa.Column("remark", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── performance_reviews ──────────────────────────────────────────────
    if not _table_exists("performance_reviews"):
        op.create_table(
            "performance_reviews",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False),
            sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("review_date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("period_start", sa.Date(), nullable=True),
            sa.Column("period_end", sa.Date(), nullable=True),
            sa.Column("task_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("attendance_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("manual_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("overall_rating", sa.Numeric(5, 2), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    tables = [
        "performance_reviews",
        "employee_tasks",
        "lookup_values",
        "attachments",
        "spreadsheet_audit_logs",
        "after_sales_tickets",
        "handovers",
        "transfers",
        "receipt_vouchers",
        "contracts",
        "followups",
    ]
    for tbl in tables:
        if _table_exists(tbl):
            op.drop_table(tbl)
