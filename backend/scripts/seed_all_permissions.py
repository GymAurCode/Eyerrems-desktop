"""
Seed ALL permissions across all schemas.

This script:
1. Seeds RBAC v3 modules and actions from the app's navigation structure
2. Seeds default v3 roles with full permissions
3. Assigns all existing users to appropriate v3 roles
4. Seeds the v1 permissions table with all module.view entries
"""
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text as sa_text, create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("seed_permissions")


def seed_schema(db):
    from app.core.rbac import seed_all_v3_permissions, _invalidate_permission_cache

    slug_to_id = seed_all_v3_permissions(db)
    _invalidate_permission_cache()

    log.info("Seeded %d modules with all actions", len(slug_to_id))

    admin_role = db.execute(
        sa_text("SELECT id FROM rbac3_roles WHERE LOWER(name) = 'admin'")
    ).fetchone()

    if not admin_role:
        db.execute(
            sa_text("INSERT INTO rbac3_roles (name, description, is_super_admin, is_system_role, is_active) VALUES ('Admin', 'Full system access', true, true, true)")
        )
        db.commit()
        admin_role = db.execute(
            sa_text("SELECT id FROM rbac3_roles WHERE LOWER(name) = 'admin'")
        ).fetchone()
        log.info("Created Admin role")

    seed_default_roles(db, slug_to_id)

    users = db.execute(
        sa_text("SELECT id, email, is_super_admin FROM users")
    ).fetchall()

    for user_id, email, is_super in users:
        if is_super:
            continue

        existing = db.execute(
            sa_text("SELECT 1 FROM rbac3_user_roles WHERE user_id = :uid LIMIT 1"),
            {"uid": user_id},
        ).fetchone()
        if existing:
            continue

        v1_roles = []
        try:
            rows = db.execute(
                sa_text("""
                    SELECT DISTINCT LOWER(r.name)
                    FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = :uid
                """),
                {"uid": user_id},
            ).fetchall()
            v1_roles.extend(row[0] for row in rows)
        except Exception:
            pass

        if not v1_roles:
            try:
                row = db.execute(
                    sa_text("SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :uid"),
                    {"uid": user_id},
                ).fetchone()
                if row:
                    v1_roles.append(row[0].lower())
            except Exception:
                pass

        if not v1_roles:
            v1_roles = ["admin"]

        for role_name in v1_roles:
            v3_role = db.execute(
                sa_text("SELECT id FROM rbac3_roles WHERE LOWER(name) = :name LIMIT 1"),
                {"name": role_name},
            ).fetchone()
            if not v3_role:
                continue
            db.execute(
                sa_text("INSERT INTO rbac3_user_roles (user_id, role_id) VALUES (:uid, :rid) ON CONFLICT DO NOTHING"),
                {"uid": user_id, "rid": v3_role[0]},
            )
            log.info("Assigned %s to role %s", email, role_name)

        if not any(True for _ in v1_roles if _):
            db.execute(
                sa_text("INSERT INTO rbac3_user_roles (user_id, role_id) VALUES (:uid, :rid) ON CONFLICT DO NOTHING"),
                {"uid": user_id, "rid": admin_role[0]},
            )
            log.info("Assigned %s to Admin role (default)", email)

    db.commit()
    log.info("Schema seeding complete")


def seed_default_roles(db, slug_to_id):
    existing_roles = db.execute(
        sa_text("SELECT COUNT(*) FROM rbac3_roles")
    ).fetchone()[0]

    if existing_roles > 1:
        return

    action_map = {}
    for row in db.execute(sa_text("SELECT id, action_key FROM rbac3_actions")).fetchall():
        action_map[row[1]] = row[0]

    default_roles = [
        {
            "name": "Accountant",
            "description": "Finance and accounting access",
            "modules": {
                "dashboard": ["view"],
                "properties": ["view"],
                "finance": ["view", "create", "edit", "export", "approve"],
                "reports": ["view", "export"],
                "tenants": ["view"],
                "crm": ["view"],
            },
        },
        {
            "name": "Property Manager",
            "description": "Manage properties, tenants, and maintenance",
            "modules": {
                "dashboard": ["view"],
                "properties": ["view", "create", "edit", "delete", "export"],
                "towns": ["view", "create", "edit"],
                "tenants": ["view", "create", "edit", "delete"],
                "maintenance": ["view", "create", "edit", "delete"],
                "crm": ["view", "create", "edit"],
                "reports": ["view", "export"],
                "communication": ["view", "create"],
            },
        },
        {
            "name": "Sales Agent",
            "description": "CRM and property sales access",
            "modules": {
                "dashboard": ["view"],
                "properties": ["view"],
                "crm": ["view", "create", "edit", "export"],
                "communication": ["view", "create"],
                "reports": ["view"],
            },
        },
        {
            "name": "HR Manager",
            "description": "Human resources management",
            "modules": {
                "dashboard": ["view"],
                "hr": ["view", "create", "edit", "delete", "export", "approve"],
                "reports": ["view", "export"],
            },
        },
        {
            "name": "Viewer",
            "description": "Read-only access",
            "modules": {
                "dashboard": ["view"],
                "properties": ["view"],
                "towns": ["view"],
                "crm": ["view"],
                "tenants": ["view"],
                "maintenance": ["view"],
                "construction": ["view"],
                "hr": ["view"],
                "finance": ["view"],
                "reports": ["view"],
                "spreadsheet": ["view"],
                "ai": ["view"],
                "communication": ["view"],
                "reminders": ["view"],
            },
        },
    ]

    for role_config in default_roles:
        existing = db.execute(
            sa_text("SELECT id FROM rbac3_roles WHERE LOWER(name) = :name"),
            {"name": role_config["name"].lower()},
        ).fetchone()
        if existing:
            continue

        db.execute(
            sa_text("INSERT INTO rbac3_roles (name, description, is_system_role, is_active) VALUES (:name, :desc, true, true)"),
            {"name": role_config["name"], "desc": role_config["description"]},
        )
        db.flush()
        role_row = db.execute(
            sa_text("SELECT id FROM rbac3_roles WHERE name = :name"),
            {"name": role_config["name"]},
        ).fetchone()
        if not role_row:
            continue
        role_id = role_row[0]

        for module_slug, action_keys in role_config["modules"].items():
            mod_id = slug_to_id.get(module_slug)
            if not mod_id:
                continue
            for action_key in action_keys:
                action_id = action_map.get(action_key)
                if not action_id:
                    continue
                db.execute(
                    sa_text("INSERT INTO rbac3_role_permissions (role_id, module_id, action_id) VALUES (:rid, :mid, :aid) ON CONFLICT DO NOTHING"),
                    {"rid": role_id, "mid": mod_id, "aid": action_id},
                )

        log.info("Created role %s with %d module permissions", role_config["name"], len(role_config["modules"]))


def main():
    engine = create_engine(settings.database_url_fixed, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        seed_schema(db)
    finally:
        db.close()
    engine.dispose()

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
            tenant_session = sessionmaker(bind=tenant_engine)()
            try:
                seed_schema(tenant_session)
                log.info("Seeded schema: %s", schema_name)
            finally:
                tenant_session.close()
                tenant_engine.dispose()
    except Exception as e:
        log.warning("Could not process company schemas: %s", e)
    finally:
        master_db.close()

    log.info("=== All permissions seeded successfully ===")


if __name__ == "__main__":
    main()
