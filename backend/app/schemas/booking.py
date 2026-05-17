"""Booking Pydantic schemas — validation and serialization.

Bookings own the financial commitment. Deals are negotiation-only.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, field_validator, model_validator


# ── Custom charge item ────────────────────────────────────────────────────────

class CustomCharge(BaseModel):
    label: str
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Charge amount cannot be negative")
        return v


# ── Booking create ────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    """Create a new booking (directly or from a deal)."""
    # Source
    deal_id: int | None = None

    # References
    client_id:   int
    property_id: int | None = None
    unit_id:     int | None = None
    project_id:  int | None = None

    # Assignment
    assigned_dealer_id: int | None = None
    assigned_staff_id:  int | None = None
    nominee_name:       str | None = None
    nominee_phone:      str | None = None
    nominee_cnic:       str | None = None

    # Financials
    property_price:      Decimal
    final_price:         Decimal | None = None   # defaults to property_price
    discount:            Decimal = Decimal("0")
    booking_amount:      Decimal                 # token/booking fee
    down_payment:        Decimal = Decimal("0")
    processing_fee:      Decimal = Decimal("0")
    possession_charges:  Decimal = Decimal("0")
    development_charges: Decimal = Decimal("0")
    custom_charges:      list[CustomCharge] = []

    # Holding period
    holding_days: int = 7

    notes: str | None = None

    @model_validator(mode="after")
    def validate_property_or_unit(self):
        if not self.property_id and not self.unit_id:
            raise ValueError("Either property_id or unit_id must be provided")
        return self

    @field_validator("property_price", "booking_amount")
    @classmethod
    def positive_required(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v

    @field_validator("discount", "down_payment", "processing_fee",
                     "possession_charges", "development_charges")
    @classmethod
    def non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Amount cannot be negative")
        return v

    @field_validator("holding_days")
    @classmethod
    def valid_holding(cls, v: int) -> int:
        if v < 1 or v > 365:
            raise ValueError("Holding days must be between 1 and 365")
        return v


# ── Booking update ────────────────────────────────────────────────────────────

class BookingUpdate(BaseModel):
    assigned_dealer_id:  int | None = None
    assigned_staff_id:   int | None = None
    nominee_name:        str | None = None
    nominee_phone:       str | None = None
    nominee_cnic:        str | None = None
    booking_amount:      Decimal | None = None
    processing_fee:      Decimal | None = None
    possession_charges:  Decimal | None = None
    development_charges: Decimal | None = None
    custom_charges:      list[CustomCharge] | None = None
    notes:               str | None = None


# ── Status update ─────────────────────────────────────────────────────────────

class BookingStatusUpdate(BaseModel):
    status:               str
    notes:                str | None = None
    cancellation_reason:  str | None = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        allowed = {
            "pending", "reserved", "confirmed", "active",
            "completed", "cancelled", "expired", "refunded",
        }
        if v.lower() not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return v.lower()


# ── Assignment ────────────────────────────────────────────────────────────────

class BookingAssignment(BaseModel):
    assigned_dealer_id: int | None = None
    assigned_staff_id:  int | None = None
    notes:              str | None = None

    @model_validator(mode="after")
    def at_least_one(self):
        if not self.assigned_dealer_id and not self.assigned_staff_id:
            raise ValueError("Either assigned_dealer_id or assigned_staff_id must be provided")
        return self


# ── Extension ─────────────────────────────────────────────────────────────────

class BookingExtension(BaseModel):
    additional_days: int
    notes:           str | None = None

    @field_validator("additional_days")
    @classmethod
    def valid_days(cls, v: int) -> int:
        if v < 1 or v > 90:
            raise ValueError("Additional days must be between 1 and 90")
        return v


# ── Installment plan creation ─────────────────────────────────────────────────

class InstallmentPlanCreate(BaseModel):
    """Create an installment plan for a booking."""
    frequency:   str   # monthly | quarterly | half_yearly | yearly | balloon | custom
    count:       int   # number of installments
    start_date:  date  # first installment due date
    due_day:     int | None = None   # day of month (1-28)
    grace_days:  int = 0
    type_id:     int | None = None

    @field_validator("frequency")
    @classmethod
    def valid_freq(cls, v: str) -> str:
        allowed = {"monthly", "quarterly", "half_yearly", "yearly", "balloon", "custom"}
        if v.lower() not in allowed:
            raise ValueError(f"frequency must be one of: {', '.join(sorted(allowed))}")
        return v.lower()

    @field_validator("count")
    @classmethod
    def positive_count(cls, v: int) -> int:
        if v < 1 or v > 600:
            raise ValueError("count must be between 1 and 600")
        return v

    @field_validator("due_day")
    @classmethod
    def valid_due_day(cls, v: int | None) -> int | None:
        if v is not None and (v < 1 or v > 28):
            raise ValueError("due_day must be between 1 and 28")
        return v


# ── Payment ───────────────────────────────────────────────────────────────────

class InstallmentPaymentCreate(BaseModel):
    installment_id:   int
    method:           str   # cash | bank | cheque | online
    amount:           Decimal
    reference_number: str | None = None
    payment_date:     datetime | None = None
    notes:            str | None = None

    @field_validator("method")
    @classmethod
    def valid_method(cls, v: str) -> str:
        allowed = {"cash", "bank", "cheque", "online"}
        if v.lower() not in allowed:
            raise ValueError(f"method must be one of: {', '.join(sorted(allowed))}")
        return v.lower()

    @field_validator("amount")
    @classmethod
    def positive_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Payment amount must be greater than 0")
        return v


# ── Convert deal → booking ────────────────────────────────────────────────────

class BookingFromDeal(BaseModel):
    """Create a booking from a WON deal."""
    deal_id:             int
    final_price:         Decimal
    booking_amount:      Decimal
    down_payment:        Decimal = Decimal("0")
    discount:            Decimal = Decimal("0")
    processing_fee:      Decimal = Decimal("0")
    possession_charges:  Decimal = Decimal("0")
    development_charges: Decimal = Decimal("0")
    custom_charges:      list[CustomCharge] = []
    holding_days:        int = 7
    assigned_dealer_id:  int | None = None
    nominee_name:        str | None = None
    nominee_phone:       str | None = None
    nominee_cnic:        str | None = None
    notes:               str | None = None


# ── Output schemas ────────────────────────────────────────────────────────────

class BookingLogOut(BaseModel):
    id:               int
    booking_id:       int
    action:           str
    old_value:        str | None
    new_value:        str | None
    performed_by_id:  int | None
    performed_by_name: str | None = None
    notes:            str | None
    created_at:       datetime

    class Config:
        from_attributes = True


class BookingAttachmentOut(BaseModel):
    id:         int
    booking_id: int
    file_path:  str
    filename:   str
    file_type:  str | None
    created_at: datetime

    class Config:
        from_attributes = True


class InstallmentOut(BaseModel):
    id:                  int
    plan_id:             int
    installment_number:  int | None = None
    due_date:            date
    amount:              Decimal
    paid_amount:         Decimal
    remaining:           Decimal = Decimal("0")
    type:                str
    status:              str
    payments:            list[Any] = []

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_remaining(cls, inst):
        d = cls.model_validate(inst).model_dump()
        d["remaining"] = Decimal(str(inst.amount)) - Decimal(str(inst.paid_amount))
        return d


class InstallmentPlanOut(BaseModel):
    id:                  int
    booking_id:          int
    type_id:             int | None
    total_amount:        Decimal
    down_payment:        Decimal
    remaining_amount:    Decimal
    down_payment_status: str
    total_count:         int | None
    frequency:           str | None
    amount_per:          Decimal | None
    created_at:          datetime
    installments:        list[InstallmentOut] = []

    class Config:
        from_attributes = True


class BookingOut(BaseModel):
    id:          int
    booking_id:  str
    deal_id:     int | None

    client_id:   int
    property_id: int | None
    unit_id:     int | None
    project_id:  int | None

    assigned_dealer_id: int | None
    assigned_staff_id:  int | None
    nominee_name:       str | None
    nominee_phone:      str | None
    nominee_cnic:       str | None

    property_price:      Decimal
    final_price:         Decimal | None
    discount:            Decimal
    booking_amount:      Decimal
    down_payment:        Decimal
    down_payment_status: str
    processing_fee:      Decimal
    possession_charges:  Decimal
    development_charges: Decimal
    custom_charges:      str | None   # raw JSON

    booking_date:  datetime
    expiry_date:   datetime
    holding_days:  int

    status:               str
    notes:                str | None
    cancellation_reason:  str | None

    created_at:   datetime
    updated_at:   datetime
    confirmed_at: datetime | None
    active_at:    datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    expired_at:   datetime | None
    refunded_at:  datetime | None

    # Enriched (computed at API layer)
    client_name:    str | None = None
    client_phone:   str | None = None
    property_name:  str | None = None
    unit_number:    str | None = None
    dealer_name:    str | None = None
    staff_name:     str | None = None
    is_expired:     bool = False
    days_remaining: int | None = None
    total_payable:  Decimal | None = None

    logs:        list[BookingLogOut] = []
    attachments: list[BookingAttachmentOut] = []
    installment_plan: InstallmentPlanOut | None = None

    class Config:
        from_attributes = True


class BookingListOut(BaseModel):
    id:           int
    booking_id:   str
    deal_id:      int | None
    client_id:    int
    client_name:  str | None
    property_name: str | None
    unit_number:  str | None
    property_price:  Decimal
    final_price:     Decimal | None
    booking_amount:  Decimal
    down_payment:    Decimal
    booking_date:    datetime
    expiry_date:     datetime
    status:          str
    is_expired:      bool = False
    days_remaining:  int | None = None
    dealer_name:     str | None = None
    staff_name:      str | None = None
    has_plan:        bool = False

    class Config:
        from_attributes = True


# ── Statistics ────────────────────────────────────────────────────────────────

class BookingStats(BaseModel):
    total_bookings:     int
    pending_bookings:   int
    reserved_bookings:  int
    confirmed_bookings: int
    active_bookings:    int
    completed_bookings: int
    cancelled_bookings: int
    expired_bookings:   int
    refunded_bookings:  int
    expiring_soon:      int
    total_booking_amount: Decimal
    total_property_value: Decimal
