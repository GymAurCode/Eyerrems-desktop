"""
Alembic migration to fix duplicate index errors.

Revision ID: 0022_fix_duplicate_indexes
Revises: 0021_town_module
Create Date: 2026-05-21 12:19:27
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0022_fix_duplicate_indexes'
down_revision = '0021_town_module'
branch_labels = None
depends_on = None

def upgrade():
    """Drop possibly duplicate indexes and recreate them safely.

    This migration is idempotent: it uses ``DROP INDEX IF EXISTS`` and
    ``CREATE INDEX IF NOT EXISTS`` which work for both PostgreSQL and SQLite.
    """
    conn = op.get_bind()

    def drop_if_exists(name: str):
        conn.execute(sa.text(f"DROP INDEX IF EXISTS {name}"))

    # Drop existing indexes that may already exist.
    drop_if_exists('ix_blocks_town_id')
    drop_if_exists('ix_blocks_company_id')
    drop_if_exists('ix_towns_company_id')
    drop_if_exists('ix_towns_name')

    # Re‑create indexes safely.
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_blocks_town_id ON blocks (town_id)"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_blocks_company_id ON blocks (company_id)"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_towns_company_id ON towns (company_id)"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_towns_name ON towns (name)"
    ))

def downgrade():
    """Revert the upgrade by dropping the indexes created above.
    """
    conn = op.get_bind()
    def drop_if_exists(name: str):
        conn.execute(sa.text(f"DROP INDEX IF EXISTS {name}"))

    drop_if_exists('ix_blocks_town_id')
    drop_if_exists('ix_blocks_company_id')
    drop_if_exists('ix_towns_company_id')
    drop_if_exists('ix_towns_name')

