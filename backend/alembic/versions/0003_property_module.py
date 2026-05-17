"""Property module: TIDs, locations, amenities, attachments, buyers, sellers, sales, lease refactor"""

from alembic import op
import sqlalchemy as sa

revision = "0003_property_module"
down_revision = "0002_erp_extensions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Locations ────────────────────────────────────────────────────────────
    op.create_table(
        "locations",
        sa.Column("id",         sa.Integer(),     primary_key=True),
        sa.Column("tid",        sa.String(20),    nullable=False, unique=True),
        sa.Column("name",       sa.String(120),   nullable=False),
        sa.Column("parent_id",  sa.Integer(),     sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(),    server_default=sa.text("now()"), nullable=False),
    )

    # ── Amenities ────────────────────────────────────────────────────────────
    op.create_table(
        "amenities",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("name",       sa.String(120),  nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "property_amenities",
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.id"), primary_key=True),
        sa.Column("amenity_id",  sa.Integer(), sa.ForeignKey("amenities.id"),  primary_key=True),
    )

    # ── Attachments ──────────────────────────────────────────────────────────
    op.create_table(
        "property_attachments",
        sa.Column("id",          sa.Integer(),    primary_key=True),
        sa.Column("property_id", sa.Integer(),    sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("file_path",   sa.String(512),  nullable=False),
        sa.Column("filename",    sa.String(255),  nullable=False),
        sa.Column("created_at",  sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )

    # ── Buyers / Sellers ─────────────────────────────────────────────────────
    op.create_table(
        "buyers",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("tid",        sa.String(20),   nullable=False, unique=True),
        sa.Column("name",       sa.String(120),  nullable=False),
        sa.Column("email",      sa.String(255),  nullable=True),
        sa.Column("phone",      sa.String(50),   nullable=True),
        sa.Column("address",    sa.String(255),  nullable=True),
        sa.Column("notes",      sa.Text(),       nullable=True),
        sa.Column("created_at", sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "sellers",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("tid",        sa.String(20),   nullable=False, unique=True),
        sa.Column("name",       sa.String(120),  nullable=False),
        sa.Column("email",      sa.String(255),  nullable=True),
        sa.Column("phone",      sa.String(50),   nullable=True),
        sa.Column("address",    sa.String(255),  nullable=True),
        sa.Column("notes",      sa.Text(),       nullable=True),
        sa.Column("created_at", sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )

    # ── Property Sales ───────────────────────────────────────────────────────
    op.create_table(
        "property_sales",
        sa.Column("id",          sa.Integer(),       primary_key=True),
        sa.Column("tid",         sa.String(20),      nullable=False, unique=True),
        sa.Column("property_id", sa.Integer(),       sa.ForeignKey("properties.id"), nullable=True),
        sa.Column("unit_id",     sa.Integer(),       sa.ForeignKey("units.id"),      nullable=True),
        sa.Column("buyer_id",    sa.Integer(),       sa.ForeignKey("buyers.id"),     nullable=False),
        sa.Column("seller_id",   sa.Integer(),       sa.ForeignKey("sellers.id"),    nullable=False),
        sa.Column("sale_price",  sa.Numeric(12, 2),  nullable=False),
        sa.Column("sale_date",   sa.Date(),          nullable=False),
        sa.Column("status",      sa.String(30),      nullable=False, server_default="pending"),
        sa.Column("notes",       sa.Text(),          nullable=True),
        sa.Column("created_at",  sa.DateTime(),      server_default=sa.text("now()"), nullable=False),
    )

    # ── Add TID + new columns to existing tables ──────────────────────────────
    op.add_column("properties", sa.Column("tid",         sa.String(20), nullable=True))
    op.add_column("properties", sa.Column("status",      sa.String(30), nullable=False, server_default="available"))
    op.add_column("properties", sa.Column("category",    sa.String(80), nullable=True))
    op.add_column("properties", sa.Column("size",        sa.String(80), nullable=True))
    op.add_column("properties", sa.Column("for_sale",    sa.Boolean(),  nullable=False, server_default=sa.text("false")))
    op.add_column("properties", sa.Column("sale_price",  sa.Numeric(12, 2), nullable=True))
    op.add_column("properties", sa.Column("dealer_id",   sa.Integer(),  sa.ForeignKey("dealers.id"), nullable=True))
    op.add_column("properties", sa.Column("year_built",  sa.Integer(),  nullable=True))
    op.add_column("properties", sa.Column("location_id", sa.Integer(),  sa.ForeignKey("locations.id"), nullable=True))

    op.add_column("floors", sa.Column("tid",        sa.String(20), nullable=True))
    op.add_column("floors", sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))

    op.add_column("units", sa.Column("tid",        sa.String(20), nullable=True))
    op.add_column("units", sa.Column("size",       sa.String(80), nullable=True))
    op.add_column("units", sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))

    # ── Refactor leases: drop client_id, add tid + tenant_name ───────────────
    op.add_column("leases", sa.Column("tid",         sa.String(20),  nullable=True))
    op.add_column("leases", sa.Column("tenant_name", sa.String(120), nullable=True))

    # Back-fill TIDs for existing rows
    conn = op.get_bind()
    for table, prefix in [
        ("properties", "PRO"),
        ("floors",     "FLR"),
        ("units",      "UNT"),
        ("leases",     "LEA"),
    ]:
        rows = conn.execute(sa.text(f"SELECT id FROM {table} ORDER BY id")).fetchall()
        for i, (row_id,) in enumerate(rows, start=1):
            tid = f"{prefix}-{i:04d}"
            conn.execute(sa.text(f"UPDATE {table} SET tid = :tid WHERE id = :id"), {"tid": tid, "id": row_id})

    # Now make TID not-nullable and unique
    op.alter_column("properties", "tid", nullable=False)
    op.create_unique_constraint("uq_properties_tid", "properties", ["tid"])

    op.alter_column("floors", "tid", nullable=False)
    op.create_unique_constraint("uq_floors_tid", "floors", ["tid"])

    op.alter_column("units", "tid", nullable=False)
    op.create_unique_constraint("uq_units_tid", "units", ["tid"])

    op.alter_column("leases", "tid", nullable=False)
    op.create_unique_constraint("uq_leases_tid", "leases", ["tid"])


def downgrade() -> None:
    op.drop_constraint("uq_leases_tid",     "leases",     type_="unique")
    op.drop_constraint("uq_units_tid",      "units",      type_="unique")
    op.drop_constraint("uq_floors_tid",     "floors",     type_="unique")
    op.drop_constraint("uq_properties_tid", "properties", type_="unique")

    for col in ["tid", "tenant_name"]:
        op.drop_column("leases", col)
    for col in ["tid", "size", "created_at"]:
        op.drop_column("units", col)
    for col in ["tid", "created_at"]:
        op.drop_column("floors", col)
    for col in ["tid", "status", "category", "size", "for_sale", "sale_price",
                "dealer_id", "year_built", "location_id"]:
        op.drop_column("properties", col)

    op.drop_table("property_sales")
    op.drop_table("sellers")
    op.drop_table("buyers")
    op.drop_table("property_attachments")
    op.drop_table("property_amenities")
    op.drop_table("amenities")
    op.drop_table("locations")
