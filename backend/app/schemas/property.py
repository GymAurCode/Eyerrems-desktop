from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


# ── Property Category ─────────────────────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str


class CategoryOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Location ──────────────────────────────────────────────────────────────────
class LocationCreate(BaseModel):
    name: str
    parent_id: int | None = None


class LocationOut(BaseModel):
    id: int
    tid: str
    name: str
    parent_id: int | None
    has_children: bool = False

    class Config:
        from_attributes = True


# ── Amenity ───────────────────────────────────────────────────────────────────
class AmenityCreate(BaseModel):
    name: str


class AmenityOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# ── Property ──────────────────────────────────────────────────────────────────
class PropertyCreate(BaseModel):
    tid: str | None = None            # user-editable; backend generates if omitted
    name: str | None = None           # defaults to TID
    address: str | None = None
    description: str | None = None
    property_type_option_id: int | None = None
    status: str = "available"
    category_id: int | None = None    # FK to property_categories
    size: str | None = None
    for_sale: bool = False
    sale_price: Decimal | None = None
    dealer_id: int | None = None
    year_built: int | None = None
    location_id: int | None = None
    amenity_ids: list[int] = []


class PropertyUpdate(BaseModel):
    tid: str | None = None
    name: str | None = None
    address: str | None = None
    description: str | None = None
    property_type_option_id: int | None = None
    status: str | None = None
    category_id: int | None = None
    size: str | None = None
    for_sale: bool | None = None
    sale_price: Decimal | None = None
    dealer_id: int | None = None
    year_built: int | None = None
    location_id: int | None = None
    amenity_ids: list[int] | None = None


class PropertyOut(BaseModel):
    id: int
    tid: str
    name: str
    address: str | None
    description: str | None
    property_type_option_id: int | None
    status: str
    category_id: int | None
    category_name: str | None = None   # resolved from FK for display
    size: str | None
    for_sale: bool
    sale_price: Decimal | None
    dealer_id: int | None
    year_built: int | None
    location_id: int | None
    created_at: datetime
    amenity_ids: list[int] = []

    class Config:
        from_attributes = True


# ── Floor ─────────────────────────────────────────────────────────────────────
class FloorCreate(BaseModel):
    property_id: int
    floor_number: int


class FloorOut(BaseModel):
    id: int
    tid: str
    property_id: int
    floor_number: int

    class Config:
        from_attributes = True


# ── Unit ──────────────────────────────────────────────────────────────────────
class UnitCreate(BaseModel):
    floor_id: int
    unit_number: str
    status: str = "available"
    unit_type_option_id: int | None = None
    size: str | None = None
    rent_amount: Decimal | None = None
    sale_price: Decimal | None = None


class UnitUpdate(BaseModel):
    status: str | None = None
    size: str | None = None
    rent_amount: Decimal | None = None
    sale_price: Decimal | None = None
    unit_type_option_id: int | None = None


class UnitOut(BaseModel):
    id: int
    tid: str
    floor_id: int
    unit_number: str
    status: str
    unit_type_option_id: int | None
    size: str | None
    rent_amount: Decimal | None
    sale_price: Decimal | None

    class Config:
        from_attributes = True


# ── Lease ─────────────────────────────────────────────────────────────────────
class LeaseCreate(BaseModel):
    unit_id: int
    tenant_name: str | None = None
    start_date: date
    end_date: date | None = None
    monthly_rent: Decimal
    status: str = "active"
    notes: str | None = None


class LeaseOut(BaseModel):
    id: int
    tid: str
    unit_id: int
    tenant_name: str | None
    start_date: date
    end_date: date | None
    monthly_rent: Decimal
    status: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Buyer ─────────────────────────────────────────────────────────────────────
class BuyerCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class BuyerOut(BaseModel):
    id: int
    tid: str
    name: str
    email: str | None
    phone: str | None
    address: str | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Seller ────────────────────────────────────────────────────────────────────
class SellerCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class SellerOut(BaseModel):
    id: int
    tid: str
    name: str
    email: str | None
    phone: str | None
    address: str | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Property Sale ─────────────────────────────────────────────────────────────
class PropertySaleCreate(BaseModel):
    property_id: int | None = None
    unit_id: int | None = None
    buyer_id: int
    seller_id: int
    sale_price: Decimal
    sale_date: date
    status: str = "pending"
    notes: str | None = None


class PropertySaleOut(BaseModel):
    id: int
    tid: str
    property_id: int | None
    unit_id: int | None
    buyer_id: int
    seller_id: int
    sale_price: Decimal
    sale_date: date
    status: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Image / Attachment ────────────────────────────────────────────────────────
class PropertyImageOut(BaseModel):
    id: int
    property_id: int
    file_path: str
    sort_order: int

    class Config:
        from_attributes = True


class PropertyAttachmentOut(BaseModel):
    id: int
    property_id: int
    file_path: str
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Detail (full property with nested data) ───────────────────────────────────
class UnitInFloor(UnitOut):
    pass


class FloorWithUnits(FloorOut):
    units: list[UnitInFloor] = []

    class Config:
        from_attributes = True


class PropertyDetail(PropertyOut):
    floors: list[FloorWithUnits] = []
    images: list[PropertyImageOut] = []
    attachments: list[PropertyAttachmentOut] = []

    class Config:
        from_attributes = True
