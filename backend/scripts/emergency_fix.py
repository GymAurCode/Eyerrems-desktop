#!/usr/bin/env python3
"""
Emergency Migration Fix

This script fixes the immediate issue by setting the correct alembic version
based on the current database state.
"""

import os
import sys
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent.parent
sys.path.insert(0, str(app_dir))

from sqlalchemy import create_engine, text, inspect

def get_db_url():
    """Get database URL from environment."""
    raw = os.environ.get("DATABASE_URL", "")
    if not raw:
        print("❌ DATABASE_URL environment variable not found")
        sys.exit(1)
    
    # Normalize postgres:// to postgresql+psycopg2://
    if raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql+psycopg2://", 1)
    
    return raw

def main():
    print("🚨 Emergency Migration Fix")
    print("=" * 40)
    
    db_url = get_db_url()
    engine = create_engine(db_url, pool_pre_ping=True)
    
    try:
        with engine.connect() as conn:
            # Check existing tables and columns
            inspector = inspect(conn)
            existing_tables = set(inspector.get_table_names())
            
            print(f"Found {len(existing_tables)} tables in database")
            
            # Determine correct version based on what actually exists
            target_version = "0031_force_fix_company_id"  # default
            
            # Check for the most advanced features first
            if "commissions" in existing_tables:
                try:
                    commission_columns = inspector.get_columns("commissions")
                    commission_col_names = {col["name"] for col in commission_columns}
                    
                    if "dealer_id" in commission_col_names:
                        target_version = "0034_commission_dealer_upgrade"
                        print("🔍 Found dealer_id column in commissions table")
                        print("✅ Database is actually at 0034_commission_dealer_upgrade")
                    else:
                        print("🔍 No dealer_id column found in commissions table")
                except Exception as e:
                    print(f"⚠️  Could not check commission columns: {e}")
            
            # Check for import tables
            if target_version == "0031_force_fix_company_id":
                if "import_row_logs" in existing_tables:
                    target_version = "0033_import_module"
                    print("✅ Database is at least at 0033_import_module")
                elif "import_batches" in existing_tables:
                    target_version = "0033_import_module"
                    print("✅ Database is at least at 0033_import_module")
            
            # Check for town tables
            if target_version == "0031_force_fix_company_id":
                if "town_transactions" in existing_tables or "town_units" in existing_tables:
                    target_version = "0032_town_units_upgrade"
                    print("✅ Database is at least at 0032_town_units_upgrade")
            
            # Get current alembic version
            try:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                current_version = result.scalar()
                print(f"📋 Current alembic version: {current_version}")
            except:
                current_version = None
                print("📋 No alembic version found")
            
            # Update alembic version if needed
            if current_version != target_version:
                print(f"🔧 Updating alembic version from {current_version} to {target_version}")
                
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
                
                print(f"✅ Successfully updated alembic version to {target_version}")
            else:
                print("✅ Alembic version is already correct")
                
            print("\n🎉 Emergency fix completed!")
            print("You can now run your normal migration process.")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        engine.dispose()

if __name__ == "__main__":
    main()