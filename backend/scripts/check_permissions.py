"""Check permissions for all companies in the database."""
import json, sys
sys.path.insert(0, '.')
from app.tenant import get_master_session
from sqlalchemy import text

db = get_master_session()
try:
    rows = db.execute(text("SELECT id, name, schema_name, permissions FROM master.companies")).fetchall()
    for r in rows:
        print(f"Company: {r.name}  (schema={r.schema_name})")
        perms = r.permissions if r.permissions else {}
        print(f"  permissions: {json.dumps(perms, indent=2)[:500]}")
        print()
finally:
    db.close()
