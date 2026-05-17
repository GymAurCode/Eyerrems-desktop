from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permissions, require_any_permission
from app.core.database import get_db
from app.core.default_coa import SYSTEM_ACCOUNT_CODES
from app.core.journal_service import JournalService, JournalEntryData
from app.core.websocket_manager import ws_manager
from app.models.auth import User
from app.models.finance import (
    Account, Commission, Expense, Invoice, Journal, JournalEntry, Payment
)
from app.schemas.finance import (
    AccountCreate, AccountResponse, AccountTreeNode, AccountUpdate, AccountWithBalance,
    CommissionCreate, CommissionResponse,
    ExpenseCreate, ExpenseResponse,
    InvoiceCreate, InvoiceResponse, InvoiceUpdate,
    JournalCreate, JournalResponse,
    LedgerEntryResponse,
    PaymentCreate, PaymentResponse,
    ProfitLossResponse, ProfitLossRow,
    TrialBalanceResponse, TrialBalanceRow,
    GeneralLedgerResponse,
)

router = APIRouter()


# ==================== ACCOUNT ENDPOINTS ====================

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
    db.commit()
    db.refresh(account)
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
    """Return full hierarchical COA tree, optionally with live balances."""
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
            node = {
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "account_type": acc.account_type,
                "type": acc.account_type,
                "description": acc.description,
                "is_active": acc.is_active,
                "parent_id": acc.parent_id,
                "balance": float(balance),
                "children": build_tree(acc.id),
            }
            result.append(node)
        return result

    return build_tree(None)


@router.get("/accounts/{account_id}/balance")
async def get_account_balance(
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
    if payload.is_active is False:
        if db.query(JournalEntry).filter(JournalEntry.account_id == account_id).count() > 0:
            raise HTTPException(status_code=400, detail="Cannot deactivate account with journal entries")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
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
    if account.code in SYSTEM_ACCOUNT_CODES:
        raise HTTPException(status_code=400, detail="Cannot delete a system account")
    if db.query(JournalEntry).filter(JournalEntry.account_id == account_id).count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete account with journal entries")
    if db.query(Account).filter(Account.parent_id == account_id).count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete account with sub-accounts")
    db.delete(account)
    db.commit()
    await ws_manager.broadcast("finance_updated", {"type": "account_deleted", "account_id": account_id})
    return {"deleted": True}


# ==================== JOURNAL ENDPOINTS ====================

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
        )
        db.commit()
        db.refresh(journal)
        await ws_manager.broadcast("journal_created", {"journal_id": journal.id})
        return journal
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/journals", response_model=list[JournalResponse])
async def list_journals(
    skip: int = 0,
    limit: int = 100,
    reference_type: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Journal)
    if reference_type:
        query = query.filter(Journal.reference_type == reference_type)
    return query.order_by(Journal.date.desc()).offset(skip).limit(limit).all()


@router.get("/journals/{journal_id}", response_model=JournalResponse)
async def get_journal(
    journal_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    return journal


# ==================== LEDGER ENDPOINT ====================

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
    opening_balance = JournalService.get_account_balance(db, account_id, start) if start else Decimal("0")
    closing_balance = JournalService.get_account_balance(db, account_id, end)
    return GeneralLedgerResponse(
        account_id=account.id,
        code=account.code,
        name=account.name,
        type=account.account_type,
        entries=[LedgerEntryResponse(**e) for e in entries],
        opening_balance=opening_balance,
        closing_balance=closing_balance,
    )


# ==================== INVOICE ENDPOINTS ====================

@router.post("/invoices", response_model=InvoiceResponse)
async def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        invoice = Invoice(**payload.model_dump())
        db.add(invoice)
        db.flush()

        ar_account = db.query(Account).filter(Account.code == "1200").first()
        income_account = db.query(Account).filter(Account.code == "4100").first()
        if not ar_account or not income_account:
            db.rollback()
            raise ValueError("Required accounts missing. Run seed_finance.py first.")

        JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=ar_account.id, debit=payload.amount,
                                 description=f"Invoice #{invoice.id} - AR"),
                JournalEntryData(account_id=income_account.id, credit=payload.amount,
                                 description=f"Invoice #{invoice.id} - Rent Income"),
            ],
            reference_type="invoice",
            reference_id=str(invoice.id),
            description=payload.description or f"Invoice #{invoice.id}",
            date=datetime.utcnow(),
            user=user,
        )
        db.commit()
        await ws_manager.broadcast("invoice_created", {"invoice_id": invoice.id})
        return invoice
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Invoice)
    if status:
        query = query.filter(Invoice.status == status)
    if tenant_id:
        query = query.filter(Invoice.tenant_id == tenant_id)
    return query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
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
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(invoice, field, value)
    db.commit()
    db.refresh(invoice)
    await ws_manager.broadcast("invoice_updated", {"invoice_id": invoice.id})
    return invoice


# ==================== PAYMENT ENDPOINTS ====================

@router.post("/payments", response_model=PaymentResponse)
async def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        invoice = db.query(Invoice).filter(Invoice.id == payload.invoice_id).first()
        if not invoice:
            raise ValueError("Invoice not found")

        payment = Payment(
            invoice_id=payload.invoice_id,
            method=payload.method,
            amount=payload.amount,
            date=payload.date or datetime.utcnow(),
            reference_number=payload.reference_number,
        )
        db.add(payment)
        db.flush()

        cash_code = "1010" if payload.method == "cash" else "1100"
        cash_account = db.query(Account).filter(Account.code == cash_code).first()
        ar_account = db.query(Account).filter(Account.code == "1200").first()
        if not cash_account or not ar_account:
            db.rollback()
            raise ValueError("Required accounts missing. Run seed_finance.py first.")

        JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=cash_account.id, debit=payload.amount,
                                 description=f"Payment #{payment.id} - Invoice #{payload.invoice_id}"),
                JournalEntryData(account_id=ar_account.id, credit=payload.amount,
                                 description=f"Payment #{payment.id} - AR cleared"),
            ],
            reference_type="payment",
            reference_id=str(payment.id),
            description=f"Payment for Invoice #{payload.invoice_id}",
            date=payment.date,
            user=user,
        )

        # Update invoice status
        total_paid = db.query(func.sum(Payment.amount)).filter(
            Payment.invoice_id == payload.invoice_id
        ).scalar() or Decimal("0")
        if total_paid >= invoice.amount:
            invoice.status = "paid"
        elif total_paid > 0:
            invoice.status = "partial"

        db.commit()
        await ws_manager.broadcast("payment_processed", {"invoice_id": payload.invoice_id, "payment_id": payment.id})
        return payment
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payments", response_model=list[PaymentResponse])
async def list_payments(
    skip: int = 0,
    limit: int = 100,
    invoice_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Payment)
    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    return query.order_by(Payment.date.desc()).offset(skip).limit(limit).all()


# ==================== COMMISSION ENDPOINTS ====================

@router.post("/commissions", response_model=CommissionResponse)
async def create_commission(
    payload: CommissionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        commission = Commission(**payload.model_dump(exclude_unset=True))
        commission.date = commission.date or datetime.utcnow()
        db.add(commission)
        db.flush()

        if payload.type == "earned":
            dr_code, cr_code = "1250", "4200"  # Commission AR → Commission Income
        else:
            dr_code, cr_code = "5200", "1000"  # Commission Expense → Bank

        dr_account = db.query(Account).filter(Account.code == dr_code).first()
        cr_account = db.query(Account).filter(Account.code == cr_code).first()
        if not dr_account or not cr_account:
            db.rollback()
            raise ValueError("Required commission accounts missing. Run seed_finance.py first.")

        JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=dr_account.id, debit=payload.amount,
                                 description=f"Commission #{commission.id}"),
                JournalEntryData(account_id=cr_account.id, credit=payload.amount,
                                 description=f"Commission #{commission.id}"),
            ],
            reference_type="commission",
            reference_id=str(commission.id),
            description=payload.description or f"Commission #{commission.id} ({payload.type})",
            date=commission.date,
            user=user,
        )
        db.commit()
        await ws_manager.broadcast("journal_created", {"type": "commission", "commission_id": commission.id})
        return commission
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/commissions", response_model=list[CommissionResponse])
async def list_commissions(
    skip: int = 0,
    limit: int = 100,
    agent_id: int | None = None,
    type: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Commission)
    if agent_id:
        query = query.filter(Commission.agent_id == agent_id)
    if type:
        query = query.filter(Commission.type == type)
    return query.order_by(Commission.date.desc()).offset(skip).limit(limit).all()


# ==================== EXPENSE ENDPOINTS ====================

@router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Record expense with double-entry: Debit Expense, Credit Cash/Bank"""
    try:
        expense_account = db.query(Account).filter(Account.id == payload.account_id).first()
        if not expense_account:
            raise ValueError("Expense account not found")
        if expense_account.account_type != "Expense":
            raise ValueError("Selected account is not an Expense account")

        cash_code = "1010" if payload.paid_from == "cash" else "1100"
        cash_account = db.query(Account).filter(Account.code == cash_code).first()
        if not cash_account:
            raise ValueError("Cash/Bank account not found. Run seed_finance.py first.")

        expense = Expense(
            account_id=payload.account_id,
            paid_from=payload.paid_from,
            amount=payload.amount,
            date=payload.date or datetime.utcnow(),
            description=payload.description,
            reference=payload.reference,
        )
        db.add(expense)
        db.flush()

        JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=expense_account.id, debit=payload.amount,
                                 description=payload.description),
                JournalEntryData(account_id=cash_account.id, credit=payload.amount,
                                 description=f"Expense #{expense.id} - {payload.paid_from}"),
            ],
            reference_type="expense",
            reference_id=str(expense.id),
            description=payload.description,
            date=expense.date,
            user=user,
        )
        db.commit()
        await ws_manager.broadcast("journal_created", {"type": "expense", "expense_id": expense.id})
        return ExpenseResponse(
            id=expense.id,
            account_id=expense.account_id,
            account_name=expense_account.name,
            account_code=expense_account.code,
            paid_from=expense.paid_from,
            amount=expense.amount,
            date=expense.date,
            description=expense.description,
            reference=expense.reference,
            created_at=expense.created_at,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/expenses", response_model=list[ExpenseResponse])
async def list_expenses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    rows = (
        db.query(Expense, Account)
        .join(Account, Expense.account_id == Account.id)
        .order_by(Expense.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        ExpenseResponse(
            id=exp.id,
            account_id=exp.account_id,
            account_name=acc.name,
            account_code=acc.code,
            paid_from=exp.paid_from,
            amount=exp.amount,
            date=exp.date,
            description=exp.description,
            reference=exp.reference,
            created_at=exp.created_at,
        )
        for exp, acc in rows
    ]


# ==================== BANK / CASH BALANCE ENDPOINTS ====================

@router.get("/bank/balance")
async def get_bank_balance(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    """Bank balance derived from journal entries (account 1100)"""
    account = db.query(Account).filter(Account.code == "1100").first()
    if not account:
        return {"balance": 0}
    balance = JournalService.get_account_balance(db, account.id)
    return {"balance": float(balance)}


@router.get("/cash/balance")
async def get_cash_balance(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    """Cash balance derived from journal entries (account 1010)"""
    account = db.query(Account).filter(Account.code == "1010").first()
    if not account:
        return {"balance": 0}
    balance = JournalService.get_account_balance(db, account.id)
    return {"balance": float(balance)}


@router.post("/bank/payment")
async def bank_payment(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Record bank payment: Debit contra account, Credit Bank"""
    return await _cash_bank_transaction(db, user, "1100", payload, is_payment=True)


@router.post("/bank/receipt")
async def bank_receipt(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Record bank receipt: Debit Bank, Credit contra account"""
    return await _cash_bank_transaction(db, user, "1100", payload, is_payment=False)


@router.post("/cash/payment")
async def cash_payment(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Record cash payment: Debit contra account, Credit Cash"""
    return await _cash_bank_transaction(db, user, "1010", payload, is_payment=True)


@router.post("/cash/receipt")
async def cash_receipt(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Record cash receipt: Debit Cash, Credit contra account"""
    return await _cash_bank_transaction(db, user, "1010", payload, is_payment=False)


async def _cash_bank_transaction(
    db: Session,
    user: User,
    instrument_code: str,
    payload: dict,
    is_payment: bool,
) -> dict:
    """
    Generic cash/bank transaction helper.
    Payment: Debit contra_account, Credit instrument
    Receipt: Debit instrument, Credit contra_account
    """
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
            db=db,
            entries=entries,
            reference_type=ref_type,
            reference_id=reference,
            description=description,
            date=date,
            user=user,
        )
        db.commit()
        await ws_manager.broadcast("journal_created", {"journal_id": journal.id, "type": ref_type})
        return {"id": journal.id, "reference_type": journal.reference_type, "date": str(journal.date)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ==================== REPORT ENDPOINTS ====================

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
        income=income_rows,
        expenses=expense_rows,
        total_income=total_income,
        total_expenses=total_expenses,
        net_profit=total_income - total_expenses,
    )


# ==================== LEGACY SUMMARY (kept for dashboard compat) ====================

@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    """Quick income/expense summary from journal entries"""
    income_accounts = db.query(Account).filter(Account.account_type == "Income").all()
    expense_accounts = db.query(Account).filter(Account.account_type == "Expense").all()
    income = sum(float(JournalService.get_account_balance(db, a.id)) for a in income_accounts)
    expense = sum(float(JournalService.get_account_balance(db, a.id)) for a in expense_accounts)
    return {"income": income, "expense": expense}
