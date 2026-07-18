import asyncio
import logging
import uuid
from typing import Optional

import cloudinary.uploader
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.file_attachment import FileAttachment

router = APIRouter(prefix="/api/files", tags=["files"])
log = logging.getLogger("rems.files")

ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

MAX_FILE_SIZE = 10 * 1024 * 1024


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    module: str = Form(...),
    record_type: str = Form(...),
    record_id: str = Form(...),
    document_type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    log.info("=== /api/files/upload request received ===")
    log.info("module=%s, record_type=%s, record_id=%s, document_type=%s, description=%s, expiry_date=%s",
             module, record_type, record_id, document_type, description, expiry_date)
    log.info("file filename=%s, content_type=%s, size=%s",
             file.filename, file.content_type, file.size)

    if not record_id or not record_id.strip():
        raise HTTPException(status_code=400, detail="record_id is required and cannot be empty")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. "
                   f"Allowed: PDF, images, Word, Excel"
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is 10MB."
        )

    try:
        folder = f"erp/{module}/{record_type}/{record_id}"
        public_id = f"{folder}/{uuid.uuid4()}"

        resource_type = "image" if file.content_type.startswith("image/") else "raw"

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: cloudinary.uploader.upload(
                contents,
                public_id=public_id,
                resource_type=resource_type,
                use_filename=True,
                unique_filename=True,
                overwrite=False,
                tags=[module, record_type, record_id],
            ),
        )

        attachment = FileAttachment(
            module=module,
            record_type=record_type,
            record_id=record_id,
            file_name=file.filename,
            file_type=file.content_type,
            file_size=len(contents),
            document_type=document_type,
            cloudinary_public_id=result["public_id"],
            cloudinary_url=result["url"],
            cloudinary_secure_url=result["secure_url"],
            description=description,
            expiry_date=expiry_date,
            uploaded_by=str(current_user.id) if current_user else "system",
        )

        db.add(attachment)
        db.commit()
        db.refresh(attachment)

        log.info("File uploaded successfully: id=%s, name=%s", attachment.id, attachment.file_name)

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "File uploaded successfully",
                "file": attachment.to_dict(),
            },
        )

    except Exception as e:
        db.rollback()
        log.error("Cloudinary upload failed: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}",
        )


@router.get("/list/{module}/{record_type}/{record_id}")
def get_files(
    module: str,
    record_type: str,
    record_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    files = (
        db.query(FileAttachment)
        .filter(
            FileAttachment.module == module,
            FileAttachment.record_type == record_type,
            FileAttachment.record_id == record_id,
        )
        .order_by(FileAttachment.uploaded_at.desc())
        .all()
    )

    return {
        "success": True,
        "files": [f.to_dict() for f in files],
        "total": len(files),
    }


@router.delete("/{file_id}")
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    attachment = (
        db.query(FileAttachment).filter(FileAttachment.id == file_id).first()
    )

    if not attachment:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        resource_type = (
            "image" if attachment.file_type.startswith("image/") else "raw"
        )
        cloudinary.uploader.destroy(
            attachment.cloudinary_public_id, resource_type=resource_type
        )
    except Exception as e:
        print(f"[Files] Cloudinary delete warning: {e}")

    db.delete(attachment)
    db.commit()

    return {"success": True, "message": "File deleted successfully"}


@router.get("/count/{module}/{record_type}/{record_id}")
def get_file_count(
    module: str,
    record_type: str,
    record_id: str,
    db: Session = Depends(get_db),
):
    count = (
        db.query(FileAttachment)
        .filter(
            FileAttachment.module == module,
            FileAttachment.record_type == record_type,
            FileAttachment.record_id == record_id,
        )
        .count()
    )
    return {"count": count}


@router.get("/count-batch")
def get_file_counts_batch(
    module: str,
    record_type: str,
    ids: str,
    db: Session = Depends(get_db),
):
    id_list = [i.strip() for i in ids.split(",") if i.strip()]

    results = {}
    for record_id in id_list:
        count = (
            db.query(FileAttachment)
            .filter(
                FileAttachment.module == module,
                FileAttachment.record_type == record_type,
                FileAttachment.record_id == record_id,
            )
            .count()
        )
        results[record_id] = count

    return {"counts": results}
