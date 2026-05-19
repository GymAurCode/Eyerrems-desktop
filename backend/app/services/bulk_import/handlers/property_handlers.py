"""Property and inventory import handlers."""
from decimal import Decimal

from app.core.tid import next_tid
from app.models.property import Property, PropertyCategory, Unit, Floor
from app.models.town import Town, Block, TownUnit, UNIT_STATUSES, UNIT_TYPES, UNIT_CATEGORIES
from app.services.bulk_import.types import ColumnDef, ImportContext, ImportModuleHandler, RowImportResult, RowValidationResult
from app.services.bulk_import.handlers.base import base_validate
from app.services.bulk_import import validator as v


PROPERTY_COLUMNS = [
    ColumnDef("property_code", "Property Code", sample="PRO-0001", hint="Leave blank to auto-generate"),
    ColumnDef("name", "Name", required=True, sample="Sunset Villa"),
    ColumnDef("type", "Type", sample="Residential"),
    ColumnDef("category", "Category", sample="House"),
    ColumnDef("address", "Address", sample="DHA Phase 6"),
    ColumnDef("size", "Size", sample="10 Marla"),
    ColumnDef("price", "Price", sample="15000000"),
    ColumnDef("status", "Status", sample="available", enum_values=["available", "sold", "rented", "reserved"]),
    ColumnDef("for_sale", "For Sale", sample="true", hint="true or false"),
]

INVENTORY_COLUMNS = [
    ColumnDef("property_code", "Property Code", required=True, sample="PRO-0001"),
    ColumnDef("unit_number", "Unit Number", required=True, sample="101"),
    ColumnDef("floor_number", "Floor Number", sample="1"),
    ColumnDef("size", "Size", sample="1200 sqft"),
    ColumnDef("rent", "Rent", sample="50000"),
    ColumnDef("status", "Status", sample="available"),
]


def validate_property(row, ctx, row_number: int) -> RowValidationResult:
    price, err = v.parse_decimal(v.opt_str(row, "price"), "price")
    extra = [err, v.validate_enum(v.opt_str(row, "status") or "available",
                                   {"available", "sold", "rented", "reserved"}, "status")]
    dup = v.opt_str(row, "property_code") or None
    return base_validate(row, ctx, row_number, [("name", "Name")], dup, extra)


def import_property(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    code = v.opt_str(row, "property_code")
    existing = db.query(Property).filter(Property.tid == code).first() if code else None
    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Skipped", "property", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Duplicate property code")
        existing.name = v.opt_str(row, "name") or existing.name
        existing.status = v.opt_str(row, "status") or existing.status
        db.flush()
        return RowImportResult(True, "updated", "Updated", "property", existing.id)

    tid = code or next_tid(db, Property, "PRO")
    if db.query(Property).filter(Property.tid == tid).first():
        return RowImportResult(False, "failed", f"Property code {tid} already exists")

    price, _ = v.parse_decimal(v.opt_str(row, "price"), "price")
    for_sale = (v.opt_str(row, "for_sale") or "").lower() in ("true", "1", "yes")

    cat_name = v.opt_str(row, "category")
    category_id = None
    if cat_name:
        cat = db.query(PropertyCategory).filter(PropertyCategory.name.ilike(cat_name)).first()
        if cat:
            category_id = cat.id

    prop = Property(
        tid=tid,
        name=v.opt_str(row, "name") or tid,
        address=v.opt_str(row, "address"),
        category=cat_name,
        category_id=category_id,
        size=v.opt_str(row, "size"),
        status=v.opt_str(row, "status") or "available",
        for_sale=for_sale,
        sale_price=price if for_sale else None,
    )
    db.add(prop)
    db.flush()
    return RowImportResult(True, "created", "Property created", "property", prop.id)


def validate_inventory(row, ctx, row_number: int) -> RowValidationResult:
    dup = f"{v.opt_str(row, 'property_code')}:{v.opt_str(row, 'unit_number')}"
    extra = []
    prop_code = v.opt_str(row, "property_code")
    if prop_code and not ctx.db.query(Property).filter(Property.tid == prop_code).first():
        extra.append(f"Property '{prop_code}' not found — import properties first")
    return base_validate(row, ctx, row_number, [
        ("property_code", "Property Code"), ("unit_number", "Unit Number"),
    ], dup, extra)


def import_inventory(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    prop = db.query(Property).filter(Property.tid == v.opt_str(row, "property_code")).first()
    if not prop:
        return RowImportResult(False, "failed", "Property not found")

    floor_num, _ = v.parse_int(v.opt_str(row, "floor_number"), "floor_number")
    floor_num = floor_num or 1
    floor = db.query(Floor).filter(Floor.property_id == prop.id, Floor.floor_number == floor_num).first()
    if not floor:
        floor = Floor(tid=next_tid(db, Floor, "FLR"), property_id=prop.id, floor_number=floor_num)
        db.add(floor)
        db.flush()

    unit_no = v.opt_str(row, "unit_number") or ""
    existing = db.query(Unit).filter(Unit.floor_id == floor.id, Unit.unit_number == unit_no).first()
    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Skipped", "unit", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Unit exists")
        existing.status = v.opt_str(row, "status") or existing.status
        db.flush()
        return RowImportResult(True, "updated", "Unit updated", "unit", existing.id)

    rent, _ = v.parse_decimal(v.opt_str(row, "rent"), "rent")
    unit = Unit(
        tid=next_tid(db, Unit, "UNT"),
        floor_id=floor.id,
        unit_number=unit_no,
        size=v.opt_str(row, "size"),
        rent_amount=rent,
        status=v.opt_str(row, "status") or "available",
    )
    db.add(unit)
    db.flush()
    return RowImportResult(True, "created", "Unit created", "unit", unit.id)


TOWN_COLUMNS = [
    ColumnDef("name", "Name", required=True, sample="Green Valley"),
    ColumnDef("location", "Location", sample="Islamabad"),
    ColumnDef("description", "Description", sample="Premium housing society"),
]

BLOCK_COLUMNS = [
    ColumnDef("town_name", "Town Name", required=True, sample="Green Valley"),
    ColumnDef("block_name", "Block Name", required=True, sample="Block A"),
    ColumnDef("block_type", "Block Type", sample="residential", enum_values=["residential", "commercial", "mixed", "industrial"]),
    ColumnDef("description", "Description", sample="Phase 1"),
]

UNIT_COLUMNS = [
    ColumnDef("town_name", "Town Name", required=True, sample="Green Valley"),
    ColumnDef("block_name", "Block Name", required=True, sample="Block A"),
    ColumnDef("unit_number", "Unit Number", required=True, sample="P-101"),
    ColumnDef("unit_type", "Unit Type", sample="plot", enum_values=sorted(UNIT_TYPES)),
    ColumnDef("category", "Category", sample="residential", enum_values=sorted(UNIT_CATEGORIES)),
    ColumnDef("size_label", "Size", sample="5 Marla"),
    ColumnDef("total_price", "Total Price", sample="5000000"),
    ColumnDef("status", "Status", sample="available", enum_values=sorted(UNIT_STATUSES)),
]


def _town_q(db, company_id, name: str):
    q = db.query(Town).filter(Town.name.ilike(name.strip()))
    if company_id is not None:
        q = q.filter(Town.company_id == company_id)
    return q.first()


def validate_town(row, ctx, row_number: int) -> RowValidationResult:
    dup = (v.opt_str(row, "name") or "").lower()
    return base_validate(row, ctx, row_number, [("name", "Name")], dup)


def import_town(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    name = v.opt_str(row, "name") or ""
    existing = _town_q(db, ctx.company_id, name)
    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Skipped", "town", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Town exists")
        existing.location = v.opt_str(row, "location") or existing.location
        db.flush()
        return RowImportResult(True, "updated", "Updated", "town", existing.id)
    town = Town(tid=next_tid(db, Town, "TWN"), name=name,
                location=v.opt_str(row, "location"), description=v.opt_str(row, "description"),
                company_id=ctx.company_id)
    db.add(town)
    db.flush()
    return RowImportResult(True, "created", "Town created", "town", town.id)


def validate_block(row, ctx, row_number: int) -> RowValidationResult:
    extra = []
    tname = v.opt_str(row, "town_name")
    if tname and not _town_q(ctx.db, ctx.company_id, tname):
        extra.append(f"Town '{tname}' not found")
    dup = f"{(tname or '').lower()}:{(v.opt_str(row, 'block_name') or '').lower()}"
    return base_validate(row, ctx, row_number, [("town_name", "Town Name"), ("block_name", "Block Name")], dup, extra)


def import_block(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    town = _town_q(db, ctx.company_id, v.opt_str(row, "town_name") or "")
    if not town:
        return RowImportResult(False, "failed", "Town not found")
    bname = v.opt_str(row, "block_name") or ""
    existing = db.query(Block).filter(Block.town_id == town.id, Block.name.ilike(bname)).first()
    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Skipped", "block", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Block exists")
        db.flush()
        return RowImportResult(True, "updated", "Updated", "block", existing.id)
    block = Block(tid=next_tid(db, Block, "BLK"), town_id=town.id, name=bname,
                  block_type=v.opt_str(row, "block_type") or "residential",
                  description=v.opt_str(row, "description"), company_id=ctx.company_id)
    db.add(block)
    db.flush()
    return RowImportResult(True, "created", "Block created", "block", block.id)


def validate_town_unit(row, ctx, row_number: int) -> RowValidationResult:
    extra = [
        v.validate_enum(v.opt_str(row, "unit_type") or "plot", UNIT_TYPES, "unit_type"),
        v.validate_enum(v.opt_str(row, "status") or "available", UNIT_STATUSES, "status"),
    ]
    tname = v.opt_str(row, "town_name")
    bname = v.opt_str(row, "block_name")
    if tname and not _town_q(ctx.db, ctx.company_id, tname):
        extra.append(f"Town '{tname}' not found")
    dup = f"{(tname or '').lower()}:{(bname or '').lower()}:{v.opt_str(row, 'unit_number')}"
    return base_validate(row, ctx, row_number, [
        ("town_name", "Town Name"), ("block_name", "Block Name"), ("unit_number", "Unit Number"),
    ], dup, extra)


def import_town_unit(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    town = _town_q(db, ctx.company_id, v.opt_str(row, "town_name") or "")
    if not town:
        return RowImportResult(False, "failed", "Town not found")
    block = db.query(Block).filter(Block.town_id == town.id, Block.name.ilike(v.opt_str(row, "block_name") or "")).first()
    if not block:
        return RowImportResult(False, "failed", "Block not found — import blocks first")

    uno = v.opt_str(row, "unit_number") or ""
    existing = db.query(TownUnit).filter(TownUnit.block_id == block.id, TownUnit.unit_number == uno).first()
    price, err = v.parse_decimal(v.opt_str(row, "total_price"), "total_price")
    if err:
        return RowImportResult(False, "failed", err)

    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Skipped", "town_unit", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Unit exists")
        existing.total_price = price or existing.total_price
        existing.status = v.opt_str(row, "status") or existing.status
        db.flush()
        return RowImportResult(True, "updated", "Updated", "town_unit", existing.id)

    unit = TownUnit(
        tid=next_tid(db, TownUnit, "TUN"),
        block_id=block.id, town_id=town.id, unit_number=uno,
        unit_type=v.opt_str(row, "unit_type") or "plot",
        category=v.opt_str(row, "category") or "residential",
        size_label=v.opt_str(row, "size_label"),
        total_price=price,
        status=v.opt_str(row, "status") or "available",
        company_id=ctx.company_id,
    )
    db.add(unit)
    db.flush()
    return RowImportResult(True, "created", "Unit created", "town_unit", unit.id)


# ── Custom Importers for Shops and Houses ─────────────────────────────────────

SHOP_COLUMNS = [
    ColumnDef("town_name", "Town Name", required=True, sample="Green Valley"),
    ColumnDef("block_name", "Block Name", required=True, sample="Block A"),
    ColumnDef("unit_number", "Unit Number", required=True, sample="S-101"),
    ColumnDef("size_label", "Size", sample="5 Marla"),
    ColumnDef("total_price", "Total Price", sample="5000000"),
    ColumnDef("status", "Status", sample="available", enum_values=sorted(UNIT_STATUSES)),
]

HOUSE_COLUMNS = [
    ColumnDef("town_name", "Town Name", required=True, sample="Green Valley"),
    ColumnDef("block_name", "Block Name", required=True, sample="Block A"),
    ColumnDef("unit_number", "Unit Number", required=True, sample="H-101"),
    ColumnDef("size_label", "Size", sample="10 Marla"),
    ColumnDef("total_price", "Total Price", sample="12000000"),
    ColumnDef("status", "Status", sample="available", enum_values=sorted(UNIT_STATUSES)),
]


def validate_shop(row, ctx, row_number: int) -> RowValidationResult:
    r = dict(row)
    r["unit_type"] = "shop"
    r["category"] = "commercial"
    return validate_town_unit(r, ctx, row_number)


def import_shop(row, ctx: ImportContext) -> RowImportResult:
    r = dict(row)
    r["unit_type"] = "shop"
    r["category"] = "commercial"
    return import_town_unit(r, ctx)


def validate_house(row, ctx, row_number: int) -> RowValidationResult:
    r = dict(row)
    r["unit_type"] = "house"
    r["category"] = "residential"
    return validate_town_unit(r, ctx, row_number)


def import_house(row, ctx: ImportContext) -> RowImportResult:
    r = dict(row)
    r["unit_type"] = "house"
    r["category"] = "residential"
    return import_town_unit(r, ctx)


def get_property_handlers() -> list[ImportModuleHandler]:
    return [
        ImportModuleHandler("properties", "Properties", "Import properties", "Property", "properties:manage",
                            PROPERTY_COLUMNS, validate_property, import_property,
                            lambda r: v.opt_str(r, "property_code")),
        ImportModuleHandler("inventory", "Inventory (Units)", "Import property units on existing properties",
                            "Property", "properties:manage", INVENTORY_COLUMNS, validate_inventory, import_inventory,
                            lambda r: f"{v.opt_str(r, 'property_code')}:{v.opt_str(r, 'unit_number')}"),
        ImportModuleHandler("towns", "Towns", "Import towns / societies", "Towns", "properties:manage",
                            TOWN_COLUMNS, validate_town, import_town, lambda r: (v.opt_str(r, "name") or "").lower()),
        ImportModuleHandler("blocks", "Blocks", "Import blocks within towns", "Towns", "properties:manage",
                            BLOCK_COLUMNS, validate_block, import_block,
                            lambda r: f"{(v.opt_str(r,'town_name') or '').lower()}:{(v.opt_str(r,'block_name') or '').lower()}"),
        ImportModuleHandler("units", "Units / Plots", "Import town units and plots", "Towns", "properties:manage",
                            UNIT_COLUMNS, validate_town_unit, import_town_unit,
                            lambda r: f"{v.opt_str(r,'unit_number')}"),
        ImportModuleHandler("shops", "Shops", "Import town commercial shops", "Towns", "properties:manage",
                            SHOP_COLUMNS, validate_shop, import_shop,
                            lambda r: f"{v.opt_str(r,'unit_number')}"),
        ImportModuleHandler("houses", "Houses", "Import town residential houses", "Towns", "properties:manage",
                            HOUSE_COLUMNS, validate_house, import_house,
                            lambda r: f"{v.opt_str(r,'unit_number')}"),
    ]
