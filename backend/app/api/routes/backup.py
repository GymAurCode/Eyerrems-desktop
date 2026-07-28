import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.rbac import require_permission
from app.models.auth import User
from app.models.backup import Backup, BackupSetting
from app.services.backup_service import BackupService, BackupServiceError, RestoreError

log = logging.getLogger("rems.backup_api")

router = APIRouter(prefix="/backup", tags=["backup"])


class BackupCreateRequest(BaseModel):
    notes: Optional[str] = None
    password: Optional[str] = None


class BackupSettingUpdate(BaseModel):
    auto_backup_enabled: Optional[bool] = None
    schedule_interval: Optional[str] = None
    retention_mode: Optional[str] = None
    retention_count: Optional[int] = None
    retention_days: Optional[int] = None
    encryption_enabled: Optional[bool] = None


class BackupDirUpdate(BaseModel):
    backup_dir: str


class BackupResponse(BaseModel):
    id: int
    filename: str
    file_size: int
    checksum: str
    backup_version: str
    app_version: str
    backup_type: str
    status: str
    created_by_name: Optional[str] = None
    is_encrypted: bool
    notes: Optional[str] = None
    restored_at: Optional[str] = None
    restore_count: int
    created_at: str

    @classmethod
    def from_orm(cls, b: Backup):
        return cls(
            id=b.id,
            filename=b.filename,
            file_size=b.file_size or 0,
            checksum=b.checksum or "",
            backup_version=b.backup_version or "",
            app_version=b.app_version or "",
            backup_type=b.backup_type or "manual",
            status=b.status or "unknown",
            created_by_name=b.created_by_name,
            is_encrypted=b.is_encrypted or False,
            notes=b.notes,
            restored_at=b.restored_at.isoformat() if b.restored_at else None,
            restore_count=b.restore_count or 0,
            created_at=b.created_at.isoformat() if b.created_at else "",
        )


# ── Fixed-path routes first (before parameterized routes) ──────────────


@router.post("/create")
def create_backup(
    req: BackupCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "manage")),
):
    try:
        backup = BackupService.create_backup(
            db=db,
            user=current_user,
            backup_type="manual",
            password=req.password,
            notes=req.notes,
        )
        return {
            "success": True,
            "message": "Backup created successfully",
            "backup": BackupResponse.from_orm(backup),
        }
    except BackupServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
def list_backups(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "view")),
):
    company_id = None if current_user.is_super_admin else current_user.company_id
    backups = BackupService.list_backups(db, company_id=company_id, limit=limit, offset=offset)
    total = BackupService.count_backups(db, company_id=company_id)
    return {
        "backups": [BackupResponse.from_orm(b) for b in backups],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/status")
def backup_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "view")),
):
    company_id = None if current_user.is_super_admin else current_user.company_id
    stats = BackupService.get_backup_stats(db, company_id=company_id)
    setting = BackupService.get_or_create_settings(db, company_id)

    return {
        "stats": stats,
        "settings": {
            "auto_backup_enabled": setting.auto_backup_enabled,
            "schedule_interval": setting.schedule_interval,
            "retention_mode": setting.retention_mode,
            "retention_count": setting.retention_count,
            "retention_days": setting.retention_days,
            "next_scheduled_run": setting.next_scheduled_run.isoformat() if setting.next_scheduled_run else None,
            "last_scheduled_run": setting.last_scheduled_run.isoformat() if setting.last_scheduled_run else None,
        },
    }


@router.patch("/settings")
def update_backup_settings(
    req: BackupSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "manage")),
):
    company_id = None if current_user.is_super_admin else current_user.company_id
    setting = BackupService.get_or_create_settings(db, company_id)

    if req.auto_backup_enabled is not None:
        setting.auto_backup_enabled = req.auto_backup_enabled
    if req.schedule_interval is not None:
        setting.schedule_interval = req.schedule_interval
        setting.next_scheduled_run = BackupService.compute_next_run(req.schedule_interval)
    if req.retention_mode is not None:
        setting.retention_mode = req.retention_mode
    if req.retention_count is not None:
        setting.retention_count = req.retention_count
    if req.retention_days is not None:
        setting.retention_days = req.retention_days

    db.commit()

    return {
        "success": True,
        "settings": {
            "auto_backup_enabled": setting.auto_backup_enabled,
            "schedule_interval": setting.schedule_interval,
            "retention_mode": setting.retention_mode,
            "retention_count": setting.retention_count,
            "retention_days": setting.retention_days,
            "next_scheduled_run": setting.next_scheduled_run.isoformat() if setting.next_scheduled_run else None,
        },
    }


@router.patch("/backup-dir")
def update_backup_dir(
    req: BackupDirUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "manage")),
):
    company_id = None if current_user.is_super_admin else current_user.company_id
    setting = BackupService.update_backup_dir(db, company_id, req.backup_dir)
    return {
        "success": True,
        "backup_dir": setting.backup_dir or str(BackupService.get_backup_dir(setting)),
    }


@router.get("/history")
def backup_history(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "view")),
):
    company_id = None if current_user.is_super_admin else current_user.company_id
    backups = BackupService.list_backups(db, company_id=company_id, limit=limit, offset=offset)
    total = BackupService.count_backups(db, company_id=company_id)
    return {
        "history": [BackupResponse.from_orm(b) for b in backups],
        "total": total,
    }


@router.post("/upload")
async def upload_backup(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "manage")),
):
    try:
        backup = BackupService.upload_backup(
            db=db,
            user=current_user,
            file_obj=file,
            password=password,
        )
        return {
            "success": True,
            "message": "Backup uploaded successfully",
            "backup": BackupResponse.from_orm(backup),
        }
    except BackupServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Parameterized routes after all fixed-path routes ───────────────────


@router.get("/{backup_id}")
def get_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "view")),
):
    backup = BackupService.get_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    return {"backup": BackupResponse.from_orm(backup)}


@router.get("/{backup_id}/download")
def download_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "edit")),
):
    filepath, filename = BackupService.download_backup(db, backup_id)
    if not filepath:
        raise HTTPException(status_code=404, detail="Backup file not found")

    try:
        from app.core.audit import log_action
        log_action(
            db=db,
            module="backup",
            action="DOWNLOAD",
            record_id=str(backup_id),
            record_label=f"Backup: {filename}",
            changed_by=current_user.email,
            changed_by_role=getattr(getattr(current_user, "role", None), "name", None),
            new_data={"filename": filename},
        )
    except Exception:
        pass

    return FileResponse(
        path=str(filepath),
        filename=filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{backup_id}/verify")
def verify_backup(
    backup_id: int,
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "view")),
):
    backup = BackupService.get_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    result = BackupService.verify_backup(Path(backup.filepath), password)
    return result


@router.post("/restore/{backup_id}")
def restore_backup(
    backup_id: int,
    password: Optional[str] = Form(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "manage")),
):
    backup = BackupService.get_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    try:
        result = BackupService.restore_backup(
            db=db,
            backup=backup,
            user=current_user,
            password=password,
            request=request,
        )
        return result
    except RestoreError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore")
async def restore_from_upload(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "manage")),
):
    try:
        backup = BackupService.upload_backup(
            db=db,
            user=current_user,
            file_obj=file,
            password=password,
        )
    except BackupServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = BackupService.restore_backup(
            db=db,
            backup=backup,
            user=current_user,
            password=password,
            request=request,
        )
        return result
    except RestoreError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{backup_id}")
def delete_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_permission("backup", "general", "delete")),
):
    backup = BackupService.get_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    BackupService.delete_backup(db, backup)
    return {"success": True, "message": "Backup deleted"}
