"""Lookup values model — dynamic dropdown options stored per company schema."""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, Text, UniqueConstraint
from app.core.database import Base


class LookupValue(Base):
    __tablename__ = "lookup_values"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    category   = Column(String(100), nullable=False, index=True)
    label      = Column(String(255), nullable=False)
    value      = Column(String(255), nullable=False)
    sort_order = Column(Integer, default=0)
    is_active  = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("category", "value", name="uq_lookup_category_value"),
        Index("idx_lookup_category", "category"),
    )
