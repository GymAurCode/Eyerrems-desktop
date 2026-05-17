import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes.activity import router as activity_router
from app.api.routes.tenants import router as tenants_router
from app.api.routes.construction import router as construction_router
from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.crm import router as crm_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.finance import router as finance_router
from app.api.routes.finance_operations import router as finance_ops_router
from app.api.routes.properties import router as properties_router
from app.api.routes.settings import router as settings_router
from app.api.routes.websocket import router as websocket_router
from app.api.routes.reminders import router as reminders_router
from app.api.routes.hr import router as hr_router
from app.api.routes.mail import router as mail_router
# Multi-tenant routes
from app.api.routes.companies import router as companies_router
from app.api.routes.company_settings import router as company_settings_router
from app.api.routes.towns import router as towns_router
from app.api.routes.ledger import router as ledger_router
from app.api.routes.bootstrap import router as bootstrap_router
from app.api.routes.booking import router as booking_router
from app.api.routes.reports import router as reports_router
from app.api.routes.ai_intelligence import router as ai_router
from app.core.config import settings
from app.core.database import get_db
from app.core.default_coa import seed_default_coa
from app.core.tenant_middleware import TenantMiddleware
from app.services.reminder_scheduler import start_scheduler, stop_scheduler
from app.services.mail.mail_sync_scheduler import register_mail_sync_job
from app.services.crm.followup_scheduler import register_followup_job

log = logging.getLogger("rems")

app = FastAPI(title="REMS API", version="1.0.0")


def _repair_alembic_version(db_url: str) -> None:
    """
    If alembic_version contains a revision ID that doesn't exist in the
    migration files, reset it to the known head so upgrade can proceed.

    This handles the case where the DB was stamped with a revision from a
    different migration history (e.g. after a SQLite→PostgreSQL migration
    or a branch merge that was never cleaned up).
    """
    from sqlalchemy import create_engine, text as sa_text

    KNOWN_HEAD = "0028_maintenance_unit_id"

    # All valid revision IDs in our migration chain
    VALID_REVISIONS = {
        "0001_initial", "0002_erp_extensions", "0003_property_module",
        "0004_property_categories", "0005_crm_overhaul", "0006_crm_upgrade",
        "0007_tenant_module", "0008_finance_module", "0009_finance_upgrade",
        "0010_installment_engine", "0011", "0012", "0013",
        "0014_construction_module", "0015_reminder_module", "0016_hr_module",
        "0017_mail_module", "0018_crm_activities", "0019_rbac_system",
        "0020_multitenant_saas", "0021_town_module", "0022_booking_module",
        "0023_booking_financial_refactor", "0024_reports_module",
        "0025_currency_settings", "0026_ai_intelligence_module",
        "0027_maintenance_upgrade", "0028_maintenance_unit_id",
    }

    try:
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as conn:
            # Check table exists
            exists = conn.execute(sa_text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'alembic_version')"
            )).scalar()
            if not exists:
                return  # Fresh DB — alembic upgrade head will create it

            rows = conn.execute(
                sa_text("SELECT version_num FROM alembic_version")
            ).fetchall()

            if not rows:
                return  # Empty — alembic upgrade head will insert

            current = rows[0][0]
            if current not in VALID_REVISIONS:
                print(f"[REMS] Repairing alembic_version: {current!r} → {KNOWN_HEAD!r}")
                conn.execute(
                    sa_text("UPDATE alembic_version SET version_num = :v"),
                    {"v": KNOWN_HEAD},
                )
                conn.commit()
    except Exception as e:
        print(f"[REMS] alembic_version repair skipped: {e}")



@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler — returns JSON instead of uvicorn's bare text/plain 500.
    Logs the full traceback so it's visible in the server console."""
    import traceback
    log.error("Unhandled exception on %s %s\n%s", request.method, request.url.path,
               traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Tenant resolver — must be added AFTER CORS
app.add_middleware(TenantMiddleware)

upload_root = Path(settings.upload_dir)
upload_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_root)), name="uploads")

app.include_router(auth_router,       prefix="/auth",       tags=["auth"])
app.include_router(activity_router,   prefix="/activity",   tags=["activity"])
app.include_router(dashboard_router,  prefix="/dashboard",  tags=["dashboard"])
app.include_router(properties_router, prefix="/properties", tags=["properties"])
app.include_router(crm_router,        prefix="/crm",        tags=["crm"])
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
# Multi-tenant
app.include_router(companies_router,        prefix="/super-admin",  tags=["super-admin"])
app.include_router(company_settings_router,                         tags=["company-settings"])
# Town / Block / Plot hierarchy
app.include_router(towns_router, prefix="/towns", tags=["towns"])
app.include_router(ledger_router,  prefix="/finance/ledger", tags=["ledger"])
app.include_router(bootstrap_router, tags=["bootstrap"])
# Booking system
app.include_router(booking_router, prefix="/crm/bookings", tags=["bookings"])
# Reports system
app.include_router(reports_router, prefix="/reports", tags=["reports"])
# AI Intelligence Center
app.include_router(ai_router, tags=["ai-intelligence"])


@app.on_event("startup")
def on_startup():
    """Run migrations, seed default data, then start schedulers."""
    # ── Auto-migrate on startup (safe for Railway deploys) ────────────────────
    # This runs `alembic upgrade head` every time the app starts.
    # It is idempotent — if the DB is already at head, it does nothing.
    # It also repairs a broken alembic_version row before upgrading.
    try:
        import os
        from sqlalchemy import create_engine, text as sa_text
        from alembic.config import Config
        from alembic import command as alembic_command

        def _normalise_url(url: str) -> str:
            if url.startswith("postgres://"):
                return url.replace("postgres://", "postgresql+psycopg2://", 1)
            return url

        db_url = _normalise_url(
            os.environ.get("DATABASE_URL", "") or settings.database_url
        )

        # Repair alembic_version if it points to a non-existent revision
        _repair_alembic_version(db_url)

        alembic_cfg = Config("alembic.ini")
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
        alembic_command.upgrade(alembic_cfg, "head")
        print("[REMS] Migrations applied (or already at head).")
    except Exception as e:
        # Non-fatal — log and continue. The app can still serve requests
        # if the schema is already correct.
        print(f"[REMS] Migration warning: {e}")

    # ── Seed default Chart of Accounts ────────────────────────────────────────
    db = next(get_db())
    try:
        seeded = seed_default_coa(db)
        if seeded:
            print("[REMS] Default Chart of Accounts created.")
    except Exception as e:
        print(f"[REMS] COA seed skipped: {e}")
    finally:
        db.close()
    start_scheduler()
    register_mail_sync_job()
    # Register follow-up scheduler on the same APScheduler instance
    from app.services.reminder_scheduler import get_scheduler
    register_followup_job(get_scheduler())
    # Register booking expiry scheduler
    from app.services.booking_scheduler import register_booking_expiry_job
    register_booking_expiry_job(get_scheduler())


@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
