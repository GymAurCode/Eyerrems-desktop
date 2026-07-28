"""SoftDeleteMixin — add soft delete + restore columns to any model."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, text


class SoftDeleteMixin:
    """Add these columns to any model that needs soft delete / recycle bin support.

    Usage:
        class MyModel(Base, SoftDeleteMixin):
            __tablename__ = "my_table"
            ...
    """

    is_deleted = Column(Boolean, default=False, server_default=text("false"), nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True, index=True)
    deleted_by = Column(Integer, nullable=True, index=True)
    restored_at = Column(DateTime, nullable=True)
    restored_by = Column(Integer, nullable=True)
    original_business_number = Column(String(100), nullable=True)
    restore_count = Column(Integer, default=0, nullable=True)