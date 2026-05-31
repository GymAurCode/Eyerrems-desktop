"""Universal attachment CRUD — files are stored in DB as BYTEA."""
import logging
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import decode_access_token
from app.models.attachment import Attachment
from app.models.auth import User

router = APIRouter()
log = logging.getLogger("rems.attachments")

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
}


@router.post("/upload")
def upload_attachment(
    module: str = Form(...),
    record_id: str = Form(...),
    description: str = Form(""),
    document_status: str = Form("VERIFIED"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE // (1024*1024)} MB.")

    file_bytes = file.file.read()
    file_size = len(file_bytes)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE // (1024*1024)} MB.")

    file_size_kb = round(file_size / 1024, 2)

    try:
        # Try ORM approach first
        max_serial = db.query(func.max(Attachment.serial_no)).filter(
            Attachment.module == module,
            Attachment.record_id == record_id,
        ).scalar()
        next_serial = (max_serial or 0) + 1

        attachment = Attachment(
            module=module,
            record_id=record_id,
            document_name=file.filename or "untitled",
            description=description or None,
            document_status=document_status,
            file_data=file_bytes,
            file_size_kb=file_size_kb,
            file_type=file.content_type or "application/octet-stream",
            serial_no=next_serial,
            uploaded_by=current_user.full_name or current_user.email,
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)

        return {
            "id": attachment.id,
            "document_name": attachment.document_name,
            "description": attachment.description,
            "document_status": attachment.document_status,
            "file_size_kb": float(attachment.file_size_kb) if attachment.file_size_kb else 0,
            "file_type": attachment.file_type,
            "serial_no": attachment.serial_no,
            "uploaded_by": attachment.uploaded_by,
            "created_at": attachment.created_at.isoformat() if attachment.created_at else None,
        }
    except Exception as orm_err:
        log.warning(f"ORM upload failed, falling back to raw SQL: {orm_err}")
        db.rollback()

    # Raw SQL fallback
    try:
        result = db.execute(
            text("""
                INSERT INTO attachments (module, record_id, document_name, description,
                    document_status, file_data, file_size_kb, file_type, uploaded_by)
                VALUES (:module, :record_id, :name, :desc, :status, :data, :size_kb, :type, :uploaded_by)
                RETURNING id, document_name, description, document_status,
                    file_size_kb, file_type, serial_no, uploaded_by, created_at
            """),
            {
                "module": module,
                "record_id": record_id,
                "name": file.filename or "untitled",
                "desc": description or None,
                "status": document_status,
                "data": file_bytes,
                "size_kb": file_size_kb,
                "type": file.content_type or "application/octet-stream",
                "uploaded_by": current_user.full_name or current_user.email,
            },
        )
        db.commit()
        row = result.fetchone()
        return {
            "id": row[0],
            "document_name": row[1],
            "description": row[2],
            "document_status": row[3],
            "file_size_kb": float(row[4]) if row[4] else 0,
            "file_type": row[5],
            "serial_no": row[6],
            "uploaded_by": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
        }
    except Exception as raw_err:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload attachment: {raw_err}")


@router.get("/{module}/{record_id}")
def list_attachments(
    module: str,
    record_id: str,
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Try ORM query first; fall back to raw SQL if columns mismatch
    try:
        query = db.query(Attachment).filter(
            Attachment.module == module,
            Attachment.record_id == record_id,
        )

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Attachment.document_name.ilike(search_term),
                    Attachment.description.ilike(search_term),
                )
            )

        total = query.count()
        items = (
            query.order_by(Attachment.serial_no.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": math.ceil(total / per_page) if total > 0 else 0,
            "data": [
                {
                    "id": a.id,
                    "document_name": a.document_name,
                    "description": a.description,
                    "document_status": a.document_status,
                    "file_size_kb": float(a.file_size_kb) if a.file_size_kb else 0,
                    "file_type": a.file_type,
                    "serial_no": a.serial_no,
                    "uploaded_by": a.uploaded_by,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in items
            ],
        }
    except Exception as exc:
        log.warning(f"ORM query failed, falling back to raw SQL: {exc}")
        db.rollback()

    # Raw SQL fallback — works even if table schema doesn't match ORM model
    try:
        search_clause = ""
        params: dict = {"module": module, "record_id": record_id}
        if search:
            search_clause = "AND (document_name ILIKE :search OR description ILIKE :search)"
            params["search"] = f"%{search}%"

        count_sql = text(f"SELECT COUNT(*) FROM attachments WHERE module = :module AND record_id = :record_id {search_clause}")
        total = db.execute(count_sql, params).scalar() or 0

        offset = (page - 1) * per_page
        data_sql = text(f"""
            SELECT id, document_name, description, document_status,
                   file_size_kb, file_type, serial_no, uploaded_by, created_at
            FROM attachments
            WHERE module = :module AND record_id = :record_id {search_clause}
            ORDER BY COALESCE(serial_no, id) ASC
            LIMIT :limit OFFSET :offset
        """)
        params["limit"] = per_page
        params["offset"] = offset
        rows = db.execute(data_sql, params).fetchall()

        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": math.ceil(total / per_page) if total > 0 else 0,
            "data": [
                {
                    "id": r[0],
                    "document_name": r[1] or "",
                    "description": r[2],
                    "document_status": r[3] or "VERIFIED",
                    "file_size_kb": float(r[4]) if r[4] else 0,
                    "file_type": r[5] or "",
                    "serial_no": r[6],
                    "uploaded_by": r[7],
                    "created_at": r[8].isoformat() if r[8] else None,
                }
                for r in rows
            ],
        }
    except Exception:
        db.rollback()
        return {"total": 0, "page": 1, "per_page": per_page, "total_pages": 0, "data": []}


def get_download_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Resolve user from Authorization header or ?token= query param."""
    token = None
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    email: str = payload.get("sub", "")
    from app.api.deps import _load_user
    user = _load_user(db, email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


@router.get("/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_download_user),
):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    content_type = att.file_type or "application/octet-stream"
    filename = att.document_name or "download"
    is_inline = content_type.startswith("image/") or content_type == "application/pdf"
    disposition = "inline" if is_inline else f'attachment; filename="{filename}"'

    return StreamingResponse(
        iter([att.file_data]),
        media_type=content_type,
        headers={"Content-Disposition": disposition},
    )


@router.patch("/{attachment_id}")
def update_attachment(
    attachment_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if "description" in body:
        att.description = body["description"]
    if "document_status" in body:
        att.document_status = body["document_status"]
    if "document_name" in body:
        att.document_name = body["document_name"]

    db.commit()
    db.refresh(att)

    return {
        "id": att.id,
        "document_name": att.document_name,
        "description": att.description,
        "document_status": att.document_status,
        "file_size_kb": float(att.file_size_kb) if att.file_size_kb else 0,
        "file_type": att.file_type,
        "serial_no": att.serial_no,
        "uploaded_by": att.uploaded_by,
        "created_at": att.created_at.isoformat() if att.created_at else None,
    }


@router.delete("/{attachment_id}")
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    db.delete(att)
    db.commit()
    return {"success": True}


@router.post("/bulk-delete")
def bulk_delete_attachments(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No attachment IDs provided")
    deleted = db.query(Attachment).filter(Attachment.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return {"success": True, "deleted_count": deleted}
