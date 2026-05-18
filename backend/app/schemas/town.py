"""Pydantic schemas for Town / Block / Plot hierarchy."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


# ── Town ──────────────────────────────────────────────────────────────────────

class TownCreate(BaseModel):
    name: str
    location: str | None = None
    description: str | None = None


class TownUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    description: str | None = None


class TownOut(BaseModel):
    id: int
    tid: str
    name: str
    location: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime
    block_count: int = 0
    plot_count: int = 0

    class Config:
        from_attributes = True


# ── Block ─────────────────────────────────────────────────────────────────────

class BlockCreate(BaseModel):
    town_id: int
    name: str
    block_type: str = "residential"
    description: str | None = None
    progress_percentage: float = 0.0
    work_type: str | None = None

    @field_validator("block_type")
    @classmethod
    def validate_block_type(cls, v: str) -> str:
        allowed = {"residential", "commercial", "mixed", "industrial"}
        if v.lower() not in allowed:
            raise ValueError(f"block_type must be one of: {', '.join(allowed)}")
        return v.lower()

    @field_validator("progress_percentage")
    @classmethod
    def validate_progress(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("progress_percentage must be between 0 and 100")
        return v


class BlockUpdate(BaseModel):
    name: str | None = None
    block_type: str | None = None
    description: str | None = None
    progress_percentage: float | None = None
    work_type: str | None = None

    @field_validator("block_type")
    @classmethod
    def validate_block_type(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = {"residential", "commercial", "mixed", "industrial"}
        if v.lower() not in allowed:
            raise ValueError(f"block_type must be one of: {', '.join(allowed)}")
        return v.lower()

    @field_validator("progress_percentage")
    @classmethod
    def validate_progress(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("progress_percentage must be between 0 and 100")
        return v


class BlockOut(BaseModel):
    id: int
    tid: str
    town_id: int
    name: str
    block_type: str
    description: str | None
    progress_percentage: float
    work_type: str | None
    created_at: datetime
    updated_at: datetime
    plot_count: int = 0
    available_plots: int = 0
    sold_plots: int = 0
    booked_plots: int = 0

    class Config:
        from_attributes = True


# ── Plot ──────────────────────────────────────────────────────────────────────

class PlotCreate(BaseModel):
    block_id: int
    plot_number: str
    size: str | None = None
    size_sqft: Decimal | None = None
    status: str = "available"
    plot_type: str | None = None
    price: Decimal | None = None
    owner_name: str | None = None
    owner_phone: str | None = None
    notes: str | None = None
    property_id: int | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"available", "booked", "sold", "reserved"}
        if v.lower() not in allowed:
            raise ValueError(f"status must be one of: {', '.join(allowed)}")
        return v.lower()


class PlotUpdate(BaseModel):
    plot_number: str | None = None
    size: str | None = None
    size_sqft: Decimal | None = None
    status: str | None = None
    plot_type: str | None = None
    price: Decimal | None = None
    owner_name: str | None = None
    owner_phone: str | None = None
    notes: str | None = None
    property_id: int | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = {"available", "booked", "sold", "reserved"}
        if v.lower() not in allowed:
            raise ValueError(f"status must be one of: {', '.join(allowed)}")
        return v.lower()


class PlotOut(BaseModel):
    id: int
    tid: str
    block_id: int
    plot_number: str
    size: str | None
    size_sqft: Decimal | None
    status: str
    plot_type: str | None
    price: Decimal | None
    owner_name: str | None
    owner_phone: str | None
    notes: str | None
    property_id: int | None
    created_at: datetime
    updated_at: datetime
    block_name: str | None = None
    town_name: str | None = None

    class Config:
        from_attributes = True


# ── Hierarchy (full town with blocks + plots) ─────────────────────────────────

class PlotInBlock(PlotOut):
    pass


class BlockWithPlots(BlockOut):
    plots: list[PlotInBlock] = []

    class Config:
        from_attributes = True


class TownFull(TownOut):
    blocks: list[BlockWithPlots] = []

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# TownUnit — upgraded multi-type property unit schemas
# ═══════════════════════════════════════════════════════════════════════════════

VALID_UNIT_TYPES = {
    "plot", "house", "apartment", "flat", "shop", "office",
    "plaza", "market", "warehouse", "farmhouse", "building",
    "industrial", "other",
}
VALID_CATEGORIES = {"residential", "commercial", "mixed_use", "industrial"}
VALID_STATUSES   = {
    "available", "booked", "sold", "rented",
    "under_construction", "inactive",
}


class TownUnitCreate(BaseModel):
    block_id:    int
    town_id:     int
    unit_number: str
    title:       str | None = None
    description: str | None = None

    unit_type: str = "plot"
    category:  str = "residential"
    status:    str = "available"

    # Location
    street:       str | None = None
    sector:       str | None = None
    floor_number: int | None = None
    size_label:   str | None = None
    size_sqft:    Decimal | None = None
    dimensions:   str | None = None

    # Financial
    total_price:         Decimal | None = None
    booking_amount:      Decimal | None = None
    monthly_installment: Decimal | None = None
    installment_months:  int | None = None
    received_amount:     Decimal = Decimal("0")
    remaining_balance:   Decimal | None = None

    # Ownership
    owner_name:   str | None = None
    owner_phone:  str | None = None
    owner_cnic:   str | None = None
    buyer_name:   str | None = None
    buyer_phone:  str | None = None
    tenant_name:  str | None = None
    tenant_phone: str | None = None

    # Links
    property_id: int | None = None
    plot_id:     int | None = None
    notes:       str | None = None

    @field_validator("unit_type")
    @classmethod
    def validate_unit_type(cls, v: str) -> str:
        if v.lower() not in VALID_UNIT_TYPES:
            raise ValueError(f"unit_type must be one of: {', '.join(sorted(VALID_UNIT_TYPES))}")
        return v.lower()

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v.lower() not in VALID_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
        return v.lower()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v.lower() not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v.lower()


class TownUnitUpdate(BaseModel):
    unit_number: str | None = None
    title:       str | None = None
    description: str | None = None
    unit_type:   str | None = None
    category:    str | None = None
    status:      str | None = None

    street:       str | None = None
    sector:       str | None = None
    floor_number: int | None = None
    size_label:   str | None = None
    size_sqft:    Decimal | None = None
    dimensions:   str | None = None

    total_price:         Decimal | None = None
    booking_amount:      Decimal | None = None
    monthly_installment: Decimal | None = None
    installment_months:  int | None = None
    received_amount:     Decimal | None = None
    remaining_balance:   Decimal | None = None

    owner_name:   str | None = None
    owner_phone:  str | None = None
    owner_cnic:   str | None = None
    buyer_name:   str | None = None
    buyer_phone:  str | None = None
    tenant_name:  str | None = None
    tenant_phone: str | None = None

    property_id: int | None = None
    plot_id:     int | None = None
    notes:       str | None = None

    @field_validator("unit_type")
    @classmethod
    def validate_unit_type(cls, v: str | None) -> str | None:
        if v is not None and v.lower() not in VALID_UNIT_TYPES:
            raise ValueError(f"unit_type must be one of: {', '.join(sorted(VALID_UNIT_TYPES))}")
        return v.lower() if v else v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is not None and v.lower() not in VALID_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
        return v.lower() if v else v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v.lower() not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v.lower() if v else v


class TownUnitOut(BaseModel):
    id:          int
    tid:         str
    unit_number: str
    title:       str | None
    description: str | None
    block_id:    int
    town_id:     int
    unit_type:   str
    category:    str
    status:      str

    street:       str | None
    sector:       str | None
    floor_number: int | None
    size_label:   str | None
    size_sqft:    Decimal | None
    dimensions:   str | None

    total_price:         Decimal | None
    booking_amount:      Decimal | None
    monthly_installment: Decimal | None
    installment_months:  int | None
    received_amount:     Decimal
    remaining_balance:   Decimal | None

    owner_name:   str | None
    owner_phone:  str | None
    owner_cnic:   str | None
    buyer_name:   str | None
    buyer_phone:  str | None
    tenant_name:  str | None
    tenant_phone: str | None

    property_id: int | None
    plot_id:     int | None
    notes:       str | None
    created_at:  datetime
    updated_at:  datetime

    # Computed / enriched
    block_name: str | None = None
    town_name:  str | None = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# TownTransaction schemas
# ═══════════════════════════════════════════════════════════════════════════════

VALID_TRANSACTION_TYPES = {
    "booking", "installment", "sale", "rent",
    "refund", "transfer", "adjustment",
}
VALID_PAYMENT_METHODS = {"cash", "bank", "cheque", "online", "other"}


class TownTransactionCreate(BaseModel):
    town_unit_id:     int | None = None
    town_id:          int | None = None
    block_id:         int | None = None
    transaction_type: str
    amount:           Decimal
    payment_method:   str | None = None
    reference_no:     str | None = None
    description:      str | None = None
    transaction_date: datetime | None = None
    payer_name:       str | None = None
    payer_phone:      str | None = None

    @field_validator("transaction_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v.lower() not in VALID_TRANSACTION_TYPES:
            raise ValueError(f"transaction_type must be one of: {', '.join(sorted(VALID_TRANSACTION_TYPES))}")
        return v.lower()

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class TownTransactionOut(BaseModel):
    id:               int
    tid:              str
    town_unit_id:     int | None
    town_id:          int | None
    block_id:         int | None
    transaction_type: str
    amount:           Decimal
    payment_method:   str | None
    reference_no:     str | None
    description:      str | None
    transaction_date: datetime
    journal_id:       int | None
    payer_name:       str | None
    payer_phone:      str | None
    created_at:       datetime

    # Enriched
    unit_number: str | None = None
    town_name:   str | None = None
    block_name:  str | None = None

    class Config:
        from_attributes = True


# ── Extended TownOut with unit counts ─────────────────────────────────────────

class TownOutExtended(TownOut):
    unit_count: int = 0

    class Config:
        from_attributes = True


# ── Finance summary for a town ────────────────────────────────────────────────

class TownFinanceSummary(BaseModel):
    total_revenue:       Decimal = Decimal("0")
    booking_revenue:     Decimal = Decimal("0")
    installment_revenue: Decimal = Decimal("0")
    sale_revenue:        Decimal = Decimal("0")
    rental_revenue:      Decimal = Decimal("0")
    total_refunds:       Decimal = Decimal("0")
    outstanding_balance: Decimal = Decimal("0")
    transaction_count:   int = 0
