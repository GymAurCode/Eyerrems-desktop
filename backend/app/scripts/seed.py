import os

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.auth import Permission, Role, User
from app.models.finance import Account


ROLE_PERMISSIONS = {
    "Admin": [
        "dashboard:view",
        "properties:manage",
        "crm:manage",
        "finance:manage",
        "users:manage",
        "settings:manage",
    ],
    "Accountant": [
        "dashboard:view",
        "finance:manage",
        "crm:view",
    ],
    "Dealer": [
        "dashboard:view",
        "properties:view",
        "crm:manage",
    ],
    "Staff": [
        "dashboard:view",
        "properties:manage",
        "crm:manage",
    ],
}


def get_or_create_permission(db: Session, code: str) -> Permission:
    permission = db.query(Permission).filter(Permission.code == code).first()
    if permission:
        return permission
    permission = Permission(code=code, description=code.replace(":", " ").title())
    db.add(permission)
    db.flush()
    return permission


def get_or_create_role(db: Session, role_name: str) -> Role:
    role = db.query(Role).filter(Role.name == role_name).first()
    if role:
        return role
    role = Role(name=role_name)
    db.add(role)
    db.flush()
    return role


def seed_roles_permissions(db: Session) -> None:
    for role_name, permission_codes in ROLE_PERMISSIONS.items():
        role = get_or_create_role(db, role_name)
        existing = {permission.code for permission in role.permissions}
        for code in permission_codes:
            if code in existing:
                continue
            role.permissions.append(get_or_create_permission(db, code))


def seed_default_accounts(db: Session) -> None:
    defaults = [
        ("1000", "Cash on Hand", "asset"),
        ("1100", "Bank", "asset"),
        ("2000", "Accounts Payable", "liability"),
        ("3000", "Owner Equity", "equity"),
        ("4000", "Sales Revenue", "revenue"),
        ("5000", "Operating Expenses", "expense"),
    ]
    for code, name, account_type in defaults:
        if db.query(Account).filter(Account.code == code).first():
            continue
        db.add(Account(code=code, name=name, account_type=account_type))


def seed_admin_user(db: Session) -> tuple[str, str]:
    admin_email = os.getenv("REMS_ADMIN_EMAIL", "admin@rems.local")
    admin_password = os.getenv("REMS_ADMIN_PASSWORD", "Admin@123")
    admin_name = os.getenv("REMS_ADMIN_NAME", "System Admin")

    admin_role = db.query(Role).filter(Role.name == "Admin").first()
    if not admin_role:
        admin_role = get_or_create_role(db, "Admin")

    user = db.query(User).filter(User.email == admin_email).first()
    if not user:
        hashed = hash_password(admin_password)
        user = User(
            email=admin_email,
            full_name=admin_name,
            hashed_password=hashed,
            role_id=admin_role.id,
            approval_status="approved",
            is_active=True,
        )
        db.add(user)
    else:
        user.approval_status = "approved"
        user.is_active = True
    return admin_email, admin_password


def main() -> None:
    db = SessionLocal()
    try:
        seed_roles_permissions(db)
        seed_default_accounts(db)
        email, password = seed_admin_user(db)
        db.commit()
        print("Seed completed.")
        print(f"Admin email: {email}")
        print(f"Admin password: {password}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
