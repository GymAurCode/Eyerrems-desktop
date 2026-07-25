from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.auth import User

router = APIRouter()

SYSTEM_CHANNEL_ID = "system_updates"


@router.get("/bootstrap")
def chat_bootstrap(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    company_id = getattr(request.state, "company_id", None)

    users_q = db.query(User).filter(User.is_active == True, User.status == "active")
    if company_id is not None and not user.is_super_admin:
        users_q = users_q.filter(User.company_id == company_id, User.is_super_admin == False)
    users = users_q.order_by(User.full_name).all()

    chat_users = []
    for u in users:
        chat_users.append({
            "id": str(u.id),
            "name": u.full_name,
            "email": u.email,
            "online": u.status == "active",
        })

    channels = [
        {
            "id": SYSTEM_CHANNEL_ID,
            "name": "System Updates",
            "type": "system",
            "members": [str(u.id) for u in users],
            "pinned": True,
            "icon": "\u2699\ufe0f",
        },
    ]

    return {
        "current_user_id": str(user.id),
        "channels": channels,
        "users": chat_users,
        "is_admin": True,
    }
