"""
Mail Service — Core business logic for sending, receiving, threading, and managing emails.
"""
import json
import os
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.mail import Email, EmailAccount, EmailAttachment, EmailThread
from app.schemas.mail import DraftSave, EmailSend
from .crypto import decrypt_password
from .imap_service import ImapService
from .smtp_service import SmtpService


UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
ATTACHMENT_DIR = os.path.join(UPLOAD_DIR, "mail_attachments")


class MailService:

    # ─────────────────────────────────────────────
    # SEND
    # ─────────────────────────────────────────────

    @staticmethod
    def send_email(
        db: Session,
        account: EmailAccount,
        payload: EmailSend,
        attachment_files: Optional[List[dict]] = None,
    ) -> Email:
        """
        Send an email via SMTP and persist it to the sent folder.
        attachment_files: list of {"filename": str, "content_type": str, "data": bytes}
        """
        plain_password = decrypt_password(account.encrypted_password)

        to_list = [str(a) for a in payload.to_addresses]
        cc_list = [str(a) for a in (payload.cc_addresses or [])]
        bcc_list = [str(a) for a in (payload.bcc_addresses or [])]

        body_text = payload.body_text or ""

        message_id = SmtpService.send(
            host=account.smtp_host,
            port=account.smtp_port,
            use_tls=account.smtp_use_tls,
            username=account.username,
            password=plain_password,
            from_address=account.email_address,
            from_name=account.display_name,
            to_addresses=to_list,
            cc_addresses=cc_list,
            bcc_addresses=bcc_list,
            subject=payload.subject,
            body_html=payload.body_html,
            body_text=body_text,
            attachments=attachment_files,
        )

        # Determine or create thread
        thread = MailService._get_or_create_thread(
            db=db,
            account_id=account.id,
            subject=payload.subject,
            reply_to_email_id=payload.reply_to_email_id,
            tenant_id=payload.tenant_id,
        )

        now = datetime.utcnow()
        sent_email = Email(
            account_id=account.id,
            thread_id=thread.id,
            message_id=message_id,
            folder="sent",
            from_address=account.email_address,
            from_name=account.display_name,
            to_addresses=json.dumps(to_list),
            cc_addresses=json.dumps(cc_list) if cc_list else None,
            bcc_addresses=json.dumps(bcc_list) if bcc_list else None,
            subject=payload.subject,
            body_text=body_text,
            body_html=payload.body_html,
            is_read=True,
            is_draft=False,
            date=now,
            created_at=now,
            updated_at=now,
        )
        db.add(sent_email)
        db.flush()

        # Save attachments
        if attachment_files:
            MailService._save_attachments(db, sent_email.id, attachment_files)

        # Update thread stats
        MailService._update_thread_stats(db, thread)

        db.commit()
        db.refresh(sent_email)
        return sent_email

    # ─────────────────────────────────────────────
    # DRAFT
    # ─────────────────────────────────────────────

    @staticmethod
    def save_draft(db: Session, account: EmailAccount, payload: DraftSave) -> Email:
        """Create or update a draft email."""
        now = datetime.utcnow()

        if payload.draft_id:
            draft = db.query(Email).filter(
                Email.id == payload.draft_id,
                Email.account_id == account.id,
                Email.is_draft.is_(True),
            ).first()
            if not draft:
                raise ValueError("Draft not found")
            draft.to_addresses = json.dumps(payload.to_addresses or [])
            draft.cc_addresses = json.dumps(payload.cc_addresses or []) if payload.cc_addresses else None
            draft.bcc_addresses = json.dumps(payload.bcc_addresses or []) if payload.bcc_addresses else None
            draft.subject = payload.subject or ""
            draft.body_html = payload.body_html or ""
            draft.body_text = payload.body_text
            draft.updated_at = now
            db.commit()
            db.refresh(draft)
            return draft

        draft = Email(
            account_id=account.id,
            folder="drafts",
            from_address=account.email_address,
            from_name=account.display_name,
            to_addresses=json.dumps(payload.to_addresses or []),
            cc_addresses=json.dumps(payload.cc_addresses or []) if payload.cc_addresses else None,
            bcc_addresses=json.dumps(payload.bcc_addresses or []) if payload.bcc_addresses else None,
            subject=payload.subject or "",
            body_html=payload.body_html or "",
            body_text=payload.body_text,
            is_read=True,
            is_draft=True,
            date=now,
            created_at=now,
            updated_at=now,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return draft

    # ─────────────────────────────────────────────
    # SYNC (IMAP)
    # ─────────────────────────────────────────────

    @staticmethod
    def sync_inbox(db: Session, account: EmailAccount, max_count: int = 100) -> int:
        """
        Sync inbox from IMAP. Returns number of new messages stored.
        """
        plain_password = decrypt_password(account.encrypted_password)

        # Find the highest UID we already have
        last = (
            db.query(Email)
            .filter(Email.account_id == account.id, Email.folder == "inbox")
            .order_by(Email.imap_uid.desc())
            .first()
        )
        since_uid = last.imap_uid if last and last.imap_uid else None

        messages = ImapService.fetch_messages(
            host=account.imap_host,
            port=account.imap_port,
            use_ssl=account.imap_use_ssl,
            username=account.username,
            password=plain_password,
            folder="INBOX",
            since_uid=since_uid,
            max_count=max_count,
        )

        new_count = 0
        for msg_data in messages:
            # Skip duplicates by message_id
            if msg_data.get("message_id"):
                exists = db.query(Email).filter(
                    Email.account_id == account.id,
                    Email.message_id == msg_data["message_id"],
                ).first()
                if exists:
                    continue

            thread = MailService._get_or_create_thread(
                db=db,
                account_id=account.id,
                subject=msg_data["subject"],
            )

            now = datetime.utcnow()
            email_obj = Email(
                account_id=account.id,
                thread_id=thread.id,
                message_id=msg_data.get("message_id"),
                imap_uid=msg_data.get("imap_uid"),
                folder="inbox",
                from_address=msg_data["from_address"],
                from_name=msg_data.get("from_name"),
                to_addresses=msg_data["to_addresses"],
                cc_addresses=msg_data.get("cc_addresses"),
                bcc_addresses=msg_data.get("bcc_addresses"),
                subject=msg_data["subject"],
                body_text=msg_data.get("body_text"),
                body_html=msg_data.get("body_html"),
                is_read=False,
                is_draft=False,
                date=msg_data.get("date", now),
                created_at=now,
                updated_at=now,
            )
            db.add(email_obj)
            db.flush()

            # Save attachments
            if msg_data.get("attachments"):
                MailService._save_attachments(db, email_obj.id, msg_data["attachments"])

            MailService._update_thread_stats(db, thread)
            new_count += 1

        # Update last sync timestamp
        account.last_sync_at = datetime.utcnow()
        db.commit()
        return new_count

    # ─────────────────────────────────────────────
    # QUERY
    # ─────────────────────────────────────────────

    @staticmethod
    def list_emails(
        db: Session,
        account_id: int,
        folder: str,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
    ) -> List[Email]:
        q = db.query(Email).filter(
            Email.account_id == account_id,
            Email.folder == folder,
        )
        if search:
            term = f"%{search}%"
            from sqlalchemy import or_
            q = q.filter(
                or_(
                    Email.subject.ilike(term),
                    Email.from_address.ilike(term),
                    Email.from_name.ilike(term),
                    Email.body_text.ilike(term),
                )
            )
        return q.order_by(Email.date.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_email(db: Session, email_id: int, account_id: int) -> Optional[Email]:
        return db.query(Email).filter(
            Email.id == email_id,
            Email.account_id == account_id,
        ).first()

    @staticmethod
    def mark_read(db: Session, email_ids: List[int], account_id: int, is_read: bool) -> int:
        updated = (
            db.query(Email)
            .filter(Email.id.in_(email_ids), Email.account_id == account_id)
            .update({"is_read": is_read, "updated_at": datetime.utcnow()}, synchronize_session=False)
        )
        db.commit()
        return updated

    @staticmethod
    def move_to_trash(db: Session, email_ids: List[int], account_id: int) -> int:
        updated = (
            db.query(Email)
            .filter(Email.id.in_(email_ids), Email.account_id == account_id)
            .update({"folder": "trash", "updated_at": datetime.utcnow()}, synchronize_session=False)
        )
        db.commit()
        return updated

    @staticmethod
    def delete_permanently(db: Session, email_id: int, account_id: int) -> bool:
        email_obj = db.query(Email).filter(
            Email.id == email_id,
            Email.account_id == account_id,
        ).first()
        if not email_obj:
            return False
        db.delete(email_obj)
        db.commit()
        return True

    @staticmethod
    def get_stats(db: Session, account_id: int) -> dict:
        def count_folder(folder: str) -> int:
            return db.query(Email).filter(
                Email.account_id == account_id,
                Email.folder == folder,
            ).count()

        def count_unread(folder: str) -> int:
            return db.query(Email).filter(
                Email.account_id == account_id,
                Email.folder == folder,
                Email.is_read.is_(False),
            ).count()

        return {
            "inbox_unread": count_unread("inbox"),
            "drafts_count": count_folder("drafts"),
            "sent_count": count_folder("sent"),
            "trash_count": count_folder("trash"),
        }

    # ─────────────────────────────────────────────
    # INTERNAL HELPERS
    # ─────────────────────────────────────────────

    @staticmethod
    def _normalize_subject(subject: str) -> str:
        """Strip Re:/Fwd: prefixes for thread matching."""
        import re
        return re.sub(r"^(re|fwd|fw):\s*", "", subject.strip(), flags=re.IGNORECASE).strip()

    @staticmethod
    def _get_or_create_thread(
        db: Session,
        account_id: int,
        subject: str,
        reply_to_email_id: Optional[int] = None,
        tenant_id: Optional[int] = None,
    ) -> EmailThread:
        """Find an existing thread or create a new one."""
        # If replying to a specific email, use its thread
        if reply_to_email_id:
            parent = db.query(Email).filter(Email.id == reply_to_email_id).first()
            if parent and parent.thread_id:
                return db.query(EmailThread).filter(EmailThread.id == parent.thread_id).first()

        # Try to match by normalized subject
        normalized = MailService._normalize_subject(subject)
        existing = (
            db.query(EmailThread)
            .filter(
                EmailThread.account_id == account_id,
                EmailThread.subject == normalized,
            )
            .order_by(EmailThread.last_message_at.desc())
            .first()
        )
        if existing:
            return existing

        now = datetime.utcnow()
        thread = EmailThread(
            account_id=account_id,
            subject=normalized,
            last_message_at=now,
            message_count=0,
            has_unread=False,
            tenant_id=tenant_id,
            created_at=now,
        )
        db.add(thread)
        db.flush()
        return thread

    @staticmethod
    def _update_thread_stats(db: Session, thread: EmailThread) -> None:
        """Recalculate thread message count and unread flag."""
        emails = db.query(Email).filter(Email.thread_id == thread.id).all()
        thread.message_count = len(emails)
        thread.has_unread = any(not e.is_read for e in emails)
        if emails:
            thread.last_message_at = max(e.date for e in emails)
        db.flush()

    @staticmethod
    def _save_attachments(db: Session, email_id: int, attachments: List[dict]) -> None:
        """Persist attachment files to disk and create DB records."""
        os.makedirs(ATTACHMENT_DIR, exist_ok=True)
        for att in attachments:
            filename = att.get("filename", "attachment")
            data: bytes = att.get("data", b"")
            safe_name = f"{email_id}_{filename}"
            path = os.path.join(ATTACHMENT_DIR, safe_name)
            if data:
                with open(path, "wb") as f:
                    f.write(data)
            db_att = EmailAttachment(
                email_id=email_id,
                filename=filename,
                content_type=att.get("content_type", "application/octet-stream"),
                size_bytes=len(data),
                storage_path=path,
            )
            db.add(db_att)
