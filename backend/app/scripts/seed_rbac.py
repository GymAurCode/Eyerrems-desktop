"""
Seed script for RBAC system - creates default roles, permissions, and admin user
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.auth import Permission, Role, User
from app.services.rbac_service import RBACService


def seed_rbac(db: Session):
    """Seed RBAC system with default data"""
    print("🌱 Seeding RBAC system...")
    
    # 1. Seed permissions
    print("\n📋 Creating permissions...")
    created_perms = RBACService.seed_default_permissions(db)
    print(f"✅ Created {len(created_perms)} permissions")
    
    # Get all permissions for display
    all_perms = db.query(Permission).order_by(Permission.module, Permission.name).all()
    print(f"📊 Total permissions in system: {len(all_perms)}")
    
    # Group by module
    modules = {}
    for perm in all_perms:
        if perm.module not in modules:
            modules[perm.module] = []
        modules[perm.module].append(perm.name)
    
    for module, perms in sorted(modules.items()):
        print(f"   {module}: {len(perms)} permissions")
    
    # 2. Seed roles
    print("\n👥 Creating roles...")
    created_roles = RBACService.seed_default_roles(db)
    print(f"✅ Created {len(created_roles)} roles")
    
    # Display roles
    all_roles = db.query(Role).all()
    for role in all_roles:
        print(f"   - {role.name}: {len(role.permissions)} permissions")
    
    # 3. Seed Default Company in master
    print("\n🏢 Ensuring default company exists...")
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
        print(f"✅ Created default company: {company.name}")
    else:
        print(f"ℹ️  Default company already exists")
    
    # 4. Initialize company tenant DB
    print("\n⚙️  Initializing default company tenant database...")
    tenant_manager.initialize_tenant_db(company.id, company.slug)
    
    # 5. Create default admin user in master if not exists
    print("\n👤 Creating default admin user in master...")
    admin_email = "admin@rems.local"
    existing_admin_master = db.query(User).filter(User.email == admin_email).first()
    
    admin_master_role = db.query(Role).filter(Role.name == "Admin").first()
    if not admin_master_role:
        print("❌ Admin role not found in master database!")
        return
        
    if not existing_admin_master:
        admin_user_master = User(
            email=admin_email,
            full_name="System Administrator",
            hashed_password=hash_password("Admin@123"),
            company_id=company.id,
            status="active",
            is_approved=True,
            is_active=True,
            approval_status="approved",
            role_id=admin_master_role.id,
        )
        admin_user_master.roles = [admin_master_role]
        db.add(admin_user_master)
        db.flush()
        print(f"✅ Created admin user in master: {admin_email}")
    else:
        existing_admin_master.company_id = company.id
        existing_admin_master.hashed_password = hash_password("Admin@123")
        if admin_master_role not in existing_admin_master.roles:
            existing_admin_master.roles.append(admin_master_role)
        db.flush()
        print(f"ℹ️  Admin user updated/verified in master: {admin_email}")
        
    # 6. Create default admin user in tenant database if not exists
    print("\n👤 Creating default admin user in tenant...")
    tenant_db = tenant_manager.get_tenant_session(company.slug)
    try:
        existing_admin_tenant = tenant_db.query(User).filter(User.email == admin_email).first()
        admin_tenant_role = tenant_db.query(Role).filter(Role.name == "Admin").first()
        if not admin_tenant_role:
            print("❌ Admin role not found in tenant database!")
            return
            
        if not existing_admin_tenant:
            admin_user_tenant = User(
                email=admin_email,
                full_name="System Administrator",
                hashed_password=hash_password("Admin@123"),
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
            print(f"✅ Created admin user in tenant: {admin_email}")
        else:
            existing_admin_tenant.company_id = company.id
            existing_admin_tenant.hashed_password = hash_password("Admin@123")
            if admin_tenant_role not in existing_admin_tenant.roles:
                existing_admin_tenant.roles.append(admin_tenant_role)
            tenant_db.commit()
            print(f"ℹ️  Admin user updated/verified in tenant: {admin_email}")
    except Exception as e:
        tenant_db.rollback()
        print(f"❌ Failed to seed tenant admin: {e}")
        raise e
    finally:
        tenant_db.close()
    
    db.commit()
    print("\n✨ RBAC seeding completed successfully!")


def main():
    """Main entry point"""
    print("=" * 60)
    print("REMS - RBAC System Seeder")
    print("=" * 60)
    
    # Create tables if they don't exist
    print("\n🔧 Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready")
    
    # Seed data
    db = SessionLocal()
    try:
        seed_rbac(db)
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("🎉 All done! You can now login with:")
    print("   Email: admin@rems.local")
    print("   Password: Admin@123")
    print("=" * 60)


if __name__ == "__main__":
    main()
