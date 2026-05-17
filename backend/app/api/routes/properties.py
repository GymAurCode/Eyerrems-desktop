import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_any_permission
from app.core.config import settings
from app.core.database import get_db
from app.core.tid import next_tid
from app.core.websocket_manager import ws_manager
from app.models.property import (
    Amenity, Buyer, Floor, Lease, Location,
    Property, PropertyAttachment, PropertyCategory, PropertyImage,
    PropertySale, Seller, Unit,
)
from app.models.master_options import MasterSettingOption
from app.schemas.property import (
    AmenityCreate, AmenityOut,
    BuyerCreate, BuyerOut,
    CategoryCreate, CategoryOut,
    FloorCreate, FloorOut,
    LeaseCreate, LeaseOut,
    LocationCreate, LocationOut,
    PropertyAttachmentOut, PropertyCreate, PropertyDetail,
    PropertyImageOut, PropertyOut, PropertySaleCreate,
    PropertySaleOut, PropertyUpdate,
    SellerCreate, SellerOut,
    UnitCreate, UnitOut, UnitUpdate,
)

router = APIRouter()

PERM_VIEW   = ("properties:manage", "properties:view")
PERM_MANAGE = ("properties:manage",)


# ── helpers ───────────────────────────────────────────────────────────────────

def _save_upload(file: UploadFile, sub: str) -> tuple[str, str]:
    """Save uploaded file, return (relative_path, original_filename)."""
    base = Path(settings.upload_dir) / sub
    base.mkdir(parents=True, exist_ok=True)
    ext  = Path(file.filename or "file").suffix or ".bin"
    name = f"{uuid.uuid4().hex}{ext}"
    dest = base / name
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return f"{sub}/{name}", file.filename or name


def _prop_out(prop: Property) -> dict:
    d = PropertyOut.model_validate(prop).model_dump()
    d["amenity_ids"] = [a.id for a in prop.amenities]
    d["category_name"] = prop.category_rel.name if prop.category_rel else None
    return d


def _prop_detail(prop: Property) -> dict:
    d = PropertyDetail.model_validate(prop).model_dump()
    d["amenity_ids"] = [a.id for a in prop.amenities]
    d["category_name"] = prop.category_rel.name if prop.category_rel else None
    return d


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), _=Depends(require_any_permission(*PERM_VIEW))):
    return db.query(PropertyCategory).order_by(PropertyCategory.name).all()


@router.post("/categories", response_model=CategoryOut)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    existing = db.query(PropertyCategory).filter(PropertyCategory.name == payload.name).first()
    if existing:
        raise HTTPException(400, f"Category '{payload.name}' already exists")
    cat = PropertyCategory(name=payload.name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    cat = db.query(PropertyCategory).filter(PropertyCategory.id == category_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    db.delete(cat)
    db.commit()


# ── Locations ─────────────────────────────────────────────────────────────────

@router.get("/locations", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db), _=Depends(require_any_permission(*PERM_VIEW))):
    rows = db.query(Location).order_by(Location.name).all()
    result = []
    for r in rows:
        out = LocationOut.model_validate(r)
        out.has_children = len(r.children) > 0
        result.append(out)
    return result


@router.post("/locations", response_model=LocationOut)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if payload.parent_id:
        if not db.query(Location).filter(Location.id == payload.parent_id).first():
            raise HTTPException(404, "Parent location not found")
    tid = next_tid(db, Location, "LOC")
    loc = Location(tid=tid, **payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    out = LocationOut.model_validate(loc)
    out.has_children = False
    return out


# ── Amenities ─────────────────────────────────────────────────────────────────

@router.get("/amenities", response_model=list[AmenityOut])
def list_amenities(db: Session = Depends(get_db), _=Depends(require_any_permission(*PERM_VIEW))):
    return db.query(Amenity).order_by(Amenity.name).all()


@router.post("/amenities", response_model=AmenityOut)
def create_amenity(
    payload: AmenityCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    existing = db.query(Amenity).filter(Amenity.name == payload.name).first()
    if existing:
        return existing
    a = Amenity(name=payload.name)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


# ── Properties ────────────────────────────────────────────────────────────────

@router.get("/preview-tid", response_model=dict)
def preview_tid(db: Session = Depends(get_db), _=Depends(require_any_permission(*PERM_VIEW))):
    """Return the TID that will be assigned to the next property."""
    return {"tid": next_tid(db, Property, "PRO")}


@router.get("/check-tid", response_model=dict)
def check_tid(
    tid: str,
    exclude_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    """Check if a TID is already taken. Returns {available: bool}."""
    q = db.query(Property).filter(Property.tid == tid)
    if exclude_id:
        q = q.filter(Property.id != exclude_id)
    return {"available": q.first() is None}


@router.get("/", response_model=list[PropertyOut])
def list_properties(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    props = (
        db.query(Property)
        .options(joinedload(Property.amenities), joinedload(Property.category_rel))
        .order_by(Property.id.desc())
        .all()
    )
    return [_prop_out(p) for p in props]


@router.post("/", response_model=PropertyOut)
async def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if payload.for_sale and payload.sale_price is None:
        raise HTTPException(400, "sale_price is required when for_sale is true")
    if payload.location_id:
        loc = db.query(Location).filter(Location.id == payload.location_id).first()
        if not loc:
            raise HTTPException(404, "Location not found")
        if len(loc.children) > 0:
            raise HTTPException(400, "Only leaf locations (no children) can be selected")

    # Resolve TID — use user-supplied or auto-generate
    tid = payload.tid.strip() if payload.tid and payload.tid.strip() else next_tid(db, Property, "PRO")
    # Enforce uniqueness
    if db.query(Property).filter(Property.tid == tid).first():
        raise HTTPException(400, f"TID '{tid}' is already in use")

    amenity_ids = payload.amenity_ids
    data = payload.model_dump(exclude={"amenity_ids", "tid"})
    if not data.get("name"):
        data["name"] = tid
    prop = Property(tid=tid, **data)

    if amenity_ids:
        amenities = db.query(Amenity).filter(Amenity.id.in_(amenity_ids)).all()
        prop.amenities = amenities

    db.add(prop)
    db.commit()
    db.refresh(prop)
    await ws_manager.broadcast("dashboard_refresh", {})
    return _prop_out(prop)


@router.get("/{property_id}", response_model=PropertyDetail)
def get_property(
    property_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    prop = (
        db.query(Property)
        .options(
            joinedload(Property.floors).joinedload(Floor.units),
            joinedload(Property.images),
            joinedload(Property.attachments),
            joinedload(Property.amenities),
            joinedload(Property.category_rel),
        )
        .filter(Property.id == property_id)
        .first()
    )
    if not prop:
        raise HTTPException(404, "Property not found")
    return _prop_detail(prop)


@router.patch("/{property_id}", response_model=PropertyOut)
async def update_property(
    property_id: int,
    payload: PropertyUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    prop = (
        db.query(Property)
        .options(joinedload(Property.amenities), joinedload(Property.category_rel))
        .filter(Property.id == property_id)
        .first()
    )
    if not prop:
        raise HTTPException(404, "Property not found")

    # TID uniqueness check if changing
    if payload.tid and payload.tid != prop.tid:
        if db.query(Property).filter(Property.tid == payload.tid, Property.id != property_id).first():
            raise HTTPException(400, f"TID '{payload.tid}' is already in use")

    data = payload.model_dump(exclude_none=True, exclude={"amenity_ids"})
    for k, v in data.items():
        setattr(prop, k, v)

    if payload.amenity_ids is not None:
        prop.amenities = db.query(Amenity).filter(Amenity.id.in_(payload.amenity_ids)).all()

    if prop.for_sale and prop.sale_price is None:
        raise HTTPException(400, "sale_price is required when for_sale is true")

    db.commit()
    db.refresh(prop)
    return _prop_out(prop)


@router.delete("/{property_id}", status_code=204)
async def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    db.delete(prop)
    db.commit()
    await ws_manager.broadcast("dashboard_refresh", {})


# ── Floors ────────────────────────────────────────────────────────────────────

@router.get("/{property_id}/floors", response_model=list[FloorOut])
def list_floors(
    property_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(Floor).filter(Floor.property_id == property_id).order_by(Floor.floor_number).all()


@router.post("/floors", response_model=FloorOut)
async def create_floor(
    payload: FloorCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if not db.query(Property).filter(Property.id == payload.property_id).first():
        raise HTTPException(404, "Property not found")
    tid   = next_tid(db, Floor, "FLR")
    floor = Floor(tid=tid, **payload.model_dump())
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return floor


@router.delete("/floors/{floor_id}", status_code=204)
def delete_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Floor not found")
    db.delete(floor)
    db.commit()


@router.get("/units/all", response_model=list[UnitOut])
def list_all_units(
    property_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    q = db.query(Unit).join(Floor)
    if property_id:
        q = q.filter(Floor.property_id == property_id)
    return q.order_by(Unit.id).all()


@router.get("/{property_id}/units", response_model=list[UnitOut])
def list_property_units(
    property_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return (
        db.query(Unit)
        .join(Floor)
        .filter(Floor.property_id == property_id)
        .order_by(Unit.id)
        .all()
    )


@router.post("/units", response_model=UnitOut)
async def create_unit(
    payload: UnitCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if not db.query(Floor).filter(Floor.id == payload.floor_id).first():
        raise HTTPException(404, "Floor not found")
    tid  = next_tid(db, Unit, "UNT")
    unit = Unit(tid=tid, **payload.model_dump())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    await ws_manager.broadcast("dashboard_refresh", {})
    return unit


@router.patch("/units/{unit_id}", response_model=UnitOut)
async def update_unit(
    unit_id: int,
    payload: UnitUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(404, "Unit not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(unit, k, v)
    db.commit()
    db.refresh(unit)
    await ws_manager.broadcast("dashboard_refresh", {})
    return unit


# ── Images ────────────────────────────────────────────────────────────────────

@router.post("/{property_id}/images", response_model=PropertyImageOut)
async def upload_image(
    property_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if not db.query(Property).filter(Property.id == property_id).first():
        raise HTTPException(404, "Property not found")
    rel, _ = _save_upload(file, f"properties/{property_id}/images")
    row = PropertyImage(property_id=property_id, file_path=rel, sort_order=0)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{property_id}/images", response_model=list[PropertyImageOut])
def list_images(
    property_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return (
        db.query(PropertyImage)
        .filter(PropertyImage.property_id == property_id)
        .order_by(PropertyImage.sort_order, PropertyImage.id)
        .all()
    )


# ── Attachments ───────────────────────────────────────────────────────────────

@router.post("/{property_id}/attachments", response_model=PropertyAttachmentOut)
async def upload_attachment(
    property_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if not db.query(Property).filter(Property.id == property_id).first():
        raise HTTPException(404, "Property not found")
    rel, fname = _save_upload(file, f"properties/{property_id}/attachments")
    row = PropertyAttachment(property_id=property_id, file_path=rel, filename=fname)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{property_id}/attachments", response_model=list[PropertyAttachmentOut])
def list_attachments(
    property_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return (
        db.query(PropertyAttachment)
        .filter(PropertyAttachment.property_id == property_id)
        .order_by(PropertyAttachment.id)
        .all()
    )


# ── Leases ────────────────────────────────────────────────────────────────────

@router.get("/leases/all", response_model=list[LeaseOut])
def list_leases(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(Lease).order_by(Lease.start_date.desc()).all()


@router.post("/leases", response_model=LeaseOut)
async def create_lease(
    payload: LeaseCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if not db.query(Unit).filter(Unit.id == payload.unit_id).first():
        raise HTTPException(404, "Unit not found")
    if payload.end_date and payload.end_date <= payload.start_date:
        raise HTTPException(400, "end_date must be after start_date")
    tid   = next_tid(db, Lease, "LEA")
    lease = Lease(tid=tid, **payload.model_dump())
    db.add(lease)
    db.commit()
    db.refresh(lease)
    return lease


# ── Buyers ────────────────────────────────────────────────────────────────────

@router.get("/buyers/all", response_model=list[BuyerOut])
def list_buyers(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(Buyer).order_by(Buyer.id.desc()).all()


@router.post("/buyers", response_model=BuyerOut)
def create_buyer(
    payload: BuyerCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    tid   = next_tid(db, Buyer, "BUY")
    buyer = Buyer(tid=tid, **payload.model_dump())
    db.add(buyer)
    db.commit()
    db.refresh(buyer)
    return buyer


# ── Sellers ───────────────────────────────────────────────────────────────────

@router.get("/sellers/all", response_model=list[SellerOut])
def list_sellers(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(Seller).order_by(Seller.id.desc()).all()


@router.post("/sellers", response_model=SellerOut)
def create_seller(
    payload: SellerCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    tid    = next_tid(db, Seller, "SEL")
    seller = Seller(tid=tid, **payload.model_dump())
    db.add(seller)
    db.commit()
    db.refresh(seller)
    return seller


# ── Sales ─────────────────────────────────────────────────────────────────────

@router.get("/sales/all", response_model=list[PropertySaleOut])
def list_sales(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(PropertySale).order_by(PropertySale.sale_date.desc()).all()


@router.post("/sales", response_model=PropertySaleOut)
async def create_sale(
    payload: PropertySaleCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if not payload.property_id and not payload.unit_id:
        raise HTTPException(400, "Either property_id or unit_id is required")
    if not db.query(Buyer).filter(Buyer.id == payload.buyer_id).first():
        raise HTTPException(404, "Buyer not found")
    if not db.query(Seller).filter(Seller.id == payload.seller_id).first():
        raise HTTPException(404, "Seller not found")
    if payload.unit_id:
        unit = db.query(Unit).filter(Unit.id == payload.unit_id).first()
        if not unit:
            raise HTTPException(404, "Unit not found")
        # Validate unit belongs to property if both given
        if payload.property_id:
            floor = db.query(Floor).filter(Floor.id == unit.floor_id).first()
            if floor and floor.property_id != payload.property_id:
                raise HTTPException(400, "Unit does not belong to the selected property")

    tid  = next_tid(db, PropertySale, "SAL")
    sale = PropertySale(tid=tid, **payload.model_dump())
    db.add(sale)
    db.commit()
    db.refresh(sale)
    await ws_manager.broadcast("dashboard_refresh", {})
    return sale
