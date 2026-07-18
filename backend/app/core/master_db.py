"""
Master schema — holds cross-company system tables in a dedicated PostgreSQL schema.

The `master` schema contains:
  - master.companies   — one row per tenant company
  - master.super_admins — super admin credentials (seeded at startup)

Every company gets its own PostgreSQL schema (e.g. company_a1b2c3) with a full
copy of all application tables.  Tenant isolation is enforced by PostgreSQL's
search_path mechanism.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings

log = logging.getLogger("rems.master")

MASTER_SCHEMA = "master"

# ── DDL ───────────────────────────────────────────────────────────────────────

CREATE_MASTER_SCHEMA_SQL = f"CREATE SCHEMA IF NOT EXISTS {MASTER_SCHEMA};"

CREATE_COMPANIES_TABLE_SQL = f"""
CREATE TABLE IF NOT EXISTS {MASTER_SCHEMA}.companies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    admin_email         TEXT UNIQUE NOT NULL,
    admin_password_hash TEXT NOT NULL,
    phone               TEXT,
    status              TEXT DEFAULT 'active'
                            CHECK (status IN ('active','suspended','expired')),
    expiry_date         TIMESTAMPTZ NOT NULL,
    schema_name         TEXT UNIQUE NOT NULL,
    permissions         JSONB DEFAULT '{{}}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
"""

ALTER_ADD_PERMISSIONS_SQL = f"""
ALTER TABLE {MASTER_SCHEMA}.companies
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{{}}';
"""

ALTER_ADD_SLUG_SQL = f"""
ALTER TABLE {MASTER_SCHEMA}.companies
ADD COLUMN IF NOT EXISTS slug TEXT;
"""


def ensure_master_schema(db: Session) -> None:
    """Create master schema and companies table if they don't exist.
    Compatible with both PostgreSQL (schema-based) and SQLite (no schema support)."""
    try:
        db.execute(text("SET lock_timeout = '5s'"))
    except Exception:
        pass  # SQLite does not support SET lock_timeout
    try:
        db.execute(text(CREATE_MASTER_SCHEMA_SQL))
        db.execute(text(CREATE_COMPANIES_TABLE_SQL))
        db.execute(text(ALTER_ADD_PERMISSIONS_SQL))
        db.execute(text(ALTER_ADD_SLUG_SQL))
        db.commit()
        log.info("[Master] Master schema and companies table ensured.")
    except Exception as e:
        log.warning(f"[Master] Schema setup skipped (expected on SQLite): {e}")


def provision_company_schema(
    db: Session,
    schema_name: str,
    company_id: str,
) -> None:
    """
    Create a new PostgreSQL schema for a company and run ALL application
    table DDL inside it using SQLAlchemy model metadata.

    This ensures every model defined in app.models.* gets its table created
    with the correct columns, indexes, and constraints.
    """
    log.info(f"[Master] Provisioning schema '{schema_name}' for company {company_id}")

    # 1. Create the schema
    db.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
    db.commit()

    # 2. Provision ALL tables using SQLAlchemy metadata.
    #    Use *checkfirst=False* because SQLAlchemy's inspector caches
    #    default_schema_name = 'public' at engine-init time (from the
    #    default search_path).  With checkfirst=True it would find
    #    e.g. public.roles and skip creating company_xxx.roles.
    #    Since the schema name is always a fresh UUID, no tables exist
    #    yet inside it, so creating unconditionally is safe.
    #    Lazy import to avoid circular import (database -> tenant -> master_db).
    from app.core.database import Base
    tenant_engine = create_engine(
        settings.database_url_fixed,
        pool_pre_ping=True,
    )
    with tenant_engine.connect() as conn:
        conn.execute(text(f"SET search_path TO {schema_name},public"))
        conn.execute(text("SET lock_timeout = '5s'"))
        Base.metadata.create_all(bind=conn, checkfirst=False)
        # The Company model does not define master_id, but create_company
        # inserts it.  Add the column here so the INSERT succeeds.
        conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS master_id VARCHAR(36)"))
        sync_attachments_table(connection=conn)
        conn.commit()
    tenant_engine.dispose()

    log.info(f"[Master] Schema '{schema_name}' provisioned successfully.")


SYNC_ATTACHMENTS_SQL = """
-- Rename file_name → document_name if old column exists
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attachments' AND column_name='file_name') THEN
        ALTER TABLE attachments RENAME COLUMN file_name TO document_name;
    END IF;
END $$;

-- Add description if missing
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS description TEXT;

-- Add document_status if missing
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS document_status VARCHAR(20) DEFAULT 'VERIFIED';

-- Convert file_size (Integer) → file_size_kb (Numeric) if old column exists
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attachments' AND column_name='file_size') THEN
        ALTER TABLE attachments ADD COLUMN IF NOT EXISTS file_size_kb NUMERIC(10,2);
        UPDATE attachments SET file_size_kb = ROUND(file_size::NUMERIC / 1024, 2) WHERE file_size IS NOT NULL;
        ALTER TABLE attachments DROP COLUMN file_size;
    END IF;
END $$;

-- Add serial_no if missing
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS serial_no INTEGER;
-- Populate serial_no for existing rows if empty
UPDATE attachments SET serial_no = sub.rn FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY module, record_id ORDER BY id) AS rn
    FROM attachments
) sub WHERE attachments.id = sub.id AND attachments.serial_no IS NULL;

-- Add updated_at if missing
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure the index exists
CREATE INDEX IF NOT EXISTS idx_attachments_module_record ON attachments(module, record_id);
"""


def sync_attachments_table(engine=None, connection=None) -> None:
    """Migrate existing attachments table columns (rename, add, convert).
    
    Accept either an *engine* (to create a new connection) or an existing
    *connection* (reused so the caller controls the search_path).
    """
    try:
        if connection is not None:
            connection.execute(text("SET lock_timeout = '5s'"))
            connection.execute(text(SYNC_ATTACHMENTS_SQL))
            connection.commit()
        else:
            with engine.connect() as conn:
                conn.execute(text("SET lock_timeout = '5s'"))
                conn.execute(text(SYNC_ATTACHMENTS_SQL))
                conn.commit()
        log.info("[Master] Attachments table synced.")
    except Exception as e:
        log.warning(f"[Master] Attachments sync skipped: {e}")


def drop_company_schema(db: Session, schema_name: str) -> None:
    """Drop a company's schema and all its data."""
    log.info(f"[Master] Dropping schema '{schema_name}'")
    db.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE"))
    db.commit()
