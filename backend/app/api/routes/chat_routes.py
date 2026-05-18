"""Chat bootstrap — dynamic role channels from RBAC."""
import re

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_any_permission
from app.core.database import get_db
from app.models.auth import Role, User

router = APIRouter()

SYSTEM_CHANNEL_ID = "system_updates"


def _slug_role(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _user_is_admin(user: User) -> bool:
    if user.is_super_admin:
        return True
    for role in user.roles or []:
        if role.name.lower() == "admin":
            return True
    if user.role and user.role.name.lower() == "admin":
        return True
    return False


def _user_role_names(user: User) -> set[str]:
    names = {r.name for r in (user.roles or [])}
    if user.role:
        names.add(user.role.name)
    return names


def _can_access_role_channel(user: User, role_name: str) -> bool:
    if _user_is_admin(user):
        return True
    return role_name in _user_role_names(user)


@router.get("/bootstrap")
def chat_bootstrap(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    _=Depends(require_any_permission("user.view", "crm:view", "crm:manage", "finance:view", "finance:manage")),
):
    """
    Build chat structure from RBAC roles and company users.
    Role channels use stable ids: role_{role_id}
    Direct message ids: dm_{minId}_{maxId}
    """
    company_id = getattr(request.state, "company_id", None) or user.company_id

    roles_q = db.query(Role).options(joinedload(Role.permissions)).order_by(Role.name)
    roles = roles_q.all()

    users_q = (
        db.query(User)
        .options(joinedload(User.roles), joinedload(User.role))
        .filter(User.is_active == True, User.status == "active")
    )
    if company_id is not None and not user.is_super_admin:
        users_q = users_q.filter(User.company_id == company_id, User.is_super_admin == False)
    users = users_q.order_by(User.full_name).all()

    chat_users = []
    for u in users:
        role_names = [r.name for r in u.roles] or ([u.role.name] if u.role else ["Staff"])
        chat_users.append({
            "id": str(u.id),
            "name": u.full_name,
            "email": u.email,
            "roles": role_names,
            "primary_role": role_names[0] if role_names else "Staff",
            "online": u.status == "active",
        })

    channels = [
        {
            "id": SYSTEM_CHANNEL_ID,
            "name": "System Updates",
            "type": "system",
            "role_id": None,
            "role_name": None,
            "members": [str(u.id) for u in users],
            "pinned": True,
            "icon": "⚙️",
        },
    ]

    for role in roles:
        if not _can_access_role_channel(user, role.name):
            continue
        member_ids = [
            str(u.id) for u in users
            if role.name in ([r.name for r in u.roles] or ([u.role.name] if u.role else []))
        ]
        if _user_is_admin(user) and str(user.id) not in member_ids:
            member_ids.append(str(user.id))
        channels.append({
            "id": f"role_{role.id}",
            "name": role.name,
            "type": "role",
            "role_id": role.id,
            "role_name": role.name,
            "members": member_ids,
            "pinned": False,
            "icon": "#",
        })

    # Direct message stubs for users in same company (not self)
    for u in users:
        if u.id == user.id:
            continue
        if not _user_is_admin(user):
            other_roles = {r.name for r in u.roles} or ({u.role.name} if u.role else set())
            if not _user_role_names(user).intersection(other_roles) and not _user_is_admin(user):
                pass  # still allow DMs within company
        a, b = sorted([user.id, u.id])
        channels.append({
            "id": f"dm_{a}_{b}",
            "name": u.full_name,
            "type": "direct",
            "role_id": None,
            "role_name": None,
            "members": [str(a), str(b)],
            "pinned": False,
        })

    return {
        "current_user_id": str(user.id),
        "is_admin": _user_is_admin(user),
        "roles": [{"id": r.id, "name": r.name, "description": r.description} for r in roles],
        "users": chat_users,
        "channels": channels,
    }
