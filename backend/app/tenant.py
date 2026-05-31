"""
Tenant database session resolution via PostgreSQL schema-per-company.

Each company has its own PostgreSQL schema.  The schema to use is determined
from the X-Company-Id header (the company's UUID from master.companies).

Usage in FastAPI routes:

    from app.tenant import get_tenant_db

    @router.get("/properties")
    def list_properties(db: Session = Depends(get_tenant_db)):
        ...

The session's search_path is set to the company's schema, so all queries
automatically run in the correct schema without any query modification.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import Header, HTTPException, Depends
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.master_db import ensure_master_schema

log = logging.getLogger("rems.tenant")

# ── Cached engines per schema ─────────────────────────────────────────────────
_engines: dict[str, object] = {}
_sessionmakers: dict[str, sessionmaker] = {}


def get_schema_engine(schema_name: str):
    """Get or create a cached engine + sessionmaker for a given schema."""
    if schema_name in _engines:
        return _engines[schema_name], _sessionmakers[schema_name]

    engine = create_engine(
        settings.database_url,
        connect_args={"options": f"-csearch_path={schema_name},public"},
        pool_pre_ping=True,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    _engines[schema_name] = engine
    _sessionmakers[schema_name] = SessionLocal
    return engine, SessionLocal


def lookup_company(x_company_id: str) -> Optional[dict]:
    """Look up company details from master.companies by UUID."""
    master_engine = get_schema_engine("master")[0]
    with master_engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT id, name, schema_name, status, expiry_date
                FROM master.companies
                WHERE id = :cid
            """),
            {"cid": x_company_id},
        ).fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "name": row[1],
        "schema_name": row[2],
        "status": row[3],
        "expiry_date": row[4],
    }


def get_tenant_db(x_company_id: str = Header(...)) -> Session:
    """
    FastAPI dependency — resolves company schema from X-Company-Id header
    and returns a SQLAlchemy session scoped to that schema.

    Raises:
        404 — Company not found
        403 — Account suspended or license expired
    """
    company = lookup_company(x_company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if company["status"] == "suspended":
        raise HTTPException(
            status_code=403,
            detail="Account suspended. Contact your administrator.",
        )

    if company["expiry_date"] and company["expiry_date"] < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=403,
            detail="License expired. Contact your administrator.",
        )

    _, SessionLocal = get_schema_engine(company["schema_name"])
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_tenant_db_optional(x_company_id: Optional[str] = Header(None)) -> Optional[Session]:
    """
    Like get_tenant_db but returns None if no header is provided.
    Used for routes that optionally scope to a company.
    """
    if not x_company_id:
        yield None
        return
    yield from get_tenant_db(x_company_id)


def get_master_session() -> Session:
    """Get a session against the database for master schema operations.
    Uses the public search_path so master.companies is accessible."""
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()
