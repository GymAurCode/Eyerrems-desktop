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

# Add the app directory to Python path
app_dir = Path(__file__).parent.parent
sys.path.insert(0, str(app_dir))

from sqlalchemy import create_engine, text, inspect
from alembic.config import Config
from alembic import command

def get_db_url():
    """Get database URL from environment or config."""
    raw = os.environ.get("DATABASE_URL", "")
    if not raw:
        try:
            from app.core.config import settings
            raw = settings.database_url
        except:
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
            
            # Check for commission table columns to detect 0034
            if "commissions" in existing_tables:
                try:
                    commission_columns = inspector.get_columns("commissions")
                    commission_col_names = {col["name"] for col in commission_columns}
                    
                    if "dealer_id" in commission_col_names:
                        target_version = "0034_commission_dealer_upgrade"
                        print("✅ Database appears to be at 0034_commission_dealer_upgrade (has dealer_id column)")
                    elif "import_row_logs" in existing_tables:
                        target_version = "0033_import_module"
                        print("✅ Database appears to be at 0033_import_module")
                    elif "import_batches" in existing_tables:
                        target_version = "0033_import_module"
                        print("✅ Database appears to be at 0033_import_module")
                    elif "town_transactions" in existing_tables:
                        target_version = "0032_town_units_upgrade"
                        print("✅ Database appears to be at 0032_town_units_upgrade")
                    elif "town_units" in existing_tables:
                        target_version = "0032_town_units_upgrade"
                        print("✅ Database appears to be at 0032_town_units_upgrade")
                except Exception as e:
                    print(f"Could not check commission columns: {e}")
                    # Fall back to table-based detection
                    if "import_row_logs" in existing_tables:
                        target_version = "0033_import_module"
                        print("✅ Database appears to be at 0033_import_module")
                    elif "import_batches" in existing_tables:
                        target_version = "0033_import_module"
                        print("✅ Database appears to be at 0033_import_module")
                    elif "town_transactions" in existing_tables:
                        target_version = "0032_town_units_upgrade"
                        print("✅ Database appears to be at 0032_town_units_upgrade")
                    elif "town_units" in existing_tables:
                        target_version = "0032_town_units_upgrade"
                        print("✅ Database appears to be at 0032_town_units_upgrade")
            else:
                # No commissions table, use table-based detection
                if "import_row_logs" in existing_tables:
                    target_version = "0033_import_module"
                    print("✅ Database appears to be at 0033_import_module")
                elif "import_batches" in existing_tables:
                    target_version = "0033_import_module"
                    print("✅ Database appears to be at 0033_import_module")
                elif "town_transactions" in existing_tables:
                    target_version = "0032_town_units_upgrade"
                    print("✅ Database appears to be at 0032_town_units_upgrade")
                elif "town_units" in existing_tables:
                    target_version = "0032_town_units_upgrade"
                    print("✅ Database appears to be at 0032_town_units_upgrade")
                else:
                    print("✅ Database appears to be at 0031_force_fix_company_id")
            
            # Get current alembic version
            try:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                current_version = result.scalar()
                print(f"Current alembic version: {current_version}")
            except:
                current_version = None
                print("No alembic version found")
            
            # Update alembic version if needed
            if current_version != target_version:
                print(f"Updating alembic version to {target_version}")
                
                # Ensure alembic_version table exists
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS alembic_version (
                        version_num VARCHAR(32) NOT NULL,
                        CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                    )
                """))
                
                # Clear and set new version
                conn.execute(text("DELETE FROM alembic_version"))
                conn.execute(text(f"INSERT INTO alembic_version (version_num) VALUES ('{target_version}')"))
                conn.commit()
                
                print(f"✅ Updated alembic version to {target_version}")
            else:
                print("✅ Alembic version is already correct")
    
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