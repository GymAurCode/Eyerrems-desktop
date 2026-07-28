"""Seed RBAC roles, permissions, and default super admin."""

import os

from sqlalchemy.orm import Session

from app.core.rbac import seed_all_v3_permissions
from app.core.security import hash_password
from app.models.auth import User


def seed_rbac(db: Session) -> None:
    """Idempotent seed: RBAC permissions + default super admin."""

    seed_all_v3_permissions(db)
    db.flush()

    admin_email = os.getenv("REMS_ADMIN_EMAIL", "admin@rems.local")
    admin_password = os.getenv("REMS_ADMIN_PASSWORD", "Admin@123")
    admin_name = os.getenv("REMS_ADMIN_NAME", "System Admin")

    user = db.query(User).filter(User.email == admin_email).first()
    if not user:
        hashed = hash_password(admin_password)
        user = User(
            email=admin_email,
            full_name=admin_name,
            hashed_password=hashed,
            is_super_admin=True,
            approval_status="approved",
            is_approved=True,
            is_active=True,
            status="active",
        )
        db.add(user)

    db.commit()
