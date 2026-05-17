"""CRM upgrade: client/dealer/deal new fields, attachment tables, comm subject/date."""

from alembic import op
import sqlalchemy as sa

revision = "0006_crm_upgrade"
down_revision = "0005_crm_overhaul"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── clients: new columns ──────────────────────────────────────────────────
    op.add_column("clients", sa.Column("cnic",         sa.String(20),  nullable=True))
    op.add_column("clients", sa.Column("status",       sa.String(20),  nullable=False, server_default="active"))
    op.add_column("clients", sa.Column("company_name", sa.String(120), nullable=True))
    op.add_column("clients", sa.Column("address",      sa.Text(),      nullable=True))
    op.add_column("clients", sa.Column("dealer_id",    sa.Integer(),   sa.ForeignKey("dealers.id"), nullable=True))

    # ── dealers: new columns ──────────────────────────────────────────────────
    op.add_column("dealers", sa.Column("dealer_id",       sa.String(20),      nullable=True))
    op.add_column("dealers", sa.Column("email",           sa.String(255),     nullable=True))
    op.add_column("dealers", sa.Column("company",         sa.String(120),     nullable=True))
    op.add_column("dealers", sa.Column("commission_rate", sa.Numeric(12, 2),  nullable=True))
    op.add_column("dealers", sa.Column("cnic",            sa.String(20),      nullable=True))
    op.add_column("dealers", sa.Column("address",         sa.Text(),          nullable=True))
    op.add_column("dealers", sa.Column("notes",           sa.Text(),          nullable=True))

    # Back-fill dealer_id for existing dealers
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id FROM dealers ORDER BY id")).fetchall()
    for i, (row_id,) in enumerate(rows, start=1):
        conn.execute(
            sa.text("UPDATE dealers SET dealer_id = :did WHERE id = :id"),
            {"did": f"DEA-{i:04d}", "id": row_id},
        )
    op.alter_column("dealers", "dealer_id", nullable=False)
    op.create_unique_constraint("uq_dealers_dealer_id", "dealers", ["dealer_id"])

    # Rename commission_value → commission_rate (already added above; drop old)
    # commission_value was the old column name — drop it if it exists
    try:
        op.drop_column("dealers", "commission_value")
    except Exception:
        pass  # column may not exist in all environments

    # ── deals: new columns ────────────────────────────────────────────────────
    op.add_column("deals", sa.Column("deal_title",           sa.String(255), nullable=True))
    op.add_column("deals", sa.Column("client_role",          sa.String(20),  nullable=True))
    op.add_column("deals", sa.Column("down_payment_status",  sa.String(20),  nullable=False, server_default="pending"))
    op.add_column("deals", sa.Column("deal_date",            sa.Date(),      nullable=True))
    op.add_column("deals", sa.Column("due_date",             sa.Date(),      nullable=True))
    op.add_column("deals", sa.Column("description",          sa.Text(),      nullable=True))

    # Rename deal_value if needed (already correct), rename notes if needed
    # installment_plans: rename duration → total_count, add amount_per
    op.add_column("installment_plans", sa.Column("total_count", sa.Integer(),      nullable=True))
    op.add_column("installment_plans", sa.Column("amount_per",  sa.Numeric(12, 2), nullable=True))
    try:
        op.drop_column("installment_plans", "duration")
    except Exception:
        pass

    # ── communications: new columns ───────────────────────────────────────────
    op.add_column("communications", sa.Column("client_id",  sa.Integer(), sa.ForeignKey("clients.id"), nullable=True))
    op.add_column("communications", sa.Column("subject",    sa.String(255), nullable=True))
    op.add_column("communications", sa.Column("comm_date",  sa.Date(),      nullable=True))

    # ── attachment tables ─────────────────────────────────────────────────────
    op.create_table(
        "client_attachments",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("client_id",  sa.Integer(),    sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("file_path",  sa.String(512),  nullable=False),
        sa.Column("filename",   sa.String(255),  nullable=False),
        sa.Column("created_at", sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "dealer_attachments",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("dealer_id",  sa.Integer(),    sa.ForeignKey("dealers.id"), nullable=False),
        sa.Column("file_path",  sa.String(512),  nullable=False),
        sa.Column("filename",   sa.String(255),  nullable=False),
        sa.Column("created_at", sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "deal_attachments",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("deal_id",    sa.Integer(),    sa.ForeignKey("deals.id"), nullable=False),
        sa.Column("file_path",  sa.String(512),  nullable=False),
        sa.Column("filename",   sa.String(255),  nullable=False),
        sa.Column("created_at", sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("deal_attachments")
    op.drop_table("dealer_attachments")
    op.drop_table("client_attachments")

    for col in ["comm_date", "subject", "client_id"]:
        op.drop_column("communications", col)

    for col in ["amount_per", "total_count"]:
        op.drop_column("installment_plans", col)

    for col in ["description", "due_date", "deal_date", "down_payment_status", "client_role", "deal_title"]:
        op.drop_column("deals", col)

    op.drop_constraint("uq_dealers_dealer_id", "dealers", type_="unique")
    for col in ["notes", "address", "cnic", "commission_rate", "company", "email", "dealer_id"]:
        op.drop_column("dealers", col)

    for col in ["dealer_id", "address", "company_name", "status", "cnic"]:
        op.drop_column("clients", col)
