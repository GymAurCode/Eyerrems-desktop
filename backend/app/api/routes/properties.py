import shutil
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.core.table_query import apply_table_filters

from app.api.deps import get_current_user, require_any_permission
from app.core.audit import log_action
from app.core.activity_logger import log_activity
from app.core.config import settings
from app.core.database import get_db
from app.core.tid import next_tid
from app.models.auth import User
from app.core.websocket_manager import ws_manager
from app.models.property import (
    Amenity, Buyer, Contact, ContactDocument, ContactInteraction,
    Floor, Lease, LeaseDocument, LeasePdc, LeasePayment, Location,
    Property, PropertyAttachment, PropertyCategory, PropertyImage,
    PropertySale, Seller, Unit,
)
from app.models.tenant import Tenant
from app.models.master_options import MasterSettingOption
from app.models.finance import Account
from app.schemas.property import (
    AmenityCreate, AmenityOut,
    AttachmentMetaUpdate,
    BuyerCreate, BuyerOut,
    CategoryCreate, CategoryOut,
    ContactCreate, ContactDetail, ContactDocumentOut,
    ContactInteractionCreate, ContactInteractionOut, ContactOut, ContactUpdate,
    FloorCreate, FloorOut,
    LeaseCreate, LeaseDetail, LeaseDocumentOut, LeaseOut,
    LeasePaymentCreate, LeasePaymentOut, LeasePdcCreate, LeasePdcOut,
    LeaseRenewCreate, LeaseTerminateCreate, LeaseUpdate,
    LocationCreate, LocationOut,
    PropertyAttachmentOut, PropertyCreate, PropertyDetail,
    PropertyImageOut, PropertyOut,
    PropertySaleCreate, PropertySaleDetail, PropertySaleOut,
    PropertyUpdate,
    SaleDocumentOut, SaleInstalmentCreate, SaleInstalmentOut,
    SalePaymentCreate, SalePaymentOut, SaleStageHistoryOut, SaleStageUpdate,
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


def _resolve_gl_names(prop: Property, d: dict) -> None:
    """Resolve GL account names from FK ids."""
    if prop.income_gl_account_id:
        acct = prop.income_gl_account
        d["income_gl_account_name"] = acct.name if acct else None
        d["income_gl_account_code"] = acct.code if acct else None
    if prop.expense_gl_account_id:
        acct = prop.expense_gl_account
        d["expense_gl_account_name"] = acct.name if acct else None
        d["expense_gl_account_code"] = acct.code if acct else None
    if prop.asset_gl_account_id:
        acct = prop.asset_gl_account
        d["asset_gl_account_name"] = acct.name if acct else None
        d["asset_gl_account_code"] = acct.code if acct else None

def _prop_out(prop: Property) -> dict:
    d = PropertyOut.model_validate(prop).model_dump()
    d["amenity_ids"] = [a.id for a in prop.amenities]
    d["category_name"] = prop.category_rel.name if prop.category_rel else None
    _resolve_gl_names(prop, d)
    return d


def _prop_detail(prop: Property) -> dict:
    d = PropertyDetail.model_validate(prop).model_dump()
    d["amenity_ids"] = [a.id for a in prop.amenities]
    d["category_name"] = prop.category_rel.name if prop.category_rel else None
    _resolve_gl_names(prop, d)
    return d


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), _=Depends(require_any_permission(*PERM_VIEW))):
    return db.query(PropertyCategory).order_by(PropertyCategory.name).all()


@router.post("/categories", response_model=CategoryOut)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    existing = db.query(PropertyCategory).filter(PropertyCategory.name == payload.name).first()
    if existing:
        raise HTTPException(400, f"Category '{payload.name}' already exists")
    cat = PropertyCategory(name=payload.name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(cat.id), record_label=f"Property Category: {cat.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={"name": cat.name, "id": cat.id},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="category", record_id=cat.id,
        record_label=f"Property Category: {cat.name}",
        new_values={"name": cat.name, "id": cat.id},
    )
    db.commit()
    return cat


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    cat = db.query(PropertyCategory).filter(PropertyCategory.id == category_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    log_action(
        db=db, module="property", action="DELETE",
        record_id=str(category_id), record_label=f"Property Category: {cat.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data={"name": cat.name, "id": cat.id},
    )
    log_activity(
        db=db, user=current_user, action="delete", module="property",
        record_type="category", record_id=category_id,
        record_label=f"Property Category: {cat.name}",
        old_values={"name": cat.name, "id": cat.id},
    )
    db.commit()
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
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    if payload.parent_id:
        if not db.query(Location).filter(Location.id == payload.parent_id).first():
            raise HTTPException(404, "Parent location not found")
    tid = next_tid(db, Location, "LOC")
    loc = Location(tid=tid, **payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(loc.id), record_label=f"Location: {loc.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in loc.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="location", record_id=loc.id,
        record_label=f"Location: {loc.name}",
        new_values={k: str(v) for k, v in loc.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
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
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    existing = db.query(Amenity).filter(Amenity.name == payload.name).first()
    if existing:
        return existing
    a = Amenity(name=payload.name)
    db.add(a)
    db.commit()
    db.refresh(a)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(a.id), record_label=f"Amenity: {a.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={"name": a.name, "id": a.id},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="amenity", record_id=a.id,
        record_label=f"Amenity: {a.name}",
        new_values={"name": a.name, "id": a.id},
    )
    db.commit()
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
    response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    property_type: str | None = None,
    property_status: str | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = (
        db.query(Property)
        .options(
            joinedload(Property.amenities),
            joinedload(Property.category_rel),
            joinedload(Property.income_gl_account),
            joinedload(Property.expense_gl_account),
            joinedload(Property.asset_gl_account),
        )
        .order_by(Property.id.desc())
    )
    if property_type:
        query = query.join(Property.category_rel).filter(PropertyCategory.name == property_type)

    query, total = apply_table_filters(
        query=query,
        model=Property,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Property.name, Property.tid, Property.address, Property.description],
        date_filter=filter,
        date_field=Property.created_at,
        start_date=startDate,
        end_date=endDate,
        property_status=property_status
    )
    response.headers["X-Total-Count"] = str(total)
    props = query.all()
    return [_prop_out(p) for p in props]


@router.post("/", response_model=PropertyOut)
async def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
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
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(prop.id), record_label=f"Property: {prop.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in prop.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="property", record_id=prop.id,
        record_label=f"Property: {prop.name}",
        new_values={k: str(v) for k, v in prop.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
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
            joinedload(Property.income_gl_account),
            joinedload(Property.expense_gl_account),
            joinedload(Property.asset_gl_account),
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
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    prop = (
        db.query(Property)
        .options(joinedload(Property.amenities), joinedload(Property.category_rel))
        .filter(Property.id == property_id)
        .first()
    )
    if not prop:
        raise HTTPException(404, "Property not found")

    old_data = {k: str(v) for k, v in prop.__dict__.items() if not k.startswith('_')}

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
    new_data = {k: str(v) for k, v in prop.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="property", action="UPDATE",
        record_id=str(property_id), record_label=f"Property: {prop.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="property",
        record_type="property", record_id=prop.id,
        record_label=f"Property: {prop.name}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return _prop_out(prop)


@router.delete("/{property_id}", status_code=204)
async def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    old_data = {k: str(v) for k, v in prop.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="property", action="DELETE",
        record_id=str(property_id), record_label=f"Property: {prop.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data,
    )
    log_activity(
        db=db, user=current_user, action="delete", module="property",
        record_type="property", record_id=property_id,
        record_label=f"Property: {prop.name}",
        old_values=old_data,
    )
    db.commit()
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
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    if not db.query(Property).filter(Property.id == payload.property_id).first():
        raise HTTPException(404, "Property not found")
    tid   = next_tid(db, Floor, "FLR")
    floor = Floor(tid=tid, **payload.model_dump())
    db.add(floor)
    db.commit()
    db.refresh(floor)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(floor.id), record_label=f"Floor: {floor.floor_number}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in floor.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="floor", record_id=floor.id,
        record_label=f"Floor: {floor.floor_number}",
        new_values={k: str(v) for k, v in floor.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return floor


@router.delete("/floors/{floor_id}", status_code=204)
def delete_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Floor not found")
    old_data = {k: str(v) for k, v in floor.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="property", action="DELETE",
        record_id=str(floor_id), record_label=f"Floor: {floor.floor_number}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data,
    )
    log_activity(
        db=db, user=current_user, action="delete", module="property",
        record_type="floor", record_id=floor_id,
        record_label=f"Floor: {floor.floor_number}",
        old_values=old_data,
    )
    db.commit()
    db.delete(floor)
    db.commit()


def _unit_out(unit: Unit) -> dict:
    d = UnitOut.model_validate(unit).model_dump()
    # Resolve property name
    if unit.property_id and unit.property:
        d["property_name"] = unit.property.name
    elif unit.floor and unit.floor.property:
        d["property_name"] = unit.floor.property.name
        d["property_id"] = unit.floor.property_id
    return d


@router.get("/units/all", response_model=list[UnitOut])
def list_all_units(
    response: Response,
    property_id: int | None = None,
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = (
        db.query(Unit)
        .join(Floor)
        .options(joinedload(Unit.property), joinedload(Unit.floor).joinedload(Floor.property))
        .order_by(Unit.id)
    )
    if property_id:
        query = query.filter(Floor.property_id == property_id)
    query, total = apply_table_filters(
        query=query,
        model=Unit,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Unit.unit_number, Unit.status, Unit.size, Unit.unit_type, Unit.furnishing_status, Unit.current_tenant_name],
        date_filter=filter,
        date_field=Unit.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    units = query.all()
    return [_unit_out(u) for u in units]


@router.get("/{property_id}/units", response_model=list[UnitOut])
def list_property_units(
    property_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    units = (
        db.query(Unit)
        .join(Floor)
        .options(joinedload(Unit.property), joinedload(Unit.floor).joinedload(Floor.property))
        .filter(Floor.property_id == property_id)
        .order_by(Unit.id)
        .all()
    )
    return [_unit_out(u) for u in units]


@router.post("/units", response_model=UnitOut)
async def create_unit(
    payload: UnitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    floor = db.query(Floor).filter(Floor.id == payload.floor_id).first()
    if not floor:
        raise HTTPException(404, "Floor not found")
    tid   = next_tid(db, Unit, "UNT")
    data  = payload.model_dump()
    # Auto-populate denormalized fields
    if data.get("property_id") is None:
        data["property_id"] = floor.property_id
    if data.get("floor_number") is None:
        data["floor_number"] = floor.floor_number
    unit = Unit(tid=tid, **data)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(unit.id), record_label=f"Unit: {unit.unit_number}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in unit.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="unit", record_id=unit.id,
        record_label=f"Unit: {unit.unit_number}",
        new_values={k: str(v) for k, v in unit.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    await ws_manager.broadcast("dashboard_refresh", {})
    return _unit_out(unit)


@router.patch("/units/{unit_id}", response_model=UnitOut)
async def update_unit(
    unit_id: int,
    payload: UnitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    unit = db.query(Unit).options(joinedload(Unit.property), joinedload(Unit.floor)).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(404, "Unit not found")
    old_data = {k: str(v) for k, v in unit.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(unit, k, v)
    db.commit()
    db.refresh(unit)
    new_data = {k: str(v) for k, v in unit.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="property", action="UPDATE",
        record_id=str(unit_id), record_label=f"Unit: {unit.unit_number}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="property",
        record_type="unit", record_id=unit.id,
        record_label=f"Unit: {unit.unit_number}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    await ws_manager.broadcast("dashboard_refresh", {})
    return _unit_out(unit)


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
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    if not db.query(Property).filter(Property.id == property_id).first():
        raise HTTPException(404, "Property not found")
    rel, fname = _save_upload(file, f"properties/{property_id}/attachments")
    row = PropertyAttachment(
        property_id=property_id, file_path=rel, filename=fname,
        uploaded_by=current_user.email,
    )
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


# ── Document endpoint: upload with metadata ───────────────────────────────────

@router.patch("/attachments/{attachment_id}", response_model=PropertyAttachmentOut)
def update_attachment_meta(
    attachment_id: int,
    payload: AttachmentMetaUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    row = db.query(PropertyAttachment).filter(PropertyAttachment.id == attachment_id).first()
    if not row:
        raise HTTPException(404, "Attachment not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    row = db.query(PropertyAttachment).filter(PropertyAttachment.id == attachment_id).first()
    if not row:
        raise HTTPException(404, "Attachment not found")
    db.delete(row)
    db.commit()


# ── Lease helpers ──────────────────────────────────────────────────────────────

def _lease_out(lease: Lease) -> dict:
    d = LeaseOut.model_validate(lease).model_dump()
    if lease.unit:
        d["unit_number"] = lease.unit.unit_number
        if not d.get("property_id") and lease.unit.floor:
            d["property_id"] = lease.unit.floor.property_id
    if d.get("property_id") and lease.property:
        d["property_name"] = lease.property.name
    elif lease.unit and lease.unit.floor and lease.unit.floor.property:
        d["property_name"] = lease.unit.floor.property.name
    if lease.tenant:
        d["tenant_ref"] = lease.tenant.tenant_id
    return d


def _generate_rent_schedule(lease: Lease) -> list[dict]:
    """Generate a list of payment installments for the full lease period."""
    freq_map = {"monthly": 1, "quarterly": 3, "every_4_months": 4, "bi_annual": 6, "annual": 12}
    step = freq_map.get(lease.payment_frequency or "monthly", 1)
    schedule = []
    current = lease.start_date
    idx = 1
    while current <= lease.end_date:
        schedule.append({
            "instalment_no": idx,
            "due_date": current.isoformat(),
            "amount": float(lease.monthly_rent),
            "status": "upcoming",
        })
        m = current.month + step
        y = current.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        try:
            current = current.replace(year=y, month=m)
        except ValueError:
            break
        idx += 1
    return schedule


def _update_unit_occupancy(unit_id: int, status: str, db: Session) -> None:
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if unit:
        unit.status = status
        db.flush()


# ── Leases ────────────────────────────────────────────────────────────────────

@router.get("/leases/all", response_model=list[LeaseOut])
def list_leases(
    response: Response,
    property_id: int | None = None,
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = (
        db.query(Lease)
        .options(joinedload(Lease.unit), joinedload(Lease.property), joinedload(Lease.tenant))
        .order_by(Lease.start_date.desc())
    )
    if property_id:
        query = query.filter(Lease.property_id == property_id)
    query, total = apply_table_filters(
        query=query,
        model=Lease,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Lease.tenant_name, Lease.status, Lease.notes, Lease.tid],
        date_filter=filter,
        date_field=Lease.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    return [_lease_out(l) for l in query.all()]


@router.get("/leases/{lease_id}", response_model=LeaseDetail)
def get_lease(
    lease_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    lease = (
        db.query(Lease)
        .options(
            joinedload(Lease.unit),
            joinedload(Lease.property),
            joinedload(Lease.tenant),
            joinedload(Lease.payments),
            joinedload(Lease.pdcs),
            joinedload(Lease.documents),
        )
        .filter(Lease.id == lease_id)
        .first()
    )
    if not lease:
        raise HTTPException(404, "Lease not found")
    detail = LeaseDetail.model_validate(lease).model_dump()
    detail.update(_lease_out(lease))
    return detail


@router.post("/leases", response_model=LeaseOut)
async def create_lease(
    payload: LeaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    unit = db.query(Unit).filter(Unit.id == payload.unit_id).first()
    if not unit:
        raise HTTPException(404, "Unit not found")
    if payload.end_date and payload.end_date <= payload.start_date:
        raise HTTPException(400, "end_date must be after start_date")
    if payload.monthly_rent <= 0:
        raise HTTPException(400, "monthly_rent must be positive")

    # Auto-calculate annual rent
    data = payload.model_dump(exclude={"pdcs"})
    if data.get("annual_rent") is None:
        data["annual_rent"] = payload.monthly_rent * 12
    if data.get("property_id") is None:
        data["property_id"] = unit.floor.property_id if unit.floor else None
    if data.get("first_payment_due_date") is None:
        data["first_payment_due_date"] = payload.start_date

    tid   = next_tid(db, Lease, "LEA")
    lease = Lease(tid=tid, **data)
    db.add(lease)
    db.flush()

    # Create PDCs if provided
    for p in payload.pdcs:
        db.add(LeasePdc(lease_id=lease.id, cheque_no=p.cheque_no, amount=p.amount, due_date=p.due_date))

    # Mark unit as occupied
    _update_unit_occupancy(payload.unit_id, "rented", db)

    db.commit()
    db.refresh(lease)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(lease.id), record_label=f"Lease: {lease.tenant_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in lease.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="lease", record_id=lease.id,
        record_label=f"Lease: {lease.tenant_name}",
        new_values={k: str(v) for k, v in lease.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    await ws_manager.broadcast("dashboard_refresh", {})
    return _lease_out(lease)


@router.patch("/leases/{lease_id}", response_model=LeaseOut)
async def update_lease(
    lease_id: int,
    payload: LeaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    lease = db.query(Lease).options(joinedload(Lease.unit), joinedload(Lease.property), joinedload(Lease.tenant)).filter(Lease.id == lease_id).first()
    if not lease:
        raise HTTPException(404, "Lease not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(lease, k, v)
    db.commit()
    db.refresh(lease)
    log_action(
        db=db, module="property", action="UPDATE",
        record_id=str(lease_id), record_label=f"Lease: {lease.tenant_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="property",
        record_type="lease", record_id=lease.id,
        record_label=f"Lease: {lease.tenant_name}",
    )
    db.commit()
    return _lease_out(lease)


# ── Lease Payments ────────────────────────────────────────────────────────────

@router.get("/leases/{lease_id}/payments", response_model=list[LeasePaymentOut])
def list_lease_payments(
    lease_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(LeasePayment).filter(LeasePayment.lease_id == lease_id).order_by(LeasePayment.payment_date).all()


@router.post("/leases/{lease_id}/payments", response_model=LeasePaymentOut)
async def record_lease_payment(
    lease_id: int,
    payload: LeasePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    lease = db.query(Lease).filter(Lease.id == lease_id).first()
    if not lease:
        raise HTTPException(404, "Lease not found")
    tid = next_tid(db, LeasePayment, "LPM")
    pmt = LeasePayment(tid=tid, lease_id=lease_id, **payload.model_dump())
    db.add(pmt)
    db.commit()
    db.refresh(pmt)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(pmt.id), record_label=f"Lease Payment: {pmt.amount}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="lease_payment", record_id=pmt.id,
        record_label=f"Lease Payment: {pmt.amount}",
        new_values={k: str(v) for k, v in pmt.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return pmt


# ── Lease Schedule ────────────────────────────────────────────────────────────

@router.get("/leases/{lease_id}/schedule", response_model=list[dict])
def get_lease_schedule(
    lease_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    lease = db.query(Lease).filter(Lease.id == lease_id).first()
    if not lease:
        raise HTTPException(404, "Lease not found")
    return _generate_rent_schedule(lease)


# ── Lease Renew ───────────────────────────────────────────────────────────────

@router.post("/leases/{lease_id}/renew", response_model=LeaseOut)
async def renew_lease(
    lease_id: int,
    payload: LeaseRenewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    old = db.query(Lease).options(joinedload(Lease.unit), joinedload(Lease.property)).filter(Lease.id == lease_id).first()
    if not old:
        raise HTTPException(404, "Lease not found")
    # Mark old lease as renewed
    old.status = "renewed"
    db.flush()
    # Create new lease from old + new terms
    tid = next_tid(db, Lease, "LEA")
    new_lease = Lease(
        tid=tid,
        property_id=old.property_id,
        unit_id=old.unit_id,
        tenant_name=old.tenant_name,
        tenant_id=old.tenant_id,
        start_date=payload.new_start_date,
        end_date=payload.new_end_date,
        monthly_rent=payload.monthly_rent,
        annual_rent=payload.monthly_rent * 12,
        payment_frequency=payload.payment_frequency,
        security_deposit=payload.security_deposit or old.security_deposit,
        deposit_status=payload.deposit_status or "pending",
        notice_period=payload.notice_period or 30,
        renewed_from_lease_id=lease_id,
        notes=payload.notes,
    )
    db.add(new_lease)
    db.commit()
    db.refresh(new_lease)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(new_lease.id), record_label=f"Lease Renewed: {new_lease.tenant_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="lease", record_id=new_lease.id,
        record_label=f"Lease Renewed: {new_lease.tenant_name}",
        new_values={k: str(v) for k, v in new_lease.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return _lease_out(new_lease)


# ── Lease Terminate ───────────────────────────────────────────────────────────

@router.post("/leases/{lease_id}/terminate", response_model=LeaseOut)
async def terminate_lease(
    lease_id: int,
    payload: LeaseTerminateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    lease = db.query(Lease).options(joinedload(Lease.unit)).filter(Lease.id == lease_id).first()
    if not lease:
        raise HTTPException(404, "Lease not found")
    lease.status = "terminated"
    lease.termination_date = payload.termination_date
    lease.termination_reason = payload.reason
    if payload.notes:
        lease.notes = (lease.notes or "") + f"\n[Terminated] {payload.notes}"
    # Mark unit as available
    _update_unit_occupancy(lease.unit_id, "available", db)
    db.commit()
    db.refresh(lease)
    log_action(
        db=db, module="property", action="UPDATE",
        record_id=str(lease_id), record_label=f"Lease Terminated: {lease.tenant_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="property",
        record_type="lease", record_id=lease.id,
        record_label=f"Lease Terminated: {lease.tenant_name}",
    )
    db.commit()
    return _lease_out(lease)


# ── Lease Documents ───────────────────────────────────────────────────────────

@router.post("/leases/{lease_id}/documents", response_model=LeaseDocumentOut)
async def upload_lease_document(
    lease_id: int,
    file: UploadFile = File(...),
    document_type: str = "lease_agreement",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    if not db.query(Lease).filter(Lease.id == lease_id).first():
        raise HTTPException(404, "Lease not found")
    rel, fname = _save_upload(file, f"leases/{lease_id}/documents")
    doc = LeaseDocument(lease_id=lease_id, file_path=rel, filename=fname, document_type=document_type)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/leases/{lease_id}/documents", response_model=list[LeaseDocumentOut])
def list_lease_documents(
    lease_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(LeaseDocument).filter(LeaseDocument.lease_id == lease_id).order_by(LeaseDocument.id).all()


# ── Contacts (unified buyer/seller) ───────────────────────────────────────────

@router.get("/contacts/all", response_model=list[ContactOut])
def list_contacts(
    response: Response,
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    role: str | None = None,
    kyc_status: str | None = None,
    city: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = db.query(Contact).filter(Contact.archived == False)
    if role == "buyer":
        query = query.filter(Contact.role.like("%buyer%"))
    elif role == "seller":
        query = query.filter(Contact.role.like("%seller%"))
    elif role == "both":
        query = query.filter(Contact.role.like("%both%"))
    elif role:
        query = query.filter(Contact.role.like(f"%{role}%"))
    if kyc_status:
        query = query.filter(Contact.kyc_status == kyc_status)
    if city:
        query = query.filter(Contact.city.ilike(f"%{city}%"))

    query = query.order_by(Contact.created_at.desc())
    query, total = apply_table_filters(
        query=query, model=Contact, limit=limit, offset=offset,
        search=search,
        search_fields=[Contact.name, Contact.cnic, Contact.phone, Contact.email,
                       Contact.company_name, Contact.ntn],
        date_filter=filter, date_field=Contact.created_at,
        start_date=startDate, end_date=endDate,
    )
    # Attach computed sale counts
    contacts = query.all()
    for c in contacts:
        c.sale_count = db.query(PropertySale).filter(
            (PropertySale.seller_contact_id == c.id) | (PropertySale.buyer_contact_id == c.id)
        ).count()
        c.purchase_count = db.query(PropertySale).filter(PropertySale.buyer_contact_id == c.id).count()
        total_val = db.query(func.coalesce(func.sum(PropertySale.sale_price), 0)).filter(
            (PropertySale.buyer_contact_id == c.id) | (PropertySale.seller_contact_id == c.id)
        ).scalar()
        c.total_transaction_value = float(total_val or 0)
    response.headers["X-Total-Count"] = str(total)
    return contacts


@router.post("/contacts", response_model=ContactOut)
async def create_contact(
    payload: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    # Duplicate detection by CNIC or email
    if payload.cnic:
        existing = db.query(Contact).filter(Contact.cnic == payload.cnic).first()
        if existing:
            raise HTTPException(409, f"DUPLICATE_CNIC|{existing.id}|{existing.name}")
    if payload.email:
        existing = db.query(Contact).filter(Contact.email == payload.email).first()
        if existing:
            raise HTTPException(409, f"DUPLICATE_EMAIL|{existing.id}|{existing.name}")

    tid      = next_tid(db, Contact, "CON")
    contact  = Contact(tid=tid, **payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    log_action(db=db, module="property", action="CREATE", record_id=str(contact.id),
               record_label=f"Contact: {contact.name}",
               changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
               new_data={k: str(v) for k, v in contact.__dict__.items() if not k.startswith('_')})
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="contact", record_id=contact.id,
        record_label=f"Contact: {contact.name}",
        new_values={k: str(v) for k, v in contact.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return contact


@router.get("/contacts/{contact_id}", response_model=ContactDetail)
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    # Computed counts
    contact.sale_count = db.query(PropertySale).filter(
        (PropertySale.seller_contact_id == contact_id) | (PropertySale.buyer_contact_id == contact_id)
    ).count()
    contact.purchase_count = db.query(PropertySale).filter(PropertySale.buyer_contact_id == contact_id).count()
    total_val = db.query(func.coalesce(func.sum(PropertySale.sale_price), 0)).filter(
        (PropertySale.buyer_contact_id == contact_id) | (PropertySale.seller_contact_id == contact_id)
    ).scalar()
    contact.total_transaction_value = float(total_val or 0)
    return contact


@router.patch("/contacts/{contact_id}", response_model=ContactOut)
async def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(contact, k, v)
    db.commit()
    db.refresh(contact)
    log_action(db=db, module="property", action="UPDATE", record_id=str(contact.id),
               record_label=f"Contact: {contact.name}",
               changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
               new_data={k: str(v) for k, v in data.items()})
    log_activity(
        db=db, user=current_user, action="update", module="property",
        record_type="contact", record_id=contact.id,
        record_label=f"Contact: {contact.name}",
        new_values={k: str(v) for k, v in data.items()},
    )
    db.commit()
    return contact


@router.post("/contacts/{contact_id}/documents", response_model=ContactDocumentOut)
async def upload_contact_document(
    contact_id: int,
    file: UploadFile = File(...),
    document_type: str = "other",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    file_path, filename = _save_upload(file, "contact_documents")
    doc = ContactDocument(contact_id=contact_id, file_path=file_path,
                          filename=filename, document_type=document_type)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/contacts/{contact_id}/documents", response_model=list[ContactDocumentOut])
def list_contact_documents(
    contact_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(ContactDocument).filter(ContactDocument.contact_id == contact_id).all()


@router.patch("/contacts/{contact_id}/documents/{doc_id}", response_model=ContactDocumentOut)
async def update_contact_document_status(
    contact_id: int, doc_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    doc = db.query(ContactDocument).filter(
        ContactDocument.id == doc_id, ContactDocument.contact_id == contact_id
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if "status" in payload:
        doc.status = payload["status"]
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/contacts/{contact_id}/interactions", response_model=ContactInteractionOut)
async def log_contact_interaction(
    contact_id: int,
    payload: ContactInteractionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    interaction = ContactInteraction(contact_id=contact_id, **payload.model_dump())
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return interaction


@router.get("/contacts/{contact_id}/interactions", response_model=list[ContactInteractionOut])
def list_contact_interactions(
    contact_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(ContactInteraction).filter(
        ContactInteraction.contact_id == contact_id
    ).order_by(ContactInteraction.interaction_date.desc()).all()


@router.get("/contacts/{contact_id}/transactions", response_model=list[PropertySaleOut])
def list_contact_transactions(
    contact_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(PropertySale).filter(
        (PropertySale.buyer_contact_id == contact_id) | (PropertySale.seller_contact_id == contact_id)
    ).order_by(PropertySale.created_at.desc()).all()


@router.post("/contacts/{contact_id}/add-role")
async def add_contact_role(
    contact_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    new_role = payload.get("role", "")
    existing_roles = [r.strip() for r in contact.role.split(",") if r.strip()]
    if new_role not in existing_roles:
        existing_roles.append(new_role)
        contact.role = ",".join(existing_roles)
        db.commit()
        db.refresh(contact)
    return contact


# ── Buyers (legacy) ───────────────────────────────────────────────────────────

@router.get("/buyers/all", response_model=list[BuyerOut])
def list_buyers(
    response: Response,
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = db.query(Buyer).order_by(Buyer.id.desc())
    query, total = apply_table_filters(
        query=query,
        model=Buyer,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Buyer.name, Buyer.email, Buyer.phone, Buyer.address, Buyer.notes],
        date_filter=filter,
        date_field=Buyer.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    return query.all()


@router.post("/buyers", response_model=BuyerOut)
def create_buyer(
    payload: BuyerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    tid   = next_tid(db, Buyer, "BUY")
    buyer = Buyer(tid=tid, **payload.model_dump())
    db.add(buyer)
    db.commit()
    db.refresh(buyer)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(buyer.id), record_label=f"Buyer: {buyer.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in buyer.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="buyer", record_id=buyer.id,
        record_label=f"Buyer: {buyer.name}",
        new_values={k: str(v) for k, v in buyer.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return buyer


# ── Sellers ───────────────────────────────────────────────────────────────────

@router.get("/sellers/all", response_model=list[SellerOut])
def list_sellers(
    response: Response,
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = db.query(Seller).order_by(Seller.id.desc())
    query, total = apply_table_filters(
        query=query,
        model=Seller,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Seller.name, Seller.email, Seller.phone, Seller.address, Seller.notes],
        date_filter=filter,
        date_field=Seller.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    return query.all()


@router.post("/sellers", response_model=SellerOut)
def create_seller(
    payload: SellerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    tid    = next_tid(db, Seller, "SEL")
    seller = Seller(tid=tid, **payload.model_dump())
    db.add(seller)
    db.commit()
    db.refresh(seller)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(seller.id), record_label=f"Seller: {seller.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in seller.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="seller", record_id=seller.id,
        record_label=f"Seller: {seller.name}",
        new_values={k: str(v) for k, v in seller.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return seller


# ── Sales ─────────────────────────────────────────────────────────────────────

@router.get("/sales/all", response_model=list[PropertySaleOut])
def list_sales(
    response: Response,
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    sale_stage: str | None = None,
    property_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = db.query(PropertySale).order_by(PropertySale.created_at.desc())
    if sale_stage:
        query = query.filter(PropertySale.sale_stage == sale_stage)
    if property_id:
        query = query.filter(
            (PropertySale.property_id == property_id) |
            (PropertySale.unit.has(property_id=property_id))
        )
    query, total = apply_table_filters(
        query=query,
        model=PropertySale,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[PropertySale.notes, PropertySale.sale_stage],
        date_filter=filter,
        date_field=PropertySale.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    return query.all()


@router.post("/sales", response_model=PropertySaleOut)
async def create_sale(
    payload: PropertySaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
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
        if payload.property_id:
            floor = db.query(Floor).filter(Floor.id == unit.floor_id).first()
            if floor and floor.property_id != payload.property_id:
                raise HTTPException(400, "Unit does not belong to the selected property")

    tid  = next_tid(db, PropertySale, "SAL")
    data = payload.model_dump(exclude={"instalments"})
    # Ensure agreement_date is set
    if not data.get("agreement_date") and data.get("sale_date"):
        data["agreement_date"] = data["sale_date"]
    if not data.get("sale_date") and data.get("agreement_date"):
        data["sale_date"] = data["agreement_date"]
    # Map sale_stage -> status for backward compat
    data["sale_date"] = data["sale_date"] or data.get("agreement_date") or date.today()
    if not data.get("status"):
        data["status"] = data["sale_stage"]

    sale = PropertySale(tid=tid, **data)
    db.add(sale)
    db.flush()

    # Create instalments if provided
    for inst_data in payload.instalments:
        inst = SaleInstalment(sale_id=sale.id, **inst_data.model_dump())
        db.add(inst)

    # Log initial stage
    history = SaleStageHistory(
        sale_id=sale.id, from_stage=None,
        to_stage=data.get("sale_stage", "enquiry"),
        changed_by=current_user.email,
    )
    db.add(history)

    db.commit()
    db.refresh(sale)
    log_action(
        db=db, module="property", action="CREATE",
        record_id=str(sale.id), record_label=f"Sale: {sale.id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in sale.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="property",
        record_type="sale", record_id=sale.id,
        record_label=f"Sale: {sale.id}",
        new_values={k: str(v) for k, v in sale.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    await ws_manager.broadcast("dashboard_refresh", {})
    return sale


@router.get("/sales/{sale_id}", response_model=PropertySaleDetail)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    sale = db.query(PropertySale).options(
        joinedload(PropertySale.instalments),
        joinedload(PropertySale.stage_history),
        joinedload(PropertySale.documents),
        joinedload(PropertySale.payments),
    ).filter(PropertySale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    return sale


@router.patch("/sales/{sale_id}", response_model=PropertySaleOut)
async def update_sale(
    sale_id: int,
    payload: PropertySaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    sale = db.query(PropertySale).filter(PropertySale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    data = payload.model_dump(exclude={"instalments"}, exclude_unset=True)
    for key, val in data.items():
        setattr(sale, key, val)
    db.commit()
    db.refresh(sale)
    log_action(
        db=db, module="property", action="UPDATE",
        record_id=str(sale.id), record_label=f"Sale: {sale.id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in data.items()},
    )
    log_activity(
        db=db, user=current_user, action="update", module="property",
        record_type="sale", record_id=sale.id,
        record_label=f"Sale: {sale.id}",
        new_values={k: str(v) for k, v in data.items()},
    )
    db.commit()
    return sale


@router.post("/sales/{sale_id}/stage", response_model=PropertySaleDetail)
async def update_sale_stage(
    sale_id: int,
    payload: SaleStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    sale = db.query(PropertySale).options(
        joinedload(PropertySale.instalments),
        joinedload(PropertySale.stage_history),
        joinedload(PropertySale.documents),
        joinedload(PropertySale.payments),
    ).filter(PropertySale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")

    from_stage = sale.sale_stage
    sale.sale_stage = payload.stage
    sale.status = payload.stage

    history = SaleStageHistory(
        sale_id=sale.id,
        from_stage=from_stage,
        to_stage=payload.stage,
        changed_by=payload.changed_by or current_user.email,
    )
    db.add(history)
    db.commit()
    db.refresh(sale)

    log_action(
        db=db, module="property", action="STAGE_CHANGE",
        record_id=str(sale.id), record_label=f"Sale: {sale.id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={"from_stage": from_stage, "to_stage": payload.stage},
    )
    log_activity(
        db=db, user=current_user, action="update", module="property",
        record_type="sale", record_id=sale.id,
        record_label=f"Sale: {sale.id}",
        new_values={"from_stage": from_stage, "to_stage": payload.stage},
    )
    db.commit()
    return sale


@router.post("/sales/{sale_id}/instalments", response_model=list[SaleInstalmentOut])
async def create_sale_instalments(
    sale_id: int,
    payload: list[SaleInstalmentCreate],
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    sale = db.query(PropertySale).filter(PropertySale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    # Delete existing instalments
    db.query(SaleInstalment).filter(SaleInstalment.sale_id == sale_id).delete()
    instalments = []
    for inst_data in payload:
        inst = SaleInstalment(sale_id=sale_id, **inst_data.model_dump())
        db.add(inst)
        instalments.append(inst)
    db.commit()
    return instalments


@router.post("/sales/{sale_id}/payments", response_model=SalePaymentOut)
async def record_sale_payment(
    sale_id: int,
    payload: SalePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    sale = db.query(PropertySale).filter(PropertySale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    payment = SalePayment(sale_id=sale_id, **payload.model_dump())
    db.add(payment)
    # Mark instalment as paid if linked
    if payload.instalment_id:
        inst = db.query(SaleInstalment).filter(SaleInstalment.id == payload.instalment_id).first()
        if inst:
            inst.status = "paid"
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/sales/{sale_id}/cancel", response_model=PropertySaleDetail)
async def cancel_sale(
    sale_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    sale = db.query(PropertySale).options(
        joinedload(PropertySale.instalments),
        joinedload(PropertySale.stage_history),
        joinedload(PropertySale.documents),
        joinedload(PropertySale.payments),
    ).filter(PropertySale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    reason = payload.get("reason", "")
    sale.sale_stage = "cancelled"
    sale.status = "cancelled"
    sale.cancellation_reason = reason
    # Restore property/unit to available
    if sale.unit:
        sale.unit.status = "available"
    if sale.property:
        sale.property.listing_status = "available"
    history = SaleStageHistory(
        sale_id=sale.id,
        from_stage=sale.sale_stage,
        to_stage="cancelled",
        changed_by=current_user.email,
    )
    db.add(history)
    db.commit()
    db.refresh(sale)
    return sale


@router.post("/sales/{sale_id}/complete", response_model=PropertySaleDetail)
async def complete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    sale = db.query(PropertySale).options(
        joinedload(PropertySale.instalments),
        joinedload(PropertySale.stage_history),
        joinedload(PropertySale.documents),
        joinedload(PropertySale.payments),
    ).filter(PropertySale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    sale.sale_stage = "completed"
    sale.status = "completed"
    # Update property/unit listing status to Sold
    if sale.unit:
        sale.unit.status = "sold"
    if sale.property:
        sale.property.listing_status = "Sold"
        sale.property.operational_status = "Sold / Transferred"
    history = SaleStageHistory(
        sale_id=sale.id,
        from_stage=sale.sale_stage,
        to_stage="completed",
        changed_by=current_user.email,
    )
    db.add(history)
    db.commit()
    db.refresh(sale)
    return sale


@router.post("/sales/{sale_id}/documents", response_model=SaleDocumentOut)
async def upload_sale_document(
    sale_id: int,
    file: UploadFile = File(...),
    document_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    sale = db.query(PropertySale).filter(PropertySale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Sale not found")
    file_path, filename = _save_upload(file, "sale_documents")
    doc = SaleDocument(sale_id=sale_id, file_path=file_path, filename=filename, document_type=document_type)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/sales/{sale_id}/documents", response_model=list[SaleDocumentOut])
def list_sale_documents(
    sale_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(SaleDocument).filter(SaleDocument.sale_id == sale_id).all()


@router.get("/sales/{sale_id}/instalments", response_model=list[SaleInstalmentOut])
def list_sale_instalments(
    sale_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(SaleInstalment).filter(SaleInstalment.sale_id == sale_id).all()
