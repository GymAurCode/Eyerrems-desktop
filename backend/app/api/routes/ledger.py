"""
Ledger Routes — /finance/ledger/*
==================================
Client Ledger, Dealer Ledger, Property Ledger.

Each ledger:
  - Lists all entries for an entity (with date-range + type filters)
  - Creates manual entries
  - Returns a single entry detail
  - Recalculates running balances on every write
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_any_permission, require_permissions
from app.core.database import get_db
from app.core.tid import next_tid
from app.models.auth import User
from app.models.crm import Client, Deal, Dealer
from app.models.ledger import ClientLedgerEntry, DealerLedgerEntry, PropertyLedgerEntry
from app.models.property import Property
from app.schemas.ledger import (
    ClientLedgerEntryCreate, ClientLedgerEntryResponse, ClientLedgerResponse,
    DealerLedgerEntryCreate, DealerLedgerEntryResponse, DealerLedgerResponse,
    LedgerSummary,
    PropertyLedgerEntryCreate, PropertyLedgerEntryResponse, PropertyLedgerResponse,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _recalc_client_balances(db: Session, client_id: int) -> None:
    """Recalculate running_balance for all entries of a client, ordered by entry_date, id."""
    entries = (
        db.query(ClientLedgerEntry)
        .filter(ClientLedgerEntry.client_id == client_id)
        .order_by(ClientLedgerEntry.entry_date, ClientLedgerEntry.id)
        .all()
    )
    balance = Decimal("0")
    for e in entries:
        balance += Decimal(str(e.debit)) - Decimal(str(e.credit))
        e.running_balance = balance
    db.flush()


def _recalc_dealer_balances(db: Session, dealer_id: int) -> None:
    entries = (
        db.query(DealerLedgerEntry)
        .filter(DealerLedgerEntry.dealer_id == dealer_id)
        .order_by(DealerLedgerEntry.entry_date, DealerLedgerEntry.id)
        .all()
    )
    balance = Decimal("0")
    for e in entries:
        balance += Decimal(str(e.debit)) - Decimal(str(e.credit))
        e.running_balance = balance
    db.flush()


def _recalc_property_balances(db: Session, property_id: int) -> None:
    entries = (
        db.query(PropertyLedgerEntry)
        .filter(PropertyLedgerEntry.property_id == property_id)
        .order_by(PropertyLedgerEntry.entry_date, PropertyLedgerEntry.id)
        .all()
    )
    balance = Decimal("0")
    for e in entries:
        balance += Decimal(str(e.debit)) - Decimal(str(e.credit))
        e.running_balance = balance
    db.flush()


def _build_summary(entries: list, opening: Decimal = Decimal("0")) -> LedgerSummary:
    total_debit  = sum(Decimal(str(e.debit))  for e in entries)
    total_credit = sum(Decimal(str(e.credit)) for e in entries)
    closing      = opening + total_debit - total_credit
    return LedgerSummary(
        total_debit=total_debit,
        total_credit=total_credit,
        opening_balance=opening,
        closing_balance=closing,
        entry_count=len(entries),
    )


def _fmt_client_entry(e: ClientLedgerEntry) -> ClientLedgerEntryResponse:
    return ClientLedgerEntryResponse(
        id=e.id, tid=e.tid, client_id=e.client_id,
        client_name=e.client.name if e.client else None,
        client_code=e.client.client_id if e.client else None,
        journal_id=e.journal_id,
        entry_date=e.entry_date, description=e.description,
        reference_no=e.reference_no, entry_type=e.entry_type,
        debit=e.debit, credit=e.credit, running_balance=e.running_balance,
        payment_method=e.payment_method, status=e.status, notes=e.notes,
        created_by_name=e.created_by.full_name if e.created_by else None,
        created_at=e.created_at,
    )


def _fmt_dealer_entry(e: DealerLedgerEntry) -> DealerLedgerEntryResponse:
    return DealerLedgerEntryResponse(
        id=e.id, tid=e.tid, dealer_id=e.dealer_id,
        dealer_name=e.dealer.name if e.dealer else None,
        deal_id=e.deal_id,
        deal_ref=e.deal.deal_id if e.deal else None,
        journal_id=e.journal_id,
        entry_date=e.entry_date, description=e.description,
        reference_no=e.reference_no, entry_type=e.entry_type,
        commission_rate=e.commission_rate, gross_commission=e.gross_commission,
        debit=e.debit, credit=e.credit, running_balance=e.running_balance,
        status=e.status, notes=e.notes,
        created_by_name=e.created_by.full_name if e.created_by else None,
        created_at=e.created_at,
    )


def _fmt_property_entry(e: PropertyLedgerEntry) -> PropertyLedgerEntryResponse:
    return PropertyLedgerEntryResponse(
        id=e.id, tid=e.tid, property_id=e.property_id,
        property_name=e.property.name if e.property else None,
        property_tid=e.property.tid if e.property else None,
        client_id=e.client_id,
        client_name=e.client.name if e.client else None,
        journal_id=e.journal_id,
        entry_date=e.entry_date, description=e.description,
        reference_no=e.reference_no, entry_type=e.entry_type,
        debit=e.debit, credit=e.credit, running_balance=e.running_balance,
        status=e.status, notes=e.notes,
        created_by_name=e.created_by.full_name if e.created_by else None,
        created_at=e.created_at,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CLIENT LEDGER
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/client/list")
def list_clients_with_ledger(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    """Return all clients that have at least one ledger entry, plus their balance."""
    rows = (
        db.query(
            Client.id, Client.client_id, Client.name,
            func.sum(ClientLedgerEntry.debit).label("total_debit"),
            func.sum(ClientLedgerEntry.credit).label("total_credit"),
            func.count(ClientLedgerEntry.id).label("entry_count"),
        )
        .join(ClientLedgerEntry, ClientLedgerEntry.client_id == Client.id)
        .group_by(Client.id, Client.client_id, Client.name)
        .order_by(Client.name)
        .all()
    )
    return [
        {
            "id": r.id,
            "client_id": r.client_id,
            "name": r.name,
            "total_debit": float(r.total_debit or 0),
            "total_credit": float(r.total_credit or 0),
            "balance": float((r.total_debit or 0) - (r.total_credit or 0)),
            "entry_count": r.entry_count,
        }
        for r in rows
    ]


@router.get("/client/all-entries")
def list_all_client_entries(
    skip: int = 0,
    limit: int = 200,
    client_id: Optional[int] = None,
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    """Flat list of all client ledger entries with optional filters."""
    q = db.query(ClientLedgerEntry)
    if client_id:
        q = q.filter(ClientLedgerEntry.client_id == client_id)
    if entry_type:
        q = q.filter(ClientLedgerEntry.entry_type == entry_type)
    if status:
        q = q.filter(ClientLedgerEntry.status == status)
    if start_date:
        q = q.filter(ClientLedgerEntry.entry_date >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(ClientLedgerEntry.entry_date <= datetime.fromisoformat(end_date))
    if search:
        like = f"%{search}%"
        q = q.join(Client, ClientLedgerEntry.client_id == Client.id).filter(
            Client.name.ilike(like) |
            ClientLedgerEntry.description.ilike(like) |
            ClientLedgerEntry.reference_no.ilike(like) |
            ClientLedgerEntry.tid.ilike(like)
        )
    entries = q.order_by(ClientLedgerEntry.entry_date.desc(), ClientLedgerEntry.id.desc()).offset(skip).limit(limit).all()
    return [_fmt_client_entry(e) for e in entries]


@router.get("/client/{client_id}", response_model=ClientLedgerResponse)
def get_client_ledger(
    client_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    q = db.query(ClientLedgerEntry).filter(ClientLedgerEntry.client_id == client_id)
    if entry_type:
        q = q.filter(ClientLedgerEntry.entry_type == entry_type)
    if status:
        q = q.filter(ClientLedgerEntry.status == status)
    if start_date:
        q = q.filter(ClientLedgerEntry.entry_date >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(ClientLedgerEntry.entry_date <= datetime.fromisoformat(end_date))

    entries = q.order_by(ClientLedgerEntry.entry_date, ClientLedgerEntry.id).all()
    summary = _build_summary(entries)

    return ClientLedgerResponse(
        client_id=client.id,
        client_name=client.name,
        client_code=client.client_id,
        entries=[_fmt_client_entry(e) for e in entries],
        summary=summary,
    )


@router.get("/client/{client_id}/entry/{entry_id}", response_model=ClientLedgerEntryResponse)
def get_client_ledger_entry(
    client_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    e = db.query(ClientLedgerEntry).filter(
        ClientLedgerEntry.id == entry_id,
        ClientLedgerEntry.client_id == client_id,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return _fmt_client_entry(e)


@router.post("/client", response_model=ClientLedgerEntryResponse)
def create_client_ledger_entry(
    payload: ClientLedgerEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    entry = ClientLedgerEntry(
        tid=next_tid(db, ClientLedgerEntry, "CLE"),
        client_id=payload.client_id,
        journal_id=payload.journal_id,
        entry_date=payload.entry_date,
        description=payload.description,
        reference_no=payload.reference_no,
        entry_type=payload.entry_type,
        debit=payload.debit,
        credit=payload.credit,
        payment_method=payload.payment_method,
        status=payload.status,
        notes=payload.notes,
        created_by_user_id=user.id,
    )
    db.add(entry)
    db.flush()
    _recalc_client_balances(db, payload.client_id)
    db.commit()
    db.refresh(entry)
    return _fmt_client_entry(entry)


@router.patch("/client/{client_id}/entry/{entry_id}", response_model=ClientLedgerEntryResponse)
def update_client_ledger_entry(
    client_id: int,
    entry_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("finance:manage")),
):
    e = db.query(ClientLedgerEntry).filter(
        ClientLedgerEntry.id == entry_id,
        ClientLedgerEntry.client_id == client_id,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    allowed = {"description", "reference_no", "entry_type", "debit", "credit",
               "payment_method", "status", "notes", "entry_date"}
    for k, v in payload.items():
        if k in allowed:
            setattr(e, k, v)
    db.flush()
    _recalc_client_balances(db, client_id)
    db.commit()
    db.refresh(e)
    return _fmt_client_entry(e)


# ══════════════════════════════════════════════════════════════════════════════
# DEALER LEDGER
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dealer/list")
def list_dealers_with_ledger(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    rows = (
        db.query(
            Dealer.id, Dealer.dealer_id, Dealer.name,
            func.sum(DealerLedgerEntry.debit).label("total_debit"),
            func.sum(DealerLedgerEntry.credit).label("total_credit"),
            func.count(DealerLedgerEntry.id).label("entry_count"),
        )
        .join(DealerLedgerEntry, DealerLedgerEntry.dealer_id == Dealer.id)
        .group_by(Dealer.id, Dealer.dealer_id, Dealer.name)
        .order_by(Dealer.name)
        .all()
    )
    return [
        {
            "id": r.id,
            "dealer_id": r.dealer_id,
            "name": r.name,
            "total_debit": float(r.total_debit or 0),
            "total_credit": float(r.total_credit or 0),
            "balance": float((r.total_debit or 0) - (r.total_credit or 0)),
            "entry_count": r.entry_count,
        }
        for r in rows
    ]


@router.get("/dealer/all-entries")
def list_all_dealer_entries(
    skip: int = 0,
    limit: int = 200,
    dealer_id: Optional[int] = None,
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    q = db.query(DealerLedgerEntry)
    if dealer_id:
        q = q.filter(DealerLedgerEntry.dealer_id == dealer_id)
    if entry_type:
        q = q.filter(DealerLedgerEntry.entry_type == entry_type)
    if status:
        q = q.filter(DealerLedgerEntry.status == status)
    if start_date:
        q = q.filter(DealerLedgerEntry.entry_date >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(DealerLedgerEntry.entry_date <= datetime.fromisoformat(end_date))
    if search:
        like = f"%{search}%"
        q = q.join(Dealer, DealerLedgerEntry.dealer_id == Dealer.id).filter(
            Dealer.name.ilike(like) |
            DealerLedgerEntry.description.ilike(like) |
            DealerLedgerEntry.reference_no.ilike(like) |
            DealerLedgerEntry.tid.ilike(like)
        )
    entries = q.order_by(DealerLedgerEntry.entry_date.desc(), DealerLedgerEntry.id.desc()).offset(skip).limit(limit).all()
    return [_fmt_dealer_entry(e) for e in entries]


@router.get("/dealer/{dealer_id}", response_model=DealerLedgerResponse)
def get_dealer_ledger(
    dealer_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")

    q = db.query(DealerLedgerEntry).filter(DealerLedgerEntry.dealer_id == dealer_id)
    if entry_type:
        q = q.filter(DealerLedgerEntry.entry_type == entry_type)
    if status:
        q = q.filter(DealerLedgerEntry.status == status)
    if start_date:
        q = q.filter(DealerLedgerEntry.entry_date >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(DealerLedgerEntry.entry_date <= datetime.fromisoformat(end_date))

    entries = q.order_by(DealerLedgerEntry.entry_date, DealerLedgerEntry.id).all()
    summary = _build_summary(entries)

    return DealerLedgerResponse(
        dealer_id=dealer.id,
        dealer_name=dealer.name,
        dealer_code=dealer.dealer_id,
        entries=[_fmt_dealer_entry(e) for e in entries],
        summary=summary,
    )


@router.get("/dealer/{dealer_id}/entry/{entry_id}", response_model=DealerLedgerEntryResponse)
def get_dealer_ledger_entry(
    dealer_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    e = db.query(DealerLedgerEntry).filter(
        DealerLedgerEntry.id == entry_id,
        DealerLedgerEntry.dealer_id == dealer_id,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return _fmt_dealer_entry(e)


@router.post("/dealer", response_model=DealerLedgerEntryResponse)
def create_dealer_ledger_entry(
    payload: DealerLedgerEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    dealer = db.query(Dealer).filter(Dealer.id == payload.dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")

    entry = DealerLedgerEntry(
        tid=next_tid(db, DealerLedgerEntry, "DLE"),
        dealer_id=payload.dealer_id,
        deal_id=payload.deal_id,
        journal_id=payload.journal_id,
        entry_date=payload.entry_date,
        description=payload.description,
        reference_no=payload.reference_no,
        entry_type=payload.entry_type,
        commission_rate=payload.commission_rate,
        gross_commission=payload.gross_commission,
        debit=payload.debit,
        credit=payload.credit,
        status=payload.status,
        notes=payload.notes,
        created_by_user_id=user.id,
    )
    db.add(entry)
    db.flush()
    _recalc_dealer_balances(db, payload.dealer_id)
    db.commit()
    db.refresh(entry)
    return _fmt_dealer_entry(entry)


# ══════════════════════════════════════════════════════════════════════════════
# PROPERTY LEDGER
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/property/list")
def list_properties_with_ledger(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    rows = (
        db.query(
            Property.id, Property.tid, Property.name,
            func.sum(PropertyLedgerEntry.debit).label("total_debit"),
            func.sum(PropertyLedgerEntry.credit).label("total_credit"),
            func.count(PropertyLedgerEntry.id).label("entry_count"),
        )
        .join(PropertyLedgerEntry, PropertyLedgerEntry.property_id == Property.id)
        .group_by(Property.id, Property.tid, Property.name)
        .order_by(Property.name)
        .all()
    )
    return [
        {
            "id": r.id,
            "tid": r.tid,
            "name": r.name,
            "total_debit": float(r.total_debit or 0),
            "total_credit": float(r.total_credit or 0),
            "balance": float((r.total_debit or 0) - (r.total_credit or 0)),
            "entry_count": r.entry_count,
        }
        for r in rows
    ]


@router.get("/property/all-entries")
def list_all_property_entries(
    skip: int = 0,
    limit: int = 200,
    property_id: Optional[int] = None,
    client_id: Optional[int] = None,
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    q = db.query(PropertyLedgerEntry)
    if property_id:
        q = q.filter(PropertyLedgerEntry.property_id == property_id)
    if client_id:
        q = q.filter(PropertyLedgerEntry.client_id == client_id)
    if entry_type:
        q = q.filter(PropertyLedgerEntry.entry_type == entry_type)
    if status:
        q = q.filter(PropertyLedgerEntry.status == status)
    if start_date:
        q = q.filter(PropertyLedgerEntry.entry_date >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(PropertyLedgerEntry.entry_date <= datetime.fromisoformat(end_date))
    if search:
        like = f"%{search}%"
        q = q.join(Property, PropertyLedgerEntry.property_id == Property.id).filter(
            Property.name.ilike(like) |
            PropertyLedgerEntry.description.ilike(like) |
            PropertyLedgerEntry.reference_no.ilike(like) |
            PropertyLedgerEntry.tid.ilike(like)
        )
    entries = q.order_by(PropertyLedgerEntry.entry_date.desc(), PropertyLedgerEntry.id.desc()).offset(skip).limit(limit).all()
    return [_fmt_property_entry(e) for e in entries]


@router.get("/property/{property_id}", response_model=PropertyLedgerResponse)
def get_property_ledger(
    property_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    q = db.query(PropertyLedgerEntry).filter(PropertyLedgerEntry.property_id == property_id)
    if entry_type:
        q = q.filter(PropertyLedgerEntry.entry_type == entry_type)
    if status:
        q = q.filter(PropertyLedgerEntry.status == status)
    if start_date:
        q = q.filter(PropertyLedgerEntry.entry_date >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(PropertyLedgerEntry.entry_date <= datetime.fromisoformat(end_date))

    entries = q.order_by(PropertyLedgerEntry.entry_date, PropertyLedgerEntry.id).all()
    summary = _build_summary(entries)

    return PropertyLedgerResponse(
        property_id=prop.id,
        property_name=prop.name,
        property_tid=prop.tid,
        entries=[_fmt_property_entry(e) for e in entries],
        summary=summary,
    )


@router.get("/property/{property_id}/entry/{entry_id}", response_model=PropertyLedgerEntryResponse)
def get_property_ledger_entry(
    property_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("finance:view", "finance:manage")),
):
    e = db.query(PropertyLedgerEntry).filter(
        PropertyLedgerEntry.id == entry_id,
        PropertyLedgerEntry.property_id == property_id,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return _fmt_property_entry(e)


@router.post("/property", response_model=PropertyLedgerEntryResponse)
def create_property_ledger_entry(
    payload: PropertyLedgerEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    prop = db.query(Property).filter(Property.id == payload.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    entry = PropertyLedgerEntry(
        tid=next_tid(db, PropertyLedgerEntry, "PLE"),
        property_id=payload.property_id,
        client_id=payload.client_id,
        journal_id=payload.journal_id,
        entry_date=payload.entry_date,
        description=payload.description,
        reference_no=payload.reference_no,
        entry_type=payload.entry_type,
        debit=payload.debit,
        credit=payload.credit,
        status=payload.status,
        notes=payload.notes,
        created_by_user_id=user.id,
    )
    db.add(entry)
    db.flush()
    _recalc_property_balances(db, payload.property_id)
    db.commit()
    db.refresh(entry)
    return _fmt_property_entry(entry)
