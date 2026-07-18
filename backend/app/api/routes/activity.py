import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import require_permissions
from app.core.database import get_db
from app.models.crm import Client, Deal, Lead
from app.models.finance import Expense, Payment
from app.models.property import Property

log = logging.getLogger("rems.activity")
router = APIRouter()


@router.get("/recent")
def recent_activity(
    limit: int = Query(default=10, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_permissions("dashboard:view")),
):
    events: list[dict] = []

    try:
        for deal in db.query(Deal).order_by(Deal.created_at.desc()).limit(limit).all():
            events.append({
                "type": "sale",
                "title": f"Deal — {deal.deal_title or deal.deal_id}",
                "amount": float(deal.deal_value) if deal.deal_value else None,
                "timestamp": deal.created_at.isoformat() if deal.created_at else None,
            })
    except SQLAlchemyError as exc:
        log.warning("Skipping Deal query: %s", exc)

    try:
        for prop in db.query(Property).order_by(Property.created_at.desc()).limit(limit).all():
            events.append({
                "type": "property",
                "title": f"Property Added — {prop.name}",
                "amount": None,
                "timestamp": prop.created_at.isoformat() if prop.created_at else None,
            })
    except SQLAlchemyError as exc:
        log.warning("Skipping Property query: %s", exc)

    try:
        for client in db.query(Client).order_by(Client.created_at.desc()).limit(limit).all():
            events.append({
                "type": "client",
                "title": f"New Client — {client.name}",
                "amount": None,
                "timestamp": client.created_at.isoformat() if client.created_at else None,
            })
    except SQLAlchemyError as exc:
        log.warning("Skipping Client query: %s", exc)

    try:
        for lead in db.query(Lead).order_by(Lead.created_at.desc()).limit(limit).all():
            events.append({
                "type": "lead",
                "title": f"New Lead — {lead.name}",
                "amount": None,
                "timestamp": lead.created_at.isoformat() if lead.created_at else None,
            })
    except SQLAlchemyError as exc:
        log.warning("Skipping Lead query: %s", exc)

    try:
        for expense in db.query(Expense).order_by(Expense.created_at.desc()).limit(limit).all():
            if not expense.created_at:
                continue
            events.append({
                "type": "expense",
                "title": f"Expense — {expense.description or 'Untitled'}",
                "amount": float(expense.amount) if expense.amount else 0,
                "timestamp": expense.created_at.isoformat(),
            })
    except SQLAlchemyError as exc:
        log.warning("Skipping Expense query: %s", exc)

    try:
        for payment in db.query(Payment).order_by(Payment.created_at.desc()).limit(limit).all():
            if not payment.created_at:
                continue
            events.append({
                "type": "payment",
                "title": f"Payment received — {payment.party_name or payment.payment_number}",
                "amount": float(payment.amount) if payment.amount else 0,
                "timestamp": payment.created_at.isoformat(),
            })
    except SQLAlchemyError as exc:
        log.warning("Skipping Payment query: %s", exc)

    events.sort(key=lambda e: e["timestamp"] or "", reverse=True)
    return events[:limit]
