from fastapi import Depends, HTTPException
from app.core.security import decode_access_token
from app.core.database import get_db
from app.models.auth import User
from app.api.deps import get_current_user
from fastapi import Request
from sqlalchemy.orm import Session


def get_current_user_flexible(request: Request,
                               db: Session = Depends(get_db)):
    """
    Works for both admin users (existing User model) and role users
    (RoleUser model via JWT). Returns a dict-like object with user_type,
    permissions, etc.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_type = payload.get("user_type")

    if user_type == "role_user":
        return payload

    try:
        user = get_current_user(request, db, token)
        user_dict = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "user_type": "admin",
            "permissions": list(user.get_all_permissions()),
            "is_super_admin": getattr(user, 'is_super_admin', False),
        }
        return type('AdminUser', (), user_dict)()
    except Exception:
        raise HTTPException(status_code=403, detail="Access denied")


def require_permission(module: str, tab: str = None,
                       action: str = "view"):
    """
    Dependency factory for route protection.

    Usage on any route:
    @router.get("/leads")
    async def get_leads(
        _=Depends(require_permission("crm", "leads", "view"))
    ):

    @router.post("/leads")
    async def create_lead(
        _=Depends(require_permission("crm", "leads", "add"))
    ):

    @router.delete("/leads/{id}")
    async def delete_lead(
        _=Depends(require_permission("crm", "leads", "delete"))
    ):
    """
    def permission_checker(
        current_user=Depends(get_current_user_flexible)
    ):
        if getattr(current_user, 'user_type', None) == 'admin':
            if getattr(current_user, 'is_super_admin', False):
                return current_user

        if getattr(current_user, 'user_type', None) == 'role_user':
            permissions = current_user.get("permissions", {})

            perm_key = f"{module}.{tab}" if tab else module
            perm = permissions.get(perm_key) or permissions.get(module)

            if not perm:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied: no permission for {module}"
                           + (f" / {tab}" if tab else "")
                )

            action_map = {
                "view": "view",
                "add": "add",
                "create": "add",
                "edit": "edit",
                "update": "edit",
                "delete": "delete",
            }

            required = action_map.get(action, action)

            if not perm.get(required, False):
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied: cannot {action} in {module}"
                           + (f" / {tab}" if tab else "")
                )

            return current_user

        return current_user

    return Depends(permission_checker)
