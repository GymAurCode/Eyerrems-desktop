"""Fix the umx company user that was created without a role."""
import sys
sys.path.insert(0, '.')
from app.tenant import get_master_session
from sqlalchemy import text, create_engine
from app.core.config import settings

# Get umx company info from master
master_db = get_master_session()
try:
    company = master_db.execute(
        text("SELECT id, schema_name FROM master.companies WHERE admin_email = 'umx@rems.local'")
    ).fetchone()
    if not company:
        print("Company not found for umx@rems.local")
        sys.exit(1)
    print(f"Found company: id={company[0]}, schema={company[1]}")
    company_id = str(company[0])
    schema_name = company[1]
finally:
    master_db.close()

# Connect to the tenant schema directly
engine = create_engine(
    settings.database_url,
    connect_args={"options": f"-csearch_path={schema_name},public"},
    pool_pre_ping=True,
)
conn = engine.connect()

try:
    # Check if Admin role exists
    role = conn.execute(text("SELECT id FROM roles WHERE name = 'Admin' ORDER BY id LIMIT 1")).fetchone()
    if not role:
        print("Admin role not found! Need to seed roles first.")
        sys.exit(1)
    print(f"Admin role id: {role[0]}")

    # Check company id in tenant schema
    tenant_company = conn.execute(
        text("SELECT id FROM companies WHERE master_id = :mid"),
        {"mid": company_id}
    ).fetchone()
    if not tenant_company:
        print(f"Company not found in tenant schema with master_id={company_id}")
        sys.exit(1)
    print(f"Tenant company id: {tenant_company[0]}")

    # Update all users without a role
    result = conn.execute(
        text("UPDATE users SET role_id = :rid WHERE role_id IS NULL AND company_id = :cid"),
        {"rid": role[0], "cid": tenant_company[0]}
    )
    conn.commit()
    print(f"Updated {result.rowcount} user(s) with Admin role")
finally:
    conn.close()
    engine.dispose()

print("Done!")
