"""Separate Invoice and Payment into independent ERP documents

- Creates InvoiceItem, PaymentAllocation, CustomerCredit, PaymentAttachment tables
- Migrates existing line_items JSON → InvoiceItem rows
- Migrates existing Payment.invoice_id → PaymentAllocation rows
- Removes payment_method from invoices
- Adds party_cnic, party_address to payments
- Removes invoice_id, overpayment, customer_notes, receipt_path, received_from from payments

Revision ID: 0066_finance_invoice_payment_separation
Revises: 0065_add_journals_deleted_at
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "0066_finance_invoice_payment_separation"
down_revision = "0065_add_journals_deleted_at"
branch_labels = None
depends_on = None


def _table_exists(conn, table):
    return inspect(conn).has_table(table)


def _column_exists(table, column):
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns(table)]
    return column in cols


def upgrade():
    conn = op.get_bind()

    # ─── 1. Create invoice_items table ───────────────────────────────────
    if not _table_exists(conn, "invoice_items"):
        op.create_table(
            "invoice_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("description", sa.String(500), nullable=False),
            sa.Column("quantity", sa.Numeric(12, 4), nullable=False, server_default=text("1")),
            sa.Column("unit", sa.String(20), nullable=True),
            sa.Column("unit_price", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("discount_pct", sa.Numeric(8, 4), nullable=False, server_default=text("0")),
            sa.Column("tax_pct", sa.Numeric(8, 4), nullable=False, server_default=text("0")),
            sa.Column("discount_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("tax_amount", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("line_total", sa.Numeric(14, 2), nullable=False, server_default=text("0")),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default=text("0")),
        )

    # Migrate existing line_items JSON → invoice_items
    if _table_exists(conn, "invoice_items") and _column_exists("invoices", "line_items"):
        rows = conn.execute(
            text("SELECT id, line_items FROM invoices WHERE line_items IS NOT NULL AND line_items::text != 'null'")
        ).fetchall()
        for row in rows:
            inv_id, items_json = row
            if not items_json:
                continue
            # items_json is already parsed by psycopg2
            items = items_json if isinstance(items_json, list) else []
            for idx, item in enumerate(items):
                desc = item.get("description", "") or ""
                qty = item.get("quantity", 1) or 1
                unit_price = item.get("unit_price", item.get("unit_cost", 0)) or 0
                disc_pct = item.get("discount_pct", 0) or 0
                tax_pct = item.get("tax_pct", 0) or 0
                disc_amt = item.get("discount_amount", 0) or 0
                tax_amt = item.get("tax_amount", 0) or 0
                line_total = item.get("line_total", item.get("amount", 0)) or 0
                unit = item.get("unit", "") or ""
                conn.execute(
                    text("""
                        INSERT INTO invoice_items
                            (invoice_id, description, quantity, unit, unit_price,
                             discount_pct, tax_pct, discount_amount, tax_amount,
                             line_total, sort_order)
                        VALUES
                            (:inv_id, :desc, :qty, :unit, :unit_price,
                             :disc_pct, :tax_pct, :disc_amt, :tax_amt,
                             :line_total, :sort)
                    """),
                    {
                        "inv_id": inv_id,
                        "desc": desc[:500],
                        "qty": qty,
                        "unit": unit[:20] if unit else None,
                        "unit_price": unit_price,
                        "disc_pct": disc_pct,
                        "tax_pct": tax_pct,
                        "disc_amt": disc_amt,
                        "tax_amt": tax_amt,
                        "line_total": line_total,
                        "sort": idx,
                    }
                )

    # ─── 2. Create payment_allocations table ────────────────────────────
    if not _table_exists(conn, "payment_allocations"):
        op.create_table(
            "payment_allocations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("payment_id", sa.Integer(), sa.ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("allocated_amount", sa.Numeric(14, 2), nullable=False),
        )

    # Migrate existing Payment.invoice_id → PaymentAllocation
    if _table_exists(conn, "payment_allocations") and _column_exists("payments", "invoice_id"):
        rows = conn.execute(
            text("SELECT id, invoice_id, amount FROM payments WHERE invoice_id IS NOT NULL")
        ).fetchall()
        for pid, inv_id, amt in rows:
            existing = conn.execute(
                text("SELECT COUNT(*) FROM payment_allocations WHERE payment_id = :pid AND invoice_id = :inv_id"),
                {"pid": pid, "inv_id": inv_id},
            ).scalar()
            if existing == 0:
                conn.execute(
                    text("""
                        INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
                        VALUES (:pid, :inv_id, :amt)
                    """),
                    {"pid": pid, "inv_id": inv_id, "amt": amt},
                )

    # ─── 3. Create customer_credits table ───────────────────────────────
    if not _table_exists(conn, "customer_credits"):
        op.create_table(
            "customer_credits",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("party_type", sa.String(30), nullable=True, index=True),
            sa.Column("party_id", sa.Integer(), nullable=True, index=True),
            sa.Column("party_name", sa.String(255), nullable=True),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("remaining_amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("source", sa.String(30), nullable=False),
            sa.Column("source_payment_id", sa.Integer(), sa.ForeignKey("payments.id", ondelete="SET NULL"), nullable=True),
            sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True, index=True),
        )

    # ─── 4. Create payment_attachments table ────────────────────────────
    if not _table_exists(conn, "payment_attachments"):
        op.create_table(
            "payment_attachments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("payment_id", sa.Integer(), sa.ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("file_path", sa.String(500), nullable=False),
            sa.Column("file_name", sa.String(255), nullable=False),
            sa.Column("file_type", sa.String(50), nullable=True),
            sa.Column("uploaded_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ─── 5. Migrate existing receipt_path → PaymentAttachment ────────────
    if _table_exists(conn, "payment_attachments") and _column_exists("payments", "receipt_path"):
        rows = conn.execute(
            text("SELECT id, receipt_path FROM payments WHERE receipt_path IS NOT NULL AND receipt_path != ''")
        ).fetchall()
        for pid, path in rows:
            existing = conn.execute(
                text("SELECT COUNT(*) FROM payment_attachments WHERE payment_id = :pid"),
                {"pid": pid},
            ).scalar()
            if existing == 0:
                fname = path.split("/")[-1].split("\\")[-1] if path else "receipt"
                conn.execute(
                    text("""
                        INSERT INTO payment_attachments (payment_id, file_path, file_name, file_type)
                        VALUES (:pid, :path, :fname, 'receipt')
                    """),
                    {"pid": pid, "path": path, "fname": fname},
                )

    # ─── 6. Add new columns to payments ─────────────────────────────────
    if not _column_exists("payments", "party_cnic"):
        op.add_column("payments", sa.Column("party_cnic", sa.String(50), nullable=True))
    if not _column_exists("payments", "party_address"):
        op.add_column("payments", sa.Column("party_address", sa.Text(), nullable=True))

    # ─── 7. Remove payment_method from invoices ─────────────────────────
    if _column_exists("invoices", "payment_method"):
        with op.batch_alter_table("invoices") as batch_op:
            batch_op.drop_column("payment_method")

    # ─── 8. Remove obsolete columns from payments ──────────────────────
    drop_payment_cols = [
        "invoice_id", "overpayment", "overpayment_approved_by",
        "customer_notes", "receipt_path", "received_from",
    ]
    for col in drop_payment_cols:
        if _column_exists("payments", col):
            with op.batch_alter_table("payments") as batch_op:
                batch_op.drop_column(col)


def downgrade():
    conn = op.get_bind()

    # Restore payment_method on invoices
    if not _column_exists("invoices", "payment_method"):
        op.add_column("invoices", sa.Column("payment_method", sa.String(50), nullable=True))

    # Restore removed payment columns
    restore_payment_cols = {
        "invoice_id": sa.Integer(),
        "overpayment": sa.Boolean(),
        "overpayment_approved_by": sa.Integer(),
        "customer_notes": sa.Text(),
        "receipt_path": sa.String(500),
        "received_from": sa.String(255),
    }
    for col_name, col_type in restore_payment_cols.items():
        if not _column_exists("payments", col_name):
            op.add_column("payments", sa.Column(col_name, col_type, nullable=True))

    # Remove new columns from payments
    if _column_exists("payments", "party_cnic"):
        with op.batch_alter_table("payments") as batch_op:
            batch_op.drop_column("party_cnic")
    if _column_exists("payments", "party_address"):
        with op.batch_alter_table("payments") as batch_op:
            batch_op.drop_column("party_address")

    # Drop new tables (order matters for FK constraints)
    for tbl in ["payment_attachments", "customer_credits", "payment_allocations", "invoice_items"]:
        if _table_exists(conn, tbl):
            op.drop_table(tbl)
