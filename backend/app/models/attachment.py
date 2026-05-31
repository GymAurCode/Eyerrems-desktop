"""Universal attachment model — stores files in DB as BYTEA."""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index, Integer, LargeBinary, Numeric, String, Text
from app.core.database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    module          = Column(String(50), nullable=False)
    record_id       = Column(String(36), nullable=False)
    document_name   = Column(String(255), nullable=False)
    description     = Column(Text, nullable=True)
    document_status = Column(String(20), default="VERIFIED")
    file_data       = Column(LargeBinary, nullable=False)
    file_size_kb    = Column(Numeric(10, 2), nullable=True)
    file_type       = Column(String(100), nullable=False)
    serial_no       = Column(Integer, autoincrement=True)
    uploaded_by     = Column(String(100), nullable=True)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_attachments_module_record", "module", "record_id"),
    )
