from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReminderTemplate(Base):
    __tablename__ = "reminder_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    title_template = Column(String(200), nullable=False)
    description_template = Column(Text, nullable=True)
    priority = Column(String(10), nullable=False, default="medium")
    repeat = Column(String(10), nullable=False, default="none")
    reminder_before = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(40), nullable=True, index=True)
    remind_at = Column(DateTime(timezone=True), nullable=False, index=True)
    priority = Column(String(10), nullable=False, default="medium")
    repeat = Column(String(10), nullable=False, default="none")
    status = Column(String(12), nullable=False, default="pending")
    reminder_before = Column(Integer, nullable=False, default=0)
    notification_sent = Column(Boolean, nullable=False, default=False)
    snoozed_until = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    template_id = Column(Integer, ForeignKey("reminder_templates.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status = Column(String(12), nullable=False, default="delivered")
    user_action = Column(String(12), nullable=True)
    snooze_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
