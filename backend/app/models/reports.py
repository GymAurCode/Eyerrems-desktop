from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReportSettings(Base):
    """Single-row-per-company report configuration — drives every generated report."""
    __tablename__ = "report_settings"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    # ── Letterhead ──────────────────────────────────────────────────────────────
    company_name = Column(String(255), nullable=False, default="")
    tagline = Column(String(255), nullable=True, default="")
    address = Column(Text, nullable=True, default="")
    phone = Column(String(60), nullable=True, default="")
    whatsapp = Column(String(60), nullable=True, default="")
    email = Column(String(255), nullable=True, default="")
    uan_helpline = Column(String(60), nullable=True, default="")
    website = Column(String(255), nullable=True, default="")
    reg_no = Column(String(100), nullable=True, default="")
    logo_url = Column(String(512), nullable=True, default="")
    show_logo_watermark = Column(Boolean, nullable=False, default=True)

    # ── Default formatting ──────────────────────────────────────────────────────
    currency_symbol = Column(String(10), nullable=False, default="PKR")
    currency_code = Column(String(10), nullable=False, default="PKR")
    thousands_separator = Column(String(2), nullable=False, default=",")
    decimal_places = Column(Integer, nullable=False, default=2)
    default_paper_size = Column(String(10), nullable=False, default="A4")
    default_orientation = Column(String(10), nullable=False, default="portrait")

    # ── Seal / stamp toggle (JSON map of report_type → bool) ────────────────────
    show_seal_config = Column(Text, nullable=True, default=None)

    # ── Footer ──────────────────────────────────────────────────────────────────
    footer_note = Column(Text, nullable=True, default="")

    # ── Timestamps ──────────────────────────────────────────────────────────────
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
