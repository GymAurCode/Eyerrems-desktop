from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


CATEGORIES = {"", "general", "meeting", "task", "followup", "deadline", "inventory"}
PRIORITIES = {"low", "medium", "high", "critical"}
REPEATS = {"none", "daily", "weekly", "monthly", "yearly"}
STATUSES = {"pending", "completed", "cancelled", "snoozed"}
LOG_STATUSES = {"delivered", "missed", "failed"}
USER_ACTIONS = {"completed", "snoozed", "ignored"}


class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    remind_at: datetime
    priority: str = "medium"
    repeat: str = "none"
    reminder_before: int = 0
    template_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str) -> str:
        if len(v) < 1 or len(v) > 200:
            raise ValueError("title must be 1-200 characters")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in CATEGORIES:
            raise ValueError(f"category must be one of {CATEGORIES}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in PRIORITIES:
            raise ValueError(f"priority must be one of {PRIORITIES}")
        return v

    @field_validator("repeat")
    @classmethod
    def validate_repeat(cls, v: str) -> str:
        if v not in REPEATS:
            raise ValueError(f"repeat must be one of {REPEATS}")
        return v

    @field_validator("reminder_before")
    @classmethod
    def validate_reminder_before(cls, v: int) -> int:
        if v < 0 or v > 10080:
            raise ValueError("reminder_before must be 0-10080")
        return v


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    remind_at: Optional[datetime] = None
    priority: Optional[str] = None
    repeat: Optional[str] = None
    reminder_before: Optional[int] = None
    template_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (len(v) < 1 or len(v) > 200):
            raise ValueError("title must be 1-200 characters")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in CATEGORIES:
            raise ValueError(f"category must be one of {CATEGORIES}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in PRIORITIES:
            raise ValueError(f"priority must be one of {PRIORITIES}")
        return v

    @field_validator("repeat")
    @classmethod
    def validate_repeat(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in REPEATS:
            raise ValueError(f"repeat must be one of {REPEATS}")
        return v

    @field_validator("reminder_before")
    @classmethod
    def validate_reminder_before(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 0 or v > 10080):
            raise ValueError("reminder_before must be 0-10080")
        return v


class ReminderOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    remind_at: datetime
    priority: str
    repeat: str
    status: str
    reminder_before: int
    notification_sent: bool
    snoozed_until: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    template_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReminderDashboardOut(BaseModel):
    upcoming_24h: list[ReminderOut]
    overdue: list[ReminderOut]
    today_total: int
    today_completed: int
    today_pending: int


class RecoveryOut(BaseModel):
    missed_count: int
    missed: list[dict]


class SchedulerStatusOut(BaseModel):
    running: bool
    loop_alive: bool


class SnoozeRequest(BaseModel):
    minutes: int = 5

    @field_validator("minutes")
    @classmethod
    def validate_minutes(cls, v: int) -> int:
        if v < 1 or v > 60:
            raise ValueError("minutes must be 1-60")
        return v


class BulkActionRequest(BaseModel):
    ids: list[int]
    action: str

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        if v not in {"complete", "delete"}:
            raise ValueError("action must be 'complete' or 'delete'")
        return v


class TemplateCreate(BaseModel):
    name: str
    title_template: str
    description_template: Optional[str] = None
    priority: str = "medium"
    repeat: str = "none"
    reminder_before: int = 0

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if len(v) < 1 or len(v) > 120:
            raise ValueError("name must be 1-120 characters")
        return v

    @field_validator("title_template")
    @classmethod
    def title_template_length(cls, v: str) -> str:
        if len(v) < 1 or len(v) > 200:
            raise ValueError("title_template must be 1-200 characters")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in PRIORITIES:
            raise ValueError(f"priority must be one of {PRIORITIES}")
        return v

    @field_validator("repeat")
    @classmethod
    def validate_repeat(cls, v: str) -> str:
        if v not in REPEATS:
            raise ValueError(f"repeat must be one of {REPEATS}")
        return v

    @field_validator("reminder_before")
    @classmethod
    def validate_reminder_before(cls, v: int) -> int:
        if v < 0 or v > 10080:
            raise ValueError("reminder_before must be 0-10080")
        return v


class TemplateOut(BaseModel):
    id: int
    user_id: int
    name: str
    title_template: str
    description_template: Optional[str] = None
    priority: str
    repeat: str
    reminder_before: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplyTemplateRequest(BaseModel):
    remind_at: datetime
    variables: dict[str, str] = {}


class NotificationLogOut(BaseModel):
    id: int
    reminder_id: int
    reminder_title: Optional[str] = None
    reminder_priority: Optional[str] = None
    reminder_category: Optional[str] = None
    triggered_at: datetime
    status: str
    user_action: Optional[str] = None
    snooze_minutes: Optional[int] = None
