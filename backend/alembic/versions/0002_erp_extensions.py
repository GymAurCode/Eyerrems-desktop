"""ERP extensions: master settings, approval, accounting, property images, leases"""

from alembic import op
import sqlalchemy as sa

revision = "0002_erp_extensions"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "master_setting_options",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("code", sa.String(80), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("category", "code", name="uq_master_setting_category_code"),
    )
    op.create_index("ix_master_setting_options_category", "master_setting_options", ["category"])

    op.add_column(
        "users",
        sa.Column(
            "approval_status",
            sa.String(20),
            nullable=False,
            server_default="approved",
        ),
    )
    op.alter_column("users", "approval_status", server_default=None)

    op.add_column(
        "properties",
        sa.Column("property_type_option_id", sa.Integer(), sa.ForeignKey("master_setting_options.id"), nullable=True),
    )
    op.add_column(
        "units",
        sa.Column("unit_type_option_id", sa.Integer(), sa.ForeignKey("master_setting_options.id"), nullable=True),
    )
    op.add_column("deals", sa.Column("dealer_commission_amount", sa.Numeric(12, 2), nullable=True))

    op.create_table(
        "property_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("file_path", sa.String(512), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "leases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("unit_id", sa.Integer(), sa.ForeignKey("units.id"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("monthly_rent", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(40), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("account_type", sa.String(30), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "journal_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reference", sa.String(120), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )

    op.create_table(
        "journal_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("journal_batches.id"), nullable=False),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("debit", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("credit", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("description", sa.String(500), nullable=True),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("entity_type", sa.String(80), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    conn = op.get_bind()
    defaults = [
        ("property_type", "residential", "Residential", 10),
        ("property_type", "commercial", "Commercial", 20),
        ("property_type", "mixed", "Mixed Use", 30),
        ("unit_type", "studio", "Studio", 10),
        ("unit_type", "apartment", "Apartment", 20),
        ("unit_type", "office", "Office", 30),
        ("unit_type", "retail", "Retail", 40),
        ("lead_status", "new", "New", 10),
        ("lead_status", "contacted", "Contacted", 20),
        ("lead_status", "qualified", "Qualified", 30),
        ("lead_status", "lost", "Lost", 40),
        ("deal_status", "draft", "Draft", 10),
        ("deal_status", "active", "Active", 20),
        ("deal_status", "closed", "Closed", 30),
        ("deal_status", "cancelled", "Cancelled", 40),
        ("unit_status", "available", "Available", 10),
        ("unit_status", "reserved", "Reserved", 20),
        ("unit_status", "sold", "Sold", 30),
        ("unit_status", "rented", "Rented", 40),
    ]
    for category, code, label, sort_order in defaults:
        conn.execute(
            sa.text(
                """
                INSERT INTO master_setting_options (category, code, label, sort_order, is_active, created_at)
                VALUES (:category, :code, :label, :sort_order, true, now())
                """
            ),
            {"category": category, "code": code, "label": label, "sort_order": sort_order},
        )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("journal_lines")
    op.drop_table("journal_batches")
    op.drop_table("accounts")
    op.drop_table("leases")
    op.drop_table("property_images")
    op.drop_column("deals", "dealer_commission_amount")
    op.drop_column("units", "unit_type_option_id")
    op.drop_column("properties", "property_type_option_id")
    op.drop_column("users", "approval_status")
    op.drop_index("ix_master_setting_options_category", table_name="master_setting_options")
    op.drop_table("master_setting_options")
