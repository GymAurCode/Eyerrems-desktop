"""End-to-end test of the RBAC permission system."""
import os, sys, json
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

# Define all the permission checks used by routes
ROUTE_PERMISSION_MAP = {
    "GET /dashboard/stats": ["dashboard.view"],
    "GET /crm/leads": ["crm:manage", "crm:view"],
    "GET /crm/clients": ["crm:manage", "crm:view"],
    "GET /crm/deals": ["crm:manage", "crm:view"],
    "GET /finance/accounts": ["finance.view", "finance:manage", "finance:view"],
    "GET /properties": ["properties.view", "property:view", "properties:manage"],
    "GET /construction/projects": ["construction:view"],
    "GET /company/currency": None,
    "GET /admin/roles": ["role.view"],
    "GET /reports": ["reports.view", "reports:view"],
    "GET /hr": ["hr.view", "hr:view"],
    "GET /tenants": ["tenants.view", "tenant:view"],
    "GET /reminders": ["reminders.view", "reminder:view"],
    "GET /admin": ["admin.view", "admin:view", "admin:access"],
}

users = db.query(User).filter(User.is_super_admin == False).all()
print(f"Testing {len(users)} non-admin users\n")

all_pass = True
for user in users:
    perms = get_user_permissions(db, user)
    is_super = "*" in perms

    print(f"User: {user.email}")
    print(f"  Permissions: {len(perms)}, Super: {is_super}")

    for route, required_perms in ROUTE_PERMISSION_MAP.items():
        if required_perms is None:
            print(f"  {route}: NO AUTH REQUIRED")
            continue

        normalized = {p.replace(":", ".") for p in required_perms}
        missing = [p for p in normalized if p not in perms]

        if is_super:
            print(f"  {route}: PASS (super admin)")
        elif not missing:
            print(f"  {route}: PASS")
        else:
            print(f"  {route}: FAIL - missing {missing}")
            all_pass = False

    print()

db.close()

if all_pass:
    print("=== ALL TESTS PASSED ===")
else:
    print("=== SOME TESTS FAILED ===")
    sys.exit(1)
