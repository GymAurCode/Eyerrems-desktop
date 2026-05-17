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
    
    # 3. Create default admin user if not exists
    print("\n👤 Creating default admin user...")
    admin_email = "admin@rems.local"
    existing_admin = db.query(User).filter(User.email == admin_email).first()
    
    if not existing_admin:
        admin_role = db.query(Role).filter(Role.name == "Admin").first()
        if not admin_role:
            print("❌ Admin role not found!")
            return
        
        admin_user = User(
            email=admin_email,
            full_name="System Administrator",
            hashed_password=hash_password("admin123"),  # Change this in production!
            status="active",
            is_approved=True,
            is_active=True,
            approval_status="approved",
            role_id=admin_role.id,
        )
        admin_user.roles = [admin_role]
        
        db.add(admin_user)
        db.flush()
        
        print(f"✅ Created admin user: {admin_email}")
        print(f"   Password: admin123 (CHANGE THIS IN PRODUCTION!)")
    else:
        print(f"ℹ️  Admin user already exists: {admin_email}")
        # Ensure admin has Admin role
        admin_role = db.query(Role).filter(Role.name == "Admin").first()
        if admin_role and admin_role not in existing_admin.roles:
            existing_admin.roles.append(admin_role)
            print(f"✅ Added Admin role to existing user")
    
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
    print("   Password: admin123")
    print("=" * 60)


if __name__ == "__main__":
    main()
