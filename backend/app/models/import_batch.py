"""Bulk import batch and row-level audit logs."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True)
    module_key = Column(String(64), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_format = Column(String(10), nullable=False)  # csv | xlsx
    duplicate_mode = Column(String(20), nullable=False, default="skip")
    status = Column(String(20), nullable=False, default="pending")  # pending|validated|completed|failed|partial
    total_rows = Column(Integer, nullable=False, default=0)
    valid_rows = Column(Integer, nullable=False, default=0)
    imported_rows = Column(Integer, nullable=False, default=0)
    skipped_rows = Column(Integer, nullable=False, default=0)
    failed_rows = Column(Integer, nullable=False, default=0)
    error_summary = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    imported_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    row_logs = relationship("ImportRowLog", back_populates="batch", cascade="all, delete-orphan")


class ImportRowLog(Base):
    __tablename__ = "import_row_logs"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False)  # valid|invalid|imported|skipped|failed|updated
    message = Column(Text, nullable=True)
    row_data_json = Column(Text, nullable=True)
    entity_type = Column(String(64), nullable=True)
    entity_id = Column(Integer, nullable=True)

    batch = relationship("ImportBatch", back_populates="row_logs")
