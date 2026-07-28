"""
Fix role_permissions table — recreate it with proper columns.

Run: python backend/scripts/fix_role_permissions.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, inspect, text
from app.core.config import settings
from app.core.database import Base
from app.models.rbac import RolePermission, Role


def fix_table(engine, schema=None):
    """Drop and recreate role_permissions table if it's missing columns."""
    inspector = inspect(engine)
    tables = inspector.get_table_names(schema=schema)

    if "role_permissions" not in tables:
        print(f"[FIX] role_permissions table not found in schema '{schema or 'public'}' — creating")
        Base.metadata.create_all(bind=engine, tables=[RolePermission.__table__])
        return

    columns = [c["name"] for c in inspector.get_columns("role_permissions", schema=schema)]
    expected = {"id", "role_id", "module_key", "tab_key", "can_view", "can_add", "can_edit", "can_delete"}

    if not expected.issubset(columns):
        print(f"[FIX] role_permissions in '{schema or 'public'}' missing columns: {expected - set(columns)}")
        print("[FIX] Dropping and recreating role_permissions table...")
        with engine.connect() as conn:
            conn.execute(text(f'DROP TABLE IF EXISTS {"public." if not schema else ""}role_permissions CASCADE'))
            conn.commit()
        Base.metadata.create_all(bind=engine, tables=[RolePermission.__table__])
        print("[FIX] role_permissions table recreated successfully.")
    else:
        print(f"[FIX] role_permissions table OK in schema '{schema or 'public'}'")


def main():
    print("=== Fix role_permissions table ===")

    db_url = settings.database_url_fixed
    if not db_url:
        db_url = "sqlite:///./rems.db"

    engine = create_engine(db_url)
    fix_table(engine)

    # Also fix tenant schemas if PostgreSQL
    if "postgresql" in db_url:
        from app.tenant import get_master_session
        master = get_master_session()
        rows = master.execute(
            text("SELECT schema_name FROM master.companies")
        ).fetchall()
        master.close()
        for (schema_name,) in rows:
            schema_engine = create_engine(
                db_url,
                connect_args={"options": f"-csearch_path={schema_name},public"},
            )
            fix_table(schema_engine, schema=schema_name)
            schema_engine.dispose()

    # Fix SQLite tenants
    from app.core.tenant_manager import DATABASES_DIR
    for f in os.listdir(str(DATABASES_DIR)):
        if f.startswith("company_") and f.endswith(".db"):
            db_path = os.path.join(str(DATABASES_DIR), f)
            tenant_engine = create_engine(f"sqlite:///{db_path}")
            fix_table(tenant_engine)
            tenant_engine.dispose()

    print("=== Fix complete ===")


if __name__ == "__main__":
    main()
