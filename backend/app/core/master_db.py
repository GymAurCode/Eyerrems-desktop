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


def ensure_master_schema(db: Session) -> None:
    """Create master schema and companies table if they don't exist."""
    db.execute(text(CREATE_MASTER_SCHEMA_SQL))
    db.execute(text(CREATE_COMPANIES_TABLE_SQL))
    db.execute(text(ALTER_ADD_PERMISSIONS_SQL))
    db.commit()
    log.info("[Master] Master schema and companies table ensured.")


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

    # 2. Provision ALL tables using SQLAlchemy metadata
    #    Create a separate engine with search_path pointing to the new schema
    #    so Base.metadata.create_all creates tables inside it.
    #    Lazy import to avoid circular import (database -> tenant -> master_db).
    from app.core.database import Base
    tenant_engine = create_engine(
        settings.database_url_fixed,
        connect_args={"options": f"-csearch_path={schema_name},public"},
        pool_pre_ping=True,
    )
    Base.metadata.create_all(bind=tenant_engine)
    # Ensure attachment columns match the current model
    sync_attachments_table(tenant_engine)
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


def sync_attachments_table(engine) -> None:
    """Migrate existing attachments table columns (rename, add, convert)."""
    try:
        with engine.connect() as conn:
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
