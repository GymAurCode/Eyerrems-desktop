"""Town Management upgrade: plots → town_units with full property/financial fields.

Adds town_units table (replaces plot-only logic with a dynamic multi-type system).
Keeps the existing plots table intact for backward compatibility — no data loss.

New hierarchy: Town → Block → TownUnit (plot/house/apartment/shop/office/etc.)

Revision ID: 0032_town_units_upgrade
Revises: 0031_force_fix_company_id
Create Date: 2026-05-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0032_town_units_upgrade"
down_revision = "0031_force_fix_company_id"
branch_labels = None
depends_on = None


def _safe(conn, sql: str) -> None:
    conn.execute(sa.text("SAVEPOINT sp_safe"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_safe"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_safe"))


def upgrade():
    conn = op.get_bind()

    # Check if town_units table already exists
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # ── 1. town_units — replaces plot-only model with full property unit system ──
    if "town_units" not in existing_tables:
        op.create_table(
        "town_units",
        # Identity
        sa.Column("id",           sa.Integer(),     primary_key=True),
        sa.Column("tid",          sa.String(20),    nullable=False, unique=True),
        sa.Column("unit_number",  sa.String(80),    nullable=False),
        sa.Column("title",        sa.String(255),   nullable=True),
        sa.Column("description",  sa.Text(),        nullable=True),

        # Hierarchy
        sa.Column("block_id",     sa.Integer(),     sa.ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("town_id",      sa.Integer(),     sa.ForeignKey("towns.id",  ondelete="CASCADE"), nullable=False),

        # Classification
        # unit_type: plot | house | apartment | flat | shop | office | plaza |
        #            market | warehouse | farmhouse | building | industrial | other
        sa.Column("unit_type",    sa.String(50),    nullable=False, server_default="plot"),
        # category: residential | commercial | mixed_use | industrial
        sa.Column("category",     sa.String(50),    nullable=False, server_default="residential"),
        # status: available | booked | sold | rented | under_construction | inactive
        sa.Column("status",       sa.String(30),    nullable=False, server_default="available"),

        # Location details
        sa.Column("street",       sa.String(200),   nullable=True),
        sa.Column("sector",       sa.String(100),   nullable=True),
        sa.Column("floor_number", sa.Integer(),     nullable=True),   # for apartments/flats
        sa.Column("size_label",   sa.String(80),    nullable=True),   # "5 Marla", "10 Marla"
        sa.Column("size_sqft",    sa.Numeric(12, 2), nullable=True),
        sa.Column("dimensions",   sa.String(100),   nullable=True),   # "30x60 ft"

        # Financial
        sa.Column("total_price",        sa.Numeric(16, 2), nullable=True),
        sa.Column("booking_amount",     sa.Numeric(16, 2), nullable=True),
        sa.Column("monthly_installment",sa.Numeric(16, 2), nullable=True),
        sa.Column("installment_months", sa.Integer(),      nullable=True),
        sa.Column("received_amount",    sa.Numeric(16, 2), nullable=False, server_default="0"),
        sa.Column("remaining_balance",  sa.Numeric(16, 2), nullable=True),

        # Ownership
        sa.Column("owner_name",   sa.String(200),   nullable=True),
        sa.Column("owner_phone",  sa.String(50),    nullable=True),
        sa.Column("owner_cnic",   sa.String(20),    nullable=True),
        sa.Column("buyer_name",   sa.String(200),   nullable=True),
        sa.Column("buyer_phone",  sa.String(50),    nullable=True),
        sa.Column("tenant_name",  sa.String(200),   nullable=True),
        sa.Column("tenant_phone", sa.String(50),    nullable=True),

        # Links to existing modules
        sa.Column("property_id",  sa.Integer(),     sa.ForeignKey("properties.id", ondelete="SET NULL"), nullable=True),
        sa.Column("plot_id",      sa.Integer(),     sa.ForeignKey("plots.id",      ondelete="SET NULL"), nullable=True),

        # Notes & meta
        sa.Column("notes",        sa.Text(),        nullable=True),
        sa.Column("company_id",   sa.Integer(),     sa.ForeignKey("companies.id",  ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",   sa.DateTime(),    nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at",   sa.DateTime(),    nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_units_block_id   ON town_units(block_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_units_town_id    ON town_units(town_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_units_status     ON town_units(status)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_units_unit_type  ON town_units(unit_type)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_units_company_id ON town_units(company_id)"))
    else:
        print("town_units table already exists, skipping creation")

    # ── 2. town_transactions — finance ledger for town/unit operations ─────────
    if "town_transactions" not in existing_tables:
        op.create_table(
        "town_transactions",
        sa.Column("id",              sa.Integer(),     primary_key=True),
        sa.Column("tid",             sa.String(20),    nullable=False, unique=True),
        sa.Column("town_unit_id",    sa.Integer(),     sa.ForeignKey("town_units.id", ondelete="SET NULL"), nullable=True),
        sa.Column("town_id",         sa.Integer(),     sa.ForeignKey("towns.id",      ondelete="SET NULL"), nullable=True),
        sa.Column("block_id",        sa.Integer(),     sa.ForeignKey("blocks.id",     ondelete="SET NULL"), nullable=True),
        # transaction_type: booking | installment | sale | rent | refund | transfer | adjustment
        sa.Column("transaction_type",sa.String(50),    nullable=False),
        sa.Column("amount",          sa.Numeric(16, 2), nullable=False),
        sa.Column("payment_method",  sa.String(50),    nullable=True),   # cash | bank | cheque | online
        sa.Column("reference_no",    sa.String(100),   nullable=True),
        sa.Column("description",     sa.Text(),        nullable=True),
        sa.Column("transaction_date",sa.DateTime(),    nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        # Finance module link
        sa.Column("journal_id",      sa.Integer(),     sa.ForeignKey("journals.id",   ondelete="SET NULL"), nullable=True),
        sa.Column("payer_name",      sa.String(200),   nullable=True),
        sa.Column("payer_phone",     sa.String(50),    nullable=True),
        sa.Column("company_id",      sa.Integer(),     sa.ForeignKey("companies.id",  ondelete="SET NULL"), nullable=True),
        sa.Column("created_by",      sa.Integer(),     sa.ForeignKey("users.id",      ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",      sa.DateTime(),    nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_txn_unit_id    ON town_transactions(town_unit_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_txn_town_id    ON town_transactions(town_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_txn_type       ON town_transactions(transaction_type)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_town_txn_company_id ON town_transactions(company_id)"))
    else:
        print("town_transactions table already exists, skipping creation")

    # ── 3. Seed new finance accounts for town operations ──────────────────────
    _safe(conn, """
        INSERT INTO accounts (code, name, account_type, description, is_active, created_at, updated_at)
        VALUES
          ('4500', 'Property Sales Income',    'Income',  'Income from town unit sales',        true, NOW(), NOW()),
          ('4510', 'Booking Income',           'Income',  'Booking amounts received',           true, NOW(), NOW()),
          ('4520', 'Installment Income',       'Income',  'Installment payments received',      true, NOW(), NOW()),
          ('4530', 'Rental Income - Town',     'Income',  'Rental income from town units',      true, NOW(), NOW()),
          ('2500', 'Advance Booking Deposits', 'Liability','Booking deposits held',             true, NOW(), NOW()),
          ('1250', 'Town Units Receivable',    'Asset',   'Installments receivable from buyers',true, NOW(), NOW())
        ON CONFLICT (code) DO NOTHING
    """)

    # Set parent_id for new accounts (4500-4530 under 4000 Income, 2500 under 2000, 1250 under 1200)
    _safe(conn, """
        UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '4000')
        WHERE code IN ('4500','4510','4520','4530') AND parent_id IS NULL
    """)
    _safe(conn, """
        UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '2000')
        WHERE code = '2500' AND parent_id IS NULL
    """)
    _safe(conn, """
        UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '1200')
        WHERE code = '1250' AND parent_id IS NULL
    """)


def downgrade():
    op.drop_table("town_transactions")
    op.drop_table("town_units")
