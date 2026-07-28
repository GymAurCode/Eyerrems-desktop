from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Backup(Base):
    __tablename__ = "backups"

    id = Column(Integer, primary_key=True)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(512), nullable=False)
    file_size = Column(BigInteger, default=0)
    checksum = Column(String(64), nullable=False)
    backup_version = Column(String(10), nullable=False, default="1.0")
    app_version = Column(String(20), nullable=False)
    db_version = Column(String(20), default="1.0")
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_name = Column(String(255), nullable=True)
    backup_type = Column(String(20), default="manual")
    status = Column(String(20), default="completed")
    notes = Column(Text, nullable=True)
    is_encrypted = Column(Boolean, default=False)
    encryption_method = Column(String(50), nullable=True)
    restored_at = Column(DateTime, nullable=True)
    restored_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    restore_count = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class BackupSetting(Base):
    __tablename__ = "backup_settings"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, unique=True)
    auto_backup_enabled = Column(Boolean, default=True)
    schedule_interval = Column(String(20), default="24h")
    retention_mode = Column(String(10), default="count")
    retention_count = Column(Integer, default=30)
    retention_days = Column(Integer, default=90)
    last_scheduled_run = Column(DateTime, nullable=True)
    next_scheduled_run = Column(DateTime, nullable=True)
    encryption_enabled = Column(Boolean, default=False)
    backup_dir = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
