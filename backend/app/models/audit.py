"""Company-scoped audit log — each entry lives in the tenant schema."""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, String, Text
from sqlalchemy import TypeDecorator, JSON

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class AuditLog(Base):
    """Captures every CREATE / UPDATE / DELETE across all modules.

    This model is bound to **Base** so it gets created inside each company schema
    (via Base.metadata.create_all with the tenant search_path).
    """

    __tablename__ = "audit_logs"

    id              = Column(String(36), primary_key=True, default=_uuid)
    module          = Column(String(100), nullable=False, index=True)
    action          = Column(String(20), nullable=False, index=True)
    record_id       = Column(String(255), nullable=True)
    record_label    = Column(Text, nullable=True)
    changed_by      = Column(String(255), nullable=False)
    changed_by_role = Column(String(100), nullable=True)
    old_data        = Column(JSON, nullable=True)
    new_data        = Column(JSON, nullable=True)
    diff            = Column(JSON, nullable=True)
    ip_address      = Column(String(45), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("idx_audit_logs_module", "module"),
        Index("idx_audit_logs_created_at", "created_at"),
        Index("idx_audit_logs_changed_by", "changed_by"),
        Index("idx_audit_logs_action", "action"),
    )
