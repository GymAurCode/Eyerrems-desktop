"""Pydantic schemas for Reminder & Notification System."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


# ── Template ──────────────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    title_tpl: str
    message_tpl: str
    module: Optional[str] = None
    default_pre_alert_minutes: int = 30
    is_active: bool = True


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    title_tpl: Optional[str] = None
    message_tpl: Optional[str] = None
    module: Optional[str] = None
    default_pre_alert_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class TemplateOut(BaseModel):
    id: int
    name: str
    title_tpl: str
    message_tpl: str
    module: Optional[str]
    default_pre_alert_minutes: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Reminder ──────────────────────────────────────────────────────────────────

class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = None
    module_name: Optional[str] = None
    record_id: Optional[int] = None
    due_time: datetime
    recurrence: str = "none"
    cron_expr: Optional[str] = None
    priority: str = "medium"
    pre_alert_minutes: int = 0
    template_id: Optional[int] = None
    assigned_user_ids: list[int] = []

    @field_validator("recurrence")
    @classmethod
    def validate_recurrence(cls, v: str) -> str:
        allowed = {"none", "daily", "weekly", "monthly", "custom"}
        if v not in allowed:
            raise ValueError(f"recurrence must be one of {allowed}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        allowed = {"low", "medium", "high", "urgent"}
        if v not in allowed:
            raise ValueError(f"priority must be one of {allowed}")
        return v


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module_name: Optional[str] = None
    record_id: Optional[int] = None
    due_time: Optional[datetime] = None
    recurrence: Optional[str] = None
    cron_expr: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    pre_alert_minutes: Optional[int] = None
    template_id: Optional[int] = None
    assigned_user_ids: Optional[list[int]] = None


class AssignedUserOut(BaseModel):
    id: int
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class ReminderOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    module_name: Optional[str]
    record_id: Optional[int]
    due_time: datetime
    recurrence: str
    cron_expr: Optional[str]
    priority: str
    status: str
    pre_alert_minutes: int
    template_id: Optional[int]
    created_by: int
    created_at: datetime
    updated_at: datetime
    snoozed_until: Optional[datetime]
    next_fire_at: Optional[datetime]
    assigned_users: list[AssignedUserOut] = []

    model_config = {"from_attributes": True}


class SnoozeRequest(BaseModel):
    snooze_until: datetime


# ── Notification ──────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    user_id: int
    reminder_id: Optional[int]
    title: str
    message: str
    channel: str
    is_read: bool
    notif_type: str
    module_name: Optional[str]
    record_id: Optional[int]
    created_at: datetime
    read_at: Optional[datetime]

    model_config = {"from_attributes": True}


class NotificationLogOut(BaseModel):
    id: int
    notification_id: int
    reminder_id: Optional[int]
    user_id: int
    triggered_at: datetime
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    status: str

    model_config = {"from_attributes": True}


# ── Settings ──────────────────────────────────────────────────────────────────

class ReminderSettingsUpdate(BaseModel):
    sound_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    default_pre_alert_mins: Optional[int] = None
    module_preferences: Optional[str] = None   # JSON string


class ReminderSettingsOut(BaseModel):
    id: int
    user_id: int
    sound_enabled: bool
    in_app_enabled: bool
    default_pre_alert_mins: int
    module_preferences: Optional[str]
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

class ReminderDashboard(BaseModel):
    today_count: int
    upcoming_count: int
    overdue_count: int
    unread_notifications: int
    today: list[ReminderOut]
    overdue: list[ReminderOut]
    upcoming: list[ReminderOut]
