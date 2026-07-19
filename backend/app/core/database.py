import logging
from typing import Optional
from fastapi import Request
from sqlalchemy import text
from sqlalchemy.orm import declarative_base, Session

from app.core.config import settings
from app.core.tenant_manager import tenant_manager
from app.tenant import get_master_session as get_pg_master_session

log = logging.getLogger("rems.db")

# Expose Base and master engine for compatibility with migrations and schemas
Base = declarative_base()

def _get_master_engine():
    """Lazy-load the master engine to avoid import-time crash."""
    if not hasattr(_get_master_engine, "_engine"):
        _get_master_engine._engine = tenant_manager.engines["master"]
    return _get_master_engine._engine

def _get_master_sessionmaker():
    if not hasattr(_get_master_sessionmaker, "_sm"):
        _get_master_sessionmaker._sm = tenant_manager.sessionmakers["master"]
    return _get_master_sessionmaker._sm

engine = _get_master_engine()
SessionLocal = _get_master_sessionmaker()


def get_db(request: Request = None):
    """
    Dynamically resolves database session:
      - If user is a super admin or no tenant is active, yields master database session.
      - If tenant is active (via X-Company-Id or JWT claim), yields tenant-isolated session
        using PostgreSQL schema-per-company approach.
    """
    db = None
    company_id = None
    company_slug = None

    if request:
        company_id = getattr(request.state, "company_id", None)
        company_slug = getattr(request.state, "company_slug", None)

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
                        company_slug = payload.get("company_slug") or company_slug
                        request.state.company_id = company_id
                        request.state.company_slug = company_slug
                except Exception as e:
                    log.debug(f"[DB] Could not decode token in get_db: {e}")

        # Also check X-Company-Id header (for company_admin API calls)
        if company_id is None:
            try:
                x_company_id = request.headers.get("X-Company-Id")
                if x_company_id:
                    company_id = x_company_id
                    request.state.company_id = x_company_id
            except Exception:
                pass

    if company_id is None:
        db = tenant_manager.get_master_session()
        log.debug("[DB] Resolved master database session")
    else:
        # Try PostgreSQL schema-based tenant first
        try:
            from app.tenant import lookup_company, get_schema_engine
            company_info = lookup_company(str(company_id))
            if company_info:
                _, SessionClass = get_schema_engine(company_info["schema_name"])
                db = SessionClass()
                resolved = False
                try:
                    row = db.execute(
                        text("SELECT id FROM companies WHERE master_id = :mid"),
                        {"mid": str(company_id)},
                    ).fetchone()
                    if row:
                        request.state.company_id = row[0]
                        resolved = True
                except Exception:
                    log.debug(f"[DB] master_id column not available, rolling back")
                    db.rollback()
                if not resolved:
                    try:
                        slug_row = db.execute(
                            text("SELECT id FROM companies WHERE slug = :slug"),
                            {"slug": company_info["schema_name"]},
                        ).fetchone()
                        if slug_row:
                            request.state.company_id = slug_row[0]
                            resolved = True
                    except Exception:
                        log.debug(f"[DB] slug lookup fallback failed, rolling back")
                        db.rollback()
                log.debug(f"[DB] Resolved schema-based tenant session for schema '{company_info['schema_name']}'")
            else:
                # Fallback to SQLite tenant
                numeric_id = int(company_id) if isinstance(company_id, (int, str)) and str(company_id).isdigit() else None
                db = tenant_manager.get_tenant_session_by_id(numeric_id)
                if db is None and company_slug:
                    db = tenant_manager.get_tenant_session(company_slug)
                if db is None:
                    log.warning(f"[DB] Could not resolve tenant. Falling back to master.")
                    db = tenant_manager.get_master_session()
                else:
                    log.debug(f"[DB] Resolved SQLite tenant session for company '{company_slug or company_id}'")
        except Exception as e:
            log.warning(f"[DB] Schema-based tenant resolution failed ({e}), falling back to SQLite.")
            try:
                numeric_id = int(company_id) if isinstance(company_id, (int, str)) and str(company_id).isdigit() else None
                db = tenant_manager.get_tenant_session_by_id(numeric_id)
                if db is None and company_slug:
                    db = tenant_manager.get_tenant_session(company_slug)
            except Exception:
                db = None
            if db is None:
                db = tenant_manager.get_master_session()

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
