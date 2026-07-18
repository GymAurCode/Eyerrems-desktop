from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import require_permissions
from app.core.database import get_db
from app.core.journal_service import JournalService
from app.models.crm import Deal
from app.models.finance import Account, Expense, Payment
from app.models.property import Property, Unit

router = APIRouter()


@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db), _=Depends(require_permissions("dashboard.view"))
):
    total_properties = db.query(func.count(Property.id)).scalar() or 0
    total_units = db.query(func.count(Unit.id)).scalar() or 0
    occupied_units = (
        db.query(func.count(Unit.id))
        .filter(
            or_(
                func.lower(Unit.status).in_(["sold", "rented", "occupied"]),
                Unit.status.in_(["Sold", "Rented", "Occupied"]),
            )
        )
        .scalar()
        or 0
    )
    active_deals = (
        db.query(func.count(Deal.id))
        .filter(func.lower(Deal.status).in_(["active"]))
        .scalar()
        or 0
    )

    # Income/expense from journal-based accounts
    income_accounts = db.query(Account).filter(Account.account_type == "Income").all()
    expense_accounts = db.query(Account).filter(Account.account_type == "Expense").all()
    income = sum(float(JournalService.get_account_balance(db, a.id)) for a in income_accounts)
    expense = sum(float(JournalService.get_account_balance(db, a.id)) for a in expense_accounts)

    return {
        "total_properties": total_properties,
        "total_units": total_units,
        "occupied_units": occupied_units,
        "vacant_units": total_units - occupied_units,
        "active_deals": active_deals,
        "income": income,
        "expense": expense,
    }
