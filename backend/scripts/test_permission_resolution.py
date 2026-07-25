"""Test permission resolution for existing users."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.auth import User
from app.core.rbac import get_user_permissions, _invalidate_permission_cache

_invalidate_permission_cache()

engine = create_engine(settings.database_url_fixed)
Session = sessionmaker(bind=engine)
db = Session()

users = db.query(User).filter(User.is_super_admin == False).all()
for user in users:
    perms = get_user_permissions(db, user)
    critical = ["dashboard.view", "crm.view", "properties.view", "finance.view",
                 "construction.view", "reports.view", "hr.view", "admin.view",
                 "tenants.view", "maintenance.view"]
    print(f"\nUser: {user.email} (ID={user.id})")
    print(f"  Total permissions: {len(perms)}")
    print(f"  Has *: {'*' in perms}")
    for p in critical:
        print(f"  {p}: {p in perms}")

# Test admin user
admin = db.query(User).filter(User.is_super_admin == True).first()
if admin:
    perms = get_user_permissions(db, admin)
    print(f"\nSuper Admin: {admin.email}")
    print(f"  Total permissions: {len(perms)}")
    print(f"  Has *: {'*' in perms}")

db.close()
print("\n=== Permission resolution test complete ===")
