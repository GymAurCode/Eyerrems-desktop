"""
setup_default_tenant.py — Create or repair default company and company admin.

This is the ONE command to run after initial deployment:

    cd backend
    python scripts/setup_default_tenant.py

It is idempotent — safe to run multiple times.
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import logging

from app.core.config import settings
from app.core.security import hash_password, verify_password

logging.basicConfig(level=logging.INFO, format="[SETUP] %(message)s")
log = logging.getLogger("setup_default_tenant")


def main():
    log.info("Starting default tenant setup...")

    from app.core.tenant_manager import tenant_manager
    from app.models.company import Company
    from app.models.auth import User

    # Ensure all tables exist before using ORM
    from app.core.database import Base
    Base.metadata.create_all(bind=tenant_manager.engines["master"])
    log.info("Database schema verified.")

    db = tenant_manager.get_master_session()

    try:
        # ── 1. Default Company ─────────────────────────────────────────────
        company_slug = os.getenv("REMS_COMPANY_SLUG", "default-company")
        company_name = os.getenv("REMS_COMPANY_NAME", "Default Company")

        company = db.query(Company).filter(Company.slug == company_slug).first()

        if not company:
            legacy = db.query(Company).filter(Company.slug == "default").first()
            if legacy:
                log.info("Found legacy company slug='default' → migrating to '%s'", company_slug)
                legacy.slug = company_slug
                company = legacy
                db.flush()
            else:
                company = Company(
                    name=company_name,
                    slug=company_slug,
                    status="active",
                    plan="enterprise",
                    currency_code="PKR",
                )
                db.add(company)
                db.flush()
                log.info("Created default company: id=%s, slug=%s", company.id, company_slug)

        cid = company.id
        log.info("Default company ready: id=%s, slug=%s, name=%s", cid, company.slug, company.name)

        if company.status != "active":
            company.status = "active"
            log.info("  → Fixed company status to 'active'")

        # ── 2. Company Admin User ──────────────────────────────────────────
        admin_email = os.getenv("REMS_ADMIN_EMAIL", "admin@rems.local")
        admin_password = os.getenv("REMS_ADMIN_PASSWORD", "Admin@123")
        admin_name = os.getenv("REMS_ADMIN_NAME", "Default Company Admin")

        user = db.query(User).filter(User.email == admin_email).first()

        if not user:
            user = User(
                email=admin_email,
                full_name=admin_name,
                hashed_password=hash_password(admin_password),
                company_id=cid,
                is_super_admin=False,
                status="active",
                is_approved=True,
                is_active=True,
                approval_status="approved",
            )
            db.add(user)
            db.flush()
            log.info("Created company admin: %s (company_id=%s)", admin_email, cid)
        else:
            log.info("Company admin already exists: %s (id=%s)", admin_email, user.id)
            updates = []

            if user.company_id is None:
                user.company_id = cid
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

            reset_pw = os.getenv("REMS_RESET_PASSWORD", "true").lower() in ("1", "true", "yes")
            if reset_pw:
                user.hashed_password = hash_password(admin_password)
                updates.append("password reset")

            if updates:
                log.info("  → Applied fixes: %s", ", ".join(updates))
            else:
                log.info("  → All flags correct, no changes needed")

        db.commit()

        # ── 3. Verify password hash ────────────────────────────────────────
        pw_ok = verify_password(admin_password, user.hashed_password)
        if pw_ok:
            log.info("Password verification: OK")
        else:
            log.error("Password verification: FAILED — hash mismatch!")
            sys.exit(1)

        log.info("")
        log.info("=" * 60)
        log.info("  DEFAULT TENANT SETUP COMPLETE")
        log.info("=" * 60)
        log.info("  Company slug: %s", company.slug)
        log.info("  Admin email:  %s", admin_email)
        log.info("  Admin pass:   %s", admin_password)
        log.info("")
        log.info("  Super Admin:  %s / %s", settings.superadmin_email, settings.superadmin_password)
        log.info("=" * 60)

    except Exception as e:
        db.rollback()
        log.error("Setup failed: %s", e, exc_info=True)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
