"""Seed RBAC roles, permissions, and default super admin."""

import os

from sqlalchemy.orm import Session

from app.core.rbac import seed_all_v3_permissions
from app.core.security import hash_password
from app.models.auth import User
from app.models.company import Company


def seed_rbac(db: Session) -> None:
    """Idempotent seed: RBAC permissions + default company + admin user."""

    slug_to_id = seed_all_v3_permissions(db)
    print(f"[seed_rbac] Seeded {len(slug_to_id)} modules and 6 actions")

    # ── Default company ──────────────────────────────────────────────
    company = db.query(Company).filter(Company.slug == "default").first()
    if not company:
        company = Company(
            name="Default Company",
            slug="default",
            status="active",
            plan="enterprise",
            currency_code="PKR",
        )
        db.add(company)
        db.flush()
        print(f"[seed_rbac] Created default company (id={company.id})")
    else:
        print(f"[seed_rbac] Default company already exists (id={company.id})")

    # ── Default company admin user ──────────────────────────────────
    admin_email = os.getenv("REMS_ADMIN_EMAIL", "admin@rems.local")
    admin_password = os.getenv("REMS_ADMIN_PASSWORD", "Admin@123")
    admin_name = os.getenv("REMS_ADMIN_NAME", "Default Company Admin")

    user = db.query(User).filter(User.email == admin_email).first()
    if not user:
        hashed = hash_password(admin_password)
        user = User(
            email=admin_email,
            full_name=admin_name,
            hashed_password=hashed,
            company_id=company.id,
            is_super_admin=False,
            approval_status="approved",
            is_approved=True,
            is_active=True,
            status="active",
        )
        db.add(user)
        print(f"[seed_rbac] Created company admin: {admin_email} (company_id={company.id})")
    else:
        updates = []
        if user.company_id is None:
            user.company_id = company.id
            updates.append("company_id")
        if user.is_super_admin:
            user.is_super_admin = False
            updates.append("is_super_admin→False")
        if user.status != "active":
            user.status = "active"
            updates.append("status→active")
        if not user.is_approved:
            user.is_approved = True
            updates.append("is_approved→True")
        if not user.is_active:
            user.is_active = True
            updates.append("is_active→True")
        if user.approval_status != "approved":
            user.approval_status = "approved"
            updates.append("approval_status→approved")
        if updates:
            print(f"[seed_rbac] Fixed existing user {admin_email}: {', '.join(updates)}")
        else:
            print(f"[seed_rbac] Company admin already exists and is correct: {admin_email}")

    db.commit()
    print("[seed_rbac] Seeding complete")
