"""
Fix existing role permissions and ensure all users are properly assigned.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import logging
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("fix_roles")


def fix_schema(db):
    from app.core.rbac import seed_all_v3_permissions, _invalidate_permission_cache

    slug_to_id = seed_all_v3_permissions(db)
    _invalidate_permission_cache()

    action_map = {}
    for row in db.execute(text("SELECT id, action_key FROM rbac3_actions")).fetchall():
        action_map[row[1]] = row[0]

    admin_role = db.execute(text("SELECT id FROM rbac3_roles WHERE LOWER(name) = 'admin'")).fetchone()
    if not admin_role:
        db.execute(text("INSERT INTO rbac3_roles (name, description, is_super_admin, is_system_role, is_active) VALUES ('Admin', 'Full system access', true, true, true)"))
        db.commit()
        admin_role = db.execute(text("SELECT id FROM rbac3_roles WHERE LOWER(name) = 'admin'")).fetchone()
    admin_role_id = admin_role[0]

    roles = db.execute(text("SELECT id, name, is_super_admin FROM rbac3_roles ORDER BY name")).fetchall()

    for role_id, role_name, is_sa in roles:
        if is_sa:
            continue

        existing_count = db.execute(text("SELECT COUNT(*) FROM rbac3_role_permissions WHERE role_id = :rid"), {"rid": role_id}).fetchone()[0]
        log.info("Role '%s': %d existing permissions", role_name, existing_count)

        if existing_count > 5:
            continue

        if role_name.lower() == "accountant":
            module_slugs = {"dashboard", "properties", "finance", "reports", "tenants", "crm"}
        elif role_name.lower() in ("dashboard only",):
            module_slugs = {"dashboard", "properties", "crm", "tenants"}
        elif role_name.lower() in ("hr manager", "hr manageer"):
            module_slugs = {"dashboard", "hr", "reports"}
        else:
            module_slugs = set(slug_to_id.keys())

        for module_slug, mod_id in slug_to_id.items():
            base = module_slug.split(".")[0]
            if base not in module_slugs and module_slug not in module_slugs:
                continue
            for action_key in ["view", "create", "edit", "delete", "export"]:
                action_id = action_map.get(action_key)
                if not action_id:
                    continue
                existing = db.execute(
                    text("SELECT 1 FROM rbac3_role_permissions WHERE role_id = :rid AND module_id = :mid AND action_id = :aid"),
                    {"rid": role_id, "mid": mod_id, "aid": action_id},
                ).fetchone()
                if not existing:
                    db.execute(
                        text("INSERT INTO rbac3_role_permissions (role_id, module_id, action_id) VALUES (:rid, :mid, :aid) ON CONFLICT DO NOTHING"),
                        {"rid": role_id, "mid": mod_id, "aid": action_id},
                    )

        new_count = db.execute(text("SELECT COUNT(*) FROM rbac3_role_permissions WHERE role_id = :rid"), {"rid": role_id}).fetchone()[0]
        log.info("Role '%s': now %d permissions", role_name, new_count)

    users = db.execute(text("SELECT id, email, is_super_admin FROM users WHERE is_super_admin = false")).fetchall()
    for user_id, email, _ in users:
        has_v3 = db.execute(text("SELECT 1 FROM rbac3_user_roles WHERE user_id = :uid LIMIT 1"), {"uid": user_id}).fetchone()
        if has_v3:
            continue

        is_admin_v1 = False
        row = db.execute(
            text("SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = :uid AND LOWER(r.name) = 'admin' LIMIT 1"),
            {"uid": user_id},
        ).fetchone()
        if row:
            is_admin_v1 = True

        if not is_admin_v1:
            row = db.execute(
                text("SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :uid AND LOWER(r.name) = 'admin' LIMIT 1"),
                {"uid": user_id},
            ).fetchone()
            if row:
                is_admin_v1 = True

        if is_admin_v1:
            db.execute(
                text("INSERT INTO rbac3_user_roles (user_id, role_id) VALUES (:uid, :rid) ON CONFLICT DO NOTHING"),
                {"uid": user_id, "rid": admin_role_id},
            )
            log.info("Assigned Admin v3 role to %s", email)

    db.commit()
    log.info("Schema fix complete")


def main():
    engine = create_engine(settings.database_url_fixed, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        fix_schema(db)
    finally:
        db.close()
    engine.dispose()

    from app.core.tenant_manager import tenant_manager
    master_db = tenant_manager.get_master_session()
    try:
        rows = master_db.execute(text("SELECT schema_name FROM master.companies")).fetchall()
        for (schema_name,) in rows:
            tenant_engine = create_engine(
                settings.database_url_fixed,
                connect_args={"options": f"-csearch_path={schema_name},public"},
                pool_pre_ping=True,
            )
            ts = sessionmaker(bind=tenant_engine)()
            try:
                fix_schema(ts)
                log.info("Fixed schema: %s", schema_name)
            finally:
                ts.close()
                tenant_engine.dispose()
    except Exception as e:
        log.warning("Company schemas skipped: %s", e)
    finally:
        master_db.close()

    log.info("=== Done ===")


if __name__ == "__main__":
    main()
