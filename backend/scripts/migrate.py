"""
Pre-start migration script for Railway (and local use).

Handles every possible DB state without data loss:

  State A — Empty DB (no tables at all)
    → Run upgrade head from scratch (0001 → 0028)

  State B — Partially migrated (some tables exist, alembic_version empty/wrong)
    → Detect the highest completed revision by inspecting which tables exist
    → Stamp at that revision
    → Run upgrade head to apply the remaining migrations

  State C — Fully migrated, alembic_version valid
    → Run upgrade head (no-op if already at head)

Usage (from backend/ directory):
  python scripts/migrate.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect, text
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command

# ── Ordered chain: (revision_id, sentinel_table_that_this_revision_creates) ──
# We use one representative table per revision as a proxy for "this migration ran".
# Revisions that only add columns (no new tables) reuse the previous sentinel.
REVISION_CHAIN = [
    ("0001_initial",                  "users"),
    ("0002_erp_extensions",           "accounts"),
    ("0003_property_module",          "locations"),
    ("0004_property_categories",      "property_categories"),
    ("0005_crm_overhaul",             "communications"),
    ("0006_crm_upgrade",              "client_attachments"),
    ("0007_tenant_module",            "tenants"),
    ("0008_finance_module",           "journals"),
    ("0009_finance_upgrade",          "expenses"),
    ("0010_installment_engine",       "installment_payments"),
    ("0011",                          ("accounts", "description")),                # column-only
    ("0012",                          "finance_operations"),
    ("0013",                          ("finance_operations", "sub_type")),         # column-only
    ("0014_construction_module",      "construction_projects"),
    ("0015_reminder_module",          "reminders"),
    ("0016_hr_module",                "employees"),
    ("0017_mail_module",              "email_accounts"),
    ("0018_crm_activities",           "lead_activities"),
    ("0019_rbac_system",              "user_roles"),
    ("0020_multitenant_saas",         "companies"),
    ("0021_town_module",              "towns"),
    ("0022_booking_module",           "bookings"),
    ("0023_booking_financial_refactor", ("bookings", "final_price")),              # column-only
    ("0024_reports_module",           "report_templates"),
    ("0025_currency_settings",        ("companies", "currency_code")),             # column-only
    ("0026_ai_intelligence_module",   "ai_anomalies"),
    ("0027_maintenance_upgrade",      "maintenance_activity_logs"),
    ("0028_maintenance_unit_id",      ("maintenance_records", "unit_id")),        # column-only
    ("0029_fix_missing_company_id",   ("invoices", "company_id")),                 # column-only
    ("0030_force_fix_missing_company_id", ("invoices", "description")),             # column-only
]

VALID_REVISIONS = {rev for rev, _ in REVISION_CHAIN}
KNOWN_HEAD = REVISION_CHAIN[-1][0]


def normalise_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    return url


def get_db_url() -> str:
    raw = os.environ.get("DATABASE_URL", "")
    if not raw:
        from app.core.config import settings
        raw = settings.database_url
    return normalise_url(raw)


def get_existing_tables_and_columns(engine) -> dict:
    """Returns a dict mapping table name to a set of its column names."""
    result = {}
    with engine.connect() as conn:
        inspector = inspect(conn)
        for table_name in inspector.get_table_names():
            try:
                cols = {c["name"] for c in inspector.get_columns(table_name)}
                result[table_name] = cols
            except Exception:
                result[table_name] = set()
    return result


def get_alembic_version(engine) -> str | None:
    with engine.connect() as conn:
        tbl_exists = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'alembic_version')"
        )).scalar()
        if not tbl_exists:
            return None
        rows = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        return rows[0][0] if rows else None


def clear_alembic_version(engine) -> None:
    with engine.connect() as conn:
        conn.execute(text(
            "DELETE FROM alembic_version WHERE EXISTS "
            "(SELECT 1 FROM information_schema.tables WHERE table_name='alembic_version')"
        ))
        conn.commit()


def detect_completed_revision(schema_info: dict) -> str | None:
    """
    Walk the revision chain in reverse and return the highest revision
    whose sentinel exists in the DB.
    
    The sentinel can be:
      - A string: the name of a table that must exist.
      - A tuple of (table_name, column_name): the column must exist in that table.
    """
    for revision, sentinel in reversed(REVISION_CHAIN):
        if isinstance(sentinel, tuple):
            table_name, column_name = sentinel
            if table_name in schema_info and column_name in schema_info[table_name]:
                return revision
        else:
            if sentinel in schema_info:
                return revision
    return None


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
        schema_info = get_existing_tables_and_columns(engine)
        current_ver = get_alembic_version(engine)
    finally:
        engine.dispose()

    existing_tables = set(schema_info.keys())
    has_any_schema = bool(existing_tables - {"alembic_version"})
    print(f"[migrate] Tables in DB: {len(existing_tables)}")
    print(f"[migrate] alembic_version: {current_ver!r}")

    cfg = make_alembic_cfg(db_url)

    if not has_any_schema:
        # ── State A: Completely empty database ────────────────────────────────
        print("[migrate] Empty database — running full migration from 0001...")
        engine2 = create_engine(db_url, pool_pre_ping=True)
        try:
            clear_alembic_version(engine2)
        finally:
            engine2.dispose()
        alembic_command.upgrade(cfg, "head")
        print("[migrate] Full migration complete.")

    elif current_ver in VALID_REVISIONS:
        # ── State C: Valid version — normal upgrade ───────────────────────────
        print(f"[migrate] Version {current_ver!r} is valid — running upgrade head...")
        alembic_command.upgrade(cfg, "head")
        print("[migrate] Done — database is up to date.")

    else:
        # ── State B: Partial schema, missing/unknown version ──────────────────
        completed = detect_completed_revision(schema_info)
        print(f"[migrate] Partial schema detected.")
        print(f"[migrate] Highest completed revision (by table inspection): {completed!r}")

        engine3 = create_engine(db_url, pool_pre_ping=True)
        try:
            clear_alembic_version(engine3)
        finally:
            engine3.dispose()

        if completed:
            print(f"[migrate] Stamping at {completed!r}...")
            alembic_command.stamp(cfg, completed)
        else:
            print("[migrate] No recognisable tables found — running from scratch...")

        print("[migrate] Running upgrade head to apply remaining migrations...")
        alembic_command.upgrade(cfg, "head")
        print("[migrate] Migration complete.")


def seed_data() -> None:
    """
    Seed default roles/permissions and superadmin after migrations.
    Both are idempotent — they skip if data already exists.
    """
    try:
        from app.core.database import SessionLocal
        from app.scripts.seed_rbac import seed_rbac

        db = SessionLocal()
        try:
            print("[migrate] Seeding RBAC roles and permissions...")
            seed_rbac(db)
        except Exception as e:
            print(f"[migrate] RBAC seed warning (non-fatal): {e}")
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        print(f"[migrate] RBAC seed skipped: {e}")

    try:
        from app.scripts.seed_superadmin import seed_superadmin
        print("[migrate] Seeding superadmin account...")
        seed_superadmin()
    except Exception as e:
        print(f"[migrate] Superadmin seed warning (non-fatal): {e}")


if __name__ == "__main__":
    try:
        main()
        seed_data()
    except Exception as e:
        print(f"[migrate] FATAL: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
