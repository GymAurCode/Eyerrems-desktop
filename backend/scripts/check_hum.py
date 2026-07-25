import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.rbac import get_user_permissions, _invalidate_permission_cache

engine = create_engine(settings.database_url_fixed)
Session = sessionmaker(bind=engine)
db = Session()

row = db.execute(text("""
    SELECT u.id, u.email, u.role_id, u.is_super_admin,
           r.name as v1_role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.email = 'hum@gmail.com'
""")).fetchone()
print(f"User: {row[1]}, v1 role_id: {row[2]}, v1 role_name: {row[4]}, super_admin: {row[3]}")

v3_roles = db.execute(text("SELECT id, name FROM rbac3_roles ORDER BY id")).fetchall()
print(f"\nv3 roles ({len(v3_roles)}):")
for r in v3_roles:
    print(f"  {r[0]}: {r[1]}")

v3_user = db.execute(text("""
    SELECT r.name FROM rbac3_user_roles ur
    JOIN rbac3_roles r ON r.id = ur.role_id
    WHERE ur.user_id = (SELECT id FROM users WHERE email = 'hum@gmail.com')
""")).fetchall()
print(f"\nUser v3 roles:")
for r in v3_user:
    print(f"  {r[0]}")

db.close()
