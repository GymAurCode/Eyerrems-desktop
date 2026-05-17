"""
GET /bootstrap — Single endpoint that returns everything the frontend needs on
initial load.  Replaces the waterfall of:
  /auth/me  +  /dashboard/stats  +  /activity/recent
  +  /reminders/notifications/unread-count

Cached per-user for 30 seconds on the backend to absorb rapid re-mounts.
"""
from datetime import datetime, timedelta
from functools import lru_cache
from threading import Lock
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.auth import _user_detail_response
from app.core.database import get_db
from app.core.journal_service import JournalService
from app.models.auth import User
from app.models.crm import Client, Deal, Dealer, Lead
from app.models.finance import Account, Expense, Payment
from app.models.property import Property, Unit
from app.models.reminders import Notification

router = APIRouter()

# ── Simple TTL cache (avoids adding redis/cachetools dependency) ──────────────
_cache: dict[int, tuple[datetime, Any]] = {}
_cache_lock = Lock()
_TTL_SECONDS = 30


def _get_cached(user_id: int) -> Any | None:
    with _cache_lock:
        entry = _cache.get(user_id)
        if entry and (datetime.utcnow() - entry[0]).total_seconds() < _TTL_SECONDS:
            return entry[1]
        return None


def _set_cached(user_id: int, data: Any) -> None:
    with _cache_lock:
        _cache[user_id] = (datetime.utcnow(), data)
        # Evict entries older than 5 minutes to prevent unbounded growth
        cutoff = datetime.utcnow() - timedelta(minutes=5)
        stale = [k for k, v in _cache.items() if v[0] < cutoff]
        for k in stale:
            del _cache[k]


def _build_bootstrap(user: User, db: Session) -> dict:
    # ── User ──────────────────────────────────────────────────────────────────
    user_data = _user_detail_response(user, db)

    # ── Dashboard stats ───────────────────────────────────────────────────────
    total_properties = db.query(func.count(Property.id)).scalar() or 0
    total_units      = db.query(func.count(Unit.id)).scalar() or 0
    occupied_units   = (
        db.query(func.count(Unit.id))
        .filter(or_(
            func.lower(Unit.status).in_(["sold", "rented"]),
            Unit.status.in_(["Sold", "Rented"]),
        ))
        .scalar() or 0
    )
    active_deals = (
        db.query(func.count(Deal.id))
        .filter(func.lower(Deal.status).in_(["active"]))
        .scalar() or 0
    )
    income_accounts  = db.query(Account).filter(Account.account_type == "Income").all()
    expense_accounts = db.query(Account).filter(Account.account_type == "Expense").all()
    income  = sum(float(JournalService.get_account_balance(db, a.id)) for a in income_accounts)
    expense = sum(float(JournalService.get_account_balance(db, a.id)) for a in expense_accounts)

    stats = {
        "total_properties": total_properties,
        "total_units":      total_units,
        "occupied_units":   occupied_units,
        "vacant_units":     total_units - occupied_units,
        "active_deals":     active_deals,
        "income":           income,
        "expense":          expense,
    }

    # ── Recent activity (limit 10) ────────────────────────────────────────────
    limit = 10
    events: list[dict] = []

    for deal in db.query(Deal).order_by(Deal.created_at.desc()).limit(limit).all():
        events.append({
            "type": "sale",
            "title": f"Deal — {deal.deal_title or deal.deal_id}",
            "amount": float(deal.deal_value) if deal.deal_value else None,
            "timestamp": deal.created_at.isoformat(),
        })
    for prop in db.query(Property).order_by(Property.created_at.desc()).limit(limit).all():
        events.append({
            "type": "property",
            "title": f"Property Added — {prop.name}",
            "amount": None,
            "timestamp": prop.created_at.isoformat(),
        })
    for client in db.query(Client).order_by(Client.created_at.desc()).limit(limit).all():
        events.append({
            "type": "client",
            "title": f"New Client — {client.name}",
            "amount": None,
            "timestamp": client.created_at.isoformat(),
        })
    for lead in db.query(Lead).order_by(Lead.created_at.desc()).limit(limit).all():
        events.append({
            "type": "lead",
            "title": f"New Lead — {lead.name}",
            "amount": None,
            "timestamp": lead.created_at.isoformat(),
        })
    for exp in db.query(Expense).order_by(Expense.created_at.desc()).limit(limit).all():
        events.append({
            "type": "expense",
            "title": f"Expense — {exp.description}",
            "amount": float(exp.amount),
            "timestamp": exp.created_at.isoformat(),
        })

    events.sort(key=lambda e: e["timestamp"], reverse=True)
    activity = events[:limit]

    # ── Unread notification count ─────────────────────────────────────────────
    unread_count = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user.id, Notification.is_read == False)
        .scalar() or 0
    )

    return {
        "user":          user_data,
        "stats":         stats,
        "activity":      activity,
        "unread_count":  unread_count,
        "cached_at":     datetime.utcnow().isoformat(),
    }


@router.get("/bootstrap")
def bootstrap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Single endpoint for initial page load.
    Returns user, dashboard stats, recent activity, and unread notification count.
    Cached per-user for 30 seconds.
    """
    cached = _get_cached(current_user.id)
    if cached is not None:
        return {**cached, "from_cache": True}

    data = _build_bootstrap(current_user, db)
    _set_cached(current_user.id, data)
    return {**data, "from_cache": False}


@router.post("/bootstrap/invalidate")
def invalidate_bootstrap_cache(
    current_user: User = Depends(get_current_user),
):
    """Call this after mutations that affect dashboard stats."""
    with _cache_lock:
        _cache.pop(current_user.id, None)
    return {"ok": True}
