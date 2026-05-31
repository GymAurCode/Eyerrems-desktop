"""
Setup script — initializes the master schema, creates the default company,
and provisions its PostgreSQL schema with all application tables.

Run once after setting up the database:

    python scripts/setup_master.py
"""
import sys
import os
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.core.master_db import ensure_master_schema, provision_company_schema

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("setup_master")


def main():
    db_url = settings.database_url
    if not db_url or db_url.startswith("sqlite"):
        log.error("This setup requires a PostgreSQL database. Update DATABASE_URL in .env")
        sys.exit(1)

    log.info("Connecting to database: %s", db_url.split("@")[-1] if "@" in db_url else db_url)

    engine = create_engine(db_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # 1. Ensure master schema and companies table
        log.info("Ensuring master schema and companies table...")
        ensure_master_schema(db)

        # 2. Check if default company already exists
        existing = db.execute(
            text("SELECT id FROM master.companies WHERE admin_email = 'admin@rems.local'")
        ).fetchone()

        if existing:
            log.info("Default company already exists (id=%s). Skipping creation.", existing[0])
        else:
            # 3. Create default company
            pw_hash = hash_password("Admin@123")
            schema_name = "company_default"
            expiry = datetime.now(timezone.utc) + timedelta(days=365)

            result = db.execute(
                text("""
                    INSERT INTO master.companies (name, admin_email, admin_password_hash,
                                                   phone, status, expiry_date, schema_name)
                    VALUES (:name, :email, :pw, :phone, 'active', :expiry, :schema)
                    RETURNING id, name, schema_name
                """),
                {
                    "name": "REMS Default",
                    "email": "admin@rems.local",
                    "pw": pw_hash,
                    "phone": "",
                    "expiry": expiry,
                    "schema": schema_name,
                },
            )
            company_row = result.fetchone()
            db.commit()
            log.info("Created default company: id=%s, schema=%s", company_row[0], company_row[2])

            # 4. Provision the schema
            log.info("Provisioning schema '%s'...", schema_name)
            provision_company_schema(db, schema_name, str(company_row[0]))

            # 5. Seed user and roles in the company schema
            db.execute(text(f"SET search_path TO {schema_name},public"))

            # Create permissions
            modules = [
                "dashboard", "property", "crm", "finance", "tenant",
                "construction", "hr", "mail", "reminders", "reports",
                "admin", "import", "booking",
            ]
            perm_ids = []
            for mod in modules:
                for action in ["view", "create", "update", "delete"]:
                    perm_name = f"{mod}.{action}"
                    existing_perm = db.execute(
                        text("SELECT id FROM permissions WHERE name = :name"),
                        {"name": perm_name},
                    ).fetchone()
                    if not existing_perm:
                        result = db.execute(
                            text("INSERT INTO permissions (name, module) VALUES (:name, :mod) RETURNING id"),
                            {"name": perm_name, "mod": mod},
                        )
                        perm_ids.append(result.fetchone()[0])
                    else:
                        perm_ids.append(existing_perm[0])

            all_permissions = db.execute(text("SELECT id FROM permissions")).fetchall()

            # Create Admin role with all permissions
            admin_role = db.execute(
                text("""
                    INSERT INTO roles (name, description, company_id)
                    VALUES ('Admin', 'Full system access', (SELECT id FROM companies WHERE slug = :slug))
                    RETURNING id
                """),
                {"slug": schema_name},
            ).fetchone()
            admin_role_id = admin_role[0]
            for p in all_permissions:
                db.execute(
                    text("INSERT INTO role_permissions (role_id, permission_id) VALUES (:r, :p)"),
                    {"r": admin_role_id, "p": p[0]},
                )

            # Create Staff role with limited permissions
            staff_perms = db.execute(
                text("SELECT id FROM permissions WHERE name IN ('dashboard.view', 'crm.view', 'crm.create', 'crm.update', 'property.view', 'tenant.view', 'finance.view')")
            ).fetchall()
            staff_role = db.execute(
                text("""
                    INSERT INTO roles (name, description, company_id)
                    VALUES ('Staff', 'Basic staff access', (SELECT id FROM companies WHERE slug = :slug))
                    RETURNING id
                """),
                {"slug": schema_name},
            ).fetchone()
            for p in staff_perms:
                db.execute(
                    text("INSERT INTO role_permissions (role_id, permission_id) VALUES (:r, :p)"),
                    {"r": staff_role[0], "p": p[0]},
                )

            # Create admin user
            company_id = db.execute(
                text("SELECT id FROM companies WHERE slug = :slug"),
                {"slug": schema_name},
            ).fetchone()[0]

            db.execute(
                text("""
                    INSERT INTO users (email, full_name, hashed_password, company_id,
                                       status, is_approved, is_active, approval_status, role_id)
                    VALUES (:email, :name, :pw, :cid, 'active', TRUE, TRUE, 'approved', :role_id)
                """),
                {
                    "email": "admin@rems.local",
                    "name": "REMS Admin",
                    "pw": pw_hash,
                    "cid": company_id,
                    "role_id": admin_role_id,
                },
            )
            db.execute(
                text("""
                    INSERT INTO users (email, full_name, hashed_password, company_id,
                                       status, is_approved, is_active, approval_status, role_id)
                    VALUES (:email, :name, :pw, :cid, 'active', TRUE, TRUE, 'approved', :role_id)
                """),
                {
                    "email": "staff@rems.local",
                    "name": "Staff User",
                    "pw": hash_password("Staff@123"),
                    "cid": company_id,
                    "role_id": staff_role[0],
                },
            )

            # Seed default features
            features = [
                "property_module", "crm_module", "finance_module", "tenant_module",
                "construction_module", "hr_module", "mail_module", "reminders_module",
            ]
            for f in features:
                db.execute(
                    text("""
                        INSERT INTO company_features (company_id, feature_key, enabled)
                        VALUES (:cid, :key, TRUE)
                    """),
                    {"cid": company_id, "key": f},
                )

            db.commit()
            log.info("Seeded admin user, roles, permissions, and features.")

        # 6. Show summary
        companies = db.execute(
            text("SELECT id, name, admin_email, status, schema_name, expiry_date FROM master.companies")
        ).fetchall()

        log.info("")
        log.info("=" * 60)
        log.info("MASTER SETUP COMPLETE")
        log.info("=" * 60)
        log.info("Companies in master.companies:")
        for c in companies:
            log.info("  • %s | %s | %s | schema=%s | expires=%s",
                     c[1], c[2], c[3], c[4], c[5].strftime("%Y-%m-%d") if c[5] else "never")
        log.info("")
        log.info("Default login:  admin@rems.local / Admin@123")
        log.info("Superadmin:     %s / %s", settings.superadmin_email, settings.superadmin_password)
        log.info("")

    except Exception as e:
        db.rollback()
        log.error("Setup failed: %s", e, exc_info=True)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
