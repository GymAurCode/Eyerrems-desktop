"""Town / Block / Plot hierarchy module.

Adds:
  - towns table
  - blocks table
  - plots table
  - deal_type + reference_id columns on deals (CRM)
  - town_id + block_id columns on construction_projects

Revision ID: 0021_town_module
Revises: 0020_multitenant_saas
Create Date: 2026-05-05 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0021_town_module'
down_revision = '0020_multitenant_saas'
branch_labels = None
depends_on = None


def _safe_add_column(conn, table: str, col_ddl: str) -> None:
    """Add a column, silently skip if it already exists."""
    conn.execute(sa.text("SAVEPOINT sp_col"))
    try:
        conn.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN {col_ddl}"))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_col"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_col"))


def upgrade():
    conn = op.get_bind()

    # ── 1. towns ──────────────────────────────────────────────────────────────
    op.create_table(
        "towns",
        sa.Column("id",          sa.Integer(),     primary_key=True),
        sa.Column("tid",         sa.String(20),    nullable=False, unique=True),
        sa.Column("name",        sa.String(200),   nullable=False),
        sa.Column("location",    sa.String(500),   nullable=True),
        sa.Column("description", sa.Text(),        nullable=True),
        sa.Column("company_id",  sa.Integer(),     sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",  sa.DateTime(),    nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at",  sa.DateTime(),    nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    # ── Safe index creation for towns ───────────────────────────────────────
    # ix_towns_company_id
    conn.execute(sa.text("SAVEPOINT sp_ix_towns_company_id"))
    try:
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_towns_company_id ON towns (company_id)"
        ))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_ix_towns_company_id"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_ix_towns_company_id"))
    # ix_towns_name
    conn.execute(sa.text("SAVEPOINT sp_ix_towns_name"))
    try:
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_towns_name ON towns (name)"
        ))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_ix_towns_name"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_ix_towns_name"))


    # ── 2. blocks ─────────────────────────────────────────────────────────────
    op.create_table(
        "blocks",
        sa.Column("id",                  sa.Integer(),     primary_key=True),
        sa.Column("tid",                 sa.String(20),    nullable=False, unique=True),
        sa.Column("town_id",             sa.Integer(),     sa.ForeignKey("towns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name",                sa.String(200),   nullable=False),
        sa.Column("block_type",          sa.String(50),    nullable=False, server_default="residential"),
        sa.Column("description",         sa.Text(),        nullable=True),
        sa.Column("progress_percentage", sa.Float(),       nullable=False, server_default="0"),
        sa.Column("work_type",           sa.String(200),   nullable=True),
        sa.Column("company_id",          sa.Integer(),     sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",          sa.DateTime(),    nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at",          sa.DateTime(),    nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    # ── Safe index creation for blocks ────────────────────────────────────────
    conn = op.get_bind()
    # ix_blocks_town_id
    conn.execute(sa.text("SAVEPOINT sp_ix_blocks_town_id"))
    try:
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_blocks_town_id ON blocks (town_id)"
        ))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_ix_blocks_town_id"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_ix_blocks_town_id"))
    # ix_blocks_company_id
    conn.execute(sa.text("SAVEPOINT sp_ix_blocks_company_id"))
    try:
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_blocks_company_id ON blocks (company_id)"
        ))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_ix_blocks_company_id"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_ix_blocks_company_id"))


    # ── 3. plots ──────────────────────────────────────────────────────────────
    op.create_table(
        "plots",
        sa.Column("id",          sa.Integer(),      primary_key=True),
        sa.Column("tid",         sa.String(20),     nullable=False, unique=True),
        sa.Column("block_id",    sa.Integer(),      sa.ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plot_number", sa.String(50),     nullable=False),
        sa.Column("size",        sa.String(80),     nullable=True),
        sa.Column("size_sqft",   sa.Numeric(10, 2), nullable=True),
        sa.Column("status",      sa.String(30),     nullable=False, server_default="available"),
        sa.Column("plot_type",   sa.String(50),     nullable=True),
        sa.Column("price",       sa.Numeric(14, 2), nullable=True),
        sa.Column("owner_name",  sa.String(200),    nullable=True),
        sa.Column("owner_phone", sa.String(50),     nullable=True),
        sa.Column("notes",       sa.Text(),         nullable=True),
        sa.Column("property_id", sa.Integer(),      sa.ForeignKey("properties.id", ondelete="SET NULL"), nullable=True),
        sa.Column("company_id",  sa.Integer(),      sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",  sa.DateTime(),     nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at",  sa.DateTime(),     nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_plots_block_id",   "plots", ["block_id"])
    op.create_index("ix_plots_status",     "plots", ["status"])
    op.create_index("ix_plots_company_id", "plots", ["company_id"])

    # ── 4. CRM deals — add deal_type + reference_id ───────────────────────────
    # deal_type: property | plot | block | town
    # reference_id: FK-agnostic integer pointing to the relevant entity
    _safe_add_column(conn, "deals", "deal_type VARCHAR(20) DEFAULT 'property'")
    _safe_add_column(conn, "deals", "reference_id INTEGER")

    # ── 5. Construction projects — add town_id + block_id ────────────────────
    _safe_add_column(conn, "construction_projects",
                     "town_id INTEGER REFERENCES towns(id) ON DELETE SET NULL")
    _safe_add_column(conn, "construction_projects",
                     "block_id INTEGER REFERENCES blocks(id) ON DELETE SET NULL")

    # Create indexes for new FK columns
    conn.execute(sa.text("SAVEPOINT sp_idx"))
    try:
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_construction_projects_town_id "
            "ON construction_projects(town_id)"
        ))
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_construction_projects_block_id "
            "ON construction_projects(block_id)"
        ))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_idx"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_idx"))

    # ── 6. Seed town_module feature for default company ───────────────────────
    conn.execute(sa.text("SAVEPOINT sp_feat"))
    try:
        conn.execute(sa.text(
            "INSERT INTO company_features (company_id, feature_key, enabled) "
            "VALUES (1, 'town_module', true)"
        ))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_feat"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_feat"))


def downgrade():
    conn = op.get_bind()

    # Remove construction project columns
    for col in ("block_id", "town_id"):
        conn.execute(sa.text("SAVEPOINT sp_drop"))
        try:
            conn.execute(sa.text(f"ALTER TABLE construction_projects DROP COLUMN IF EXISTS {col}"))
            conn.execute(sa.text("RELEASE SAVEPOINT sp_drop"))
        except Exception:
            conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_drop"))

    # Remove deal columns
    for col in ("reference_id", "deal_type"):
        conn.execute(sa.text("SAVEPOINT sp_drop"))
        try:
            conn.execute(sa.text(f"ALTER TABLE deals DROP COLUMN IF EXISTS {col}"))
            conn.execute(sa.text("RELEASE SAVEPOINT sp_drop"))
        except Exception:
            conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_drop"))

    op.drop_table("plots")
    op.drop_table("blocks")
    op.drop_table("towns")
