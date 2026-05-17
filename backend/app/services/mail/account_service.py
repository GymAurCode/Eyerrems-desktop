"""
Account Service — CRUD for email account configurations.
"""
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.mail import EmailAccount
from app.schemas.mail import EmailAccountCreate, EmailAccountUpdate
from .crypto import encrypt_password, decrypt_password
from .smtp_service import SmtpService
from .imap_service import ImapService


class AccountService:

    @staticmethod
    def create(db: Session, user_id: int, payload: EmailAccountCreate) -> EmailAccount:
        """Create a new email account, encrypting the password."""
        if db.query(EmailAccount).filter(
            EmailAccount.email_address == payload.email_address
        ).first():
            raise ValueError(f"Email account '{payload.email_address}' already configured")

        encrypted = encrypt_password(payload.password)
        now = datetime.utcnow()
        account = EmailAccount(
            user_id=user_id,
            display_name=payload.display_name,
            email_address=payload.email_address,
            smtp_host=payload.smtp_host,
            smtp_port=payload.smtp_port,
            smtp_use_tls=payload.smtp_use_tls,
            imap_host=payload.imap_host,
            imap_port=payload.imap_port,
            imap_use_ssl=payload.imap_use_ssl,
            username=payload.username,
            encrypted_password=encrypted,
            created_at=now,
            updated_at=now,
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def update(db: Session, account: EmailAccount, payload: EmailAccountUpdate) -> EmailAccount:
        """Update account fields; re-encrypt password if provided."""
        data = payload.model_dump(exclude_none=True)
        if "password" in data:
            account.encrypted_password = encrypt_password(data.pop("password"))
        for k, v in data.items():
            setattr(account, k, v)
        account.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def delete(db: Session, account: EmailAccount) -> None:
        db.delete(account)
        db.commit()

    @staticmethod
    def list_for_user(db: Session, user_id: int) -> List[EmailAccount]:
        return (
            db.query(EmailAccount)
            .filter(EmailAccount.user_id == user_id, EmailAccount.is_active.is_(True))
            .order_by(EmailAccount.created_at)
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, account_id: int) -> Optional[EmailAccount]:
        return db.query(EmailAccount).filter(EmailAccount.id == account_id).first()

    @staticmethod
    def test_connection(account: EmailAccount) -> dict:
        """Test SMTP and IMAP connectivity. Returns dict with results."""
        plain_password = decrypt_password(account.encrypted_password)

        smtp_ok, smtp_error = SmtpService.test_connection(
            host=account.smtp_host,
            port=account.smtp_port,
            use_tls=account.smtp_use_tls,
            username=account.username,
            password=plain_password,
        )
        imap_ok, imap_error = ImapService.test_connection(
            host=account.imap_host,
            port=account.imap_port,
            use_ssl=account.imap_use_ssl,
            username=account.username,
            password=plain_password,
        )
        return {
            "smtp_ok": smtp_ok,
            "imap_ok": imap_ok,
            "smtp_error": smtp_error,
            "imap_error": imap_error,
        }

    @staticmethod
    def mark_verified(db: Session, account: EmailAccount) -> None:
        account.is_verified = True
        account.updated_at = datetime.utcnow()
        db.commit()
