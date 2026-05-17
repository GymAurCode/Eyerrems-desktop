"""
Mail System Schemas — Pydantic models for request/response validation
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr


# ─────────────────────────────────────────────
# Email Account
# ─────────────────────────────────────────────

class EmailAccountCreate(BaseModel):
    display_name: str
    email_address: EmailStr
    smtp_host: str
    smtp_port: int = 587
    smtp_use_tls: bool = True
    imap_host: str
    imap_port: int = 993
    imap_use_ssl: bool = True
    username: str
    password: str  # plain — will be encrypted before storage


class EmailAccountUpdate(BaseModel):
    display_name: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_use_tls: Optional[bool] = None
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_use_ssl: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None  # plain — will be encrypted before storage


class EmailAccountResponse(BaseModel):
    id: int
    user_id: int
    display_name: str
    email_address: str
    smtp_host: str
    smtp_port: int
    smtp_use_tls: bool
    imap_host: str
    imap_port: int
    imap_use_ssl: bool
    username: str
    is_active: bool
    is_verified: bool
    last_sync_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Attachment
# ─────────────────────────────────────────────

class AttachmentResponse(BaseModel):
    id: int
    email_id: int
    filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Email
# ─────────────────────────────────────────────

class EmailSend(BaseModel):
    account_id: int
    to_addresses: List[EmailStr]
    cc_addresses: Optional[List[EmailStr]] = []
    bcc_addresses: Optional[List[EmailStr]] = []
    subject: str
    body_html: str
    body_text: Optional[str] = None
    reply_to_email_id: Optional[int] = None  # for threading
    tenant_id: Optional[int] = None


class DraftSave(BaseModel):
    account_id: int
    to_addresses: Optional[List[str]] = []
    cc_addresses: Optional[List[str]] = []
    bcc_addresses: Optional[List[str]] = []
    subject: Optional[str] = ""
    body_html: Optional[str] = ""
    body_text: Optional[str] = None
    draft_id: Optional[int] = None  # if updating existing draft


class EmailResponse(BaseModel):
    id: int
    account_id: int
    thread_id: Optional[int] = None
    message_id: Optional[str] = None
    folder: str
    from_address: str
    from_name: Optional[str] = None
    to_addresses: str   # JSON string
    cc_addresses: Optional[str] = None
    bcc_addresses: Optional[str] = None
    subject: str
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    is_read: bool
    is_starred: bool
    is_draft: bool
    date: datetime
    created_at: datetime
    attachments: List[AttachmentResponse] = []

    model_config = {"from_attributes": True}


class EmailListItem(BaseModel):
    """Lightweight email for list view."""
    id: int
    account_id: int
    thread_id: Optional[int] = None
    folder: str
    from_address: str
    from_name: Optional[str] = None
    to_addresses: str
    subject: str
    body_text: Optional[str] = None
    is_read: bool
    is_starred: bool
    is_draft: bool
    date: datetime
    attachment_count: int = 0

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Thread
# ─────────────────────────────────────────────

class ThreadResponse(BaseModel):
    id: int
    account_id: int
    subject: str
    last_message_at: datetime
    message_count: int
    has_unread: bool
    tenant_id: Optional[int] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Misc
# ─────────────────────────────────────────────

class MailboxStats(BaseModel):
    inbox_unread: int
    drafts_count: int
    sent_count: int
    trash_count: int


class ConnectionTestResult(BaseModel):
    smtp_ok: bool
    imap_ok: bool
    smtp_error: Optional[str] = None
    imap_error: Optional[str] = None


class MarkReadPayload(BaseModel):
    email_ids: List[int]
    is_read: bool = True


class MoveToTrashPayload(BaseModel):
    email_ids: List[int]
