"""Check specific permissions for users."""
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

user = db.query(User).filter(User.email == 'ali@gmail.com').first()
perms = get_user_permissions(db, user)

role_perms = [p for p in perms if 'role' in p.lower()]
print(f"Role-related permissions ({len(role_perms)}):")
for p in sorted(role_perms):
    print(f"  {p}")

booking_perms = [p for p in perms if 'booking' in p.lower()]
print(f"\nBooking-related permissions ({len(booking_perms)}):")
for p in sorted(booking_perms):
    print(f"  {p}")

db.close()
