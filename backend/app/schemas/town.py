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
