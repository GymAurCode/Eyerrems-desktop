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
    action          = Column(String(50), nullable=False, index=True)
    record_id       = Column(String(255), nullable=True)
    record_label    = Column(Text, nullable=True)
    changed_by      = Column(String(255), nullable=False)
    changed_by_role = Column(String(100), nullable=True)

    # Enhanced user info
    user_id         = Column(String(36), nullable=True)
    username        = Column(String(255), nullable=True)
    full_name       = Column(String(255), nullable=True)
    role            = Column(String(100), nullable=True)
    department      = Column(String(100), nullable=True)

    # Entity info
    entity_type     = Column(String(100), nullable=True)
    entity_id       = Column(String(255), nullable=True)
    entity_name     = Column(Text, nullable=True)

    # Data snapshots
    old_data        = Column(JSON, nullable=True)
    new_data        = Column(JSON, nullable=True)
    diff            = Column(JSON, nullable=True)

    # Request metadata
    ip_address      = Column(String(45), nullable=True)
    browser         = Column(String(255), nullable=True)
    os              = Column(String(255), nullable=True)
    device          = Column(String(255), nullable=True)
    request_method  = Column(String(10), nullable=True)
    api_endpoint    = Column(String(500), nullable=True)

    # Status
    status          = Column(String(20), nullable=True, default="Success")

    created_at      = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("idx_audit_logs_module", "module"),
        Index("idx_audit_logs_created_at", "created_at"),
        Index("idx_audit_logs_changed_by", "changed_by"),
        Index("idx_audit_logs_action", "action"),
        Index("idx_audit_logs_record", "module", "record_id"),
        Index("idx_audit_logs_user_id", "user_id"),
        Index("idx_audit_logs_entity_type", "entity_type"),
        Index("idx_audit_logs_status", "status"),
    )