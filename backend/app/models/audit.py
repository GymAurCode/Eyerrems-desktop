"""Audit log — every action is scoped to a company."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action      = Column(String(120), nullable=False, index=True)
    module      = Column(String(50), nullable=True, index=True)
    entity_type = Column(String(80), nullable=True, index=True)
    entity_id   = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    details     = Column(Text, nullable=True)   # JSON blob
    ip_address  = Column(String(45), nullable=True)
    user_agent  = Column(String(255), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user    = relationship("User", foreign_keys=[user_id])
    company = relationship("Company", foreign_keys=[company_id])
