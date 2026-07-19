"""One-time fix: add missing is_system_account column to accounts table.
Run via:  python scripts/fix_missing_is_system_account.py
Or on Railway:  railway run python scripts/fix_missing_is_system_account.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from app.core.config import settings

url = settings.database_url_fixed
engine = create_engine(url)
with engine.connect() as conn:
    inspector = inspect(conn)
    if "accounts" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("accounts")}
        if "is_system_account" not in cols:
            conn.execute(text(
                "ALTER TABLE accounts ADD COLUMN is_system_account BOOLEAN NOT NULL DEFAULT false"
            ))
            conn.commit()
            print("✅ Added is_system_account column to accounts table.")
        else:
            print("✅ is_system_account column already exists — nothing to do.")
    else:
        print("❌ accounts table not found.")
