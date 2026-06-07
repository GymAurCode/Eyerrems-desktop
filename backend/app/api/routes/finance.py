from decimal import Decimal
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session, joinedload
from app.core.table_query import apply_table_filters

from app.api.deps import get_current_user, require_permissions, require_any_permission
from app.core.activity_logger import log_activity
from app.core.audit import log_action
from app.core.database import get_db
from app.core.default_coa import SYSTEM_ACCOUNT_CODES
from app.core.journal_service import JournalService, JournalEntryData
from app.core.websocket_manager import ws_manager
from app.models.auth import User
from app.models.crm import Deal, Dealer, Client, Installment, InstallmentPlan
from app.models.booking import Booking
from app.models.finance import (
    Account, Commission, Expense, Invoice, Journal, JournalEntry, Payment, SyncLog, AuditLog
)
from app.models.property import Property, Lease, Unit
from app.models.tenant import Tenant
from app.models.ledger import DealerLedgerEntry
from app.core.tid import next_tid
from app.services.commission_service import calculate_commission_amount, get_dealer_context
from app.schemas.finance import (
    AccountCreate, AccountResponse, AccountTreeNode, AccountUpdate, AccountWithBalance,
    CommissionCreate, CommissionResponse, CommissionCalculateRequest, CommissionCalculateResponse,
    ExpenseCreate, ExpenseResponse,
    InvoiceCreate, InvoiceResponse, InvoiceUpdate,
    JournalCreate, JournalResponse, JournalEntryResponse,
    LedgerEntryResponse,
    PaymentCreate, PaymentResponse,
    ProfitLossResponse, ProfitLossRow,
    TrialBalanceResponse, TrialBalanceRow,
    GeneralLedgerResponse,
    SyncPostResponse, SyncStatusResponse,
    DashboardKPI, DashboardResponse,
    MonthlyIncomeExpense, CashFlowPoint, InvoiceStatusCount, BankCashPosition,
)

router = APIRouter()


# ── Helper ──────────────────────────────────────────────────────────────────

def _journal_to_response(db: Session, j: Journal) -> JournalResponse:
    entries_resp = []
    for e in j.entries:
        acc = db.query(Account).filter(Account.id == e.account_id).first()
        entries_resp.append(JournalEntryResponse(
            id=e.id,
            journal_id=e.journal_id,
            account_id=e.account_id,
            debit=e.debit,
            credit=e.credit,
            description=e.description,
            account_code=acc.code if acc else None,
            account_name=f"{acc.code} — {acc.name}" if acc else None,
        ))
    dr_total = sum(e.debit for e in j.entries)
    cr_total = sum(e.credit for e in j.entries)
    return JournalResponse(
        id=j.id,
        date=j.date,
        reference_type=j.reference_type,
        reference_id=j.reference_id,
        description=j.description,
        source=j.source or "MANUAL",
        is_editable=j.is_editable if j.is_editable is not None else True,
        created_at=j.created_at,
        entries=entries_resp,
        dr_total=dr_total,
        cr_total=cr_total,
        balanced=dr_total == cr_total,
    )


def _log_audit(db: Session, user: User, action: str, module: str, record_type: str | None, record_id: str | None, description: str | None = None, amount: Decimal | None = None):
    log = AuditLog(
        user_id=user.id,
        user_email=user.email,
        action=action,
        module=module,
        record_type=record_type,
        record_id=record_id,
        description=description,
        amount=amount,
    )
    db.add(log)


# ── ACCOUNT ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/accounts", response_model=AccountResponse)
async def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    if db.query(Account).filter(Account.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Account code already exists")
    if payload.parent_id:
        parent = db.query(Account).filter(Account.id == payload.parent_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent account not found")
    account = Account(**payload.model_dump())
    db.add(account)
    db.flush()

    if account.opening_balance and account.opening_balance > 0:
        equity = db.query(Account).filter(Account.code == "3100").first()
        if equity:
            je = JournalService.create_journal_entry(
                db=db,
                entries=[
                    JournalEntryData(account_id=account.id, debit=account.opening_balance,
                                     description=f"Opening balance for {account.code} — {account.name}"),
                    JournalEntryData(account_id=equity.id, credit=account.opening_balance,
                                     description=f"Opening balance for {account.code} — {account.name}"),
                ],
                reference_type="opening_balance",
                reference_id=f"ACC-{account.id}",
                description=f"Opening balance setup: {account.code} — {account.name}",
                date=account.opening_balance_date or datetime.utcnow(),
                user=user,
                source="MANUAL",
                is_editable=False,
            )

    db.commit()
    db.refresh(account)
    _log_audit(db, user, "CREATE", "accounts", "Account", str(account.id), f"Created account: {account.code} — {account.name}")
    log_activity(
        db=db, user=user, action="create", module="finance",
        record_type="Account", record_id=str(account.id),
        record_label=f"Account {account.code} — {account.name}",
        new_values={k: str(v) for k, v in account.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    await ws_manager.broadcast("finance_updated", {"type": "account_created", "account_id": account.id})
    return account


@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    active: bool = True,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    q = db.query(Account)
    if active:
        q = q.filter(Account.is_active.is_(True))
    return q.order_by(Account.code).all()


@router.get("/accounts/tree")
async def get_account_tree(
    include_balance: bool = True,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    def build_tree(parent_id):
        accounts = (
            db.query(Account)
            .filter(Account.parent_id == parent_id)
            .order_by(Account.code)
            .all()
        )
        result = []
        for acc in accounts:
            balance = JournalService.get_account_balance(db, acc.id) if include_balance else Decimal("0")
            child_count = db.query(Account).filter(Account.parent_id == acc.id).count()
            node = {
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "account_type": acc.account_type,
                "type": acc.account_type,
                "description": acc.description,
                "is_active": acc.is_active,
                "is_system_account": acc.is_system_account,
                "parent_id": acc.parent_id,
                "balance": float(balance),
                "opening_balance": float(acc.opening_balance or 0),
                "child_count": child_count,
                "children": build_tree(acc.id),
            }
            result.append(node)
        return result
    return build_tree(None)


@router.get("/accounts/{account_id}/balance")
async def get_account_balance_endpoint(
    account_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    balance = JournalService.get_account_balance(db, account_id)
    return {
        "account_id": account_id,
        "code": account.code,
        "name": account.name,
        "balance": float(balance),
        "opening_balance": float(account.opening_balance or 0),
    }


@router.get("/accounts/{account_id}", response_model=AccountWithBalance)
async def get_account(
    account_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    balance = JournalService.get_account_balance(db, account_id)
    parent_name = None
    if account.parent_id:
        parent = db.query(Account).filter(Account.id == account.parent_id).first()
        parent_name = f"{parent.code} — {parent.name}" if parent else None
    result = AccountWithBalance.model_validate(account)
    result.balance = balance
    result.parent_name = parent_name
    return result


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    old_data = {k: str(v) for k, v in account.__dict__.items() if not k.startswith('_')}
    if payload.is_active is False:
        if db.query(JournalEntry).filter(JournalEntry.account_id == account_id).count() > 0:
            raise HTTPException(status_code=400, detail="Cannot deactivate account with journal entries")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    _log_audit(db, user, "UPDATE", "accounts", "Account", str(account_id), f"Updated account: {account.code}")
    log_activity(
        db=db, user=user, action="update", module="finance",
        record_type="Account", record_id=str(account_id),
        record_label=f"Account {account.code}",
        old_values=old_data, new_values={k: str(v) for k, v in account.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    await ws_manager.broadcast("finance_updated", {"type": "account_updated", "account_id": account.id})
    return account


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.code in SYSTEM_ACCOUNT_CODES or account.is_system_account:
        raise HTTPException(status_code=400, detail="Cannot delete a system account")
    if db.query(JournalEntry).filter(JournalEntry.account_id == account_id).count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete account with journal entries")
    if db.query(Account).filter(Account.parent_id == account_id).count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete account with sub-accounts")
    db.delete(account)
    db.commit()
    _log_audit(db, user, "DELETE", "accounts", "Account", str(account_id), f"Deleted account: {account.code}")
    log_activity(
        db=db, user=user, action="delete", module="finance",
        record_type="Account", record_id=str(account_id),
        record_label=f"Account {account.code}",
        old_values={"id": str(account_id)},
    )
    db.commit()
    await ws_manager.broadcast("finance_updated", {"type": "account_deleted", "account_id": account_id})
    return {"deleted": True}


# ── JOURNAL ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/journals", response_model=JournalResponse)
async def create_journal(
    payload: JournalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        entries = [
            JournalEntryData(
                account_id=line.account_id,
                debit=line.debit,
                credit=line.credit,
                description=line.description,
            )
            for line in payload.lines
        ]
        journal = JournalService.create_journal_entry(
            db=db,
            entries=entries,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            description=payload.description,
            date=payload.date,
            user=user,
            source=payload.source or "MANUAL",
            is_editable=payload.is_editable if payload.is_editable is not None else True,
        )
        db.commit()
        db.refresh(journal)
        _log_audit(db, user, "CREATE", "journals", "Journal", str(journal.id),
                   f"Journal: {journal.description}", sum(e.debit for e in journal.entries))
        log_activity(
            db=db, user=user, action="create", module="finance",
            record_type="Journal", record_id=str(journal.id),
            record_label=f"Journal {journal.id}",
            new_values={k: str(v) for k, v in journal.__dict__.items() if not k.startswith('_')},
        )
        db.commit()
        await ws_manager.broadcast("journal_created", {"journal_id": journal.id})
        return _journal_to_response(db, journal)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/journals", response_model=list[JournalResponse])
async def list_journals(
    skip: int = 0,
    limit: int = 100,
    reference_type: str | None = None,
    source: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Journal).options(joinedload(Journal.entries))
    if reference_type:
        query = query.filter(Journal.reference_type == reference_type)
    if source:
        query = query.filter(Journal.source == source)
    if start_date:
        query = query.filter(Journal.date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Journal.date <= datetime.fromisoformat(end_date) + timedelta(days=1))
    journals = query.order_by(Journal.date.desc()).offset(skip).limit(limit).all()
    return [_journal_to_response(db, j) for j in journals]


@router.get("/journals/{journal_id}", response_model=JournalResponse)
async def get_journal(
    journal_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    journal = db.query(Journal).options(joinedload(Journal.entries)).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    return _journal_to_response(db, journal)


@router.get("/journals/ledger/{account_id}", response_model=GeneralLedgerResponse)
async def get_general_ledger(
    account_id: int,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    entries = JournalService.get_account_ledger(db, account_id, start, end)
    balance = JournalService.get_account_balance(db, account_id, end)
    opening = JournalService.get_account_balance(db, account_id, start) if start else (account.opening_balance or Decimal("0"))
    return GeneralLedgerResponse(
        account_id=account.id,
        code=account.code,
        name=account.name,
        type=account.account_type,
        entries=[LedgerEntryResponse(**e) for e in entries],
        opening_balance=opening,
        closing_balance=balance,
    )


# ── INVOICE ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/invoices", response_model=InvoiceResponse)
async def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        invoice = Invoice(
            tenant_id=payload.tenant_id,
            property_id=payload.property_id,
            unit_id=payload.unit_id,
            amount=payload.amount,
            status="pending",
            due_date=payload.due_date,
            description=payload.description,
            invoice_type=payload.invoice_type,
            client_id=payload.client_id,
            client_name=payload.client_name,
            reference=payload.reference,
            paid_amount=Decimal("0"),
            remaining_amount=payload.amount,
        )
        if not user.is_super_admin:
            invoice.company_id = user.company_id
        db.add(invoice)
        db.flush()

        dr_account_id = payload.dr_account_id
        cr_account_id = payload.cr_account_id
        if not dr_account_id:
            ar = db.query(Account).filter(Account.code == "1200").first()
            dr_account_id = ar.id if ar else None
        if not cr_account_id:
            income = db.query(Account).filter(Account.code == "4100").first()
            cr_account_id = income.id if income else None
        if not dr_account_id or not cr_account_id:
            db.rollback()
            raise ValueError("Required accounts missing. Run seed_finance.py first.")

        JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account_id, debit=payload.amount,
                                 description=f"Invoice #{invoice.id}"),
                JournalEntryData(account_id=cr_account_id, credit=payload.amount,
                                 description=f"Invoice #{invoice.id}"),
            ],
            reference_type="invoice",
            reference_id=str(invoice.id),
            description=payload.description or f"Invoice #{invoice.id}",
            date=datetime.utcnow(),
            user=user,
            source="MANUAL",
        )
        db.commit()
        _log_audit(db, user, "CREATE", "invoices", "Invoice", str(invoice.id),
                   f"Created invoice #{invoice.id} for {payload.amount}", payload.amount)
        log_activity(
            db=db, user=user, action="create", module="finance",
            record_type="Invoice", record_id=str(invoice.id),
            record_label=f"Invoice #{invoice.id}",
            new_values={k: str(v) for k, v in invoice.__dict__.items() if not k.startswith('_')},
        )
        db.commit()
        await ws_manager.broadcast("invoice_created", {"invoice_id": invoice.id})
        return invoice
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    response: Response,
    skip: int = 0,
    limit: int | None = 100,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    status: str | None = None,
    tenant_id: int | None = None,
    invoice_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Invoice).order_by(Invoice.created_at.desc())
    if not user.is_super_admin:
        query = query.filter(Invoice.company_id == user.company_id)
    if status:
        query = query.filter(Invoice.status == status)
    if tenant_id:
        query = query.filter(Invoice.tenant_id == tenant_id)
    if invoice_type:
        query = query.filter(Invoice.invoice_type == invoice_type)
    actual_offset = offset if offset is not None else skip
    query, total = apply_table_filters(
        query=query, model=Invoice, limit=limit, offset=actual_offset,
        search=search, search_fields=[Invoice.description, Invoice.client_name, Invoice.reference],
        date_filter=filter, date_field=Invoice.created_at,
        start_date=startDate, end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    return query.all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Invoice)
    if not user.is_super_admin:
        query = query.filter(Invoice.company_id == user.company_id)
    invoice = query.filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Invoice)
    if not user.is_super_admin:
        query = query.filter(Invoice.company_id == user.company_id)
    invoice = query.filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    old_data = {k: str(v) for k, v in invoice.__dict__.items() if not k.startswith('_')}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(invoice, field, value)
    db.commit()
    db.refresh(invoice)
    _log_audit(db, user, "UPDATE", "invoices", "Invoice", str(invoice_id), f"Updated invoice #{invoice_id}")
    log_activity(
        db=db, user=user, action="update", module="finance",
        record_type="Invoice", record_id=str(invoice_id),
        record_label=f"Invoice #{invoice_id}",
        old_values=old_data, new_values={k: str(v) for k, v in invoice.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return invoice


# ── PAYMENT ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/payments", response_model=PaymentResponse)
async def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        payment = Payment(
            invoice_id=payload.invoice_id,
            method=payload.method,
            amount=payload.amount,
            date=payload.date or datetime.utcnow(),
            reference_number=payload.reference_number,
            received_from=payload.received_from,
            payment_type=payload.payment_type or "manual",
            source=payload.source or "MANUAL",
            source_id=payload.source_id,
            notes=payload.notes,
            posted_to_finance=False,
        )
        db.add(payment)
        db.flush()

        dr_account_id = payload.account_id
        if payload.method == "cash":
            dr_account = db.query(Account).filter(Account.code == "1010").first()
            dr_account_id = dr_account.id if dr_account else None
        elif payload.method in ("bank", "cheque", "online"):
            dr_account = db.query(Account).filter(Account.code == "1100").first()
            dr_account_id = dr_account.id if dr_account else None

        cr_account_id = None
        if payload.invoice_id:
            ar_account = db.query(Account).filter(Account.code == "1200").first()
            cr_account_id = ar_account.id if ar_account else None

        if dr_account_id and cr_account_id:
            journal = JournalService.create_journal_entry(
                db=db,
                entries=[
                    JournalEntryData(account_id=dr_account_id, debit=payload.amount,
                                     description=f"Payment #{payment.id}"),
                    JournalEntryData(account_id=cr_account_id, credit=payload.amount,
                                     description=f"Payment #{payment.id}"),
                ],
                reference_type="payment",
                reference_id=str(payment.id),
                description=f"Payment received: {payload.received_from or 'N/A'}",
                date=payment.date,
                user=user,
                source=payload.source or "MANUAL",
            )
            payment.posted_to_finance = True
            payment.finance_journal_id = journal.id

        if payload.invoice_id:
            invoice = db.query(Invoice).filter(Invoice.id == payload.invoice_id).first()
            if invoice:
                total_paid = (db.query(func.sum(Payment.amount))
                              .filter(Payment.invoice_id == payload.invoice_id)
                              .scalar() or Decimal("0"))
                invoice.paid_amount = total_paid
                invoice.remaining_amount = invoice.amount - total_paid
                if total_paid >= invoice.amount:
                    invoice.status = "paid"
                elif total_paid > 0:
                    invoice.status = "partial"

        db.commit()
        _log_audit(db, user, "CREATE", "payments", "Payment", str(payment.id),
                   f"Payment of {payload.amount} received", payload.amount)
        log_activity(
            db=db, user=user, action="create", module="finance",
            record_type="Payment", record_id=str(payment.id),
            record_label=f"Payment {payment.id}",
            new_values={k: str(v) for k, v in payment.__dict__.items() if not k.startswith('_')},
        )
        db.commit()
        await ws_manager.broadcast("payment_processed", {"payment_id": payment.id})
        db.refresh(payment)
        return payment
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payments", response_model=list[PaymentResponse])
async def list_payments(
    skip: int = 0,
    limit: int = 100,
    invoice_id: int | None = None,
    source: str | None = None,
    payment_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Payment)
    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    if source:
        query = query.filter(Payment.source == source)
    if payment_type:
        query = query.filter(Payment.payment_type == payment_type)
    if start_date:
        query = query.filter(Payment.date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Payment.date <= datetime.fromisoformat(end_date) + timedelta(days=1))
    return query.order_by(Payment.date.desc()).offset(skip).limit(limit).all()


# ── COMMISSION ENDPOINTS ────────────────────────────────────────────────────

def _commission_to_response(db: Session, c: Commission) -> CommissionResponse:
    dealer = db.query(Dealer).filter(Dealer.id == c.dealer_id).first() if c.dealer_id else None
    prop = db.query(Property).filter(Property.id == c.property_id).first()
    deal = db.query(Deal).filter(Deal.id == c.deal_id).first() if c.deal_id else None
    return CommissionResponse(
        id=c.id, agent_id=c.agent_id, dealer_id=c.dealer_id,
        dealer_name=dealer.name if dealer else None,
        dealer_code=dealer.dealer_id if dealer else None,
        property_id=c.property_id, property_code=prop.tid if prop else None,
        property_name=prop.name if prop else None,
        deal_id=c.deal_id, deal_code=deal.deal_id if deal else None,
        sale_amount=c.sale_amount, commission_rate=c.commission_rate,
        calculated_amount=c.calculated_amount, amount=c.amount,
        type=c.type, payment_status=c.payment_status or "unpaid",
        date=c.date, reference=c.reference, description=c.description,
        journal_id=c.journal_id, created_at=c.created_at,
    )


@router.get("/commissions/context/dealer/{dealer_id}")
async def commission_dealer_context(
    dealer_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    ctx = get_dealer_context(db, dealer_id)
    if not ctx:
        raise HTTPException(404, "Dealer not found")
    return ctx


@router.post("/commissions/calculate", response_model=CommissionCalculateResponse)
async def calculate_commission(
    payload: CommissionCalculateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    dealer = db.query(Dealer).filter(Dealer.id == payload.dealer_id).first()
    if not dealer:
        raise HTTPException(404, "Dealer not found")
    sale_amount = payload.sale_amount
    if sale_amount is None and payload.deal_id:
        deal = db.query(Deal).filter(Deal.id == payload.deal_id).first()
        if deal:
            sale_amount = deal.deal_value
    if sale_amount is None:
        prop = db.query(Property).filter(Property.id == payload.property_id).first()
        if prop and prop.sale_price:
            sale_amount = prop.sale_price
    if sale_amount is None:
        raise HTTPException(400, "Sale amount is required")
    rate = payload.commission_rate if payload.commission_rate is not None else dealer.commission_rate
    if rate is None:
        raise HTTPException(400, "Commission rate not set on dealer profile")
    calc = calculate_commission_amount(Decimal(str(sale_amount)), dealer.commission_type, Decimal(str(rate)))
    return CommissionCalculateResponse(
        sale_amount=Decimal(str(sale_amount)), commission_rate=Decimal(str(rate)),
        commission_type=dealer.commission_type, calculated_amount=calc,
    )


@router.post("/commissions", response_model=CommissionResponse)
async def create_commission(
    payload: CommissionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        dealer = db.query(Dealer).filter(Dealer.id == payload.dealer_id).first()
        if not dealer:
            raise HTTPException(404, "Dealer not found")
        prop = db.query(Property).filter(Property.id == payload.property_id).first()
        if not prop:
            raise HTTPException(404, "Property not found")
        sale_amount = payload.sale_amount
        if sale_amount is None and payload.deal_id:
            deal = db.query(Deal).filter(Deal.id == payload.deal_id).first()
            if deal:
                sale_amount = deal.deal_value
        if sale_amount is None and prop.sale_price:
            sale_amount = prop.sale_price
        if sale_amount is None:
            raise HTTPException(400, "Sale amount is required")
        rate = payload.commission_rate if payload.commission_rate is not None else dealer.commission_rate
        if rate is None:
            raise HTTPException(400, "Commission rate not configured for dealer")
        calculated = calculate_commission_amount(Decimal(str(sale_amount)), dealer.commission_type, Decimal(str(rate)))
        if payload.amount is not None and payload.allow_override:
            final_amount = Decimal(str(payload.amount))
        else:
            final_amount = calculated
        commission = Commission(
            dealer_id=payload.dealer_id, property_id=payload.property_id,
            deal_id=payload.deal_id, sale_amount=sale_amount,
            commission_rate=rate, calculated_amount=calculated,
            amount=final_amount, type=payload.type,
            payment_status="paid" if payload.type == "paid" else "unpaid",
            date=payload.date or datetime.utcnow(),
            reference=payload.reference, description=payload.description,
        )
        if not user.is_super_admin:
            commission.company_id = user.company_id
        db.add(commission)
        db.flush()

        if payload.type == "earned":
            dr_code, cr_code = "1250", "4200"
        else:
            dr_code, cr_code = "5200", "1000"
        dr_account = db.query(Account).filter(Account.code == dr_code).first()
        cr_account = db.query(Account).filter(Account.code == cr_code).first()
        if not dr_account or not cr_account:
            db.rollback()
            raise ValueError("Required commission accounts missing")
        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=final_amount,
                                 description=f"Commission #{commission.id} — {dealer.name}"),
                JournalEntryData(account_id=cr_account.id, credit=final_amount,
                                 description=f"Commission #{commission.id} — {dealer.name}"),
            ],
            reference_type="commission",
            reference_id=str(commission.id),
            description=payload.description or f"Commission {dealer.dealer_id} ({payload.type})",
            date=commission.date,
            user=user,
            source="MANUAL",
        )
        commission.journal_id = journal.id if journal else None

        if payload.type == "earned":
            entry = DealerLedgerEntry(
                tid=next_tid(db, DealerLedgerEntry, "DLE"),
                dealer_id=dealer.id, entry_date=commission.date,
                description=payload.description or f"Commission earned — {prop.name}",
                reference_no=payload.reference or f"COM-{commission.id}",
                entry_type="commission", debit=Decimal("0"), credit=final_amount,
                status="posted", commission_rate=rate if dealer.commission_type == "percentage" else None,
                gross_commission=final_amount, deal_id=commission.deal_id,
                journal_id=journal.id, created_by_user_id=user.id,
            )
            db.add(entry)

        db.commit()
        db.refresh(commission)
        _log_audit(db, user, "CREATE", "commissions", "Commission", str(commission.id),
                   f"Commission: {dealer.name} {final_amount}", final_amount)
        log_activity(
            db=db, user=user, action="create", module="finance",
            record_type="Commission", record_id=str(commission.id),
            record_label=f"Commission {commission.id}",
            new_values={k: str(v) for k, v in commission.__dict__.items() if not k.startswith('_')},
        )
        db.commit()
        await ws_manager.broadcast("journal_created", {"type": "commission", "commission_id": commission.id})
        return _commission_to_response(db, commission)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/commissions", response_model=list[CommissionResponse])
async def list_commissions(
    skip: int = 0, limit: int = 200,
    dealer_id: int | None = None, property_id: int | None = None,
    type: str | None = None, payment_status: str | None = None,
    db: Session = Depends(get_db), user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Commission)
    if not user.is_super_admin:
        query = query.filter(Commission.company_id == user.company_id)
    if dealer_id:
        query = query.filter(Commission.dealer_id == dealer_id)
    if property_id:
        query = query.filter(Commission.property_id == property_id)
    if type:
        query = query.filter(Commission.type == type)
    if payment_status:
        query = query.filter(Commission.payment_status == payment_status)
    rows = query.order_by(Commission.date.desc()).offset(skip).limit(limit).all()
    return [_commission_to_response(db, c) for c in rows]


@router.patch("/commissions/{commission_id}/mark-paid", response_model=CommissionResponse)
async def mark_commission_paid(
    commission_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    commission = db.query(Commission).filter(Commission.id == commission_id).first()
    if not commission:
        raise HTTPException(404, "Commission not found")
    if commission.type != "earned":
        raise HTTPException(400, "Only earned commissions can be marked paid")
    if commission.payment_status == "paid":
        return _commission_to_response(db, commission)
    dr_account = db.query(Account).filter(Account.code == "2100").first()
    cr_account = db.query(Account).filter(Account.code == "1100").first()
    if not dr_account or not cr_account:
        raise HTTPException(400, "Payout accounts not configured")
    payout = Commission(
        dealer_id=commission.dealer_id, property_id=commission.property_id,
        deal_id=commission.deal_id, sale_amount=commission.sale_amount,
        commission_rate=commission.commission_rate, calculated_amount=commission.amount,
        amount=commission.amount, type="paid", payment_status="paid",
        date=datetime.utcnow(), reference=f"PAYOUT-COM-{commission.id}",
        description=f"Payout for commission #{commission.id}",
        company_id=commission.company_id,
    )
    db.add(payout)
    commission.payment_status = "paid"
    JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=dr_account.id, debit=commission.amount,
                             description=f"Payout COM-{commission.id}"),
            JournalEntryData(account_id=cr_account.id, credit=commission.amount,
                             description=f"Payout COM-{commission.id}"),
        ],
        reference_type="commission",
        reference_id=str(payout.id),
        description=f"Commission payout #{commission.id}",
        date=payout.date, user=user, source="MANUAL",
    )
    db.commit()
    db.refresh(commission)
    _log_audit(db, user, "MARK_PAID", "commissions", "Commission", str(commission_id),
               f"Marked commission {commission_id} paid", commission.amount)
    log_activity(
        db=db, user=user, action="update", module="finance",
        record_type="Commission", record_id=str(commission_id),
        record_label=f"Commission {commission_id}",
        new_values={"payment_status": "paid"},
    )
    db.commit()
    return _commission_to_response(db, commission)


# ── EXPENSE ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        expense_account = db.query(Account).filter(Account.id == payload.account_id).first()
        if not expense_account:
            raise ValueError("Expense account not found")
        if expense_account.account_type != "Expense":
            raise ValueError("Selected account is not an Expense account")
        cash_code = "1010" if payload.paid_from == "cash" else "1100"
        cash_account = db.query(Account).filter(Account.code == cash_code).first()
        if not cash_account:
            raise ValueError("Cash/Bank account not found")
        expense = Expense(
            account_id=payload.account_id, paid_from=payload.paid_from,
            amount=payload.amount, date=payload.date or datetime.utcnow(),
            description=payload.description, reference=payload.reference,
            vendor_name=payload.vendor_name, invoice_bill_no=payload.invoice_bill_no,
            payment_method=payload.payment_method, payment_status=payload.payment_status or "pending",
            paid_from_account_id=payload.paid_from_account_id, property_id=payload.property_id,
            department=payload.department, is_recurring=payload.is_recurring,
            recurring_frequency=payload.recurring_frequency, next_due_date=payload.next_due_date,
            recurring_end_date=payload.recurring_end_date,
        )
        db.add(expense)
        db.flush()

        JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=expense_account.id, debit=payload.amount,
                                 description=payload.description),
                JournalEntryData(account_id=cash_account.id, credit=payload.amount,
                                 description=f"Expense #{expense.id}"),
            ],
            reference_type="expense",
            reference_id=str(expense.id),
            description=payload.description,
            date=expense.date, user=user, source="MANUAL",
        )
        db.commit()
        _log_audit(db, user, "CREATE", "expenses", "Expense", str(expense.id),
                   f"Expense: {payload.description}", payload.amount)
        log_activity(
            db=db, user=user, action="create", module="finance",
            record_type="Expense", record_id=str(expense.id),
            record_label=f"Expense {expense.id}",
            new_values={k: str(v) for k, v in expense.__dict__.items() if not k.startswith('_')},
        )
        db.commit()
        await ws_manager.broadcast("journal_created", {"type": "expense", "expense_id": expense.id})
        db.refresh(expense)
        return ExpenseResponse(
            id=expense.id, account_id=expense.account_id,
            account_name=expense_account.name, account_code=expense_account.code,
            paid_from=expense.paid_from, amount=expense.amount,
            date=expense.date, description=expense.description,
            reference=expense.reference, vendor_name=expense.vendor_name,
            invoice_bill_no=expense.invoice_bill_no, payment_method=expense.payment_method,
            payment_status=expense.payment_status, paid_from_account_id=expense.paid_from_account_id,
            property_id=expense.property_id, department=expense.department,
            is_recurring=expense.is_recurring, recurring_frequency=expense.recurring_frequency,
            next_due_date=expense.next_due_date, recurring_end_date=expense.recurring_end_date,
            created_at=expense.created_at,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/expenses", response_model=list[ExpenseResponse])
async def list_expenses(
    response: Response, skip: int = 0, limit: int | None = 100,
    offset: int | None = None, search: str | None = None,
    filter: str | None = None, startDate: date | None = None,
    endDate: date | None = None, payment_status: str | None = None,
    approval_status: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Expense, Account).join(Account, Expense.account_id == Account.id).order_by(Expense.date.desc())
    if payment_status:
        query = query.filter(Expense.payment_status == payment_status)
    if approval_status:
        query = query.filter(Expense.approval_status == approval_status)
    actual_offset = offset if offset is not None else skip
    query, total = apply_table_filters(
        query=query, model=Expense, limit=limit, offset=actual_offset,
        search=search, search_fields=[Expense.description, Expense.reference, Expense.vendor_name, Account.name, Account.code],
        date_filter=filter, date_field=Expense.date,
        start_date=startDate, end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    rows = query.all()
    return [ExpenseResponse(
        id=exp.id, account_id=exp.account_id, account_name=acc.name, account_code=acc.code,
        paid_from=exp.paid_from, amount=exp.amount, date=exp.date,
        description=exp.description, reference=exp.reference,
        vendor_name=exp.vendor_name, invoice_bill_no=exp.invoice_bill_no,
        payment_method=exp.payment_method, payment_status=exp.payment_status,
        paid_from_account_id=exp.paid_from_account_id, property_id=exp.property_id,
        department=exp.department, is_recurring=exp.is_recurring,
        recurring_frequency=exp.recurring_frequency, next_due_date=exp.next_due_date,
        recurring_end_date=exp.recurring_end_date, approval_status=exp.approval_status,
        approved_by=exp.approved_by, approved_at=exp.approved_at, created_at=exp.created_at,
    ) for exp, acc in rows]


@router.patch("/expenses/{expense_id}/approve")
async def approve_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    expense.approval_status = "approved"
    expense.approved_by = user.id
    expense.approved_at = datetime.utcnow()
    db.commit()
    return {"success": True}


# ── BANK / CASH ENDPOINTS ───────────────────────────────────────────────────

@router.get("/bank/balance")
async def get_bank_balance(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    account = db.query(Account).filter(Account.code == "1100").first()
    if not account:
        return {"balance": 0, "opening_balance": 0, "account_name": "Main Bank Account"}
    balance = JournalService.get_account_balance(db, account.id)
    last_tx = db.query(JournalEntry).join(Journal).filter(
        JournalEntry.account_id == account.id
    ).order_by(Journal.date.desc()).first()
    return {
        "balance": float(balance),
        "opening_balance": float(account.opening_balance or 0),
        "account_name": account.name,
        "last_transaction_date": last_tx.journal.date.isoformat() if last_tx else None,
    }


@router.get("/cash/balance")
async def get_cash_balance(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    account = db.query(Account).filter(Account.code == "1010").first()
    if not account:
        return {"balance": 0, "opening_balance": 0, "account_name": "Cash on Hand"}
    balance = JournalService.get_account_balance(db, account.id)
    last_tx = db.query(JournalEntry).join(Journal).filter(
        JournalEntry.account_id == account.id
    ).order_by(Journal.date.desc()).first()
    return {
        "balance": float(balance),
        "opening_balance": float(account.opening_balance or 0),
        "account_name": account.name,
        "last_transaction_date": last_tx.journal.date.isoformat() if last_tx else None,
    }


@router.get("/bank/transactions")
async def get_bank_transactions(
    start_date: str | None = None, end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    account = db.query(Account).filter(Account.code == "1100").first()
    if not account:
        return {"transactions": [], "opening_balance": 0, "total_in": 0, "total_out": 0}
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    ledger = JournalService.get_account_ledger(db, account.id, start, end)
    total_in = sum(Decimal(str(e["debit"])) for e in ledger if e["debit"] > 0)
    total_out = sum(Decimal(str(e["credit"])) for e in ledger if e["credit"] > 0)
    return {
        "transactions": ledger,
        "opening_balance": float(account.opening_balance or 0),
        "current_balance": float(JournalService.get_account_balance(db, account.id, end)),
        "total_in": float(total_in),
        "total_out": float(total_out),
    }


@router.get("/cash/transactions")
async def get_cash_transactions(
    start_date: str | None = None, end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    account = db.query(Account).filter(Account.code == "1010").first()
    if not account:
        return {"transactions": [], "opening_balance": 0, "total_in": 0, "total_out": 0}
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    ledger = JournalService.get_account_ledger(db, account.id, start, end)
    total_in = sum(Decimal(str(e["debit"])) for e in ledger if e["debit"] > 0)
    total_out = sum(Decimal(str(e["credit"])) for e in ledger if e["credit"] > 0)
    return {
        "transactions": ledger,
        "opening_balance": float(account.opening_balance or 0),
        "current_balance": float(JournalService.get_account_balance(db, account.id, end)),
        "total_in": float(total_in),
        "total_out": float(total_out),
    }


@router.post("/bank/payment")
async def bank_payment(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_permissions("finance:manage"))):
    return await _cash_bank_transaction(db, user, "1100", payload, is_payment=True)


@router.post("/bank/receipt")
async def bank_receipt(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_permissions("finance:manage"))):
    return await _cash_bank_transaction(db, user, "1100", payload, is_payment=False)


@router.post("/cash/payment")
async def cash_payment(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_permissions("finance:manage"))):
    return await _cash_bank_transaction(db, user, "1010", payload, is_payment=True)


@router.post("/cash/receipt")
async def cash_receipt(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_permissions("finance:manage"))):
    return await _cash_bank_transaction(db, user, "1010", payload, is_payment=False)


async def _cash_bank_transaction(db: Session, user: User, instrument_code: str, payload: dict, is_payment: bool) -> dict:
    try:
        account_id = payload.get("account_id")
        amount = Decimal(str(payload.get("amount", 0)))
        description = payload.get("description", "")
        date_str = payload.get("date")
        reference = payload.get("reference")
        date = datetime.fromisoformat(date_str) if date_str else datetime.utcnow()
        instrument = db.query(Account).filter(Account.code == instrument_code).first()
        contra = db.query(Account).filter(Account.id == account_id).first()
        if not instrument or not contra:
            raise ValueError("Account not found")
        if is_payment:
            entries = [
                JournalEntryData(account_id=contra.id, debit=amount, description=description),
                JournalEntryData(account_id=instrument.id, credit=amount, description=description),
            ]
            ref_type = "bank_payment" if instrument_code == "1100" else "cash_payment"
        else:
            entries = [
                JournalEntryData(account_id=instrument.id, debit=amount, description=description),
                JournalEntryData(account_id=contra.id, credit=amount, description=description),
            ]
            ref_type = "bank_receipt" if instrument_code == "1100" else "cash_receipt"
        journal = JournalService.create_journal_entry(
            db=db, entries=entries, reference_type=ref_type, reference_id=reference,
            description=description, date=date, user=user, source="MANUAL",
        )
        db.commit()
        await ws_manager.broadcast("journal_created", {"journal_id": journal.id, "type": ref_type})
        return {"id": journal.id, "reference_type": journal.reference_type, "date": str(journal.date)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── CRM SYNC ENDPOINTS ──────────────────────────────────────────────────────

@router.post("/sync/crm/booking-token", response_model=SyncPostResponse)
async def sync_booking_token(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """CRM Event 1: Booking Token Received"""
    try:
        booking_id = payload.get("booking_id")
        amount = Decimal(str(payload.get("amount", 0)))
        client_name = payload.get("client_name", "Unknown")
        property_name = payload.get("property_name", "Unknown")
        unit_name = payload.get("unit_name", "")
        payment_method = payload.get("payment_method", "bank")

        if payment_method == "cash":
            dr_account = db.query(Account).filter(Account.code == "1010").first()
        else:
            dr_account = db.query(Account).filter(Account.code == "1100").first()
        cr_account = db.query(Account).filter(Account.code == "4510").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Token received from {client_name} for {property_name} Unit {unit_name}"
        ref = f"BKG-{booking_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="booking",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(),
            user=user,
            source="CRM",
            is_editable=False,
        )
        db.commit()

        sync_log = SyncLog(
            source_module="CRM", source_record_type="booking",
            source_record_id=booking_id, action="booking_token",
            status="success", journal_id=journal.id,
        )
        db.add(sync_log)
        db.commit()
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "CRM", "booking", booking_id or 0, "booking_token", str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync/crm/down-payment", response_model=SyncPostResponse)
async def sync_down_payment(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """CRM Event 2: Down Payment Received (Deal)"""
    try:
        deal_id = payload.get("deal_id")
        amount = Decimal(str(payload.get("amount", 0)))
        client_name = payload.get("client_name", "Unknown")
        property_name = payload.get("property_name", "Unknown")
        unit_name = payload.get("unit_name", "")

        dr_account = db.query(Account).filter(Account.code == "1100").first()
        cr_account = db.query(Account).filter(Account.code == "4500").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Down payment from {client_name} for {property_name} Unit {unit_name}"
        ref = f"DEAL-{deal_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="deal",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="CRM", is_editable=False,
        )
        db.commit()
        _log_success(db, "CRM", "deal", deal_id or 0, "down_payment", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "CRM", "deal", deal_id or 0, "down_payment", str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync/crm/installment", response_model=SyncPostResponse)
async def sync_installment(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """CRM Event 3: Installment Payment Received"""
    try:
        deal_id = payload.get("deal_id")
        installment_id = payload.get("installment_id")
        installment_no = payload.get("installment_no", 1)
        amount = Decimal(str(payload.get("amount", 0)))
        client_name = payload.get("client_name", "Unknown")

        dr_account = db.query(Account).filter(Account.code == "1100").first()
        cr_account = db.query(Account).filter(Account.code == "4520").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Installment #{installment_no} received from {client_name}"
        ref = f"INS-{installment_id}/DEAL-{deal_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="installment",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="CRM", is_editable=False,
        )
        db.commit()
        _log_success(db, "CRM", "installment", installment_id or 0, "installment", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "CRM", "installment", installment_id or 0, "installment", str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync/crm/commission-earned", response_model=SyncPostResponse)
async def sync_commission_earned(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """CRM Event 4: Dealer Commission Earned"""
    try:
        deal_id = payload.get("deal_id")
        dealer_id = payload.get("dealer_id")
        dealer_name = payload.get("dealer_name", "Unknown")
        amount = Decimal(str(payload.get("amount", 0)))
        property_name = payload.get("property_name", "Unknown")

        dr_account = db.query(Account).filter(Account.code == "4200").first()
        cr_account = db.query(Account).filter(Account.code == "2100").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Commission earned by {dealer_name} on {property_name} deal"
        ref = f"DEAL-{deal_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="commission_earned",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="CRM", is_editable=False,
        )
        db.commit()
        _log_success(db, "CRM", "deal", deal_id or 0, "commission_earned", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "CRM", "deal", deal_id or 0, "commission_earned", str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync/crm/commission-paid", response_model=SyncPostResponse)
async def sync_commission_paid(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """CRM Event 5: Commission Paid to Dealer"""
    try:
        dealer_name = payload.get("dealer_name", "Unknown")
        amount = Decimal(str(payload.get("amount", 0)))
        commission_id = payload.get("commission_id")

        dr_account = db.query(Account).filter(Account.code == "2100").first()
        cr_account = db.query(Account).filter(Account.code == "1100").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Commission paid to {dealer_name}"
        ref = f"COM-{commission_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="commission_paid",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="CRM", is_editable=False,
        )
        db.commit()
        _log_success(db, "CRM", "commission", commission_id or 0, "commission_paid", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "CRM", "commission", commission_id or 0, "commission_paid", str(e))
        raise HTTPException(status_code=400, detail=str(e))


# ── PROPERTY SYNC ENDPOINTS ─────────────────────────────────────────────────

@router.post("/sync/property/rent-invoice", response_model=SyncPostResponse)
async def sync_rent_invoice(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Property Event 1: Rent Invoice Created"""
    try:
        lease_id = payload.get("lease_id")
        invoice_id = payload.get("invoice_id")
        amount = Decimal(str(payload.get("amount", 0)))
        unit_name = payload.get("unit_name", "Unknown")
        tenant_name = payload.get("tenant_name", "Unknown")
        month = payload.get("month", "")

        dr_account = db.query(Account).filter(Account.code == "1200").first()
        cr_account = db.query(Account).filter(Account.code == "4100").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Rent invoice for {unit_name} — {tenant_name} — {month}"
        ref = f"INV-{invoice_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="rent_invoice",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="PROPERTY", is_editable=False,
        )
        db.commit()
        _log_success(db, "PROPERTY", "invoice", invoice_id or 0, "rent_invoice", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "PROPERTY", "invoice", invoice_id or 0, "rent_invoice", str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync/property/rent-payment", response_model=SyncPostResponse)
async def sync_rent_payment(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Property Event 2: Rent Payment Received"""
    try:
        payment_id = payload.get("payment_id")
        invoice_id = payload.get("invoice_id")
        amount = Decimal(str(payload.get("amount", 0)))
        tenant_name = payload.get("tenant_name", "Unknown")
        unit_name = payload.get("unit_name", "Unknown")

        dr_account = db.query(Account).filter(Account.code == "1100").first()
        cr_account = db.query(Account).filter(Account.code == "1200").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Rent received from {tenant_name} for {unit_name}"
        ref = f"PAY-{payment_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="rent_payment",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="PROPERTY", is_editable=False,
        )
        db.commit()
        _log_success(db, "PROPERTY", "payment", payment_id or 0, "rent_payment", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "PROPERTY", "payment", payment_id or 0, "rent_payment", str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync/property/security-deposit", response_model=SyncPostResponse)
async def sync_security_deposit(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Property Event 3: Security Deposit Received"""
    try:
        lease_id = payload.get("lease_id")
        amount = Decimal(str(payload.get("amount", 0)))
        tenant_name = payload.get("tenant_name", "Unknown")
        unit_name = payload.get("unit_name", "Unknown")

        dr_account = db.query(Account).filter(Account.code == "1100").first()
        cr_account = db.query(Account).filter(Account.code == "2200").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Security deposit from {tenant_name} for {unit_name}"
        ref = f"LEASE-{lease_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="security_deposit",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="PROPERTY", is_editable=False,
        )
        db.commit()
        _log_success(db, "PROPERTY", "lease", lease_id or 0, "security_deposit", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "PROPERTY", "lease", lease_id or 0, "security_deposit", str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync/property/security-deposit-refund", response_model=SyncPostResponse)
async def sync_security_deposit_refund(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Property Event 4: Security Deposit Refunded"""
    try:
        lease_id = payload.get("lease_id")
        amount = Decimal(str(payload.get("amount", 0)))
        tenant_name = payload.get("tenant_name", "Unknown")
        unit_name = payload.get("unit_name", "Unknown")

        dr_account = db.query(Account).filter(Account.code == "2200").first()
        cr_account = db.query(Account).filter(Account.code == "1100").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Security deposit refunded to {tenant_name} for {unit_name}"
        ref = f"LEASE-{lease_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="security_deposit_refund",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="PROPERTY", is_editable=False,
        )
        db.commit()
        _log_success(db, "PROPERTY", "lease", lease_id or 0, "security_deposit_refund", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "PROPERTY", "lease", lease_id or 0, "security_deposit_refund", str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync/property/maintenance", response_model=SyncPostResponse)
async def sync_maintenance(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Property Event 5: Maintenance Expense"""
    try:
        property_id = payload.get("property_id")
        description = payload.get("description", "Maintenance")
        amount = Decimal(str(payload.get("amount", 0)))
        maintenance_id = payload.get("maintenance_id")
        is_payable = payload.get("is_payable", False)

        dr_account = db.query(Account).filter(Account.code == "5100").first()
        if is_payable:
            cr_account = db.query(Account).filter(Account.code == "2100").first()
        else:
            cr_account = db.query(Account).filter(Account.code == "1100").first()
        if not dr_account or not cr_account:
            return SyncPostResponse(success=False, message="Required accounts not found")

        narration = f"Maintenance: {description} at Property #{property_id}"
        ref = f"MNT-{maintenance_id}"

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=amount, description=narration),
                JournalEntryData(account_id=cr_account.id, credit=amount, description=narration),
            ],
            reference_type="maintenance",
            reference_id=ref,
            description=narration,
            date=datetime.utcnow(), user=user, source="PROPERTY", is_editable=False,
        )
        db.commit()
        _log_success(db, "PROPERTY", "maintenance", maintenance_id or 0, "maintenance", journal.id)
        return SyncPostResponse(success=True, journal_id=journal.id, message=narration)
    except Exception as e:
        _log_failure(db, "PROPERTY", "maintenance", maintenance_id or 0, "maintenance", str(e))
        raise HTTPException(status_code=400, detail=str(e))


def _log_success(db: Session, module: str, record_type: str, record_id: int, action: str, journal_id: int):
    sync_log = SyncLog(
        source_module=module, source_record_type=record_type,
        source_record_id=record_id, action=action,
        status="success", journal_id=journal_id,
    )
    db.add(sync_log)


def _log_failure(db: Session, module: str, record_type: str, record_id: int, action: str, error: str):
    sync_log = SyncLog(
        source_module=module, source_record_type=record_type,
        source_record_id=record_id, action=action,
        status="failed", error_message=error,
    )
    db.add(sync_log)
    db.commit()


@router.get("/sync/status/{module}/{record_type}/{record_id}", response_model=SyncStatusResponse)
async def get_sync_status(
    module: str, record_type: str, record_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    log = db.query(SyncLog).filter(
        SyncLog.source_module == module.upper(),
        SyncLog.source_record_type == record_type,
        SyncLog.source_record_id == record_id,
        SyncLog.status == "success",
    ).order_by(SyncLog.created_at.desc()).first()
    if log:
        return SyncStatusResponse(
            posted_to_finance=True,
            finance_journal_id=log.journal_id,
            status="posted",
            log_id=log.id,
        )
    failed = db.query(SyncLog).filter(
        SyncLog.source_module == module.upper(),
        SyncLog.source_record_type == record_type,
        SyncLog.source_record_id == record_id,
        SyncLog.status == "failed",
    ).order_by(SyncLog.created_at.desc()).first()
    if failed:
        return SyncStatusResponse(
            posted_to_finance=False,
            status="failed",
            error_message=failed.error_message,
            log_id=failed.id,
        )
    return SyncStatusResponse(posted_to_finance=False, status="pending")


@router.post("/sync/retry/{log_id}")
async def retry_sync(
    log_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    sync_log = db.query(SyncLog).filter(SyncLog.id == log_id).first()
    if not sync_log:
        raise HTTPException(404, "Sync log not found")
    sync_log.retry_count += 1
    sync_log.retried_at = datetime.utcnow()
    sync_log.status = "retried"
    db.commit()
    return {"success": True, "message": "Sync retry initiated"}


# ── DASHBOARD ENDPOINTS ─────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    first_of_last_month = (first_of_month - timedelta(days=1)).replace(day=1)

    bank_account = db.query(Account).filter(Account.code == "1100").first()
    cash_account = db.query(Account).filter(Account.code == "1010").first()

    bank_bal = JournalService.get_account_balance(db, bank_account.id) if bank_account else Decimal("0")
    cash_bal = JournalService.get_account_balance(db, cash_account.id) if cash_account else Decimal("0")

    bank_bal_last = JournalService.get_account_balance(db, bank_account.id, first_of_last_month) if bank_account else Decimal("0")
    cash_bal_last = JournalService.get_account_balance(db, cash_account.id, first_of_last_month) if cash_account else Decimal("0")

    income_accounts = db.query(Account).filter(Account.account_type == "Income").all()
    expense_accounts = db.query(Account).filter(Account.account_type == "Expense").all()

    total_income = sum(JournalService.get_account_balance(db, a.id) for a in income_accounts)
    total_expenses = sum(JournalService.get_account_balance(db, a.id) for a in expense_accounts)

    income_this = sum(
        JournalService.get_account_balance(db, a.id, now) -
        JournalService.get_account_balance(db, a.id, first_of_month)
        for a in income_accounts
    )
    expense_this = sum(
        JournalService.get_account_balance(db, a.id, now) -
        JournalService.get_account_balance(db, a.id, first_of_month)
        for a in expense_accounts
    )
    income_last = sum(
        JournalService.get_account_balance(db, a.id, first_of_month) -
        JournalService.get_account_balance(db, a.id, first_of_last_month)
        for a in income_accounts
    ) if first_of_last_month else Decimal("0")
    expense_last = sum(
        JournalService.get_account_balance(db, a.id, first_of_month) -
        JournalService.get_account_balance(db, a.id, first_of_last_month)
        for a in expense_accounts
    ) if first_of_last_month else Decimal("0")

    pending_invoices = db.query(Invoice).filter(Invoice.status.in_(["pending", "partial"])).all()
    pending_receivables = sum(i.remaining_amount for i in pending_invoices)

    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    overdue_invoices = db.query(Invoice).filter(
        Invoice.status.in_(["pending", "partial"]),
        Invoice.due_date < today,
    ).all()
    overdue_total = sum(i.remaining_amount for i in overdue_invoices)

    commission_payable = db.query(func.sum(Commission.amount)).filter(
        Commission.type == "earned",
        Commission.payment_status != "paid",
    ).scalar() or Decimal("0")

    def calc_change(current: Decimal, previous: Decimal) -> tuple[Decimal, bool]:
        if previous == 0:
            return (Decimal("0"), True)
        change = ((current - previous) / previous) * 100
        return (change, change >= 0)

    bank_change, bank_up = calc_change(bank_bal, bank_bal_last)
    cash_change, cash_up = calc_change(cash_bal, cash_bal_last)
    inc_change, inc_up = calc_change(income_this, income_last)
    exp_change, exp_up = calc_change(expense_this, expense_last)

    return DashboardResponse(
        bank_balance=DashboardKPI(label="Bank Balance", value=bank_bal, change_vs_last_month=bank_change, trend_up=bank_up),
        cash_balance=DashboardKPI(label="Cash Balance", value=cash_bal, change_vs_last_month=cash_change, trend_up=cash_up),
        total_income=DashboardKPI(label="Total Income", value=total_income, change_vs_last_month=inc_change, trend_up=inc_up),
        total_expenses=DashboardKPI(label="Total Expenses", value=total_expenses, change_vs_last_month=exp_change, trend_up=not exp_up),
        net_profit=DashboardKPI(label="Net Profit", value=total_income - total_expenses, change_vs_last_month=inc_change - exp_change, trend_up=income_this >= expense_this),
        pending_receivables=DashboardKPI(label="Pending Receivables", value=pending_receivables),
        overdue_invoices=DashboardKPI(label="Overdue Invoices", value=overdue_total),
        commission_payable=DashboardKPI(label="Commission Payable", value=commission_payable),
    )


@router.get("/dashboard/monthly-income-expense")
async def get_monthly_income_expense(
    months: int = 6,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    results = []
    now = datetime.utcnow()
    income_accounts = db.query(Account).filter(Account.account_type == "Income").all()
    expense_accounts = db.query(Account).filter(Account.account_type == "Expense").all()

    for i in range(months - 1, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start.replace(month=month_start.month % 12 + 1, year=month_start.year + (month_start.month // 12)) - timedelta(days=1)) if i > 0 else now

        income = sum(
            JournalService.get_account_balance(db, a.id, month_end) -
            JournalService.get_account_balance(db, a.id, month_start)
            for a in income_accounts
        )
        expense = sum(
            JournalService.get_account_balance(db, a.id, month_end) -
            JournalService.get_account_balance(db, a.id, month_start)
            for a in expense_accounts
        )
        results.append(MonthlyIncomeExpense(
            month=month_start.strftime("%b %Y"),
            income=income,
            expense=expense,
        ))
    return results


@router.get("/dashboard/cash-flow")
async def get_cash_flow(
    days: int = 30,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    bank_account = db.query(Account).filter(Account.code == "1100").first()
    cash_account = db.query(Account).filter(Account.code == "1010").first()
    if not bank_account or not cash_account:
        return []
    results = []
    now = datetime.utcnow().replace(hour=23, minute=59, second=59)

    bank_entries = db.query(JournalEntry).join(Journal).filter(
        JournalEntry.account_id.in_([bank_account.id, cash_account.id]),
        Journal.date >= now - timedelta(days=days),
    ).order_by(Journal.date).all()

    running = Decimal("0")
    for entry in bank_entries:
        running += entry.debit - entry.credit

    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        day_start = d.replace(hour=0, minute=0, second=0)
        day_end = d.replace(hour=23, minute=59, second=59)
        bal = JournalService.get_account_balance(db, bank_account.id, day_end) + JournalService.get_account_balance(db, cash_account.id, day_end)
        results.append(CashFlowPoint(date=d.strftime("%Y-%m-%d"), balance=bal))
    return results


@router.get("/dashboard/invoice-status")
async def get_invoice_status(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    statuses = ["paid", "partial", "pending"]
    results = []
    total_outstanding = Decimal("0")
    for status in statuses:
        invs = db.query(Invoice).filter(Invoice.status == status).all()
        total = sum(i.remaining_amount if status in ("partial", "pending") else i.amount for i in invs)
        if status == "pending":
            total_outstanding += total
        if status == "partial":
            total_outstanding += total
        results.append(InvoiceStatusCount(status=status, count=len(invs), amount=total))
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    overdue = db.query(Invoice).filter(
        Invoice.status.in_(["pending", "partial"]),
        Invoice.due_date < today,
    ).all()
    results.append(InvoiceStatusCount(
        status="overdue", count=len(overdue),
        amount=sum(i.remaining_amount for i in overdue),
    ))
    return {"statuses": results, "total_outstanding": total_outstanding}


@router.get("/dashboard/bank-cash-positions")
async def get_bank_cash_positions(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    accounts = db.query(Account).filter(
        Account.code.in_(["1010", "1100"]),
        Account.is_active.is_(True),
    ).all()
    results = []
    for acc in accounts:
        bal = JournalService.get_account_balance(db, acc.id)
        last_entry = db.query(JournalEntry).join(Journal).filter(
            JournalEntry.account_id == acc.id
        ).order_by(Journal.date.desc()).first()
        last_date = None
        if last_entry:
            je = db.query(Journal).filter(Journal.id == last_entry.journal_id).first()
            if je:
                last_date = je.date
        results.append(BankCashPosition(
            account_id=acc.id, code=acc.code, name=acc.name,
            balance=bal, last_transaction_date=last_date, status="active" if acc.is_active else "inactive",
        ))
    return results


# ── REPORT ENDPOINTS ────────────────────────────────────────────────────────

@router.get("/journals/reports/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    as_of_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    date = datetime.fromisoformat(as_of_date) if as_of_date else None
    rows = JournalService.get_trial_balance(db, date)
    total_debit = sum(Decimal(str(row["debit"])) for row in rows)
    total_credit = sum(Decimal(str(row["credit"])) for row in rows)
    return TrialBalanceResponse(
        rows=[TrialBalanceRow(**row) for row in rows],
        total_debit=total_debit,
        total_credit=total_credit,
    )


@router.get("/journals/reports/profit-loss", response_model=ProfitLossResponse)
async def get_profit_loss(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    accounts = db.query(Account).filter(Account.is_active.is_(True)).all()

    income_rows, expense_rows = [], []
    for account in accounts:
        if account.account_type == "Income":
            balance = JournalService.get_account_balance(db, account.id, end)
            if start:
                opening = JournalService.get_account_balance(db, account.id, start)
                balance = balance - opening
            income_rows.append(ProfitLossRow(
                account_id=account.id, code=account.code, name=account.name, amount=balance
            ))
        elif account.account_type == "Expense":
            balance = JournalService.get_account_balance(db, account.id, end)
            if start:
                opening = JournalService.get_account_balance(db, account.id, start)
                balance = balance - opening
            expense_rows.append(ProfitLossRow(
                account_id=account.id, code=account.code, name=account.name, amount=balance
            ))

    total_income = sum(r.amount for r in income_rows)
    total_expenses = sum(r.amount for r in expense_rows)
    return ProfitLossResponse(
        income=income_rows, expenses=expense_rows,
        total_income=total_income, total_expenses=total_expenses,
        net_profit=total_income - total_expenses,
    )


@router.get("/journals/reports/balance-sheet")
async def get_balance_sheet(
    as_of_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    date = datetime.fromisoformat(as_of_date) if as_of_date else None
    accounts = db.query(Account).filter(Account.is_active.is_(True)).order_by(Account.code).all()
    assets = []
    liabilities = []
    equity = []
    for acc in accounts:
        bal = JournalService.get_account_balance(db, acc.id, date)
        if acc.account_type == "Asset":
            assets.append({"code": acc.code, "name": acc.name, "balance": float(bal)})
        elif acc.account_type == "Liability":
            liabilities.append({"code": acc.code, "name": acc.name, "balance": float(bal)})
        elif acc.account_type == "Equity":
            equity.append({"code": acc.code, "name": acc.name, "balance": float(bal)})
    return {
        "assets": {"accounts": assets, "total": float(sum(a["balance"] for a in assets))},
        "liabilities": {"accounts": liabilities, "total": float(sum(l["balance"] for l in liabilities))},
        "equity": {"accounts": equity, "total": float(sum(e["balance"] for e in equity))},
    }


@router.get("/journals/reports/cash-flow")
async def get_cash_flow_report(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None

    bank_account = db.query(Account).filter(Account.code == "1100").first()
    cash_account = db.query(Account).filter(Account.code == "1010").first()
    if not bank_account or not cash_account:
        return {"operating": 0, "investing": 0, "financing": 0, "net_movement": 0}

    bank_start = JournalService.get_account_balance(db, bank_account.id, start) if start else JournalService.get_account_balance(db, bank_account.id)
    cash_start = JournalService.get_account_balance(db, cash_account.id, start) if start else JournalService.get_account_balance(db, cash_account.id)
    bank_end = JournalService.get_account_balance(db, bank_account.id, end) if end else JournalService.get_account_balance(db, bank_account.id)
    cash_end = JournalService.get_account_balance(db, cash_account.id, end) if end else JournalService.get_account_balance(db, cash_account.id)

    income_entries = db.query(JournalEntry).join(Journal).join(Account, JournalEntry.account_id == Account.id).filter(
        Account.account_type == "Income",
    )
    expense_entries = db.query(JournalEntry).join(Journal).join(Account, JournalEntry.account_id == Account.id).filter(
        Account.account_type == "Expense",
    )
    if start:
        income_entries = income_entries.filter(Journal.date >= start)
        expense_entries = expense_entries.filter(Journal.date >= start)
    if end:
        income_entries = income_entries.filter(Journal.date <= end)
        expense_entries = expense_entries.filter(Journal.date <= end)

    operating = (sum(e.debit - e.credit for e in income_entries.all() or []) -
                 sum(e.debit - e.credit for e in expense_entries.all() or []))
    net = (bank_end + cash_end) - (bank_start + cash_start)
    return {
        "operating": float(operating),
        "investing": 0,
        "financing": 0,
        "net_movement": float(net),
        "opening_balance": float(bank_start + cash_start),
        "closing_balance": float(bank_end + cash_end),
    }


@router.get("/journals/reports/receivables-aging")
async def get_receivables_aging(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    buckets = {
        "0_30": {"label": "0-30 days", "invoices": [], "total": Decimal("0")},
        "31_60": {"label": "31-60 days", "invoices": [], "total": Decimal("0")},
        "61_90": {"label": "61-90 days", "invoices": [], "total": Decimal("0")},
        "90_plus": {"label": "90+ days", "invoices": [], "total": Decimal("0")},
    }
    overdue = db.query(Invoice).filter(
        Invoice.status.in_(["pending", "partial"]),
        Invoice.due_date < today,
    ).all()

    for inv in overdue:
        days_overdue = (today - inv.due_date.replace(tzinfo=None)).days if inv.due_date else 0
        key = "0_30"
        if days_overdue > 90:
            key = "90_plus"
        elif days_overdue > 60:
            key = "61_90"
        elif days_overdue > 30:
            key = "31_60"
        buckets[key]["invoices"].append({
            "id": inv.id, "client": inv.client_name or f"Tenant #{inv.tenant_id}",
            "amount": float(inv.remaining_amount), "due_date": inv.due_date.isoformat(),
            "days_overdue": days_overdue,
        })
        buckets[key]["total"] += inv.remaining_amount

    return [{"label": v["label"], "invoices": v["invoices"], "total": float(v["total"])} for v in buckets.values()]


@router.get("/journals/reports/property-income")
async def get_property_income_report(
    property_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Property)
    if property_id:
        query = query.filter(Property.id == property_id)
    properties = query.all()
    results = []
    for prop in properties:
        invoices = db.query(Invoice).filter(Invoice.property_id == prop.id).all()
        income = sum(i.amount for i in invoices if i.status == "paid")
        expenses = db.query(Expense).filter(Expense.property_id == prop.id).all()
        expense_total = sum(e.amount for e in expenses)
        leases = db.query(Lease).filter(Lease.property_id == prop.id).all()
        total_units = len(prop.units or [])
        occupied_units = len([u for u in (prop.units or []) if u.status == "occupied"])
        occupancy_rate = (occupied_units / total_units * 100) if total_units > 0 else 0
        rental_yield = (income / (prop.sale_price or 1) * 100) if prop.sale_price else 0
        results.append({
            "property_id": prop.id, "property_name": prop.name,
            "income": float(income), "expenses": float(expense_total),
            "net": float(income - expense_total),
            "occupancy_rate": round(occupancy_rate, 1),
            "rental_yield": round(float(rental_yield), 2),
        })
    return results


@router.get("/journals/reports/dealer-commission")
async def get_dealer_commission_report(
    dealer_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Commission)
    if dealer_id:
        query = query.filter(Commission.dealer_id == dealer_id)
    if start_date:
        query = query.filter(Commission.date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Commission.date <= datetime.fromisoformat(end_date))
    commissions = query.order_by(Commission.date.desc()).all()
    dealers_map = {}
    for c in commissions:
        dealer = db.query(Dealer).filter(Dealer.id == c.dealer_id).first() if c.dealer_id else None
        dealer_name = dealer.name if dealer else f"Dealer #{c.dealer_id}"
        if dealer_name not in dealers_map:
            dealers_map[dealer_name] = {"deals": 0, "sales_value": Decimal("0"), "commission": Decimal("0"), "paid": Decimal("0"), "pending": Decimal("0")}
        dealers_map[dealer_name]["deals"] += 1
        if c.sale_amount:
            dealers_map[dealer_name]["sales_value"] += c.sale_amount
        dealers_map[dealer_name]["commission"] += c.amount
        if c.payment_status == "paid":
            dealers_map[dealer_name]["paid"] += c.amount
        else:
            dealers_map[dealer_name]["pending"] += c.amount

    return [{"dealer_name": k, **v} for k, v in dealers_map.items()]


@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    income_accounts = db.query(Account).filter(Account.account_type == "Income").all()
    expense_accounts = db.query(Account).filter(Account.account_type == "Expense").all()
    income = sum(float(JournalService.get_account_balance(db, a.id)) for a in income_accounts)
    expense = sum(float(JournalService.get_account_balance(db, a.id)) for a in expense_accounts)
    return {"income": income, "expense": expense}


# ── LEDGER ENDPOINTS ────────────────────────────────────────────────────────

@router.get("/client-ledger/{client_id}")
async def get_client_ledger(client_id: int, db: Session = Depends(get_db), _=Depends(require_any_permission("finance:manage", "finance:view"))):
    client = db.query(Client).filter(Client.id == client_id).first()
    invoices = db.query(Invoice).filter(Invoice.client_id == client_id).order_by(Invoice.created_at).all()
    payments = db.query(Payment).filter(Payment.source == "CRM", Payment.source_id == client_id).order_by(Payment.date).all()
    transactions = []
    for inv in invoices:
        transactions.append({"date": inv.created_at, "type": "invoice", "description": f"Invoice #{inv.id}", "debit": inv.amount, "credit": Decimal("0"), "balance": Decimal("0")})
    for pmt in payments:
        transactions.append({"date": pmt.date, "type": "payment", "description": f"Payment #{pmt.id}", "debit": Decimal("0"), "credit": pmt.amount, "balance": Decimal("0")})
    transactions.sort(key=lambda t: t["date"])
    running = Decimal("0")
    for t in transactions:
        running += t["debit"] - t["credit"]
        t["balance"] = running
    total_invoiced = sum(t["debit"] for t in transactions)
    total_paid = sum(t["credit"] for t in transactions)
    return {
        "client_id": client_id,
        "client_name": client.name if client else f"Client #{client_id}",
        "transactions": transactions,
        "total_invoiced": float(total_invoiced),
        "total_paid": float(total_paid),
        "balance_outstanding": float(total_invoiced - total_paid),
    }


@router.get("/dealer-ledger/{dealer_id}")
async def get_dealer_ledger(dealer_id: int, db: Session = Depends(get_db), _=Depends(require_any_permission("finance:manage", "finance:view"))):
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    commissions = db.query(Commission).filter(Commission.dealer_id == dealer_id).order_by(Commission.date).all()
    total_earned = sum(c.amount for c in commissions if c.type == "earned")
    total_paid = sum(c.amount for c in commissions if c.type == "paid")
    return {
        "dealer_id": dealer_id,
        "dealer_name": dealer.name if dealer else f"Dealer #{dealer_id}",
        "commissions": [{"id": c.id, "date": c.date, "type": c.type, "amount": float(c.amount), "status": c.payment_status} for c in commissions],
        "total_earned": float(total_earned),
        "total_paid": float(total_paid),
        "balance_payable": float(total_earned - total_paid),
    }


@router.get("/property-ledger/{property_id}")
async def get_property_ledger(property_id: int, db: Session = Depends(get_db), _=Depends(require_any_permission("finance:manage", "finance:view"))):
    prop = db.query(Property).filter(Property.id == property_id).first()
    invoices = db.query(Invoice).filter(Invoice.property_id == property_id).all()
    expenses = db.query(Expense).filter(Expense.property_id == property_id).all()
    income_total = sum(i.amount for i in invoices if i.status == "paid")
    expense_total = sum(e.amount for e in expenses)
    return {
        "property_id": property_id,
        "property_name": prop.name if prop else f"Property #{property_id}",
        "total_income": float(income_total),
        "total_expenses": float(expense_total),
        "net_position": float(income_total - expense_total),
        "transactions": [
            *[{"date": i.created_at, "type": "income", "description": f"Invoice #{i.id}", "amount": float(i.amount)} for i in invoices],
            *[{"date": e.date, "type": "expense", "description": e.description, "amount": float(e.amount)} for e in expenses],
        ],
    }


# ── AUDIT LOG ENDPOINT ──────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [{
        "id": l.id, "user_email": l.user_email, "action": l.action,
        "module": l.module, "record_type": l.record_type, "record_id": l.record_id,
        "description": l.description, "amount": float(l.amount) if l.amount else None,
        "created_at": l.created_at.isoformat(),
    } for l in logs]
