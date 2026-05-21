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
    email: str = "admin@rems.local",
    password: str = "Admin@123",
    full_name: str = "System Administrator",
) -> None:
    from app.scripts.seed_rbac import seed_rbac

    db = SessionLocal()
    try:
        seed_rbac(db)
        print(f"[seed] Default admin ensured: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_superadmin()
