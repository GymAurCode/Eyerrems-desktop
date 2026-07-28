import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.api.routes.activity import router as activity_router
from app.api.routes.audit import router as audit_router
from app.api.routes.tenants import router as tenants_router
from app.api.routes.construction import router as construction_router
from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.crm import router as crm_router
from app.api.routes.client_pipeline import router as client_pipeline_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.finance import router as finance_router
from app.api.routes.finance_operations import router as finance_ops_router
from app.api.routes.properties import router as properties_router
from app.api.routes.settings import router as settings_router
from app.api.routes.websocket import router as websocket_router
from app.api.routes.reminders import router as reminders_router
from app.api.routes.hr import router as hr_router
from app.api.routes.mail import router as mail_router
from app.api.routes.company_settings import router as company_settings_router
from app.api.routes.towns import router as towns_router, town_units_router
from app.api.routes.ledger import router as ledger_router
from app.api.routes.bootstrap import router as bootstrap_router
from app.api.routes.booking import router as booking_router
from app.api.routes.ai_intelligence import router as ai_router
from app.api.routes.import_routes import router as import_router
from app.api.routes.chat_routes import router as chat_router
from app.api.routes.superadmin import router as superadmin_router
from app.api.routes.attachments import router as attachments_router
from app.routers.files import router as files_router

from app.api.routes.spreadsheet import router as spreadsheet_router
from app.api.routes.users import router as users_router
from app.api.routes.lookups import router as lookups_router
from app.api.routes.async_select import router as async_select_router
from app.api.routes.reports import router as reports_router
from app.api.routes.rbac_routes import router as rbac_router
from app.api.routes.recycle_bin import router as recycle_bin_router
from app.api.routes.backup import router as backup_router
from app.api.routes.clear_data import router as clear_data_router
from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.core.default_coa import seed_default_coa
from app.models.audit import AuditLog
from app.models.rbac import RolePermission
from app.core.master_db import sync_attachments_table
from app.core.tenant_middleware import TenantMiddleware
from app.services.reminder_scheduler import start_scheduler as start_reminder_scheduler, stop_scheduler as stop_reminder_scheduler
from app.services.booking_scheduler import register_booking_expiry_job
from app.services.mail.mail_sync_scheduler import register_mail_sync_job
from app.services.crm.followup_scheduler import register_followup_job
from app.services.backup_scheduler import register_backup_job

BASE_DIR = Path(__file__).resolve().parent.parent

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rems")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    _startup()
    yield
    stop_reminder_scheduler()


def _startup():
    log.info("=== Application startup began ===")
    log.info(f"[ENV] DATABASE_URL set: {bool(settings.database_url)}")
    log.info(f"[ENV] JWT_SECRET_KEY set: {bool(settings.jwt_secret_key)}")
    log.info(f"[ENV] JWT_ALGORITHM: {settings.jwt_algorithm}")
    log.info(f"[ENV] JWT_EXPIRE_MINUTES: {settings.jwt_access_token_expire_minutes}")
    log.info(f"[ENV] SUPERADMIN_EMAIL: {settings.superadmin_email}")
    if not settings.jwt_secret_key:
        log.error("[ENV] JWT_SECRET_KEY is not set! Authentication will fail!")
    if not settings.database_url:
        log.warning("[ENV] DATABASE_URL not set — will use SQLite fallback (local dev only)")

    try:
        from app.tenant import get_master_session
        from app.core.master_db import ensure_master_schema
        mdb = get_master_session()
        try:
            ensure_master_schema(mdb)
            print("[REMS] Master schema and companies table ensured.")
        finally:
            mdb.close()
    except Exception as e:
        print(f"[REMS] Master schema setup skipped: {e}")

    try:
        Base.metadata.create_all(bind=engine)
        print("[REMS] Verified database schema before seeding.")
    except Exception as e:
        print(f"[REMS] Schema verification skipped: {e}")

    try:
        from alembic.config import Config as AlembicConfig
        from alembic import command
        alembic_cfg = AlembicConfig(str(BASE_DIR / "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
        print("[REMS] Alembic upgrade head completed.")
    except Exception as e:
        print(f"[REMS] Alembic upgrade skipped: {e}")

    try:
        from app.core.tenant_manager import tenant_manager as _tm
        from app.core.security import hash_password
        sa_session = _tm.get_master_session()
        try:
            existing = sa_session.execute(
                text("SELECT id FROM users WHERE email = :email AND is_super_admin = TRUE"),
                {"email": settings.superadmin_email},
            ).fetchone()
            if not existing:
                pw_hash = hash_password(settings.superadmin_password)
                now = datetime.now(timezone.utc)
                sa_session.execute(
                    text("""
                        INSERT INTO users (email, full_name, hashed_password, is_super_admin,
                                           status, is_approved, is_active, approval_status, created_at)
                        VALUES (:email, :name, :pw, TRUE, 'active', TRUE, TRUE, 'approved', :now)
                    """),
                    {"email": settings.superadmin_email, "name": "Super Admin", "pw": pw_hash, "now": now},
                )
                sa_session.commit()
                print("[REMS] Superadmin user seeded.")
            else:
                print("[REMS] Superadmin user already exists.")
        except Exception as e:
            print(f"[REMS] Superadmin INSERT failed: {e}")
        finally:
            sa_session.close()
    except Exception as e:
        print(f"[REMS] Superadmin seed skipped: {e}")

    try:
        from app.models.company import Company
        from app.core.security import hash_password
        sa_session = _tm.get_master_session()
        try:
            company_row = sa_session.execute(
                text("SELECT id FROM companies WHERE slug = 'default'"),
            ).fetchone()
            if not company_row:
                now = datetime.now(timezone.utc)
                sa_session.execute(
                    text("""
                        INSERT INTO companies (name, slug, status, currency_code, created_at, updated_at)
                        VALUES ('Default Company', 'default', 'active', 'PKR', :now, :now)
                    """),
                    {"now": now},
                )
                sa_session.commit()
                company_row = sa_session.execute(
                    text("SELECT id FROM companies WHERE slug = 'default'"),
                ).fetchone()
            cid = company_row[0] if company_row else None

            existing = sa_session.execute(
                text("SELECT id, company_id FROM users WHERE email = 'admin@rems.local'"),
            ).fetchone()
            if not existing:
                pw_hash = hash_password("Admin@123")
                now = datetime.now(timezone.utc)
                sa_session.execute(
                    text("""
                        INSERT INTO users (email, full_name, hashed_password, company_id,
                                           is_super_admin, status, is_approved, is_active,
                                           approval_status, created_at)
                        VALUES ('admin@rems.local', 'Default Company Admin', :pw, :cid,
                                FALSE, 'active', TRUE, TRUE, 'approved', :now)
                    """),
                    {"pw": pw_hash, "cid": cid, "now": now},
                )
                sa_session.commit()
                print("[REMS] Company admin (admin@rems.local) seeded.")
            else:
                if existing.company_id is None and cid:
                    sa_session.execute(
                        text("UPDATE users SET company_id = :cid WHERE id = :uid"),
                        {"cid": cid, "uid": existing.id},
                    )
                    sa_session.commit()
                    print("[REMS] Assigned company_id to existing admin@rems.local.")
                print("[REMS] Company admin (admin@rems.local) already exists.")
        except Exception as e:
            print(f"[REMS] Company admin INSERT failed: {e}")
        finally:
            sa_session.close()
    except Exception as e:
        print(f"[REMS] Company admin seed skipped: {e}")

    def _column_exists(conn, table, column):
        try:
            rs = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ), {"t": table, "c": column})
            return rs.fetchone() is not None
        except Exception:
            return False

    def _safe_add_column(conn, table, col, col_def):
        if _column_exists(conn, table, col):
            return
        try:
            conn.execute(text("SET LOCAL lock_timeout = '2s'"))
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_def}"))
            conn.commit()
            print(f"[REMS] Added {table}.{col} column.")
        except Exception as e:
            conn.rollback()
            print(f"[REMS] {table}.{col} skipped (non-fatal): {e}")

    try:
        with engine.connect() as conn:
            for col, col_def in {
                "email":         "VARCHAR(255) DEFAULT NULL",
                "phone":         "VARCHAR(60)  DEFAULT NULL",
                "plan":          "VARCHAR(30)  DEFAULT 'free'",
                "currency_code": "VARCHAR(10)  DEFAULT 'PKR'",
                "expiry_date":   "TIMESTAMP    DEFAULT NULL",
                "db_path":       "VARCHAR(300) DEFAULT NULL",
                "updated_at":    "TIMESTAMP    DEFAULT NULL",
            }.items():
                _safe_add_column(conn, "companies", col, col_def)
    except Exception as e:
        print(f"[REMS] companies column checks skipped: {e}")

    try:
        with engine.connect() as conn:
            for col, col_type in {
                "website": "VARCHAR(255) DEFAULT ''",
                "reg_no": "VARCHAR(100) DEFAULT ''",
                "show_logo_watermark": "BOOLEAN DEFAULT TRUE",
            }.items():
                _safe_add_column(conn, "report_settings", col, col_type)
    except Exception as e:
        print(f"[REMS] report_settings columns check skipped: {e}")

    try:
        with engine.connect() as conn:
            _safe_add_column(conn, "reminders", "user_id", "INTEGER")
    except Exception as e:
        print(f"[REMS] reminders.user_id column check skipped: {e}")

    try:
        with engine.connect() as conn:
            _safe_add_column(conn, "reminder_templates", "user_id", "INTEGER")
    except Exception as e:
        print(f"[REMS] reminder_templates.user_id column check skipped: {e}")

    try:
        with engine.connect() as conn:
            _safe_add_column(conn, "users", "role_id", "INTEGER")
            _safe_add_column(conn, "audit_logs", "company_id", "INTEGER")
    except Exception as e:
        print(f"[REMS] columns check skipped: {e}")

    # Repair role_permissions table if missing columns
    try:
        with engine.connect() as conn:
            import sqlalchemy as sa
            inspector = sa.inspect(engine)
            if "role_permissions" in inspector.get_table_names():
                cols = {c["name"] for c in inspector.get_columns("role_permissions")}
                required = {"id", "role_id", "module_key", "tab_key", "can_view", "can_add", "can_edit", "can_delete"}
                if not required.issubset(cols):
                    print(f"[REMS] role_permissions table is missing columns: {required - cols} — recreating")
                    conn.execute(text("DROP TABLE IF EXISTS role_permissions CASCADE"))
                    conn.commit()
                    Base.metadata.create_all(bind=engine)
                    print("[REMS] role_permissions table recreated.")
    except Exception as e:
        print(f"[REMS] role_permissions repair skipped: {e}")

    try:
        with engine.connect() as conn:
            for col, col_def in {
                "user_id":      "VARCHAR(36)",
                "username":     "VARCHAR(255)",
                "full_name":    "VARCHAR(255)",
                "role":         "VARCHAR(100)",
                "department":   "VARCHAR(100)",
                "entity_type":  "VARCHAR(100)",
                "entity_id":    "VARCHAR(255)",
                "entity_name":  "TEXT",
                "browser":      "VARCHAR(255)",
                "os":           "VARCHAR(255)",
                "device":       "VARCHAR(255)",
                "request_method": "VARCHAR(10)",
                "api_endpoint": "VARCHAR(500)",
                "status":       "VARCHAR(20) DEFAULT 'Success'",
            }.items():
                _safe_add_column(conn, "audit_logs", col, col_type)
    except Exception as e:
        print(f"[REMS] audit_logs enhanced columns check skipped: {e}")

    # ── Soft delete columns for ALL models using SoftDeleteMixin ──────
    # Dynamically discover all tables from ORM metadata that have is_deleted column.
    _SOFT_DELETE_COLS = {
        "is_deleted": "BOOLEAN DEFAULT FALSE",
        "deleted_at": "TIMESTAMP",
        "deleted_by": "INTEGER",
        "restored_at": "TIMESTAMP",
        "restored_by": "INTEGER",
        "original_business_number": "VARCHAR(100)",
        "restore_count": "INTEGER DEFAULT 0",
    }
    _soft_delete_tables = []
    for table_name, table in Base.metadata.tables.items():
        if "is_deleted" in table.c:
            _soft_delete_tables.append(table_name)
    print(f"[REMS] Found {len(_soft_delete_tables)} tables with soft delete columns: {', '.join(sorted(_soft_delete_tables))}")
    for table in sorted(_soft_delete_tables):
        try:
            with engine.connect() as conn:
                for col, col_def in _SOFT_DELETE_COLS.items():
                    _safe_add_column(conn, table, col, col_def)
        except Exception as e:
            print(f"[REMS] {table} soft delete columns skipped: {e}")

    try:
        from app.tenant import get_master_session

        mdb = get_master_session()
        try:
            rows = mdb.execute(
                text("SELECT schema_name FROM master.companies")
            ).fetchall()
            registered = {r[0] for r in rows}
            extra = mdb.execute(
                text("""
                    SELECT nspname FROM pg_catalog.pg_namespace
                    WHERE nspname NOT IN ('public', 'pg_catalog', 'information_schema', 'pg_toast')
                      AND nspname NOT LIKE 'pg_%'
                      AND nspname NOT IN (SELECT schema_name FROM master.companies)
                """)
            ).fetchall()
            for (nspname,) in extra:
                if nspname not in registered:
                    rows.append((nspname,))
                    registered.add(nspname)
            for (schema_name,) in rows:
                try:
                    with engine.connect() as tmp_conn:
                        tmp_conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
                        tmp_conn.commit()
                    with engine.connect() as tmp_conn:
                        tmp_conn.execute(
                            text("""
                                UPDATE master.companies m
                                SET slug = c.slug
                                FROM public.companies c
                                WHERE m.schema_name = :schema
                                  AND c.slug = m.schema_name
                                  AND (m.slug IS NULL OR m.slug = '')
                            """),
                            {"schema": schema_name},
                        )
                        tmp_conn.commit()
                    tenant_engine = create_engine(
                        settings.database_url_fixed,
                        connect_args={"options": f"-csearch_path={schema_name},public"},
                        pool_pre_ping=True,
                    )
                    try:
                        with tenant_engine.connect() as conn:
                            conn.execute(text("SET lock_timeout = '5s'"))
                            import sqlalchemy as sa
                            insp = sa.inspect(tenant_engine)
                            if "audit_logs" in insp.get_table_names():
                                cols = [c["name"] for c in insp.get_columns("audit_logs")]
                                if "company_id" in cols:
                                    conn.execute(text("DROP TABLE IF EXISTS audit_logs CASCADE"))
                                    conn.commit()
                                    print(f"[REMS] Dropped old audit_logs in schema '{schema_name}'")
                    except Exception as exc:
                        print(f"[REMS] audit_logs migration check failed for '{schema_name}': {exc}")
                    try:
                        Base.metadata.create_all(bind=tenant_engine)
                    except Exception as exc:
                        print(f"[REMS] create_all failed for '{schema_name}': {exc}")
                    sync_attachments_table(tenant_engine)
                    with tenant_engine.connect() as conn:
                        conn.execute(text("SET lock_timeout = '5s'"))

                        def _tenant_add_col(table, col, col_def):
                            try:
                                rs = conn.execute(text(
                                    "SELECT column_name FROM information_schema.columns "
                                    "WHERE table_name = :t AND column_name = :c"
                                ), {"t": table, "c": col})
                                if rs.fetchone() is None:
                                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_def}"))
                            except Exception:
                                pass

                        for col, col_type in {
                            "payment_type": "VARCHAR(30)",
                            "source": "VARCHAR(20)",
                            "source_id": "INTEGER",
                            "posted_to_finance": "BOOLEAN DEFAULT false",
                            "finance_journal_id": "INTEGER",
                            "notes": "VARCHAR(500)",
                            "party_cnic": "VARCHAR(50)",
                            "party_address": "TEXT",
                            "method_fields": "JSON",
                            "external_transaction_id": "VARCHAR(100)",
                            "received_by": "VARCHAR(255)",
                            "branch": "VARCHAR(100)",
                            "cash_counter": "VARCHAR(100)",
                            "completed_at": "TIMESTAMP",
                            "reversed_at": "TIMESTAMP",
                            "refunded_at": "TIMESTAMP",
                            "cancelled_at": "TIMESTAMP",
                            "deleted_at": "TIMESTAMP",
                            "created_by_user_id": "INTEGER",
                            "company_id": "INTEGER",
                        }.items():
                            _tenant_add_col("payments", col, col_type)
                        for col, col_type in {
                            "vendor_name": "VARCHAR(255)",
                            "invoice_bill_no": "VARCHAR(100)",
                            "payment_method": "VARCHAR(30)",
                            "payment_status": "VARCHAR(20)",
                            "paid_from_account_id": "INTEGER",
                            "receipt_path": "VARCHAR(500)",
                            "property_id": "INTEGER",
                            "department": "VARCHAR(100)",
                            "is_recurring": "BOOLEAN DEFAULT false",
                            "recurring_frequency": "VARCHAR(20)",
                            "next_due_date": "TIMESTAMP",
                            "recurring_end_date": "TIMESTAMP",
                            "approval_status": "VARCHAR(20) DEFAULT 'submitted'",
                            "approved_by": "INTEGER",
                            "approved_at": "TIMESTAMP",
                            "subtotal": "NUMERIC(14,2) DEFAULT 0",
                            "tax_amount": "NUMERIC(14,2) DEFAULT 0",
                            "discount_amount": "NUMERIC(14,2) DEFAULT 0",
                            "adjustment": "NUMERIC(14,2) DEFAULT 0",
                        }.items():
                            _tenant_add_col("expenses", col, col_type)
                        for col, col_type in {
                            "client_id": "INTEGER",
                            "client_name": "VARCHAR(255)",
                            "reference": "VARCHAR(100)",
                            "paid_amount": "NUMERIC(12,2) DEFAULT 0",
                            "remaining_amount": "NUMERIC(12,2) DEFAULT 0",
                        }.items():
                            _tenant_add_col("invoices", col, col_type)
                        for col, col_type in {
                            "buyer_contact_id":   "INTEGER",
                            "seller_contact_id":  "INTEGER",
                            "token_amount":       "NUMERIC(12,2)",
                            "token_date":         "DATE",
                            "payment_type":       "VARCHAR(30)",
                            "bank_name":          "VARCHAR(120)",
                            "loan_amount":        "NUMERIC(12,2)",
                            "approval_date":      "DATE",
                            "commission_pct":     "NUMERIC(5,2)",
                            "commission_amount":  "NUMERIC(12,2)",
                            "commission_paid_to": "VARCHAR(120)",
                            "stamp_duty":         "NUMERIC(12,2)",
                            "registration_fee":   "NUMERIC(12,2)",
                            "agreement_date":     "DATE",
                            "transfer_date":      "DATE",
                            "transfer_deed_number": "VARCHAR(100)",
                            "sale_stage":         "VARCHAR(30)",
                            "cancellation_reason": "TEXT",
                        }.items():
                            _tenant_add_col("property_sales", col, col_type)
                        for tbl, cols in {
                            "leads": {
                                "preferred_project": "VARCHAR(120)",
                                "lead_cost": "NUMERIC(14,2)",
                                "investor_type": "VARCHAR(20)",
                            },
                            "dealers": {
                                "cost_per_lead": "NUMERIC(14,2)",
                                "monthly_target": "NUMERIC(12,2)",
                            },
                        }.items():
                            for col, col_type in cols.items():
                                _tenant_add_col(tbl, col, col_type)
                        # Repair role_permissions table if missing columns
                        if "role_permissions" in insp.get_table_names():
                            rp_cols = {c["name"] for c in insp.get_columns("role_permissions")}
                            rp_required = {"id", "role_id", "module_key", "tab_key", "can_view", "can_add", "can_edit", "can_delete"}
                            if not rp_required.issubset(rp_cols):
                                print(f"[REMS] role_permissions table in schema '{schema_name}' missing columns — recreating")
                                conn.execute(text("DROP TABLE IF EXISTS role_permissions CASCADE"))
                                conn.commit()
                                Base.metadata.create_all(bind=tenant_engine, tables=[RolePermission.__table__])
                                print(f"[REMS] role_permissions table recreated in schema '{schema_name}'")
                        conn.commit()
                    tenant_engine.dispose()

                    try:
                        from alembic.config import Config as AlembicConfig
                        from alembic import command
                        from alembic.script import ScriptDirectory
                        os.environ["ALEMBIC_SEARCH_PATH"] = f"{schema_name},public"
                        schema_cfg = AlembicConfig(str(BASE_DIR / "alembic.ini"))
                        head = ScriptDirectory.from_config(schema_cfg).get_current_head()
                        command.stamp(schema_cfg, head)
                        command.upgrade(schema_cfg, "head")
                        del os.environ["ALEMBIC_SEARCH_PATH"]
                        print(f"[REMS] Alembic migrations synced for schema '{schema_name}'")
                    except Exception as exc:
                        os.environ.pop("ALEMBIC_SEARCH_PATH", None)
                        print(f"[REMS] Alembic upgrade skipped for schema '{schema_name}': {exc}")

                    print(f"[REMS] Repaired tables in schema '{schema_name}'")
                except Exception as e:
                    print(f"[REMS] Skipping schema '{schema_name}' repair: {e}")
        finally:
            mdb.close()
    except Exception as e:
        print(f"[REMS] Company schema repair skipped: {e}")

    try:
        from app.core.tenant_manager import DATABASES_DIR

        for f in os.listdir(str(DATABASES_DIR)):
            if f.startswith("company_") and f.endswith(".db"):
                db_path = os.path.join(str(DATABASES_DIR), f)
                db_url = f"sqlite:///{db_path}"
                tenant_engine = create_engine(db_url)
                try:
                    Base.metadata.create_all(bind=tenant_engine)
                    with tenant_engine.connect() as conn:
                        import sqlalchemy as sa
                        insp = sa.inspect(tenant_engine)
                        pay_cols = [c["name"] for c in insp.get_columns("payments")] if "payments" in insp.get_table_names() else []
                        for col, col_type in {
                            "payment_type": "VARCHAR(30) DEFAULT 'against_invoice'",
                            "source": "VARCHAR(20)",
                            "source_id": "INTEGER",
                            "posted_to_finance": "BOOLEAN DEFAULT 0",
                            "finance_journal_id": "INTEGER",
                            "method_fields": "JSON",
                            "external_transaction_id": "VARCHAR(100)",
                            "received_by": "VARCHAR(255)",
                            "party_cnic": "VARCHAR(50)",
                            "party_address": "TEXT",
                            "branch": "VARCHAR(100)",
                            "cash_counter": "VARCHAR(100)",
                            "completed_at": "DATETIME",
                            "reversed_at": "DATETIME",
                            "refunded_at": "DATETIME",
                            "cancelled_at": "DATETIME",
                            "deleted_at": "DATETIME",
                            "created_by_user_id": "INTEGER",
                            "company_id": "INTEGER",
                        }.items():
                            if col not in pay_cols:
                                try:
                                    conn.execute(text(f"ALTER TABLE payments ADD COLUMN {col} {col_type}"))
                                except Exception:
                                    pass
                        for tbl, cols in {
                            "leads": ["preferred_project", "lead_cost", "investor_type"],
                            "dealers": ["cost_per_lead", "monthly_target"],
                        }.items():
                            if tbl in insp.get_table_names():
                                tbl_cols = [c["name"] for c in insp.get_columns(tbl)]
                                col_types = {
                                    "preferred_project": "VARCHAR(120)",
                                    "lead_cost": "NUMERIC(14,2)",
                                    "investor_type": "VARCHAR(20)",
                                    "cost_per_lead": "NUMERIC(14,2)",
                                    "monthly_target": "NUMERIC(12,2)",
                                }
                                for col in cols:
                                    if col not in tbl_cols:
                                        try:
                                            conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_types[col]}"))
                                        except Exception:
                                            pass
                        # Repair role_permissions table if missing columns (SQLite)
                        if "role_permissions" in insp.get_table_names():
                            rp_cols = {c["name"] for c in insp.get_columns("role_permissions")}
                            rp_required = {"id", "role_id", "module_key", "tab_key", "can_view", "can_add", "can_edit", "can_delete"}
                            if not rp_required.issubset(rp_cols):
                                print(f"[REMS] role_permissions table missing columns in SQLite tenant — recreating")
                                conn.execute(text("DROP TABLE IF EXISTS role_permissions"))
                                conn.commit()
                                Base.metadata.create_all(bind=tenant_engine, tables=[RolePermission.__table__])
                                print(f"[REMS] role_permissions table recreated in SQLite tenant")
                        conn.commit()
                    print(f"[REMS] Verified/created tables in SQLite tenant DB '{f}'")
                finally:
                    tenant_engine.dispose()
    except Exception as e:
        print(f"[REMS] SQLite tenant schema repair skipped: {e}")

    db = next(get_db())
    try:
        seeded = seed_default_coa(db)
        if seeded:
            print("[REMS] Default Chart of Accounts created.")
    except Exception as e:
        print(f"[REMS] COA seed skipped: {e}")
    finally:
        db.close()

    try:
        public_engine = create_engine(settings.database_url_fixed, pool_pre_ping=True)
        pub_session = sessionmaker(bind=public_engine)()
        try:
            Base.metadata.create_all(bind=public_engine)
            from app.core.seed_lookups import seed_lookup_values
            seeded = seed_lookup_values(pub_session)
            if seeded > 0:
                print(f"[REMS] Seeded {seeded} lookup values in public schema.")
        finally:
            pub_session.close()
            public_engine.dispose()
    except Exception as e:
        print(f"[REMS] Public lookup seed skipped: {e}")

    try:
        db = next(get_db())
        try:
            from app.core.seed_lookups import seed_lookup_values
            seeded = seed_lookup_values(db)
            if seeded > 0:
                print(f"[REMS] Seeded {seeded} lookup values in tenant schema.")
        finally:
            db.close()
    except Exception as e:
        print(f"[REMS] Tenant lookup seed skipped: {e}")

    db = next(get_db())
    try:
        from app.models.town import sync_town_unit_columns
        sync_town_unit_columns(db)
        print("[REMS] TownUnit columns checked and synced.")
    except Exception as e:
        print(f"[REMS] TownUnit columns sync failed: {e}")
    finally:
        db.close()

    try:
        loop = asyncio.new_event_loop()
        start_reminder_scheduler(loop)
    except Exception as e:
        log.error("Failed to start reminder scheduler: %s", e)

    from apscheduler.schedulers.asyncio import AsyncIOScheduler as _AsyncSched
    _async_sched = _AsyncSched(timezone="UTC")
    register_mail_sync_job()
    register_followup_job(_async_sched)
    register_booking_expiry_job(_async_sched)
    _async_sched.start()

    # Start backup scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler as _BgSched
        _backup_sched = _BgSched(timezone="UTC")
        register_backup_job(_backup_sched)
        _backup_sched.start()
        log.info("Backup scheduler started")
    except Exception as e:
        log.error("Failed to start backup scheduler: %s", e)

    # Register all modules for soft delete / recycle bin
    try:
        from app.services.soft_delete_service import register_all_modules
        register_all_modules()
        log.info("All modules registered for soft delete and recycle bin")
    except Exception as e:
        log.error("Failed to register modules for soft delete: %s", e)


app = FastAPI(title="REMS API", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "Real Estate ERP API"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    import traceback
    log.error("Unhandled exception on %s %s\n%s", request.method, request.url.path,
               traceback.format_exc())
    origin = request.headers.get("origin", "")
    cors_headers = {"Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*"}
    if origin:
        cors_headers["Access-Control-Allow-Origin"] = origin
        cors_headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
        headers=cors_headers,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list if settings.cors_origins_list else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)
app.add_middleware(TenantMiddleware)

upload_root = Path(settings.upload_dir)
upload_root.mkdir(parents=True, exist_ok=True)
backup_dir = upload_root / "rems_backups"
backup_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_root)), name="uploads")

app.include_router(auth_router,       prefix="/auth",       tags=["auth"])
app.include_router(activity_router,   prefix="/activity",   tags=["activity"])
app.include_router(audit_router,     prefix="/audit",      tags=["audit"])
app.include_router(dashboard_router,  prefix="/dashboard",  tags=["dashboard"])
app.include_router(properties_router, prefix="/properties", tags=["properties"])
app.include_router(crm_router,              prefix="/crm",        tags=["crm"])
app.include_router(client_pipeline_router,  prefix="/crm",        tags=["client-pipeline"])
app.include_router(finance_router,    prefix="/finance",    tags=["finance"])
app.include_router(finance_ops_router, prefix="/finance",   tags=["finance-operations"])
app.include_router(settings_router,   prefix="/settings",   tags=["settings"])
app.include_router(admin_router,      prefix="/admin",      tags=["admin"])
app.include_router(tenants_router,      prefix="/tenants",      tags=["tenants"])
app.include_router(construction_router, prefix="/construction", tags=["construction"])
app.include_router(websocket_router)
app.include_router(reminders_router, prefix="/reminders", tags=["reminders"])
app.include_router(hr_router, prefix="/hr", tags=["hr"])
app.include_router(mail_router, prefix="/mail", tags=["mail"])
app.include_router(company_settings_router,                         tags=["company-settings"])
app.include_router(towns_router, prefix="/towns", tags=["towns"])
app.include_router(town_units_router, prefix="/town-units", tags=["town-units"])
app.include_router(ledger_router,  prefix="/finance/ledger", tags=["ledger"])
app.include_router(bootstrap_router, tags=["bootstrap"])
app.include_router(booking_router, prefix="/crm/bookings", tags=["bookings"])
app.include_router(ai_router, tags=["ai-intelligence"])
app.include_router(import_router, prefix="/import", tags=["import"])
app.include_router(chat_router, prefix="/chat", tags=["chat"])
app.include_router(superadmin_router)
app.include_router(attachments_router, prefix="/attachments", tags=["attachments"])
app.include_router(files_router)
app.include_router(spreadsheet_router)
app.include_router(lookups_router, prefix="/lookups", tags=["lookups"])
app.include_router(async_select_router, prefix="/crm", tags=["async-select"])
app.include_router(reports_router)
app.include_router(users_router)
app.include_router(rbac_router)
app.include_router(recycle_bin_router)
app.include_router(backup_router)
app.include_router(clear_data_router)


@app.get("/health/db")
def health_db() -> dict:
    from app.core.database import check_db_connection
    ok = check_db_connection()
    return {"status": "ok" if ok else "error", "database": "connected" if ok else "unreachable"}
