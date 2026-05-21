"""
Service to seed the default admin user on startup or migration.
"""
import logging
from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.models.auth import Role, User
from app.models.company import Company
from app.core.tenant_manager import tenant_manager

log = logging.getLogger("rems.admin_user_seed")

def seed_admin_user(db: Session) -> None:
    """Ensures default admin user exists with the hashed password."""
    admin_email = "admin@rems.local"
    admin_password = "Admin@123"
    
    # 1. Ensure default company exists in master
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
        log.info(f"Created default company: {company.name}")
    
    # 2. Ensure Admin role exists in master database
    admin_role = db.query(Role).filter(Role.name == "Admin").first()
    if not admin_role:
        log.warning("Admin role not found in master database. Skipping admin user creation in master.")
        return

    # 3. Create or update admin user in master DB
    existing_admin_master = db.query(User).filter(User.email == admin_email).first()
    if not existing_admin_master:
        admin_user_master = User(
            email=admin_email,
            full_name="System Administrator",
            hashed_password=hash_password(admin_password),
            company_id=company.id,
            status="active",
            is_approved=True,
            is_active=True,
            approval_status="approved",
            role_id=admin_role.id,
        )
        admin_user_master.roles = [admin_role]
        db.add(admin_user_master)
        db.flush()
        log.info(f"Created default admin user in master: {admin_email}")
    else:
        existing_admin_master.company_id = company.id
        existing_admin_master.hashed_password = hash_password(admin_password)
        if admin_role not in existing_admin_master.roles:
            existing_admin_master.roles.append(admin_role)
        db.flush()
        log.info(f"Admin user updated/verified in master: {admin_email}")

    # 4. Initialize company tenant DB and seed tenant admin user
    try:
        tenant_manager.initialize_tenant_db(company.id, company.slug)
        tenant_db = tenant_manager.get_tenant_session(company.slug)
        try:
            existing_admin_tenant = tenant_db.query(User).filter(User.email == admin_email).first()
            admin_tenant_role = tenant_db.query(Role).filter(Role.name == "Admin").first()
            
            if admin_tenant_role:
                if not existing_admin_tenant:
                    admin_user_tenant = User(
                        email=admin_email,
                        full_name="System Administrator",
                        hashed_password=hash_password(admin_password),
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
                    log.info(f"Created default admin user in tenant: {admin_email}")
                else:
                    existing_admin_tenant.company_id = company.id
                    existing_admin_tenant.hashed_password = hash_password(admin_password)
                    if admin_tenant_role not in existing_admin_tenant.roles:
                        existing_admin_tenant.roles.append(admin_tenant_role)
                    tenant_db.commit()
                    log.info(f"Admin user updated/verified in tenant: {admin_email}")
            else:
                log.warning("Admin role not found in tenant database.")
        except Exception as e:
            tenant_db.rollback()
            log.error(f"Failed to seed tenant admin user: {e}")
        finally:
            tenant_db.close()
    except Exception as e:
        log.error(f"Failed to initialize tenant DB or seed: {e}")
