"""
One-time repair script — provisions missing tables in all existing company schemas
and seeds default permissions for companies that have none.
"""
import json
import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text
from app.core.database import Base
from app.core.config import settings
from app.core.master_db import sync_attachments_table
from app.core.seed_lookups import seed_lookup_values
from app.tenant import get_master_session

# Import ALL models so they register with Base.metadata
from app.models import *  # noqa: F401, F403

DEFAULT_PERMISSIONS = {
    "properties": {"enabled": True, "tabs": {"overview": True, "units": True, "tenants": True, "maintenance": True, "documents": True}},
    "tenants": {"enabled": True, "tabs": {"profile": True, "payments": True, "complaints": True, "documents": True}},
    "crm": {"enabled": True, "tabs": {"leads": True, "contacts": True, "deals": True}},
    "hr": {"enabled": True, "tabs": {"employees": True, "payroll": True, "attendance": True}},
    "finance": {"enabled": True, "tabs": {"income": True, "expenses": True, "reports": True, "invoices": True}},
    "maintenance": {"enabled": True, "tabs": {"open": True, "in_progress": True, "resolved": True}},
    "reports": {"enabled": True, "tabs": {}},
    "reminders": {"enabled": True, "tabs": {}},
    "settings": {"enabled": True, "tabs": {}},
}


def main():
    db = get_master_session()
    try:
        companies = db.execute(
            text("SELECT id, schema_name, permissions FROM master.companies")
        ).fetchall()
    except Exception as e:
        print(f"Error querying master.companies: {e}")
        sys.exit(1)

    print(f"Found {len(companies)} companies to repair")

    for row in companies:
        company_id, schema_name, permissions = row
        print(f"\n--- Repairing: {schema_name} (id={company_id}) ---")

        # 1. Provision missing tables in the schema
        print(f"  Creating missing tables in schema '{schema_name}'...")
        try:
            engine = create_engine(
                settings.database_url,
                connect_args={"options": f"-csearch_path={schema_name},public"},
                pool_pre_ping=True,
            )
            Base.metadata.create_all(bind=engine)
            sync_attachments_table(engine)
            # Seed lookup values in the tenant schema
            from sqlalchemy.orm import sessionmaker
            tenant_session = sessionmaker(bind=engine)()
            try:
                seeded = seed_lookup_values(tenant_session)
                if seeded > 0:
                    print(f"  Seeded {seeded} lookup values")
            finally:
                tenant_session.close()
            print(f"  Tables provisioned successfully")
        except Exception as e:
            print(f"  ERROR provisioning tables: {e}")
        finally:
            try:
                engine.dispose()
            except Exception:
                pass

        # 2. Seed default permissions if empty or missing
        current_perms = permissions if permissions else {}
        if not current_perms or current_perms == {}:
            print(f"  Setting default permissions...")
            try:
                db.execute(
                    text("""
                        UPDATE master.companies
                        SET permissions = CAST(:permissions AS jsonb)
                        WHERE id = :id
                    """),
                    {"id": str(company_id), "permissions": json.dumps(DEFAULT_PERMISSIONS)},
                )
                db.commit()
                print(f"  Default permissions saved")
            except Exception as e:
                db.rollback()
                print(f"  ERROR setting permissions: {e}")
        else:
            print(f"  Permissions already present, skipping")

    db.close()
    print("\n=== Repair complete ===")


if __name__ == "__main__":
    main()
