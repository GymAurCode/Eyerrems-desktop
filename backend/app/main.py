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
from app.api.routes.import_routes import router as import_router
from app.api.routes.chat_routes import router as chat_router
from app.core.config import settings
from app.core.database import get_db
from app.core.default_coa import seed_default_coa
from app.core.tenant_middleware import TenantMiddleware
from app.services.reminder_scheduler import start_scheduler, stop_scheduler
from app.services.mail.mail_sync_scheduler import register_mail_sync_job
from app.services.crm.followup_scheduler import register_followup_job

log = logging.getLogger("rems")

app = FastAPI(title="REMS API", version="1.0.0")



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
    expose_headers=["X-Total-Count"],
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
app.include_router(import_router, prefix="/import", tags=["import"])
app.include_router(chat_router, prefix="/chat", tags=["chat"])


@app.on_event("startup")
def on_startup():
    """Seed default data and start schedulers.

    Migrations are intentionally NOT run here — they run via the
    pre-start script (scripts/migrate.py) which Railway executes before
    uvicorn starts. Running migrations inside the ASGI startup handler
    can cause port-binding timeouts on Railway (health check fails while
    migrations are running, triggering a 502).
    """
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
    from app.services.reminder_scheduler import get_scheduler
    register_followup_job(get_scheduler())
    from app.services.booking_scheduler import register_booking_expiry_job
    register_booking_expiry_job(get_scheduler())


@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_db() -> dict:
    """Check database connectivity — useful for Railway deployment diagnostics."""
    from app.core.database import check_db_connection
    ok = check_db_connection()
    return {"status": "ok" if ok else "error", "database": "connected" if ok else "unreachable"}
