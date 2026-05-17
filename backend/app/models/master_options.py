from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, UniqueConstraint

from app.core.database import Base


class MasterSettingOption(Base):
    __tablename__ = "master_setting_options"
    __table_args__ = (UniqueConstraint("category", "code", name="uq_master_setting_category_code"),)

    id = Column(Integer, primary_key=True)
    category = Column(String(40), nullable=False, index=True)
    code = Column(String(80), nullable=False)
    label = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
