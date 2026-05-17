"""Tenant Management Pydantic Schemas."""
import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CNIC_RE  = re.compile(r"^\d{5}-\d{7}-\d$")

RENT_CYCLES  = {"monthly", "quarterly", "yearly"}
RENT_STATUSES = {"pending", "paid", "partial", "overdue"}
PAY_METHODS  = {"cash", "bank", "cheque", "online"}
MAINT_TYPES  = {
    "repair", "utility", "cleaning", "other",
    "electrical", "plumbing", "hvac", "security", "emergency", "preventive",
}
MAINT_STATUSES  = {"pending", "assigned", "in_progress", "completed", "cancelled"}
MAINT_PRIORITIES = {"low", "normal", "high", "urgent"}


# ── Tenant ────────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    phone: str
    email: str | None = None
    cnic: str | None = None
    family_size: int | None = None
    notes: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v and not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("cnic")
    @classmethod
    def validate_cnic(cls, v: str | None) -> str | None:
        if v and not _CNIC_RE.match(v):
            raise ValueError("CNIC must be in format XXXXX-XXXXXXX-X")
        return v


class TenantUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    cnic: str | None = None
    family_size: int | None = None
    notes: str | None = None
    is_active: bool | None = None


class TenantOut(BaseModel):
    id: int
    tenant_id: str
    name: str
    phone: str
    email: str | None
    cnic: str | None
    family_size: int | None
    notes: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Lease ─────────────────────────────────────────────────────────────────────

class LeaseCreate(BaseModel):
    property_id: int
    unit_id: int | None = None
    is_full_property: bool = False
    rent_amount: Decimal
    security_deposit: Decimal | None = None
    rent_cycle: str = "monthly"
    due_day: int = 1
    lease_start: date
    lease_end: date | None = None

    @field_validator("rent_cycle")
    @classmethod
    def validate_cycle(cls, v: str) -> str:
        if v not in RENT_CYCLES:
            raise ValueError(f"rent_cycle must be one of {RENT_CYCLES}")
        return v

    @field_validator("due_day")
    @classmethod
    def validate_due_day(cls, v: int) -> int:
        if not 1 <= v <= 28:
            raise ValueError("due_day must be between 1 and 28")
        return v


class LeaseOut(BaseModel):
    id: int
    tenant_id: int
    property_id: int
    unit_id: int | None
    is_full_property: bool
    rent_amount: Decimal
    security_deposit: Decimal | None
    rent_cycle: str
    due_day: int
    lease_start: date
    lease_end: date | None
    status: str
    created_at: datetime
    property_name: str | None = None
    unit_number: str | None = None

    class Config:
        from_attributes = True


# ── Full Tenant Create (wizard payload) ───────────────────────────────────────

class TenantWizardCreate(BaseModel):
    tenant: TenantCreate
    lease: LeaseCreate


# ── Rent Record ───────────────────────────────────────────────────────────────

class RentRecordOut(BaseModel):
    id: int
    tenant_id: int
    lease_id: int
    amount_due: Decimal
    amount_paid: Decimal
    due_date: date
    paid_date: date | None
    status: str
    late_fee: Decimal | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class RentRecordUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None


# ── Rent Increase ─────────────────────────────────────────────────────────────

class RentIncreaseCreate(BaseModel):
    new_amount: Decimal
    effective_from: date
    notes: str | None = None


class RentIncreaseOut(BaseModel):
    id: int
    lease_id: int
    old_amount: Decimal
    new_amount: Decimal
    effective_from: date
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Payment ───────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    tenant_id: int
    rent_record_id: int | None = None
    amount: Decimal
    payment_date: date
    payment_method: str = "cash"
    notes: str | None = None

    @field_validator("payment_method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        if v not in PAY_METHODS:
            raise ValueError(f"payment_method must be one of {PAY_METHODS}")
        return v


class PaymentOut(BaseModel):
    id: int
    tenant_id: int
    rent_record_id: int | None
    amount: Decimal
    payment_date: date
    payment_method: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Maintenance ───────────────────────────────────────────────────────────────

class MaintenanceCreate(BaseModel):
    property_id:    int
    unit_id:        int | None = None
    tenant_id:      int | None = None
    title:          str | None = None
    description:    str
    category:       str = "repair"
    mtype:          str = "repair"          # kept for backward compat
    priority:       str = "normal"
    estimated_cost: Decimal | None = None
    cost:           Decimal = Decimal("0")  # kept for backward compat
    date:           date
    assigned_to:    int | None = None
    vendor_name:    str | None = None
    vendor_phone:   str | None = None
    notes:          str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in MAINT_TYPES:
            raise ValueError(f"category must be one of {sorted(MAINT_TYPES)}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in MAINT_PRIORITIES:
            raise ValueError(f"priority must be one of {sorted(MAINT_PRIORITIES)}")
        return v

    @field_validator("mtype")
    @classmethod
    def validate_mtype(cls, v: str) -> str:
        if v not in MAINT_TYPES:
            raise ValueError(f"mtype must be one of {sorted(MAINT_TYPES)}")
        return v


class MaintenanceUpdate(BaseModel):
    title:          str | None = None
    description:    str | None = None
    category:       str | None = None
    priority:       str | None = None
    status:         str | None = None
    estimated_cost: Decimal | None = None
    actual_cost:    Decimal | None = None
    cost:           Decimal | None = None
    assigned_to:    int | None = None
    vendor_name:    str | None = None
    vendor_phone:   str | None = None
    notes:          str | None = None
    completed_date: date | None = None
    status_note:    str | None = None   # note to attach to activity log

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in MAINT_STATUSES:
            raise ValueError(f"status must be one of {sorted(MAINT_STATUSES)}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str | None) -> str | None:
        if v is not None and v not in MAINT_PRIORITIES:
            raise ValueError(f"priority must be one of {sorted(MAINT_PRIORITIES)}")
        return v


class MaintenanceActivityLogOut(BaseModel):
    id:         int
    user_id:    int | None
    action:     str
    old_status: str | None
    new_status: str | None
    note:       str | None
    created_at: datetime
    user_name:  str | None = None

    class Config:
        from_attributes = True


class MaintenanceOut(BaseModel):
    id:             int
    property_id:    int
    unit_id:        int | None
    tenant_id:      int | None
    title:          str | None
    description:    str
    category:       str
    mtype:          str
    priority:       str
    status:         str
    estimated_cost: Decimal | None
    actual_cost:    Decimal | None
    cost:           Decimal
    date:           date
    completed_date: date | None
    assigned_to:    int | None
    vendor_name:    str | None
    vendor_phone:   str | None
    notes:          str | None
    expense_posted: bool
    ledger_posted:  bool
    created_by:     int | None
    created_at:     datetime
    updated_at:     datetime | None
    # Computed / joined
    property_name:  str | None = None
    unit_number:    str | None = None
    tenant_name:    str | None = None
    assigned_name:  str | None = None
    activity_logs:  list[MaintenanceActivityLogOut] = []

    class Config:
        from_attributes = True


class MaintenanceAnalytics(BaseModel):
    total_requests:     int
    pending:            int
    in_progress:        int
    completed:          int
    cancelled:          int
    total_cost:         Decimal
    avg_cost:           Decimal
    by_category:        list[dict]
    by_priority:        list[dict]
    by_property:        list[dict]
    monthly_trend:      list[dict]


# ── Tenant Detail (full page) ─────────────────────────────────────────────────

class TenantDetailOut(TenantOut):
    leases: list[LeaseOut] = []
    rent_records: list[RentRecordOut] = []
    payments: list[PaymentOut] = []
    total_paid: Decimal = Decimal("0")
    total_pending: Decimal = Decimal("0")
    total_overdue: Decimal = Decimal("0")


# ── Dashboard summary ─────────────────────────────────────────────────────────

class TenantDashboardOut(BaseModel):
    total_tenants: int
    active_tenants: int
    total_rent_collected: Decimal
    total_pending: Decimal
    total_overdue: Decimal
    total_maintenance_cost: Decimal
    net_profit: Decimal


# ── Alerts ────────────────────────────────────────────────────────────────────

class TenantAlert(BaseModel):
    type: str          # "overdue" | "due_soon" | "lease_expiry"
    severity: str      # "high" | "medium" | "low"
    tenant_id: int
    tenant_name: str
    tenant_ref: str    # TEN-XXXX
    message: str
    due_date: date | None = None
