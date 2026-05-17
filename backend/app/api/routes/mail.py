"""
Mail System Routes — Email accounts, inbox, send, drafts, sync
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.auth import User
from app.models.mail import Email, EmailAccount
from app.schemas.mail import (
    ConnectionTestResult,
    DraftSave,
    EmailAccountCreate,
    EmailAccountResponse,
    EmailAccountUpdate,
    EmailListItem,
    EmailResponse,
    EmailSend,
    MailboxStats,
    MarkReadPayload,
    MoveToTrashPayload,
)
from app.services.mail import AccountService, MailService

router = APIRouter()


# ─────────────────────────────────────────────
# ACCOUNT MANAGEMENT
# ─────────────────────────────────────────────

@router.get("/accounts", response_model=List[EmailAccountResponse])
def list_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all email accounts for the current user."""
    return AccountService.list_for_user(db, current_user.id)


@router.post("/accounts", response_model=EmailAccountResponse, status_code=201)
def create_account(
    payload: EmailAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # all authenticated roles allowed
):
    """Configure a new email account."""
    try:
        account = AccountService.create(db, current_user.id, payload)
        # Auto-test connection and verify if successful
        try:
            result = AccountService.test_connection(account)
            if result["smtp_ok"] and result["imap_ok"]:
                AccountService.mark_verified(db, account)
                db.refresh(account)
        except Exception:
            # If test fails, account is still created but not verified
            pass
        return account
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        import logging
        logging.getLogger("rems.mail").error("create_account failed: %s", e, exc_info=True)
        db.rollback()
        raise HTTPException(500, f"Failed to save account: {type(e).__name__}: {e}")


@router.put("/accounts/{account_id}", response_model=EmailAccountResponse)
def update_account(
    account_id: int,
    payload: EmailAccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _get_account_or_404(db, account_id, current_user.id)
    return AccountService.update(db, account, payload)


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _get_account_or_404(db, account_id, current_user.id)
    AccountService.delete(db, account)


@router.post("/accounts/{account_id}/test", response_model=ConnectionTestResult)
def test_account_connection(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test SMTP and IMAP connectivity for an account."""
    account = _get_account_or_404(db, account_id, current_user.id)
    result = AccountService.test_connection(account)
    if result["smtp_ok"] and result["imap_ok"]:
        AccountService.mark_verified(db, account)
    return result


# ─────────────────────────────────────────────
# MAILBOX STATS
# ─────────────────────────────────────────────

@router.get("/accounts/{account_id}/stats", response_model=MailboxStats)
def get_mailbox_stats(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_account_or_404(db, account_id, current_user.id)
    stats = MailService.get_stats(db, account_id)
    return stats


# ─────────────────────────────────────────────
# SYNC
# ─────────────────────────────────────────────

@router.post("/accounts/{account_id}/sync")
def sync_inbox(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger an IMAP inbox sync for the given account."""
    account = _get_account_or_404(db, account_id, current_user.id)
    if not account.is_verified:
        raise HTTPException(400, "Account not verified — test connection first")
    try:
        new_count = MailService.sync_inbox(db, account)
        return {"synced": new_count}
    except Exception as exc:
        raise HTTPException(500, f"Sync failed: {exc}")


# ─────────────────────────────────────────────
# EMAIL LIST
# ─────────────────────────────────────────────

@router.get("/accounts/{account_id}/emails", response_model=List[EmailListItem])
def list_emails(
    account_id: int,
    folder: str = Query("inbox", pattern="^(inbox|sent|drafts|trash)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_account_or_404(db, account_id, current_user.id)
    emails = MailService.list_emails(db, account_id, folder, skip, limit, search)
    result = []
    for e in emails:
        result.append(EmailListItem(
            id=e.id,
            account_id=e.account_id,
            thread_id=e.thread_id,
            folder=e.folder,
            from_address=e.from_address,
            from_name=e.from_name,
            to_addresses=e.to_addresses,
            subject=e.subject,
            body_text=e.body_text[:200] if e.body_text else None,
            is_read=e.is_read,
            is_starred=e.is_starred,
            is_draft=e.is_draft,
            date=e.date,
            attachment_count=len(e.attachments),
        ))
    return result


@router.get("/accounts/{account_id}/emails/{email_id}", response_model=EmailResponse)
def get_email(
    account_id: int,
    email_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_account_or_404(db, account_id, current_user.id)
    email_obj = MailService.get_email(db, email_id, account_id)
    if not email_obj:
        raise HTTPException(404, "Email not found")
    # Auto-mark as read when opened
    if not email_obj.is_read:
        MailService.mark_read(db, [email_id], account_id, True)
        email_obj.is_read = True
    return email_obj


# ─────────────────────────────────────────────
# SEND
# ─────────────────────────────────────────────

@router.post("/send", response_model=EmailResponse, status_code=201)
async def send_email(
    account_id: int = Form(...),
    to_addresses: str = Form(...),       # JSON array string
    cc_addresses: str = Form("[]"),
    bcc_addresses: str = Form("[]"),
    subject: str = Form(...),
    body_html: str = Form(...),
    body_text: str = Form(""),
    reply_to_email_id: Optional[int] = Form(None),
    tenant_id: Optional[int] = Form(None),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send an email via SMTP with optional file attachments."""
    account = _get_account_or_404(db, account_id, current_user.id)
    if not account.is_verified:
        raise HTTPException(400, "Account not verified — test connection first")

    try:
        to_list = json.loads(to_addresses)
        cc_list = json.loads(cc_addresses)
        bcc_list = json.loads(bcc_addresses)
    except json.JSONDecodeError:
        raise HTTPException(422, "Invalid address list format — expected JSON array")

    # Read uploaded files
    attachment_files = []
    for f in files:
        data = await f.read()
        attachment_files.append({
            "filename": f.filename,
            "content_type": f.content_type or "application/octet-stream",
            "data": data,
            "size_bytes": len(data),
        })

    payload = EmailSend(
        account_id=account_id,
        to_addresses=to_list,
        cc_addresses=cc_list,
        bcc_addresses=bcc_list,
        subject=subject,
        body_html=body_html,
        body_text=body_text or None,
        reply_to_email_id=reply_to_email_id,
        tenant_id=tenant_id,
    )

    try:
        sent = MailService.send_email(db, account, payload, attachment_files or None)
        return sent
    except Exception as exc:
        raise HTTPException(500, f"Failed to send email: {exc}")


# ─────────────────────────────────────────────
# DRAFTS
# ─────────────────────────────────────────────

@router.post("/drafts", response_model=EmailResponse, status_code=201)
def save_draft(
    payload: DraftSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _get_account_or_404(db, payload.account_id, current_user.id)
    try:
        return MailService.save_draft(db, account, payload)
    except ValueError as e:
        raise HTTPException(404, str(e))


# ─────────────────────────────────────────────
# BULK ACTIONS
# ─────────────────────────────────────────────

@router.post("/accounts/{account_id}/mark-read")
def mark_read(
    account_id: int,
    payload: MarkReadPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_account_or_404(db, account_id, current_user.id)
    count = MailService.mark_read(db, payload.email_ids, account_id, payload.is_read)
    return {"updated": count}


@router.post("/accounts/{account_id}/trash")
def move_to_trash(
    account_id: int,
    payload: MoveToTrashPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_account_or_404(db, account_id, current_user.id)
    count = MailService.move_to_trash(db, payload.email_ids, account_id)
    return {"moved": count}


@router.delete("/accounts/{account_id}/emails/{email_id}", status_code=204)
def delete_email(
    account_id: int,
    email_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_account_or_404(db, account_id, current_user.id)
    deleted = MailService.delete_permanently(db, email_id, account_id)
    if not deleted:
        raise HTTPException(404, "Email not found")


# ─────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────

def _get_account_or_404(db: Session, account_id: int, user_id: int) -> EmailAccount:
    account = AccountService.get_by_id(db, account_id)
    if not account:
        raise HTTPException(404, "Email account not found")
    if account.user_id != user_id:
        raise HTTPException(403, "Access denied")
    return account
