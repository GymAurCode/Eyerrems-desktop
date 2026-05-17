"""
Pre-start migration script for Railway.

Railway runs this before uvicorn via the startCommand in railway.toml:
  python scripts/migrate.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT

This script:
  1. Normalises the DATABASE_URL (Railway uses postgres://, SQLAlchemy needs postgresql+psycopg2://)
  2. Repairs alembic_version if it contains an unknown revision
  3. Runs alembic upgrade head (no-op if already at head)

Exit codes:
  0 — success (migrations applied or already at head)
  1 — fatal error (startup should be aborted)
"""
import os
import sys

# Allow importing app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command

# ── All valid revision IDs in our migration chain ─────────────────────────────
VALID_REVISIONS = {
    "0001_initial", "0002_erp_extensions", "0003_property_module",
    "0004_property_categories", "0005_crm_overhaul", "0006_crm_upgrade",
    "0007_tenant_module", "0008_finance_module", "0009_finance_upgrade",
    "0010_installment_engine", "0011", "0012", "0013",
    "0014_construction_module", "0015_reminder_module", "0016_hr_module",
    "0017_mail_module", "0018_crm_activities", "0019_rbac_system",
    "0020_multitenant_saas", "0021_town_module", "0022_booking_module",
    "0023_booking_financial_refactor", "0024_reports_module",
    "0025_currency_settings", "0026_ai_intelligence_module",
    "0027_maintenance_upgrade", "0028_maintenance_unit_id",
}
KNOWN_HEAD = "0028_maintenance_unit_id"


def normalise_url(url: str) -> str:
    """Railway injects postgres://, SQLAlchemy requires postgresql+psycopg2://."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    return url


def repair_alembic_version(engine) -> bool:
    """
    Returns True if a stamp is needed (empty or unknown version),
    False if the version is already valid.
    """
    with engine.connect() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'alembic_version')"
        )).scalar()

        if not tbl_exists:
            print("[migrate] Fresh database — will stamp then upgrade.")
            return True

        rows = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()

        if not rows:
            print("[migrate] alembic_version is empty — will stamp.")
            return True

        current = rows[0][0]
        if current in VALID_REVISIONS:
            print(f"[migrate] alembic_version is valid: {current}")
            return False

        # Unknown revision — clear it so stamp can insert cleanly
        print(f"[migrate] Unknown revision {current!r} — clearing and re-stamping at {KNOWN_HEAD}")
        conn.execute(text("DELETE FROM alembic_version"))
        conn.commit()
        return True


def main():
    raw_url = os.environ.get("DATABASE_URL", "")
    if not raw_url:
        # Fall back to .env via pydantic settings
        from app.core.config import settings
        raw_url = settings.database_url

    db_url = normalise_url(raw_url)
    print(f"[migrate] Connecting to database...")

    engine = create_engine(db_url, pool_pre_ping=True)

    try:
        needs_stamp = repair_alembic_version(engine)
    finally:
        engine.dispose()

    # Build alembic config — path is relative to backend/ directory
    cfg_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
    alembic_cfg = AlembicConfig(cfg_path)
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    if needs_stamp:
        print(f"[migrate] Stamping at {KNOWN_HEAD}...")
        alembic_command.stamp(alembic_cfg, KNOWN_HEAD)

    print("[migrate] Running alembic upgrade head...")
    alembic_command.upgrade(alembic_cfg, "head")
    print("[migrate] Done — database is up to date.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[migrate] FATAL: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
