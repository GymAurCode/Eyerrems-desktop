"""
Tenant Resolver Middleware
──────────────────────────
Extracts company_id from the JWT on every request and attaches it to
request.state so route handlers can use it without repeating the lookup.

This is a *passive* middleware — it never blocks requests.  Actual
enforcement happens in the `get_current_user` dependency in deps.py.
"""
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.security import decode_access_token


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Reads the Authorization header, decodes the JWT (without raising),
    and sets:
        request.state.company_id     – int | None
        request.state.is_super_admin – bool
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        company_id: Optional[int] = None
        is_super_admin: bool = False

        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_access_token(token)
            if payload:
                company_id = payload.get("company_id")
                is_super_admin = bool(payload.get("is_super_admin", False))

        request.state.company_id = company_id
        request.state.is_super_admin = is_super_admin

        return await call_next(request)
