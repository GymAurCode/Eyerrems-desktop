"""Report generation and settings API routes."""
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permissions
from app.core.database import get_db
from app.core.config import settings
from app.models.auth import User
from app.models.reports import ReportSettings
from app.schemas.report import (
    ReportGenerateRequest, ReportGenerateResponse,
    ReportSettingsCreate, ReportSettingsResponse, ReportSettingsUpdate,
)
from app.services.report_engine import ReportEngine, list_report_types
from app.services import report_mappers  # noqa: F401 — registers mappers

logger = logging.getLogger("rems.reports")

router = APIRouter(prefix="/reports", tags=["reports"])

LOGO_MAX_SIZE = 2 * 1024 * 1024
LOGO_ALLOWED_TYPES = {"image/png", "image/jpeg", "image/svg+xml"}


def _ensure_reg_no(settings_row: ReportSettings, company_id: int) -> str:
    """Auto-generate a registration number if one isn't set."""
    reg_no = getattr(settings_row, "reg_no", "") or ""
    if not reg_no:
        import hashlib
        raw = f"{company_id}-{datetime.now(timezone.utc).isoformat()}"
        short = hashlib.md5(raw.encode()).hexdigest()[:6].upper()
        reg_no = f"REY-{company_id}-{short}"
        settings_row.reg_no = reg_no
    return reg_no


# ── Report Settings CRUD ───────────────────────────────────────────────────────

@router.get("/settings", response_model=ReportSettingsResponse)
def get_report_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", None) or 1
    settings = db.query(ReportSettings).filter(
        ReportSettings.company_id == company_id
    ).first()
    if not settings:
        settings = ReportSettings(company_id=company_id, company_name="Company Name")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    _ensure_reg_no(settings, company_id)
    return settings


@router.put("/settings", response_model=ReportSettingsResponse)
def update_report_settings(
    payload: ReportSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("settings:manage")),
):
    company_id = getattr(current_user, "company_id", None) or 1
    settings = db.query(ReportSettings).filter(
        ReportSettings.company_id == company_id
    ).first()
    if not settings:
        settings = ReportSettings(company_id=company_id, company_name="Company Name")
        db.add(settings)
        db.flush()

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(settings, k, v)

    _ensure_reg_no(settings, company_id)
    settings.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings)
    return settings


# ── Logo Upload / Remove ───────────────────────────────────────────────────────

def _get_logo_dir(company_id: int) -> Path:
    """Return the per-company logo directory, creating it if needed."""
    base = Path(settings.upload_dir) / "report_branding" / str(company_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


@router.post("/settings/logo")
async def upload_report_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("settings:manage")),
):
    company_id = getattr(current_user, "company_id", None) or 1

    if file.content_type not in LOGO_ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Allowed: PNG, JPEG, SVG",
        )

    contents = await file.read()
    if len(contents) > LOGO_MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 2MB.",
        )

    # Remove old logo file(s) for this company
    logo_dir = _get_logo_dir(company_id)
    for old in logo_dir.iterdir():
        if old.is_file():
            old.unlink()

    ext = {"image/png": ".png", "image/jpeg": ".jpg", "image/svg+xml": ".svg"}.get(file.content_type, ".png")
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = logo_dir / filename
    dest.write_bytes(contents)

    base_url = settings.public_base_url.rstrip("/")
    logo_url = f"{base_url}/uploads/report_branding/{company_id}/{filename}"

    settings_row = db.query(ReportSettings).filter(
        ReportSettings.company_id == company_id
    ).first()
    if not settings_row:
        settings_row = ReportSettings(company_id=company_id, company_name="Company Name")
        db.add(settings_row)
        db.flush()
    settings_row.logo_url = logo_url
    settings_row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings_row)

    return {"success": True, "logo_url": logo_url}


@router.delete("/settings/logo")
def remove_report_logo(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("settings:manage")),
):
    company_id = getattr(current_user, "company_id", None) or 1

    logo_dir = _get_logo_dir(company_id)
    for old in logo_dir.iterdir():
        if old.is_file():
            old.unlink()

    settings_row = db.query(ReportSettings).filter(
        ReportSettings.company_id == company_id
    ).first()
    if settings_row:
        settings_row.logo_url = ""
        settings_row.updated_at = datetime.now(timezone.utc)
        db.commit()

    return {"success": True, "message": "Logo removed"}


# ── Report Generation ──────────────────────────────────────────────────────────

@router.post("/generate", response_model=ReportGenerateResponse)
def generate_report(
    req: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engine = ReportEngine(db)
    fmt = req.output_format

    # Build payload dict (entity_id, filters, plus optional settings_overrides)
    payload = {"entity_id": req.entity_id, "filters": req.filters or {}}
    if req.settings_overrides:
        payload["settings_overrides"] = req.settings_overrides
    if req.prepared_for is not None:
        payload["prepared_for"] = req.prepared_for
    payload["prepared_by"] = req.prepared_by or current_user.full_name or current_user.email or ""
    if req.note is not None:
        payload["note"] = req.note

    try:
        if fmt == "html":
            html = engine.generate(req.report_type, payload, "html")
            return ReportGenerateResponse(
                success=True,
                html=html,
                filename=f"{engine.generate_filename(req.report_type, payload)}.html",
            )

        elif fmt == "pdf":
            pdf_bytes = engine.generate(req.report_type, payload, "pdf")
            filename = f"{engine.generate_filename(req.report_type, payload)}.pdf"
            return ReportGenerateResponse(
                success=True,
                filename=filename,
                message="PDF generated",
            )

        elif fmt == "xlsx":
            xlsx_bytes = engine.generate(req.report_type, payload, "xlsx")
            filename = f"{engine.generate_filename(req.report_type, payload)}.xlsx"
            return ReportGenerateResponse(
                success=True,
                filename=filename,
                message="Excel generated",
            )

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}")

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        db.rollback()
        logger.error("Report generation runtime error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.exception("Report generation failed")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {e}")


@router.post("/download/{format}")
def download_report(
    format: str,
    req: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and immediately download a report file."""
    engine = ReportEngine(db)
    req.output_format = format

    payload = {"entity_id": req.entity_id, "filters": req.filters or {}}
    if req.settings_overrides:
        payload["settings_overrides"] = req.settings_overrides
    if req.prepared_for is not None:
        payload["prepared_for"] = req.prepared_for
    payload["prepared_by"] = req.prepared_by or current_user.full_name or current_user.email or ""
    if req.note is not None:
        payload["note"] = req.note

    try:
        if format == "pdf":
            pdf_bytes = engine.generate(req.report_type, payload, "pdf")
            filename = f"{engine.generate_filename(req.report_type, payload)}.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

        elif format == "xlsx":
            xlsx_bytes = engine.generate(req.report_type, payload, "xlsx")
            filename = f"{engine.generate_filename(req.report_type, payload)}.xlsx"
            return Response(
                content=xlsx_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

        elif format == "html":
            html = engine.generate(req.report_type, payload, "html")
            return HTMLResponse(content=html)

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        db.rollback()
        logger.error("Report download runtime error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.exception("Download failed")
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")


@router.get("/types")
def list_report_types_endpoint(
    _: User = Depends(get_current_user),
):
    return {"report_types": list_report_types()}
