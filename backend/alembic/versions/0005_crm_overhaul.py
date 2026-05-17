"""CRM overhaul: tracking IDs, lead_id, client_id, dealers refactor,
   installment types/plans, communications."""

from alembic import op
import sqlalchemy as sa

revision = "0005_crm_overhaul"
down_revision = "0004_property_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Drop old tables that will be replaced ──────────────────────────────
    # Drop FK constraints that reference tables we're about to drop
    op.drop_constraint("leases_client_id_fkey", "leases", type_="foreignkey")
    op.drop_column("leases", "client_id")
    op.drop_constraint("properties_dealer_id_fkey", "properties", type_="foreignkey")

    # Drop in dependency order
    op.drop_table("installments")
    op.drop_table("deals")
    op.drop_table("clients")
    op.drop_table("leads")
    op.drop_table("dealers")

    # Re-add properties.dealer_id FK after dealers is recreated (done at end of upgrade)

    # ── 2. Leads (new schema) ─────────────────────────────────────────────────
    op.create_table(
        "leads",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("lead_id",    sa.String(20),   nullable=False, unique=True),
        sa.Column("name",       sa.String(120),  nullable=False),
        sa.Column("phone",      sa.String(50),   nullable=True),
        sa.Column("email",      sa.String(255),  nullable=True),
        sa.Column("source",     sa.String(80),   nullable=True),
        sa.Column("notes",      sa.Text(),       nullable=True),
        sa.Column("status",     sa.String(20),   nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )

    # ── 3. Clients (new schema with tracking_id) ──────────────────────────────
    op.create_table(
        "clients",
        sa.Column("id",                     sa.Integer(),    primary_key=True),
        sa.Column("client_id",              sa.String(20),   nullable=False, unique=True),
        sa.Column("tracking_id",            sa.String(20),   nullable=False, unique=True),
        sa.Column("lead_id",                sa.Integer(),    sa.ForeignKey("leads.id"), nullable=True),
        sa.Column("name",                   sa.String(120),  nullable=False),
        sa.Column("phone",                  sa.String(50),   nullable=True),
        sa.Column("email",                  sa.String(255),  nullable=True),
        sa.Column("interested_property_id", sa.Integer(),    sa.ForeignKey("properties.id"), nullable=True),
        sa.Column("notes",                  sa.Text(),       nullable=True),
        sa.Column("created_at",             sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_clients_tracking_id", "clients", ["tracking_id"])

    # ── 4. Dealers (new schema) ───────────────────────────────────────────────
    op.create_table(
        "dealers",
        sa.Column("id",               sa.Integer(),       primary_key=True),
        sa.Column("name",             sa.String(120),     nullable=False),
        sa.Column("phone",            sa.String(50),      nullable=True),
        sa.Column("commission_type",  sa.String(20),      nullable=False, server_default="percentage"),
        sa.Column("commission_value", sa.Numeric(12, 2),  nullable=True),
        sa.Column("created_at",       sa.DateTime(),      server_default=sa.text("now()"), nullable=False),
    )

    # ── 5. Deals (new schema) ─────────────────────────────────────────────────
    op.create_table(
        "deals",
        sa.Column("id",           sa.Integer(),       primary_key=True),
        sa.Column("deal_id",      sa.String(20),      nullable=False, unique=True),
        sa.Column("tracking_id",  sa.String(20),      nullable=False),   # inherited string, not FK
        sa.Column("client_id",    sa.Integer(),       sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("property_id",  sa.Integer(),       sa.ForeignKey("properties.id"), nullable=True),
        sa.Column("unit_id",      sa.Integer(),       sa.ForeignKey("units.id"), nullable=True),
        sa.Column("dealer_id",    sa.Integer(),       sa.ForeignKey("dealers.id"), nullable=True),
        sa.Column("deal_value",   sa.Numeric(12, 2),  nullable=False),
        sa.Column("down_payment", sa.Numeric(12, 2),  nullable=True),
        sa.Column("status",       sa.String(20),      nullable=False, server_default="active"),
        sa.Column("notes",        sa.Text(),          nullable=True),
        sa.Column("created_at",   sa.DateTime(),      server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_deals_tracking_id", "deals", ["tracking_id"])

    # ── 6. Installment types ──────────────────────────────────────────────────
    op.create_table(
        "installment_types",
        sa.Column("id",         sa.Integer(),   primary_key=True),
        sa.Column("name",       sa.String(120), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(),  server_default=sa.text("now()"), nullable=False),
    )

    # Seed defaults
    for name in ["Equal Monthly", "Quarterly", "Bi-Annual", "Annual", "Custom"]:
        conn.execute(
            sa.text("INSERT INTO installment_types (name, created_at) VALUES (:name, now())"),
            {"name": name},
        )

    # ── 7. Installment plans ──────────────────────────────────────────────────
    op.create_table(
        "installment_plans",
        sa.Column("id",           sa.Integer(),       primary_key=True),
        sa.Column("deal_id",      sa.Integer(),       sa.ForeignKey("deals.id"), nullable=False, unique=True),
        sa.Column("type_id",      sa.Integer(),       sa.ForeignKey("installment_types.id"), nullable=True),
        sa.Column("total_amount", sa.Numeric(12, 2),  nullable=False),
        sa.Column("duration",     sa.Integer(),       nullable=True),
        sa.Column("frequency",    sa.String(20),      nullable=True),
        sa.Column("created_at",   sa.DateTime(),      server_default=sa.text("now()"), nullable=False),
    )

    # ── 8. Installments ───────────────────────────────────────────────────────
    op.create_table(
        "installments",
        sa.Column("id",          sa.Integer(),       primary_key=True),
        sa.Column("plan_id",     sa.Integer(),       sa.ForeignKey("installment_plans.id"), nullable=False),
        sa.Column("due_date",    sa.Date(),          nullable=False),
        sa.Column("amount",      sa.Numeric(12, 2),  nullable=False),
        sa.Column("paid_amount", sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("status",      sa.String(20),      nullable=False, server_default="pending"),
    )

    # ── 9. Communications ─────────────────────────────────────────────────────
    op.create_table(
        "communications",
        sa.Column("id",          sa.Integer(),    primary_key=True),
        sa.Column("tracking_id", sa.String(20),   nullable=False),
        sa.Column("type",        sa.String(20),   nullable=False),
        sa.Column("description", sa.Text(),       nullable=True),
        sa.Column("attachment",  sa.String(512),  nullable=True),
        sa.Column("created_at",  sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_communications_tracking_id", "communications", ["tracking_id"])

    # Re-add properties.dealer_id FK now that dealers table is recreated
    op.create_foreign_key(
        "properties_dealer_id_fkey", "properties", "dealers", ["dealer_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_index("ix_communications_tracking_id", table_name="communications")
    op.drop_table("communications")
    op.drop_table("installments")
    op.drop_table("installment_plans")
    op.drop_table("installment_types")
    op.drop_index("ix_deals_tracking_id", table_name="deals")
    op.drop_table("deals")
    op.drop_table("dealers")
    op.drop_index("ix_clients_tracking_id", table_name="clients")
    op.drop_table("clients")
    op.drop_table("leads")

    # Restore minimal old tables
    op.create_table("leads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("contact", sa.String(120), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table("clients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table("dealers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("commission_rate", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table("deals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("dealer_id", sa.Integer(), sa.ForeignKey("dealers.id"), nullable=True),
        sa.Column("unit_id", sa.Integer(), sa.ForeignKey("units.id"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("dealer_commission_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table("installments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("deal_id", sa.Integer(), sa.ForeignKey("deals.id"), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("paid_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False),
    )
