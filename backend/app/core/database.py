import logging
from typing import Optional
from fastapi import Request
from sqlalchemy import text
from sqlalchemy.orm import declarative_base, Session

from app.core.config import settings
from app.core.tenant_manager import tenant_manager

log = logging.getLogger("rems.db")

# Expose Base and master engine for compatibility with migrations and schemas
Base = declarative_base()
engine = tenant_manager.engines["master"]
SessionLocal = tenant_manager.sessionmakers["master"]

def get_db(request: Request = None):
    """
    Dynamically resolves database session:
      - If user is a super admin or no tenant is active, yields master database session.
      - If tenant is active, yields tenant-isolated company database session.
    """
    db = None
    company_id = None
    
    if request:
        company_id = getattr(request.state, "company_id", None)
        
        # If not already determined, try to decode from Authorization header
        if company_id is None:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    from app.core.security import decode_access_token
                    payload = decode_access_token(token)
                    if payload:
                        company_id = payload.get("company_id")
                        request.state.company_id = company_id
                except Exception as e:
                    log.debug(f"[DB] Could not decode token in get_db: {e}")

    if company_id is None:
        # Use master database for global admin or system requests
        db = tenant_manager.get_master_session()
        log.debug("[DB] Resolved master database session")
    else:
        # Use tenant-specific database
        db = tenant_manager.get_tenant_session_by_id(company_id)
        if db is None:
            # Fallback to master database if tenant database fails to open or does not exist
            log.warning(f"[DB] Company ID {company_id} database session could not be resolved. Falling back to master.db.")
            db = tenant_manager.get_master_session()
        else:
            log.debug(f"[DB] Resolved tenant-isolated database session for company ID {company_id}")

    try:
        yield db
    except Exception as exc:
        log.error("[DB] Session error: %s", exc, exc_info=True)
        if db:
            db.rollback()
        raise
    finally:
        if db:
            db.close()


def get_master_db():
    """Return a session against the master database unconditionally."""
    db = tenant_manager.get_master_session()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Health-check helper — returns True if the master database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        log.error("[DB] Master database health check failed: %s", exc)
        return False
