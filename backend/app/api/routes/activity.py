from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.core.database import get_db
from app.models.crm import Client, Deal, Lead
from app.models.finance import Expense, Payment
from app.models.property import Property

router = APIRouter()


@router.get("/recent")
def recent_activity(
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    _=Depends(require_permissions("dashboard:view")),
):
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

    for expense in db.query(Expense).order_by(Expense.created_at.desc()).limit(limit).all():
        events.append({
            "type": "expense",
            "title": f"Expense — {expense.description}",
            "amount": float(expense.amount),
            "timestamp": expense.created_at.isoformat(),
        })

    for payment in db.query(Payment).order_by(Payment.created_at.desc()).limit(limit).all():
        events.append({
            "type": "payment",
            "title": f"Payment received — Invoice #{payment.invoice_id}",
            "amount": float(payment.amount),
            "timestamp": payment.created_at.isoformat(),
        })

    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events[:limit]
