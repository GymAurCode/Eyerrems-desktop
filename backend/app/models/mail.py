"""
Mail System Models — Email accounts, messages, threads, attachments
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer,
    String, Text, BigInteger,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class EmailAccount(Base):
    """Company email account configuration (SMTP + IMAP)."""
    __tablename__ = "email_accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Display
    display_name = Column(String(255), nullable=False)
    email_address = Column(String(255), nullable=False, unique=True)

    # SMTP
    smtp_host = Column(String(255), nullable=False)
    smtp_port = Column(Integer, nullable=False, default=587)
    smtp_use_tls = Column(Boolean, nullable=False, default=True)

    # IMAP
    imap_host = Column(String(255), nullable=False)
    imap_port = Column(Integer, nullable=False, default=993)
    imap_use_ssl = Column(Boolean, nullable=False, default=True)

    # Credentials (password stored encrypted)
    username = Column(String(255), nullable=False)
    encrypted_password = Column(Text, nullable=False)

    # State
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    last_sync_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="email_accounts")
    emails = relationship("Email", back_populates="account", cascade="all, delete-orphan")


class EmailThread(Base):
    """Groups related emails into a conversation thread."""
    __tablename__ = "email_threads"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("email_accounts.id"), nullable=False)
    subject = Column(String(998), nullable=False)
    last_message_at = Column(DateTime, nullable=False, server_default=func.now())
    message_count = Column(Integer, nullable=False, default=0)
    has_unread = Column(Boolean, nullable=False, default=False)

    # Optional tenant link
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    account = relationship("EmailAccount")
    emails = relationship("Email", back_populates="thread", order_by="Email.date")
    tenant = relationship("Tenant", backref="email_threads")


class Email(Base):
    """Individual email message."""
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("email_accounts.id"), nullable=False)
    thread_id = Column(Integer, ForeignKey("email_threads.id"), nullable=True)

    # IMAP uid for deduplication
    message_id = Column(String(998), nullable=True, index=True)  # RFC 2822 Message-ID header
    imap_uid = Column(BigInteger, nullable=True)

    # Folder / direction
    folder = Column(String(50), nullable=False, default="inbox")
    # inbox | sent | drafts | trash

    # Envelope
    from_address = Column(String(998), nullable=False)
    from_name = Column(String(255), nullable=True)
    to_addresses = Column(Text, nullable=False)   # JSON array of strings
    cc_addresses = Column(Text, nullable=True)    # JSON array of strings
    bcc_addresses = Column(Text, nullable=True)   # JSON array of strings

    # Content
    subject = Column(String(998), nullable=False, default="(no subject)")
    body_text = Column(Text, nullable=True)   # plain text
    body_html = Column(Text, nullable=True)   # HTML

    # State
    is_read = Column(Boolean, nullable=False, default=False)
    is_starred = Column(Boolean, nullable=False, default=False)
    is_draft = Column(Boolean, nullable=False, default=False)

    # Timestamps
    date = Column(DateTime, nullable=False, server_default=func.now())
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    account = relationship("EmailAccount", back_populates="emails")
    thread = relationship("EmailThread", back_populates="emails")
    attachments = relationship("EmailAttachment", back_populates="email", cascade="all, delete-orphan")


class EmailAttachment(Base):
    """File attachment linked to an email."""
    __tablename__ = "email_attachments"

    id = Column(Integer, primary_key=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)

    filename = Column(String(512), nullable=False)
    content_type = Column(String(255), nullable=True)
    size_bytes = Column(BigInteger, nullable=True)
    storage_path = Column(String(1024), nullable=True)  # local file path

    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    email = relationship("Email", back_populates="attachments")
