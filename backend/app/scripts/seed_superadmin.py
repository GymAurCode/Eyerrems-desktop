"""
Seed Super-Admin User
─────────────────────
Run once after migration to create the super-admin account.

Usage:
    cd backend
    python -m app.scripts.seed_superadmin
"""
import sys
import os

# Allow running from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.auth import User


def seed_superadmin(
    email: str = "superadmin@system.local",
    password: str = "SuperAdmin@123",
    full_name: str = "Super Administrator",
) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email, User.is_super_admin == True).first()
        if existing:
            print(f"[seed] Super-admin already exists: {email}")
            return

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            company_id=None,          # super-admin has no company
            is_super_admin=True,
            status="active",
            is_approved=True,
            is_active=True,
            approval_status="approved",
        )
        db.add(user)
        db.commit()
        print(f"[seed] Super-admin created: {email} / {password}")
        print("[seed] ⚠️  Change the password immediately after first login!")
    finally:
        db.close()


if __name__ == "__main__":
    seed_superadmin()
