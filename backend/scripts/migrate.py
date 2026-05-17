"""
Pre-start migration script for Railway (and local use).

Strategy:
  1. Check whether the actual schema exists (probe for the 'users' table).
  2. If schema is MISSING  → wipe alembic_version, run upgrade head from scratch.
  3. If schema EXISTS but alembic_version is empty/unknown → stamp at head (schema
     was built outside Alembic), then run upgrade head for any new migrations.
  4. If schema EXISTS and alembic_version is valid → just run upgrade head (no-op
     if already at head, applies new migrations if any).

This covers every possible Railway/local state without data loss.

Usage (from backend/ directory):
  python scripts/migrate.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect, text
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command

# ── All valid revision IDs in our local migration chain ───────────────────────
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


def get_db_url() -> str:
    raw = os.environ.get("DATABASE_URL", "")
    if not raw:
        from app.core.config import settings
        raw = settings.database_url
    return normalise_url(raw)


def schema_exists(engine) -> bool:
    """Return True if the 'users' table exists — proxy for 'schema is built'."""
    inspector = inspect(engine)
    return "users" in inspector.get_table_names()


def get_alembic_version(engine):
    """Return current version string, or None if table missing/empty."""
    with engine.connect() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'alembic_version')"
        )).scalar()
        if not tbl_exists:
            return None
        rows = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        return rows[0][0] if rows else None


def clear_alembic_version(engine):
    with engine.connect() as conn:
        conn.execute(text(
            "DELETE FROM alembic_version"
            " WHERE EXISTS (SELECT 1 FROM information_schema.tables"
            " WHERE table_name = 'alembic_version')"
        ))
        conn.commit()


def make_alembic_cfg(db_url: str) -> AlembicConfig:
    cfg_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "alembic.ini",
    )
    cfg = AlembicConfig(cfg_path)
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def main():
    db_url = get_db_url()
    print("[migrate] Connecting to database...")

    engine = create_engine(db_url, pool_pre_ping=True)

    try:
        has_schema = schema_exists(engine)
        current_ver = get_alembic_version(engine)
    finally:
        engine.dispose()

    print(f"[migrate] Schema exists (users table): {has_schema}")
    print(f"[migrate] alembic_version: {current_ver!r}")

    cfg = make_alembic_cfg(db_url)

    if not has_schema:
        # ── Case 1: Empty database — run all migrations from scratch ──────────
        print("[migrate] Empty database detected. Running full migration from 0001...")
        # Clear any stale alembic_version row so Alembic starts from None
        engine2 = create_engine(db_url, pool_pre_ping=True)
        try:
            clear_alembic_version(engine2)
        finally:
            engine2.dispose()
        alembic_command.upgrade(cfg, "head")
        print("[migrate] Full migration complete.")

    elif current_ver is None or current_ver not in VALID_REVISIONS:
        # ── Case 2: Schema exists but version is missing/unknown ──────────────
        # The schema was built outside Alembic (e.g. direct SQL, old tool).
        # Stamp at head so Alembic knows the schema is current, then upgrade
        # to apply any genuinely new migrations.
        print(f"[migrate] Schema exists but version {current_ver!r} is unknown.")
        print(f"[migrate] Stamping at {KNOWN_HEAD} and upgrading...")
        engine3 = create_engine(db_url, pool_pre_ping=True)
        try:
            clear_alembic_version(engine3)
        finally:
            engine3.dispose()
        alembic_command.stamp(cfg, KNOWN_HEAD)
        alembic_command.upgrade(cfg, "head")
        print("[migrate] Stamp + upgrade complete.")

    else:
        # ── Case 3: Schema exists and version is valid — normal upgrade ───────
        print(f"[migrate] Version {current_ver!r} is valid. Running upgrade head...")
        alembic_command.upgrade(cfg, "head")
        print("[migrate] Done — database is up to date.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[migrate] FATAL: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
