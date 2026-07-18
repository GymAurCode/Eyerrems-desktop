from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class SpreadsheetAuditLog(Base):
    __tablename__ = "spreadsheet_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String(120), nullable=False)
    sheet_name = Column(String(120), nullable=False)
    row_id = Column(Integer, nullable=True)
    column_name = Column(String(120), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    action = Column(String(40), nullable=False, default="edit")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
