"""Lookup values API — dynamic dropdown options."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.auth import User
from app.models.lookup import LookupValue

router = APIRouter()
log = logging.getLogger("rems.lookups")


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
):
    """Get all active values for a dropdown category."""
    items = (
        db.query(LookupValue)
        .filter(LookupValue.category == category, LookupValue.is_active == True)
        .order_by(LookupValue.sort_order.asc(), LookupValue.label.asc())
        .all()
    )
    return [_serialize(item) for item in items]


@router.get("")
def list_all_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all categories grouped with their values — for Advance Options page."""
    items = (
        db.query(LookupValue)
        .order_by(LookupValue.category.asc(), LookupValue.sort_order.asc(), LookupValue.label.asc())
        .all()
    )
    grouped: dict = {}
    for item in items:
        cat = item.category
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(_serialize(item))
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
