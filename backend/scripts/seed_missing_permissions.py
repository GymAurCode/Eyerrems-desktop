"""Seed missing permissions and add them to the Admin role."""
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine
from app.models.auth import Permission, Role
from app.services.rbac_service import RBACService

log = logging.getLogger("rems.seed")
logging.basicConfig(level=logging.INFO)

MISSING_PERMISSIONS = [
    ("ai.view", "AI", "View AI intelligence"),
    ("ai.create", "AI", "Create AI queries"),
    ("ai.manage", "AI", "Full AI management"),
    ("admin.manage", "Admin", "Manage admin settings"),
    ("admin.view", "Admin", "View admin panel"),
    ("settings.view", "Settings", "View settings"),
    ("settings.manage", "Settings", "Manage settings"),
    ("reports.view", "Reports", "View reports"),
    ("reports.export", "Reports", "Export reports"),
    ("reminders.view", "Reminders", "View reminders"),
    ("reminders.create", "Reminders", "Create reminders"),
    ("reminders.manage", "Reminders", "Manage reminders"),
    ("maintenance.view", "Maintenance", "View maintenance"),
    ("maintenance.create", "Maintenance", "Create maintenance requests"),
    ("maintenance.manage", "Maintenance", "Full maintenance management"),
    ("communication.view", "Communication", "View communications"),
    ("communication.send", "Communication", "Send communications"),
    ("import.view", "Import", "View import module"),
    ("import.create", "Import", "Create imports"),
    ("import.manage", "Import", "Full import management"),
]


def seed():
    db = SessionLocal()
    try:
        created = []
        for name, module, description in MISSING_PERMISSIONS:
            existing = db.query(Permission).filter(Permission.name == name).first()
            if not existing:
                perm = Permission(name=name, module=module, description=description)
                db.add(perm)
                created.append(name)
                log.info(f"Created permission: {name}")

        if created:
            db.flush()
            # Add all new permissions to Admin role
            admin_role = db.query(Role).filter(Role.name == "Admin").first()
            if admin_role:
                new_perms = db.query(Permission).filter(Permission.name.in_(created)).all()
                admin_role.permissions.extend(new_perms)
                log.info(f"Added {len(new_perms)} new permissions to Admin role")
            db.commit()
            log.info(f"Seeded {len(created)} missing permissions")
        else:
            log.info("No missing permissions to seed")

    except Exception as e:
        db.rollback()
        log.error(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()