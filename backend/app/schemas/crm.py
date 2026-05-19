"""CRM Pydantic schemas — full validation."""
import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator, model_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CNIC_RE  = re.compile(r"^\d{5}-\d{7}-\d$")


# ── Lead ──────────────────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    source: str | None = None
    notes: str | None = None
    status: str = "new"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v and not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v


class LeadUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    source: str | None = None
    notes: str | None = None
    status: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v and not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v


class LeadOut(BaseModel):
    id: int
    lead_id: str
    name: str
    phone: str | None
    email: str | None
    source: str | None
    notes: str | None
    status: str
    created_at: datetime
    is_converted: bool = False

    class Config:
        from_attributes = True


# ── Client ────────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    name: str
    phone: str
    email: str | None = None
    cnic: str | None = None
    status: str = "active"
    company_name: str | None = None
    address: str | None = None
    dealer_id: int | None = None
    interested_property_id: int | None = None
    notes: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Phone is required")
        return v.strip()

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

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"active", "inactive", "potential"}
        if v.lower() not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(allowed)}")
        return v.lower()


class ConvertLeadToClient(BaseModel):
    lead_id: int
    name: str
    phone: str
    email: str | None = None
    cnic: str | None = None
    status: str = "active"
    company_name: str | None = None
    address: str | None = None
    dealer_id: int | None = None
    interested_property_id: int | None = None
    notes: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Phone is required")
        return v.strip()

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


class ClientUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    cnic: str | None = None
    status: str | None = None
    company_name: str | None = None
    address: str | None = None
    dealer_id: int | None = None
    interested_property_id: int | None = None
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


class ClientAttachmentOut(BaseModel):
    id: int
    client_id: int
    file_path: str
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClientOut(BaseModel):
    id: int
    client_id: str
    tracking_id: str
    lead_id: int | None
    name: str
    phone: str | None
    email: str | None
    cnic: str | None
    status: str
    company_name: str | None
    address: str | None
    dealer_id: int | None
    interested_property_id: int | None
    notes: str | None
    created_at: datetime
    converted_from_lead: bool = False
    original_lead_id: str | None = None
    dealer_name: str | None = None
    attachments: list[ClientAttachmentOut] = []

    class Config:
        from_attributes = True


# ── Dealer ────────────────────────────────────────────────────────────────────

class DealerCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str
    company: str | None = None
    commission_type: str = "percentage"
    commission_rate: Decimal | None = None
    cnic: str | None = None
    address: str | None = None
    notes: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Phone is required")
        return v.strip()

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

    @field_validator("commission_type")
    @classmethod
    def validate_commission_type(cls, v: str) -> str:
        if v not in {"fixed", "percentage"}:
            raise ValueError("commission_type must be 'fixed' or 'percentage'")
        return v


class DealerUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    commission_type: str | None = None
    commission_rate: Decimal | None = None
    cnic: str | None = None
    address: str | None = None
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


class DealerAttachmentOut(BaseModel):
    id: int
    dealer_id: int
    file_path: str
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True


class DealerOut(BaseModel):
    id: int
    dealer_id: str
    name: str
    email: str | None
    phone: str | None
    company: str | None
    commission_type: str
    commission_rate: Decimal | None
    cnic: str | None
    address: str | None
    notes: str | None
    created_at: datetime
    attachments: list[DealerAttachmentOut] = []

    class Config:
        from_attributes = True


# ── InstallmentType ───────────────────────────────────────────────────────────

class InstallmentTypeCreate(BaseModel):
    name: str


class InstallmentTypeOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Deal ──────────────────────────────────────────────────────────────────────

class DealCreate(BaseModel):
    client_id: int
    property_id: int | None = None
    unit_id: int | None = None
    dealer_id: int | None = None
    # Town hierarchy support
    deal_type: str = "property"   # property | plot | block | town
    reference_id: int | None = None
    deal_title: str
    client_role: str | None = None
    deal_value: Decimal
    down_payment: Decimal | None = None
    down_payment_status: str = "pending"
    status: str = "pending"
    deal_date: date | None = None
    due_date: date | None = None
    description: str | None = None
    notes: str | None = None

    @field_validator("deal_type")
    @classmethod
    def validate_deal_type(cls, v: str) -> str:
        allowed = {"property", "plot", "block", "town"}
        if v.lower() not in allowed:
            raise ValueError(f"deal_type must be one of: {', '.join(allowed)}")
        return v.lower()

    @field_validator("client_role")
    @classmethod
    def validate_role(cls, v: str | None) -> str | None:
        if v and v not in {"Buyer", "Seller", "Investor"}:
            raise ValueError("client_role must be Buyer, Seller, or Investor")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"pending", "active", "closed", "cancelled"}
        if v.lower() not in allowed:
            raise ValueError(f"status must be one of: {', '.join(allowed)}")
        return v.lower()


class DealUpdate(BaseModel):
    property_id: int | None = None
    unit_id: int | None = None
    dealer_id: int | None = None
    deal_type: str | None = None
    reference_id: int | None = None
    deal_title: str | None = None
    client_role: str | None = None
    deal_value: Decimal | None = None
    down_payment: Decimal | None = None
    down_payment_status: str | None = None
    status: str | None = None
    deal_date: date | None = None
    due_date: date | None = None
    description: str | None = None
    notes: str | None = None


class DealAttachmentOut(BaseModel):
    id: int
    deal_id: int
    file_path: str
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True


class DealOut(BaseModel):
    id: int
    deal_id: str
    tracking_id: str
    client_id: int
    property_id: int | None
    unit_id: int | None
    dealer_id: int | None
    deal_type: str = "property"
    reference_id: int | None = None
    deal_title: str | None
    client_role: str | None
    deal_value: Decimal
    down_payment: Decimal | None = None          # optional — moved to Booking
    down_payment_status: str = "pending"          # optional — moved to Booking
    status: str
    deal_date: date | None
    due_date: date | None
    description: str | None
    notes: str | None
    created_at: datetime
    client_name: str | None = None
    dealer_name: str | None = None
    property_name: str | None = None
    attachments: list[DealAttachmentOut] = []

    class Config:
        from_attributes = True


# ── InstallmentPlan ───────────────────────────────────────────────────────────

# ── InstallmentPlan ───────────────────────────────────────────────────────────

class InstallmentRuleCreate(BaseModel):
    """One rule in a mixed schedule: e.g. monthly × 6 @ 500 each"""
    type: str  # monthly | quarterly | yearly | custom
    amount: Decimal
    count: int
    start_date: date  # first due date for this rule

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"monthly", "quarterly", "yearly", "custom"}
        if v not in allowed:
            raise ValueError(f"type must be one of: {', '.join(allowed)}")
        return v

    @field_validator("count")
    @classmethod
    def validate_count(cls, v: int) -> int:
        if v < 1:
            raise ValueError("count must be >= 1")
        return v


class InstallmentCreate(BaseModel):
    due_date: date
    amount: Decimal
    type: str = "custom"


class InstallmentUpdate(BaseModel):
    status: str | None = None
    paid_amount: Decimal | None = None
    due_date: date | None = None  # reschedule support


class InstallmentOut(BaseModel):
    id: int
    plan_id: int
    due_date: date
    amount: Decimal
    paid_amount: Decimal
    type: str
    status: str

    class Config:
        from_attributes = True


class InstallmentPlanCreate(BaseModel):
    """
    Flexible plan creation.
    Supports two modes:
      1. rules-based: provide `rules` list → backend generates schedule
      2. manual: provide `installments` list directly
    """
    type_id: int | None = None
    total_amount: Decimal
    down_payment: Decimal = Decimal("0")
    # rules-based generation
    rules: list[InstallmentRuleCreate] = []
    # manual override
    installments: list[InstallmentCreate] = []

    @field_validator("down_payment")
    @classmethod
    def validate_dp(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("down_payment must be >= 0")
        return v


class InstallmentPlanOut(BaseModel):
    id: int
    deal_id: int
    type_id: int | None
    total_amount: Decimal
    down_payment: Decimal
    remaining_amount: Decimal
    down_payment_status: str
    total_count: int | None
    frequency: str | None
    amount_per: Decimal | None
    created_at: datetime
    installments: list[InstallmentOut] = []

    class Config:
        from_attributes = True


class InstallmentPaymentCreate(BaseModel):
    installment_id: int
    method: str  # cash | bank
    amount: Decimal
    date: datetime | None = None
    reference_number: str | None = None

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        if v not in {"cash", "bank"}:
            raise ValueError("method must be cash or bank")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be > 0")
        return v


class InstallmentPaymentOut(BaseModel):
    id: int
    installment_id: int
    method: str
    amount: Decimal
    date: datetime
    reference_number: str | None
    journal_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Communication ─────────────────────────────────────────────────────────────

class CommunicationCreate(BaseModel):
    tracking_id: str
    client_id: int | None = None
    type: str
    subject: str
    description: str | None = None
    comm_date: date | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"call", "sms", "email", "meeting"}
        if v.lower() not in allowed:
            raise ValueError(f"type must be one of: {', '.join(allowed)}")
        return v.lower()


class CommunicationOut(BaseModel):
    id: int
    tracking_id: str
    client_id: int | None
    type: str
    subject: str | None
    description: str | None
    comm_date: date | None
    attachment: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Global Search ─────────────────────────────────────────────────────────────

class GlobalSearchResult(BaseModel):
    tracking_id: str
    client: ClientOut | None = None
    lead: LeadOut | None = None
    deals: list[DealOut] = []
    communications: list[CommunicationOut] = []


# ── LeadActivity ──────────────────────────────────────────────────────────────

class ActivityCreate(BaseModel):
    entity_type: str  # lead | client
    entity_id: int
    type: str         # call | whatsapp | followup | note | email
    message: str | None = None
    scheduled_at: datetime | None = None  # for follow-ups
    status: str = "initiated"

    @field_validator("entity_type")
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        if v not in {"lead", "client"}:
            raise ValueError("entity_type must be 'lead' or 'client'")
        return v

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"call", "whatsapp", "followup", "note", "email"}
        if v.lower() not in allowed:
            raise ValueError(f"type must be one of: {', '.join(allowed)}")
        return v.lower()


class ActivityUpdate(BaseModel):
    status: str | None = None
    message: str | None = None
    scheduled_at: datetime | None = None


class ActivityOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    type: str
    message: str | None
    scheduled_at: datetime | None
    status: str
    notified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedLeads(BaseModel):
    items: list[LeadOut]
    total: int
    limit: int | None = None
    offset: int | None = None


class PaginatedClients(BaseModel):
    items: list[ClientOut]
    total: int
    limit: int | None = None
    offset: int | None = None


class PaginatedDealers(BaseModel):
    items: list[DealerOut]
    total: int
    limit: int | None = None
    offset: int | None = None


class PaginatedDeals(BaseModel):
    items: list[DealOut]
    total: int
    limit: int | None = None
    offset: int | None = None

