from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.soft_delete_mixin import SoftDeleteMixin


class User(Base, SoftDeleteMixin):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    company_id       = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    role_id          = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True)
    is_super_admin   = Column(Boolean, nullable=False, default=False)
    email            = Column(String(255), nullable=False, index=True)
    full_name        = Column(String(120), nullable=False)
    hashed_password  = Column(String(255), nullable=False)

    status           = Column(String(20), nullable=False, default="pending", index=True)
    is_approved      = Column(Boolean, default=False, nullable=False)
    is_active        = Column(Boolean, default=True, nullable=False)

    approved_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at      = Column(DateTime, nullable=True)

    approval_status  = Column(String(20), nullable=False, default="pending")

    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login       = Column(DateTime, nullable=True)

    company          = relationship("Company", foreign_keys=[company_id], back_populates="users")
    approver         = relationship("User", remote_side=[id], foreign_keys=[approved_by])
