"""Check exact DB state — alembic_version and which tables exist."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from sqlalchemy import create_engine, text

engine = create_engine(settings.database_url_fixed)
with engine.connect() as conn:
    exists = conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version')"
    )).scalar()
    print(f"alembic_version table exists: {exists}")

    if exists:
        rows = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        print(f"alembic_version rows: {rows}")

    for tbl in ["roles", "users", "companies", "properties", "finance_accounts"]:
        ex = conn.execute(text(
            f"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '{tbl}')"
        )).scalar()
        print(f"  table '{tbl}' exists: {ex}")
