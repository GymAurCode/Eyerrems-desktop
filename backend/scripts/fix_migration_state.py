#!/usr/bin/env python3
"""
Migration State Recovery Script

This script helps recover from migration state issues by:
1. Checking current database state
2. Identifying existing tables
3. Updating alembic version to match actual state
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
from app.core.config import settings

def check_database_state():
    """Check current database state and existing tables."""
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        inspector = inspect(conn)
        existing_tables = inspector.get_table_names()
        
        print("=== Database State Check ===")
        print(f"Total tables found: {len(existing_tables)}")
        
        # Check for key tables from recent migrations
        key_tables = [
            "town_units",
            "town_transactions", 
            "import_batches",
            "import_row_logs"
        ]
        
        print("\n=== Key Tables Status ===")
        for table in key_tables:
            status = "EXISTS" if table in existing_tables else "MISSING"
            print(f"{table}: {status}")
        
        # Check current alembic version
        try:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            current_version = result.scalar()
            print(f"\nCurrent alembic version: {current_version}")
        except Exception as e:
            print(f"\nError reading alembic version: {e}")
            current_version = None
        
        return existing_tables, current_version

def fix_migration_state():
    """Fix migration state based on existing tables."""
    existing_tables, current_version = check_database_state()
    
    # Determine correct version based on existing tables
    target_version = None
    
    if "import_row_logs" in existing_tables:
        target_version = "0033_import_module"
        print("\nAll tables through 0033 exist - should be at 0033_import_module")
    elif "town_transactions" in existing_tables:
        target_version = "0032_town_units_upgrade" 
        print("\nTown tables exist - should be at 0032_town_units_upgrade")
    elif "town_units" in existing_tables:
        target_version = "0032_town_units_upgrade"
        print("\nTown units table exists - should be at 0032_town_units_upgrade")
    else:
        target_version = "0031_force_fix_company_id"
        print("\nNo new tables found - staying at 0031_force_fix_company_id")
    
    if target_version and target_version != current_version:
        print(f"\nUpdating alembic version from {current_version} to {target_version}")
        
        # Update alembic version
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            conn.execute(text(f"UPDATE alembic_version SET version_num = '{target_version}'"))
            conn.commit()
            print("✅ Alembic version updated successfully")
    else:
        print("\n✅ Alembic version is already correct")

def run_safe_upgrade():
    """Run upgrade to head with the fixed migration files."""
    print("\n=== Running Safe Upgrade ===")
    
    # Set up alembic config
    alembic_cfg = Config(str(app_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(app_dir / "alembic"))
    
    try:
        command.upgrade(alembic_cfg, "head")
        print("✅ Migration upgrade completed successfully")
    except Exception as e:
        print(f"❌ Migration upgrade failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🔧 Migration State Recovery Tool")
    print("=" * 50)
    
    try:
        # Check current state
        check_database_state()
        
        # Ask user what to do
        print("\nOptions:")
        print("1. Fix alembic version to match database state")
        print("2. Run safe upgrade to head")
        print("3. Both (recommended)")
        print("4. Exit")
        
        choice = input("\nEnter your choice (1-4): ").strip()
        
        if choice == "1":
            fix_migration_state()
        elif choice == "2":
            run_safe_upgrade()
        elif choice == "3":
            fix_migration_state()
            run_safe_upgrade()
        elif choice == "4":
            print("Exiting...")
        else:
            print("Invalid choice")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)