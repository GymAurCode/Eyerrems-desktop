"""Lookup values API — dynamic dropdown options."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.auth import User
from app.models.lookup import LookupValue

router = APIRouter()
log = logging.getLogger("rems.lookups")

# Maps each lookup category to (table_name, column_name) pairs that store its values.
# Usage: for a lookup value "apartment" in category "property_type", count rows in
# the listed tables where the column equals "apartment".
CATEGORY_TO_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "property_type":         [("leads", "preferred_property_type"), ("properties", "category")],
    "property_status":       [("properties", "status")],
    "unit_type":             [("units", "unit_type"), ("town_units", "unit_type"), ("leads", "unit_preference")],
    "furnishing_status":     [("units", "furnishing_status")],
    "tenant_status":         [],
    "id_type":               [],
    "nationality":           [("contacts", "nationality"), ("employees", "nationality")],
    "lease_type":            [("leases", "payment_frequency"), ("tenant_leases", "rent_cycle")],
    "lease_status":          [("leases", "status"), ("tenant_leases", "status")],
    "payment_method":        [("leases", "payment_method"), ("lease_payments", "payment_method"),
                              ("tenant_payments", "payment_method"), ("expenses", "payment_method"),
                              ("payrolls", "payment_method")],
    "lead_status":           [("leads", "status")],
    "lead_source":           [("leads", "source")],
    "priority":              [("maintenance_records", "priority")],
    "client_status":         [("clients", "status")],
    "dealer_status":         [],
    "employee_status":       [("employees", "employment_status")],
    "department":            [],
    "employment_type":       [("employees", "employment_type")],
    "maintenance_category":  [("maintenance_records", "category")],
    "maintenance_status":    [("maintenance_records", "status")],
    "maintenance_priority":  [("maintenance_records", "priority")],
    "expense_category":      [],
    "invoice_status":        [("invoices", "status")],
    "document_status":       [("attachments", "document_status")],
    "booking_status":        [("bookings", "status")],
    "unit_status":           [("units", "status"), ("town_units", "status")],
    "deal_status":           [("deals", "status")],
    "down_payment_status":   [("bookings", "down_payment_status")],
    "commission_type":       [("dealers", "commission_type")],
    "client_role":           [("contacts", "role")],
    "gender":                [("employees", "gender")],
    "payment_status":        [("payments", "payment_status"), ("expenses", "payment_status"),
                              ("sale_instalments", "status")],
    "account_type":          [("accounts", "account_type")],
    "installment_type":      [("installments", "type")],
    "listing_status":        [("properties", "listing_status")],
    "operational_status":    [("properties", "operational_status")],
    "size_unit":             [("properties", "size_unit"), ("units", "area_unit"), ("town_units", "size_unit")],
    "owner_type":            [("properties", "owner_type")],
    "regulatory_authority":  [("properties", "regulatory_authority")],
    "unit_ownership":        [],
    "contact_type":          [("contacts", "role")],
    "payment_frequency":     [("leases", "payment_frequency"), ("tenant_leases", "rent_cycle")],
}


def _compute_usage(db: Session, category: str, values: list[str]) -> dict[str, int]:
    """Return {value_string: count} for how many rows reference each lookup value."""
    if not values:
        return {}
    columns = CATEGORY_TO_COLUMNS.get(category, [])
    if not columns:
        return {}

    result: dict[str, int] = {v: 0 for v in values}
    for table, col in columns:
        try:
            placeholders = ", ".join([f":v{i}" for i in range(len(values))])
            params = {f"v{i}": v for i, v in enumerate(values)}
            rows = db.execute(
                text(f"SELECT {col}, COUNT(*) AS cnt FROM {table} WHERE {col} IN ({placeholders}) GROUP BY {col}"),
                params,
            ).fetchall()
            for row in rows:
                val = str(row[0])
                if val in result:
                    result[val] += row[1]
        except Exception:
            log.debug("Skipping usage query for %s.%s (table may not exist)", table, col)
    return result


def _serialize(lv: LookupValue) -> dict:
    return {
        "id": lv.id,
        "category": lv.category,
        "label": lv.label,
        "value": lv.value,
        "sort_order": lv.sort_order,
        "is_active": lv.is_active,
        "is_default": lv.is_default,
        "created_at": lv.created_at.isoformat() if lv.created_at else None,
    }


@router.get("/{category}")
def get_lookup_values(
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    include_usage: bool = Query(False, description="Include usage count for each value"),
):
    """Get all active values for a dropdown category."""
    items = (
        db.query(LookupValue)
        .filter(LookupValue.category == category, LookupValue.is_active == True)
        .order_by(LookupValue.sort_order.asc(), LookupValue.label.asc())
        .all()
    )
    serialized = [_serialize(item) for item in items]
    if include_usage:
        usage = _compute_usage(db, category, [item["value"] for item in serialized])
        for item in serialized:
            item["usage_count"] = usage.get(item["value"], 0)
    return serialized


@router.get("")
def list_all_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    include_usage: bool = Query(False, description="Include usage count for each value"),
):
    """Get all categories grouped with their values — for Advance Options page."""
    items = (
        db.query(LookupValue)
        .order_by(LookupValue.category.asc(), LookupValue.sort_order.asc(), LookupValue.label.asc())
        .all()
    )
    # Auto-seed if the table is empty — ensures first-time users see data
    if not items:
        try:
            from app.core.seed_lookups import seed_lookup_values
            inserted = seed_lookup_values(db, missing_categories_only=True)
            if inserted:
                log.info("Auto-seeded %d lookup values on empty read.", inserted)
                items = (
                    db.query(LookupValue)
                    .order_by(LookupValue.category.asc(), LookupValue.sort_order.asc(), LookupValue.label.asc())
                    .all()
                )
        except Exception as exc:
            log.warning("Auto-seed on empty lookups failed: %s", exc)

    grouped: dict = {}
    for item in items:
        cat = item.category
        if cat not in grouped:
            grouped[cat] = []
        serialized = _serialize(item)
        grouped[cat].append(serialized)

    if include_usage:
        for cat, vals in grouped.items():
            usage = _compute_usage(db, cat, [v["value"] for v in vals])
            for v in vals:
                v["usage_count"] = usage.get(v["value"], 0)

    return grouped


@router.post("", status_code=201)
def create_lookup_value(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new lookup value."""
    category = body.get("category")
    label = body.get("label")
    value = body.get("value")
    if not category or not label or not value:
        raise HTTPException(status_code=400, detail="category, label, and value are required")

    existing = db.query(LookupValue).filter(
        LookupValue.category == category,
        LookupValue.value == value,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Value '{value}' already exists in category '{category}'")

    sort_order = body.get("sort_order", 0)
    is_default = body.get("is_default", False)

    lv = LookupValue(
        category=category,
        label=label,
        value=value,
        sort_order=sort_order,
        is_default=is_default,
    )
    db.add(lv)
    db.commit()
    db.refresh(lv)
    return _serialize(lv)


class SeedDefaultsResponse(BaseModel):
    inserted: int
    message: str


class SeedPreviewItem(BaseModel):
    category: str
    label: str
    value: str
    sort_order: int
    is_default: bool


@router.get("/seed-defaults", response_model=list[SeedPreviewItem])
def get_seed_defaults():
    """Return all seed default values so the frontend can preview them."""
    from app.core.seed_lookups import SEED_DATA
    return [
        SeedPreviewItem(
            category=row[0],
            label=row[1],
            value=row[2],
            sort_order=row[3],
            is_default=row[4] if len(row) > 4 else False,
        )
        for row in SEED_DATA
    ]


@router.post("/seed-defaults")
def seed_default_lookup_values(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Insert default lookup values for categories that have zero existing values.

    Safe to call at any time — never overwrites user customisations.
    """
    from app.core.seed_lookups import seed_lookup_values

    inserted = seed_lookup_values(db, missing_categories_only=True)
    msg = (
        f"Inserted {inserted} default value(s)."
        if inserted
        else "All categories already have values — nothing to seed."
    )
    log.info("seed-defaults: %s", msg)
    return SeedDefaultsResponse(inserted=inserted, message=msg)


@router.patch("/reorder")
def reorder_lookup_values(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reorder lookup values — accepts { ids: [1, 2, 3] } in new order."""
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="ids list required")
    for idx, lid in enumerate(ids):
        db.query(LookupValue).filter(LookupValue.id == lid).update({"sort_order": idx})
    db.commit()
    return {"success": True}


@router.patch("/{lookup_id}")
def update_lookup_value(
    lookup_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a lookup value."""
    lv = db.query(LookupValue).filter(LookupValue.id == lookup_id).first()
    if not lv:
        raise HTTPException(status_code=404, detail="Lookup value not found")

    if "label" in body:
        lv.label = body["label"]
    if "value" in body:
        # Check uniqueness
        existing = db.query(LookupValue).filter(
            LookupValue.category == lv.category,
            LookupValue.value == body["value"],
            LookupValue.id != lookup_id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Value '{body['value']}' already exists")
        lv.value = body["value"]
    if "sort_order" in body:
        lv.sort_order = body["sort_order"]
    if "is_active" in body:
        lv.is_active = body["is_active"]
    if "is_default" in body:
        # Only one default per category
        if body["is_default"]:
            db.query(LookupValue).filter(
                LookupValue.category == lv.category,
                LookupValue.id != lookup_id,
            ).update({"is_default": False})
        lv.is_default = body["is_default"]

    db.commit()
    db.refresh(lv)
    return _serialize(lv)


@router.delete("/{lookup_id}")
def delete_lookup_value(
    lookup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a lookup value (hard delete)."""
    lv = db.query(LookupValue).filter(LookupValue.id == lookup_id).first()
    if not lv:
        raise HTTPException(status_code=404, detail="Lookup value not found")
    db.delete(lv)
    db.commit()
    return {"success": True}
