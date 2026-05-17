"""Reminder & Notification System — SQLAlchemy Models"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey,
    Index, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReminderTemplate(Base):
    __tablename__ = "reminder_templates"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(120), nullable=False)
    title_tpl   = Column(String(255), nullable=False)   # supports {var} placeholders
    message_tpl = Column(Text, nullable=False)
    module      = Column(String(60), nullable=True)     # optional module hint
    # default offset in minutes before due_time to fire pre-alert
    default_pre_alert_minutes = Column(Integer, nullable=False, default=30)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    reminders = relationship("Reminder", back_populates="template")


class Reminder(Base):
    __tablename__ = "reminders"

    id          = Column(Integer, primary_key=True)
    title       = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Dynamic module reference
    module_name = Column(String(60), nullable=True, index=True)   # property|tenant|crm|finance|construction|custom
    record_id   = Column(Integer, nullable=True, index=True)

    due_time    = Column(DateTime, nullable=False, index=True)

    # Recurrence: none | daily | weekly | monthly | custom
    recurrence  = Column(String(20), nullable=False, default="none")
    cron_expr   = Column(String(100), nullable=True)   # for custom cron

    priority    = Column(String(20), nullable=False, default="medium")  # low|medium|high|urgent
    # pending | completed | snoozed | cancelled
    status      = Column(String(20), nullable=False, default="pending", index=True)

    # Minutes before due_time to send pre-alert (0 = at due_time)
    pre_alert_minutes = Column(Integer, nullable=False, default=0)

    template_id = Column(Integer, ForeignKey("reminder_templates.id"), nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Snooze tracking
    snoozed_until = Column(DateTime, nullable=True)

    # Next fire time (maintained by scheduler)
    next_fire_at  = Column(DateTime, nullable=True, index=True)

    template    = relationship("ReminderTemplate", back_populates="reminders")
    creator     = relationship("User", foreign_keys=[created_by])
    assignments = relationship("ReminderAssignment", back_populates="reminder", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="reminder", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_reminders_due_status", "due_time", "status"),
        Index("ix_reminders_next_fire", "next_fire_at", "status"),
    )


class ReminderAssignment(Base):
    """Which users are assigned to a reminder."""
    __tablename__ = "reminder_assignments"

    id          = Column(Integer, primary_key=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id"), nullable=False, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    reminder = relationship("Reminder", back_populates="assignments")
    user     = relationship("User", foreign_keys=[user_id])


class Notification(Base):
    __tablename__ = "notifications"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id"), nullable=True)

    title       = Column(String(255), nullable=False)
    message     = Column(Text, nullable=False)
    # in_app | email | sms
    channel     = Column(String(20), nullable=False, default="in_app")
    # unread | read
    is_read     = Column(Boolean, nullable=False, default=False, index=True)
    # info | warning | error | success
    notif_type  = Column(String(20), nullable=False, default="info")

    module_name = Column(String(60), nullable=True)
    record_id   = Column(Integer, nullable=True)

    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    read_at     = Column(DateTime, nullable=True)

    user     = relationship("User", foreign_keys=[user_id])
    reminder = relationship("Reminder", back_populates="notifications")
    log      = relationship("NotificationLog", back_populates="notification", uselist=False,
                            cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id              = Column(Integer, primary_key=True)
    notification_id = Column(Integer, ForeignKey("notifications.id"), nullable=False, index=True)
    reminder_id     = Column(Integer, ForeignKey("reminders.id"), nullable=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    triggered_at    = Column(DateTime, nullable=False, default=datetime.utcnow)
    delivered_at    = Column(DateTime, nullable=True)
    read_at         = Column(DateTime, nullable=True)
    # delivered | failed | clicked | ignored
    status          = Column(String(20), nullable=False, default="delivered")

    notification = relationship("Notification", back_populates="log")


class ReminderSettings(Base):
    """Per-user notification preferences."""
    __tablename__ = "reminder_settings"

    id                      = Column(Integer, primary_key=True)
    user_id                 = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    sound_enabled           = Column(Boolean, nullable=False, default=True)
    in_app_enabled          = Column(Boolean, nullable=False, default=True)
    default_pre_alert_mins  = Column(Integer, nullable=False, default=30)
    # JSON string for per-module toggles e.g. '{"tenant":true,"crm":false}'
    module_preferences      = Column(Text, nullable=True)
    updated_at              = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
