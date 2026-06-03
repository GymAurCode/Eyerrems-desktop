"""
Async-debounced-select helper endpoints.

Returns structured JSON consumed by AsyncDebouncedSelect:
  { "items": [{ "id": 1, "label": "...", "subtext": "..." }], "totalPages": 5 }

All endpoints are public‑read (require_any_permission VIEW) so the select
component can load options without write access.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from math import ceil

from app.api.deps import require_any_permission
from app.core.database import get_db
from app.models.crm import Client, Dealer, Lead
from app.models.property import Property, Unit
from app.models.tenant import Tenant

router = APIRouter(prefix="/async-select", tags=["async-select"])

PAGE_SIZE = 20


def _paginated_response(query, page: int, model, label_field, subtext_field=None):
    """Build the standard { items, totalPages } response."""
    total = query.count()
    total_pages = max(1, ceil(total / PAGE_SIZE))
    offset = (page - 1) * PAGE_SIZE
    rows = query.offset(offset).limit(PAGE_SIZE).all()

    items = []
    for r in rows:
        label = getattr(r, label_field, "")
        subtext = None
        if subtext_field:
            subtext = str(getattr(r, subtext_field, "")) if getattr(r, subtext_field, None) else None
        elif hasattr(model, "phone"):
            subtext = r.phone
        items.append({"id": r.id, "label": str(label), "subtext": subtext})

    return {"items": items, "totalPages": total_pages}


# ── Clients ────────────────────────────────────────────────────────────────────

@router.get("/clients")
def search_clients(
    search: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("crm:view")),
):
    q = db.query(Client)
    if search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Client.name.ilike(like),
                Client.phone.ilike(like),
                Client.email.ilike(like),
                Client.client_id.ilike(like),
            )
        )
    q = q.order_by(Client.name.asc())
    return _paginated_response(q, page, Client, "name", "phone")


# ── Properties ─────────────────────────────────────────────────────────────────

@router.get("/properties")
def search_properties(
    search: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("property:view")),
):
    q = db.query(Property)
    if search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Property.title.ilike(like),
                Property.address.ilike(like),
                Property.property_id.ilike(like),
            )
        )
    q = q.order_by(Property.title.asc())
    return _paginated_response(q, page, Property, "title", "address")


# ── Units ──────────────────────────────────────────────────────────────────────

@router.get("/units")
def search_units(
    search: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    property_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("property:view")),
):
    q = db.query(Unit)
    if property_id:
        q = q.filter(Unit.property_id == property_id)
    if search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Unit.unit_no.ilike(like),
                Unit.unit_type.ilike(like),
                Unit.title.ilike(like),
            )
        )
    q = q.order_by(Unit.unit_no.asc())
    return _paginated_response(q, page, Unit, "unit_no", "unit_type")


# ── Tenants ─────────────────────────────────────────────────────────────────────

@router.get("/tenants")
def search_tenants(
    search: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("tenant:view")),
):
    q = db.query(Tenant)
    if search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Tenant.name.ilike(like),
                Tenant.phone.ilike(like),
                Tenant.email.ilike(like),
            )
        )
    q = q.order_by(Tenant.name.asc())
    return _paginated_response(q, page, Tenant, "name", "phone")


# ── Dealers ─────────────────────────────────────────────────────────────────────

@router.get("/dealers")
def search_dealers(
    search: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("crm:view")),
):
    q = db.query(Dealer)
    if search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Dealer.name.ilike(like),
                Dealer.phone.ilike(like),
                Dealer.email.ilike(like),
                Dealer.dealer_id.ilike(like),
            )
        )
    q = q.order_by(Dealer.name.asc())
    return _paginated_response(q, page, Dealer, "name", "phone")


# ── Leads ───────────────────────────────────────────────────────────────────────

@router.get("/leads")
def search_leads(
    search: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("crm:view")),
):
    q = db.query(Lead)
    if search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Lead.name.ilike(like),
                Lead.phone.ilike(like),
                Lead.email.ilike(like),
                Lead.lead_id.ilike(like),
            )
        )
    q = q.order_by(Lead.name.asc())
    return _paginated_response(q, page, Lead, "name", "phone")
