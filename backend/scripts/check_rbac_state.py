"""Check RBAC state of the database."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.database_url_fixed)
Session = sessionmaker(bind=engine)
db = Session()

print("=== All Roles ===")
for row in db.execute(text("SELECT id, name, is_super_admin, is_system_role, is_active FROM rbac3_roles ORDER BY name")).fetchall():
    print(f"  ID={row[0]} Name={row[1]} SuperAdmin={row[2]} System={row[3]} Active={row[4]}")

print()
print("=== Role Permissions Count ===")
for row in db.execute(text("""
    SELECT r.name, COUNT(rp.id) as perm_count
    FROM rbac3_roles r
    LEFT JOIN rbac3_role_permissions rp ON rp.role_id = r.id
    GROUP BY r.name
    ORDER BY r.name
""")).fetchall():
    print(f"  {row[0]}: {row[1]} permissions")

print()
print("=== Sample Role Permissions ===")
for row in db.execute(text("""
    SELECT r.name, m.slug, a.action_key
    FROM rbac3_role_permissions rp
    JOIN rbac3_roles r ON r.id = rp.role_id
    JOIN rbac3_modules m ON m.id = rp.module_id
    JOIN rbac3_actions a ON a.id = rp.action_id
    ORDER BY r.name, m.slug
    LIMIT 30
""")).fetchall():
    print(f"  {row[0]}: {row[1]}.{row[2]}")

print()
print("=== User Role Assignments ===")
for row in db.execute(text("""
    SELECT u.email, r.name
    FROM rbac3_user_roles ur
    JOIN users u ON u.id = ur.user_id
    JOIN rbac3_roles r ON r.id = ur.role_id
    ORDER BY u.email
""")).fetchall():
    print(f"  {row[0]} -> {row[1]}")

print()
print("=== Permissions table (first 30) ===")
for row in db.execute(text("SELECT name, module FROM permissions ORDER BY name LIMIT 30")).fetchall():
    print(f"  {row[0]} ({row[1]})")

db.close()
