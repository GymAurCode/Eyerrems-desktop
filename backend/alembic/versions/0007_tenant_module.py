"""Tenant Management Module: tenants, leases, rent_records, rent_increases, payments, maintenance"""

from alembic import op
import sqlalchemy as sa

revision = "0007_tenant_module"
down_revision = "0006_crm_upgrade"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id",          sa.Integer(),     primary_key=True),
        sa.Column("tenant_id",   sa.String(20),    nullable=False, unique=True),
        sa.Column("name",        sa.String(120),   nullable=False),
        sa.Column("phone",       sa.String(50),    nullable=False),
        sa.Column("email",       sa.String(255),   nullable=True),
        sa.Column("cnic",        sa.String(20),    nullable=True),
        sa.Column("family_size", sa.Integer(),     nullable=True),
        sa.Column("notes",       sa.Text(),        nullable=True),
        sa.Column("is_active",   sa.Boolean(),     nullable=False, server_default=sa.text("true")),
        sa.Column("created_at",  sa.DateTime(),    server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "tenant_leases",
        sa.Column("id",               sa.Integer(),      primary_key=True),
        sa.Column("tenant_id",        sa.Integer(),      sa.ForeignKey("tenants.id"),    nullable=False),
        sa.Column("property_id",      sa.Integer(),      sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("unit_id",          sa.Integer(),      sa.ForeignKey("units.id"),      nullable=True),
        sa.Column("is_full_property", sa.Boolean(),      nullable=False, server_default=sa.text("false")),
        sa.Column("rent_amount",      sa.Numeric(12, 2), nullable=False),
        sa.Column("security_deposit", sa.Numeric(12, 2), nullable=True),
        sa.Column("rent_cycle",       sa.String(20),     nullable=False, server_default="monthly"),
        sa.Column("due_day",          sa.Integer(),      nullable=False, server_default=sa.text("1")),
        sa.Column("lease_start",      sa.Date(),         nullable=False),
        sa.Column("lease_end",        sa.Date(),         nullable=True),
        sa.Column("status",           sa.String(20),     nullable=False, server_default="active"),
        sa.Column("created_at",       sa.DateTime(),     server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "rent_records",
        sa.Column("id",          sa.Integer(),      primary_key=True),
        sa.Column("tenant_id",   sa.Integer(),      sa.ForeignKey("tenants.id"),       nullable=False),
        sa.Column("lease_id",    sa.Integer(),      sa.ForeignKey("tenant_leases.id"), nullable=False),
        sa.Column("amount_due",  sa.Numeric(12, 2), nullable=False),
        sa.Column("amount_paid", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("due_date",    sa.Date(),         nullable=False),
        sa.Column("paid_date",   sa.Date(),         nullable=True),
        sa.Column("status",      sa.String(20),     nullable=False, server_default="pending"),
        sa.Column("late_fee",    sa.Numeric(12, 2), nullable=True),
        sa.Column("notes",       sa.Text(),         nullable=True),
        sa.Column("created_at",  sa.DateTime(),     server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "rent_increases",
        sa.Column("id",             sa.Integer(),      primary_key=True),
        sa.Column("lease_id",       sa.Integer(),      sa.ForeignKey("tenant_leases.id"), nullable=False),
        sa.Column("old_amount",     sa.Numeric(12, 2), nullable=False),
        sa.Column("new_amount",     sa.Numeric(12, 2), nullable=False),
        sa.Column("effective_from", sa.Date(),         nullable=False),
        sa.Column("notes",          sa.Text(),         nullable=True),
        sa.Column("created_at",     sa.DateTime(),     server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "tenant_payments",
        sa.Column("id",             sa.Integer(),      primary_key=True),
        sa.Column("tenant_id",      sa.Integer(),      sa.ForeignKey("tenants.id"),       nullable=False),
        sa.Column("rent_record_id", sa.Integer(),      sa.ForeignKey("rent_records.id"),  nullable=True),
        sa.Column("amount",         sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_date",   sa.Date(),         nullable=False),
        sa.Column("payment_method", sa.String(40),     nullable=False, server_default="cash"),
        sa.Column("notes",          sa.Text(),         nullable=True),
        sa.Column("created_at",     sa.DateTime(),     server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "maintenance_records",
        sa.Column("id",          sa.Integer(),      primary_key=True),
        sa.Column("property_id", sa.Integer(),      sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("tenant_id",   sa.Integer(),      sa.ForeignKey("tenants.id"),    nullable=True),
        sa.Column("description", sa.Text(),         nullable=False),
        sa.Column("cost",        sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("date",        sa.Date(),         nullable=False),
        sa.Column("mtype",       sa.String(30),     nullable=False, server_default="repair"),
        sa.Column("created_at",  sa.DateTime(),     server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("maintenance_records")
    op.drop_table("tenant_payments")
    op.drop_table("rent_increases")
    op.drop_table("rent_records")
    op.drop_table("tenant_leases")
    op.drop_table("tenants")
