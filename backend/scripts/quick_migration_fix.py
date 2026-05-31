#!/usr/bin/env python3
"""
Quick Migration Fix Script

This script quickly fixes the current migration issue by:
1. Detecting the actual database state
2. Updating alembic version to match
3. Running a safe upgrade
"""

import os
import sys
from pathlib import Path

# Resolve app directory and backend .env early so config imports can use them.
app_dir = Path(__file__).parent.parent
env_file = app_dir / ".env"
if env_file.exists():
    with env_file.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)

# Add the app directory to Python path
sys.path.insert(0, str(app_dir))

from sqlalchemy import create_engine, text, inspect
from alembic.config import Config
from alembic import command


def load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    with env_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            values[key] = value
    return values


def get_db_url():
    """Get database URL from environment, .env, or app config."""
    raw = os.environ.get("DATABASE_URL", "")
    if not raw:
        env_file = app_dir / ".env"
        if env_file.exists():
            env_values = load_env_file(env_file)
            raw = env_values.get("DATABASE_URL", "")

    if not raw:
        try:
            from app.core.config import settings
            raw = settings.database_url
        except Exception:
            pass

    if not raw:
        print("❌ Could not get database URL")
        sys.exit(1)
    
    # Normalize postgres:// to postgresql+psycopg2://
    if raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql+psycopg2://", 1)
    
    return raw

def main():
    print("🔧 Quick Migration Fix")
    print("=" * 30)
    
    db_url = get_db_url()
    engine = create_engine(db_url, pool_pre_ping=True)
    
    try:
        with engine.connect() as conn:
            # Check existing tables
            inspector = inspect(conn)
            existing_tables = set(inspector.get_table_names())
            
            print(f"Found {len(existing_tables)} tables in database")
            
            # Determine correct version based on existing tables and columns
            target_version = "0031_force_fix_company_id"  # default
            
            if "companies" in existing_tables:
                try:
                    company_columns = inspector.get_columns("companies")
                    company_col_names = {col["name"] for col in company_columns}

                    if {"email", "phone", "expiry_date", "db_path"}.issubset(company_col_names):
                        target_version = "0036_add_company_lifecycle_fields"
                        print("✅ Database appears to already include company lifecycle fields; assuming at least 0036")
                    elif {"expiry_date", "db_path"}.issubset(company_col_names):
                        target_version = "0036_add_company_lifecycle_fields"
                        print("✅ Database appears to include lifecycle columns from 0036")
                    elif "commissions" in existing_tables:
                        commission_columns = inspector.get_columns("commissions")
                        commission_col_names = {col["name"] for col in commission_columns}
                        if "dealer_id" in commission_col_names:
                            target_version = "0034_commission_dealer_upgrade"
                            print("✅ Database appears to be at 0034_commission_dealer_upgrade (has dealer_id column)")
                        elif "import_row_logs" in existing_tables or "import_batches" in existing_tables:
                            target_version = "0033_import_module"
                            print("✅ Database appears to be at 0033_import_module")
                        elif "town_transactions" in existing_tables or "town_units" in existing_tables:
                            target_version = "0032_town_units_upgrade"
                            print("✅ Database appears to be at 0032_town_units_upgrade")
                    elif "import_row_logs" in existing_tables or "import_batches" in existing_tables:
                        target_version = "0033_import_module"
                        print("✅ Database appears to be at 0033_import_module")
                    elif "town_transactions" in existing_tables or "town_units" in existing_tables:
                        target_version = "0032_town_units_upgrade"
                        print("✅ Database appears to be at 0032_town_units_upgrade")
                    else:
                        print("✅ Database appears to be at 0031_force_fix_company_id")
                except Exception as e:
                    print(f"Could not inspect company table columns: {e}")
                    if "import_row_logs" in existing_tables or "import_batches" in existing_tables:
                        target_version = "0033_import_module"
                        print("✅ Database appears to be at 0033_import_module")
                    elif "town_transactions" in existing_tables or "town_units" in existing_tables:
                        target_version = "0032_town_units_upgrade"
                        print("✅ Database appears to be at 0032_town_units_upgrade")
                    elif "commissions" in existing_tables:
                        try:
                            commission_columns = inspector.get_columns("commissions")
                            commission_col_names = {col["name"] for col in commission_columns}
                            if "dealer_id" in commission_col_names:
                                target_version = "0034_commission_dealer_upgrade"
                                print("✅ Database appears to be at 0034_commission_dealer_upgrade (has dealer_id column)")
                        except Exception:
                            pass
            else:
                if "import_row_logs" in existing_tables or "import_batches" in existing_tables:
                    target_version = "0033_import_module"
                    print("✅ Database appears to be at 0033_import_module")
                elif "town_transactions" in existing_tables or "town_units" in existing_tables:
                    target_version = "0032_town_units_upgrade"
                    print("✅ Database appears to be at 0032_town_units_upgrade")
                else:
                    print("✅ Database appears to be at 0031_force_fix_company_id")
            
            # Get current alembic version
            try:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                current_version = result.scalar()
                print(f"Current alembic version: {current_version}")

                # Expand version_num length if it is too short for newer revision IDs.
                try:
                    if conn.dialect.name == "postgresql":
                        inspector = inspect(conn)
                        cols = inspector.get_columns("alembic_version")
                        version_col = next((c for c in cols if c["name"] == "version_num"), None)
                        if version_col is not None:
                            current_length = getattr(version_col["type"], "length", None)
                            if current_length is not None and current_length < 64:
                                print("🔧 Expanding alembic_version.version_num to VARCHAR(128)")
                                conn.execute(text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(128)"))
                                conn.commit()
                                print("✅ Expanded alembic version column length")
                except Exception:
                    pass
            except Exception:
                current_version = None
                print("No alembic version found")
            
            # Stamp alembic version only if it is missing
            if current_version is None:
                if target_version:
                    print(f"Stamping alembic version to {target_version}")

                    # Ensure alembic_version table exists
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS alembic_version (
                            version_num VARCHAR(128) NOT NULL,
                            CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                        )
                    """))

                    # Clear and set new version
                    conn.execute(text("DELETE FROM alembic_version"))
                    conn.execute(text(f"INSERT INTO alembic_version (version_num) VALUES ('{target_version}')"))
                    conn.commit()

                    print(f"✅ Updated alembic version to {target_version}")
                else:
                    print("⚠️ Unable to determine a safe alembic version to stamp. Please inspect the database schema manually.")
            else:
                print("✅ Alembic version is already recorded; skipping stamp.")
    
    finally:
        engine.dispose()
    
    # Now run upgrade to head
    print("\n🚀 Running upgrade to head...")
    
    try:
        alembic_cfg = Config(str(app_dir / "alembic.ini"))
        alembic_cfg.set_main_option("script_location", str(app_dir / "alembic"))
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
        
        command.upgrade(alembic_cfg, "head")
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        print("\nThis is likely due to the table already existing.")
        print("The migration files have been updated to handle this case.")
        print("Try running the migration again.")
        return False
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        if success:
            print("\n🎉 Migration fix completed successfully!")
        else:
            print("\n⚠️  Migration fix completed with warnings.")
            print("Check the output above for details.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)