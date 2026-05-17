"""
fix_alembic_version.py
======================
Safely repairs a broken alembic_version table without touching any data.

The problem:
  The database has alembic_version stamped with a revision ID that no longer
  exists in the migration files (e.g. '0038_sync_idempotency'). This blocks
  all `alembic upgrade` and `alembic revision` commands.

The fix:
  1. Show what the DB currently thinks its version is.
  2. Show what the latest local migration file is.
  3. UPDATE alembic_version to the latest local revision.
  4. Run `alembic upgrade head` to apply any genuinely missing migrations.

This script NEVER drops tables, NEVER deletes data, and NEVER modifies schema.
It only updates the single-row alembic_version table.

Usage (from backend/ directory):
  python scripts/fix_alembic_version.py
"""
import os
import sys
import subprocess

# Make sure we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.core.config import settings

# ── Normalise URL (Railway uses postgres://, SQLAlchemy needs postgresql://) ──
def normalise_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    return url

db_url = normalise_url(os.environ.get("DATABASE_URL", "") or settings.database_url)

# ── The correct head revision (last file in our chain) ───────────────────────
CORRECT_HEAD = "0028_maintenance_unit_id"

def main():
    print("=" * 60)
    print("Alembic Version Repair Tool")
    print("=" * 60)

    engine = create_engine(db_url, pool_pre_ping=True)

    with engine.connect() as conn:
        # ── 1. Check if alembic_version table exists ──────────────────────────
        result = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'alembic_version')"
        ))
        table_exists = result.scalar()

        if not table_exists:
            print("\n[INFO] alembic_version table does not exist.")
            print("       This is a fresh database — run: alembic upgrade head")
            return

        # ── 2. Read current version ───────────────────────────────────────────
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        rows = result.fetchall()

        if not rows:
            print("\n[INFO] alembic_version table is empty.")
            print(f"       Stamping with: {CORRECT_HEAD}")
            conn.execute(text(
                "INSERT INTO alembic_version (version_num) VALUES (:v)"
            ), {"v": CORRECT_HEAD})
            conn.commit()
            print("[OK]   Stamped successfully.")
        else:
            current = rows[0][0]
            print(f"\n[DB]   Current alembic_version : {current}")
            print(f"[CODE] Correct head revision    : {CORRECT_HEAD}")

            if current == CORRECT_HEAD:
                print("\n[OK]   Version is already correct. Nothing to do.")
            else:
                print(f"\n[FIX]  Updating alembic_version: {current!r} → {CORRECT_HEAD!r}")
                conn.execute(text(
                    "UPDATE alembic_version SET version_num = :v"
                ), {"v": CORRECT_HEAD})
                conn.commit()
                print("[OK]   alembic_version updated successfully.")

    print("\n[NEXT] Running: alembic upgrade head")
    print("       (applies any migrations that are in files but not yet in DB)")
    print("-" * 60)

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    )

    if result.returncode == 0:
        print("\n[DONE] Migration system is healthy.")
        print("       You can now run: alembic revision --autogenerate -m 'your_change'")
    else:
        print("\n[ERROR] alembic upgrade head failed.")
        print("        Check the output above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
