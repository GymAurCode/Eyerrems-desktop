"""
Seed script for RBAC system - creates default roles, permissions, and admin user
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from datetime import datetime, timezone, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine, Base
from app.core.master_db import ensure_master_schema
from app.core.security import hash_password
from app.models.auth import Permission, Role, User
from app.services.rbac_service import RBACService


ADMIN_EMAIL = "admin@rems.local"
ADMIN_PASSWORD = "Admin@123"


def seed_rbac(db: Session):
    """Seed RBAC system with default data"""
    print("[RBAC] Seeding RBAC system...")
    
    # 1. Seed Default Company in master
    print("\n[RBAC] Ensuring default company exists...")
    from app.models.company import Company
    from app.core.tenant_manager import tenant_manager
    
    company = db.query(Company).filter(Company.slug == "default").first()
    if not company:
        company = Company(
            name="Default Company",
            slug="default",
            status="active",
            plan="enterprise",
            currency_code="PKR"
        )
        db.add(company)
        db.flush()
        db.commit()  # Commit so tenant init sees it in a new session
        print(f"[OK] Created default company: {company.name}")
    else:
        print(f"[INFO]  Default company already exists")

    # ── 1b. Ensure row exists in master.companies ──────────────────────────
    # login/auth.py queries master.companies for company admin auth
    try:
        ensure_master_schema(db)
        admin_pw_hash = hash_password(ADMIN_PASSWORD)
        existing_mc = db.execute(
            text("SELECT id FROM master.companies WHERE admin_email = :email"),
            {"email": ADMIN_EMAIL},
        ).fetchone()
        if not existing_mc:
            db.execute(
                text("""
                    INSERT INTO master.companies
                        (name, admin_email, admin_password_hash, phone, status, expiry_date, schema_name)
                    VALUES (:name, :email, :pw, :phone, :status, :expiry, :schema)
                """),
                {
                    "name": company.name,
                    "email": ADMIN_EMAIL,
                    "pw": admin_pw_hash,
                    "phone": "",
                    "status": "active",
                    "expiry": datetime.now(timezone.utc) + timedelta(days=365 * 10),
                    "schema": "company_default",
                },
            )
            db.commit()
            print(f"[OK] Added company to master.companies: {ADMIN_EMAIL}")
        else:
            print(f"[INFO]  Company already in master.companies: {ADMIN_EMAIL}")
    except Exception as e:
        print(f"[WARN]  master.companies seed skipped: {e}")

    # 2. Seed permissions
    print("\n[PERMS] Creating permissions...")
    created_perms = RBACService.seed_default_permissions(db)
    print(f"[OK] Created {len(created_perms)} permissions")
    
    # Get all permissions for display
    all_perms = db.query(Permission).order_by(Permission.module, Permission.name).all()
    print(f"[STATS] Total permissions in system: {len(all_perms)}")
    
    # Group by module
    modules = {}
    for perm in all_perms:
        if perm.module not in modules:
            modules[perm.module] = []
        modules[perm.module].append(perm.name)
    
    for module, perms in sorted(modules.items()):
        print(f"   {module}: {len(perms)} permissions")
    
    # 3. Seed roles
    print("\n[ROLES] Creating roles...")
    created_roles = RBACService.seed_default_roles(db)
    print(f"[OK] Created {len(created_roles)} roles")
    
    # Display roles
    all_roles = db.query(Role).all()
    for role in all_roles:
        print(f"   - {role.name}: {len(role.permissions)} permissions")
    
    # 4. Initialize company tenant DB
    print("\n[INIT]  Initializing default company tenant database...")
    tenant_manager.initialize_tenant_db(company.id, company.slug)
    
    # 5. Create default admin user in master if not exists
    print("\n[USER] Creating default admin user in master...")
    existing_admin_master = db.query(User).filter(User.email == ADMIN_EMAIL).first()
    
    admin_master_role = db.query(Role).filter(Role.name == "Admin").first()
    if not admin_master_role:
        print("[FAIL] Admin role not found in master database!")
        return
        
    if not existing_admin_master:
        admin_user_master = User(
            email=ADMIN_EMAIL,
            full_name="System Administrator",
            hashed_password=hash_password(ADMIN_PASSWORD),
            company_id=company.id,
            is_super_admin=False,
            status="active",
            is_approved=True,
            is_active=True,
            approval_status="approved",
            role_id=admin_master_role.id,
        )
        admin_user_master.roles = [admin_master_role]
        db.add(admin_user_master)
        db.flush()
        print(f"[OK] Created admin user in master: {ADMIN_EMAIL}")
    else:
        existing_admin_master.company_id = company.id
        existing_admin_master.is_super_admin = False
        existing_admin_master.hashed_password = hash_password(ADMIN_PASSWORD)
        if admin_master_role not in existing_admin_master.roles:
            existing_admin_master.roles.append(admin_master_role)
        db.flush()
        print(f"[INFO]  Admin user updated/verified in master: {ADMIN_EMAIL}")
        
    # 6. Create default admin user in tenant database if not exists
    print("\n[USER] Creating default admin user in tenant...")
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        existing_admin_tenant = tenant_db.query(User).filter(User.email == ADMIN_EMAIL).first()
        admin_tenant_role = tenant_db.query(Role).filter(Role.name == "Admin").first()
        if not admin_tenant_role:
            print("[FAIL] Admin role not found in tenant database!")
            return
            
        if not existing_admin_tenant:
            admin_user_tenant = User(
                email=ADMIN_EMAIL,
                full_name="System Administrator",
                hashed_password=hash_password(ADMIN_PASSWORD),
                company_id=company.id,
                status="active",
                is_approved=True,
                is_active=True,
                approval_status="approved",
                role_id=admin_tenant_role.id,
            )
            admin_user_tenant.roles = [admin_tenant_role]
            tenant_db.add(admin_user_tenant)
            tenant_db.commit()
            print(f"[OK] Created admin user in tenant: {ADMIN_EMAIL}")
        else:
            existing_admin_tenant.company_id = company.id
            existing_admin_tenant.hashed_password = hash_password(ADMIN_PASSWORD)
            if admin_tenant_role not in existing_admin_tenant.roles:
                existing_admin_tenant.roles.append(admin_tenant_role)
            tenant_db.commit()
            print(f"[INFO]  Admin user updated/verified in tenant: {ADMIN_EMAIL}")
    except Exception as e:
        tenant_db.rollback()
        print(f"[FAIL] Failed to seed tenant admin: {e}")
        raise e
    finally:
        tenant_db.close()

    # 7. Seed the admin user into the PostgreSQL company schema (production path)
    try:
        from app.tenant import get_schema_engine
        _, PgSessionClass = get_schema_engine("company_default")
        pg_db = PgSessionClass()
        try:
            pg_user = pg_db.query(User).filter(User.email == ADMIN_EMAIL).first()
            pg_admin_role = pg_db.query(Role).filter(Role.name == "Admin").first()
            if pg_admin_role and not pg_user:
                pg_user = User(
                    email=ADMIN_EMAIL,
                    full_name="System Administrator",
                    hashed_password=hash_password(ADMIN_PASSWORD),
                    company_id=company.id,
                    status="active",
                    is_approved=True,
                    is_active=True,
                    approval_status="approved",
                    role_id=pg_admin_role.id,
                )
                pg_user.roles = [pg_admin_role]
                pg_db.add(pg_user)
                pg_db.commit()
                print(f"[OK] Created admin user in PostgreSQL tenant schema: {ADMIN_EMAIL}")
            elif pg_user:
                print(f"[INFO]  Admin user already exists in PostgreSQL tenant schema")
        finally:
            pg_db.close()
    except Exception as e:
        print(f"[WARN]  PostgreSQL tenant schema seeding skipped: {e}")

    db.commit()
    print("\n[DONE] RBAC seeding completed successfully!")


def main():
    """Main entry point"""
    print("=" * 60)
    print("REMS - RBAC System Seeder")
    print("=" * 60)
    
    # Create tables if they don't exist
    print("\n[SETUP] Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)
    print("[OK] Database tables ready")
    
    # Seed data
    db = SessionLocal()
    try:
        seed_rbac(db)
    except Exception as e:
        print(f"\n[FAIL] Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("[DONE] All done! You can now login with:")
    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")
    print("=" * 60)


if __name__ == "__main__":
    main()
