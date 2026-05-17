"""Report Models — Report Templates, Saved Reports, Report Schedules."""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey,
    Integer, String, Text, JSON,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReportTemplate(Base):
    """Predefined report templates for the system."""
    __tablename__ = "report_templates"

    id = Column(Integer, primary_key=True)
    template_key = Column(String(100), unique=True, nullable=False, index=True)  # customer_ledger, booking_form, etc.
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, index=True)  # crm, finance, property, tenant, etc.
    report_type = Column(String(50), nullable=False)  # tabular, ledger, profile, financial_statement, summary
    default_filters = Column(JSON, nullable=True)  # Default filter configuration
    default_columns = Column(JSON, nullable=True)  # Default columns to display
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class SavedReport(Base):
    """User-saved report configurations."""
    __tablename__ = "saved_reports"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    template_key = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    filters = Column(JSON, nullable=True)  # Saved filter configuration
    columns = Column(JSON, nullable=True)  # Saved column configuration
    sort_config = Column(JSON, nullable=True)  # Saved sort configuration
    is_favorite = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])


class ReportSchedule(Base):
    """Scheduled report generation and delivery."""
    __tablename__ = "report_schedules"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    saved_report_id = Column(Integer, ForeignKey("saved_reports.id"), nullable=True)
    template_key = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    schedule_type = Column(String(20), nullable=False)  # daily, weekly, monthly
    schedule_config = Column(JSON, nullable=True)  # Cron-like config
    delivery_method = Column(String(20), nullable=False, default="email")  # email, download
    recipients = Column(JSON, nullable=True)  # List of email addresses
    format = Column(String(20), nullable=False, default="pdf")  # pdf, excel, both
    is_active = Column(Boolean, nullable=False, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    saved_report = relationship("SavedReport", foreign_keys=[saved_report_id])


class ReportLog(Base):
    """Audit log for report generation."""
    __tablename__ = "report_logs"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    template_key = Column(String(100), nullable=False, index=True)
    report_name = Column(String(255), nullable=False)
    format = Column(String(20), nullable=False)  # pdf, excel
    filters_applied = Column(JSON, nullable=True)
    record_count = Column(Integer, nullable=True)
    generation_time_ms = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="success")  # success, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])
