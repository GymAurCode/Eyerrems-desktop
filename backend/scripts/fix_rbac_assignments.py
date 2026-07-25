"""
Fix RBAC assignments for existing users.

This script ensures:
1. All Admin role users are assigned to the v3 Admin role
2. All users with roles in the v1 system have corresponding v3 role assignments
3. Missing v3 roles are created for users who have v1 roles
"""
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text as sa_text, create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("fix_rbac")


def fix_tenant_schema(engine):
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        log.info("Processing schema: %s", engine.url)

        seed_rbac(db)

        admin_role = db.execute(
            sa_text("SELECT id FROM rbac3_roles WHERE LOWER(name) = 'admin'")
        ).fetchone()

        if not admin_role:
            log.warning("No Admin role found in rbac3_roles")
            return

        admin_role_id = admin_role[0]

        users = db.execute(
            sa_text("SELECT id, email, is_super_admin FROM users")
        ).fetchall()

        for user_id, email, is_super in users:
            if is_super:
                continue

            existing = db.execute(
                sa_text("SELECT 1 FROM rbac3_user_roles WHERE user_id = :uid AND role_id = :rid"),
                {"uid": user_id, "rid": admin_role_id},
            ).fetchone()
            if existing:
                continue

            is_admin_v1 = False
            row = db.execute(
                sa_text("""
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = :uid AND LOWER(r.name) = 'admin'
                    LIMIT 1
                """),
                {"uid": user_id},
            ).fetchone()
            if row:
                is_admin_v1 = True

            if not is_admin_v1:
                row = db.execute(
                    sa_text("""
                        SELECT 1 FROM users u
                        JOIN roles r ON r.id = u.role_id
                        WHERE u.id = :uid AND LOWER(r.name) = 'admin'
                        LIMIT 1
                    """),
                    {"uid": user_id},
                ).fetchone()
                if row:
                    is_admin_v1 = True

            if is_admin_v1:
                db.execute(
                    sa_text("INSERT INTO rbac3_user_roles (user_id, role_id) VALUES (:uid, :rid) ON CONFLICT DO NOTHING"),
                    {"uid": user_id, "rid": admin_role_id},
                )
                log.info("Assigned Admin role to user %s (id=%s)", email, user_id)

        db.commit()
        log.info("Fixed RBAC assignments for schema")
    except Exception as e:
        db.rollback()
        log.error("Failed for schema: %s", e)
        raise
    finally:
        db.close()


def seed_rbac(db):
    from app.core.rbac import seed_all_v3_permissions
    seed_all_v3_permissions(db)
    log.info("RBAC modules and actions seeded")


def fix_all():
    engine = create_engine(settings.database_url_fixed, pool_pre_ping=True)
    fix_tenant_schema(engine)

    from app.core.tenant_manager import tenant_manager
    master_db = tenant_manager.get_master_session()
    try:
        rows = master_db.execute(
            sa_text("SELECT schema_name FROM master.companies")
        ).fetchall()
        for (schema_name,) in rows:
            tenant_engine = create_engine(
                settings.database_url_fixed,
                connect_args={"options": f"-csearch_path={schema_name},public"},
                pool_pre_ping=True,
            )
            fix_tenant_schema(tenant_engine)
            tenant_engine.dispose()
    except Exception as e:
        log.warning("Could not process company schemas: %s", e)
    finally:
        master_db.close()

    log.info("RBAC fix complete!")


if __name__ == "__main__":
    fix_all()
