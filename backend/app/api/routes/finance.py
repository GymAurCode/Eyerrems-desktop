import time
from decimal import Decimal
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, Query
from pydantic import BaseModel
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session, joinedload
from app.core.table_query import apply_table_filters

from app.api.deps import get_current_user, require_permissions, require_any_permission, require_roles
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
    Account, Commission, Expense, ExpenseItem, Invoice, Journal, JournalEntry, Payment, SyncLog, AuditLog, Vendor
)
from app.models.property import Property, Lease, Unit
from app.models.tenant import Tenant
from app.models.ledger import DealerLedgerEntry
from app.core.tid import next_tid
from app.services.commission_service import calculate_commission_amount, get_dealer_context
from app.schemas.finance import (
    AccountCreate, AccountResponse, AccountTreeNode, AccountUpdate, AccountWithBalance,
    CommissionCreate, CommissionResponse, CommissionCalculateRequest, CommissionCalculateResponse,
    ExpenseCreate, ExpenseResponse, ExpenseUpdate, ExpenseSubmit,
    ExpenseApprove, ExpenseReject, ExpenseRecordPayment,
    ExpenseLineItemCreate, ExpenseLineItemResponse, ExpenseListResponse,
    InvoiceCreate, InvoiceResponse, InvoiceUpdate, InvoiceLineItem, AutoGenerateInvoice, InvoiceReportRow,
    JournalCreate, JournalUpdate, JournalSubmit, JournalApprove, JournalReverse, JournalReject,
    JournalResponse, JournalListResponse, JournalEntryResponse,
    LedgerEntryResponse,
    PaymentCreate, PaymentResponse, PaymentUpdate, PaymentReverse, PaymentRefund,
    PaymentReceipt, PaymentResponse, PaymentListResponse, PaymentSearchInvoice,
    ProfitLossResponse, ProfitLossRow,
    TrialBalanceResponse, TrialBalanceRow,
    GeneralLedgerResponse,
    DayBookEntry, DayBookResponse,
    CashBookEntry, CashBookResponse,
    BankBookEntry, BankBookResponse,
    SyncPostResponse, SyncStatusResponse,
    DashboardKPI, DashboardResponse,
    MonthlyIncomeExpense, CashFlowPoint, InvoiceStatusCount, BankCashPosition,
    VendorCreate, VendorUpdate, VendorResponse,
)

router = APIRouter()


# ── Helper ──────────────────────────────────────────────────────────────────

def _journal_to_response(db: Session, j: Journal) -> JournalResponse:
    entries_resp = []
    for e in j.entries:
        acc = db.query(Account).filter(Account.id == e.account_id).first()
        entries_resp.append(JournalEntryResponse(
            id=e.id, journal_id=e.journal_id, account_id=e.account_id,
            debit=e.debit, credit=e.credit, narration=e.narration, description=e.description,
            cost_center=e.cost_center, department=e.department,
            project_id=e.project_id, property_id=e.property_id,
            building=e.building, floor=e.floor, unit_id=e.unit_id,
            customer_id=e.customer_id, vendor_id=e.vendor_id, employee_id=e.employee_id,
            tax_code=e.tax_code, tax_amount=e.tax_amount,
            reference=e.reference, memo=e.memo, sort_order=e.sort_order,
            account_code=acc.code if acc else None,
            account_name=f"{acc.code} — {acc.name}" if acc else None,
        ))
    dr_total = sum(e.debit for e in j.entries)
    cr_total = sum(e.credit for e in j.entries)
    return JournalResponse(
        id=j.id, journal_number=j.journal_number, date=j.date,
        reference_type=j.reference_type, reference_id=j.reference_id,
        description=j.description, source=j.source or "MANUAL",
        source_module=j.source_module, source_document_id=j.source_document_id,
        source_document_number=j.source_document_number, source_document_status=j.source_document_status,
        source_document_date=j.source_document_date,
        status=j.status, is_editable=j.is_editable if j.is_editable is not None else True,
        is_reversal=j.is_reversal, reversal_of=j.reversal_of, reversal_reason=j.reversal_reason,
        approved_by=j.approved_by, approved_at=j.approved_at,
        posted_by=j.posted_by, posted_at=j.posted_at,
        submitted_by=j.submitted_by, submitted_at=j.submitted_at,
        rejected_by=j.rejected_by, rejected_at=j.rejected_at, rejection_reason=j.rejection_reason,
        internal_notes=j.internal_notes, remarks=j.remarks,
        approved_budget=j.approved_budget, budget_exceeded=j.budget_exceeded,
        created_at=j.created_at, updated_at=j.updated_at,
        created_by_user_id=j.created_by_user_id, company_id=j.company_id,
        entries=entries_resp, dr_total=dr_total, cr_total=cr_total, balanced=dr_total == cr_total,
    )


def _journal_to_list_response(j: Journal, entry_count: int = 0) -> JournalListResponse:
    dr_total = sum(e.debit for e in j.entries)
    cr_total = sum(e.credit for e in j.entries)
    return JournalListResponse(
        id=j.id, journal_number=j.journal_number, date=j.date,
        reference_type=j.reference_type, reference_id=j.reference_id,
        description=j.description, source=j.source or "MANUAL",
        status=j.status, is_reversal=j.is_reversal, reversal_of=j.reversal_of,
        created_at=j.created_at, created_by_user_id=j.created_by_user_id,
        entry_count=entry_count or len(j.entries),
        dr_total=dr_total, cr_total=cr_total, balanced=dr_total == cr_total,
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
    _role: User = Depends(require_roles("Admin", "Accountant")),
):
    try:
        entries = [
            JournalEntryData(
                account_id=line.account_id, debit=line.debit, credit=line.credit,
                narration=line.narration, description=line.description,
                cost_center=line.cost_center, department=line.department,
                project_id=line.project_id, property_id=line.property_id,
                building=line.building, floor=line.floor, unit_id=line.unit_id,
                customer_id=line.customer_id, vendor_id=line.vendor_id,
                employee_id=line.employee_id,
                tax_code=line.tax_code, tax_amount=line.tax_amount,
                reference=line.reference, memo=line.memo, sort_order=line.sort_order,
            )
            for line in payload.lines
        ]
        journal = JournalService.create_journal_entry(
            db=db, entries=entries,
            reference_type=payload.reference_type, reference_id=payload.reference_id,
            description=payload.description, date=payload.date, user=user,
            source=payload.source or "MANUAL",
            source_module=payload.source_module, source_document_id=payload.source_document_id,
            source_document_number=payload.source_document_number,
            source_document_status=payload.source_document_status,
            source_document_date=payload.source_document_date,
            status="draft",
            approved_budget=payload.approved_budget, budget_used=payload.budget_used,
            budget_remaining=payload.budget_remaining, budget_exceeded=payload.budget_exceeded,
            budget_approval_required=payload.budget_approval_required,
            internal_notes=payload.internal_notes, remarks=payload.remarks,
            company_id=user.company_id,
            ip_address=user.ip_address if hasattr(user, 'ip_address') else None,
        )
        db.commit()
        db.refresh(journal)
        _log_audit(db, user, "CREATE", "journals", "Journal", str(journal.id),
                   f"Journal #{journal.journal_number}: {journal.description}",
                   sum(e.debit for e in journal.entries))
        log_activity(db=db, user=user, action="create", module="finance",
                     record_type="Journal", record_id=str(journal.id),
                     record_label=journal.journal_number or f"JE-{journal.id}",
                     new_values={k: str(v) for k, v in journal.__dict__.items() if not k.startswith('_')})
        db.commit()
        await ws_manager.broadcast("journal_created", {"journal_id": journal.id})
        return _journal_to_response(db, journal)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/journals", response_model=list[JournalListResponse])
async def list_journals(
    skip: int = 0,
    limit: int = 100,
    reference_type: str | None = None,
    source: str | None = None,
    status: str | None = None,
    search: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort_by: str = "date",
    sort_dir: str = "desc",
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Journal).options(joinedload(Journal.entries)).filter(Journal.deleted_at.is_(None))
    if reference_type:
        query = query.filter(Journal.reference_type == reference_type)
    if source:
        query = query.filter(Journal.source == source)
    if status:
        query = query.filter(Journal.status == status)
    if search:
        like = f"%{search}%"
        query = query.filter(
            Journal.description.ilike(like) | Journal.journal_number.ilike(like) |
            Journal.reference_id.ilike(like) | Journal.source.ilike(like)
        )
    if start_date:
        query = query.filter(Journal.date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Journal.date <= datetime.fromisoformat(end_date) + timedelta(days=1))
    if sort_by == "date":
        sort_col = Journal.date
    elif sort_by == "journal_number":
        sort_col = Journal.journal_number
    elif sort_by == "created_at":
        sort_col = Journal.created_at
    else:
        sort_col = Journal.date
    query = query.order_by(sort_col.desc() if sort_dir == "desc" else sort_col.asc())
    journals = query.offset(skip).limit(limit).all()
    return [_journal_to_list_response(j) for j in journals]


@router.get("/journals/{journal_id}", response_model=JournalResponse)
async def get_journal(
    journal_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    journal = db.query(Journal).options(joinedload(Journal.entries)).filter(
        Journal.id == journal_id, Journal.deleted_at.is_(None)
    ).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    return _journal_to_response(db, journal)


@router.patch("/journals/{journal_id}", response_model=JournalResponse)
async def update_journal(
    journal_id: int,
    payload: JournalUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
    _role: User = Depends(require_roles("Admin", "Accountant")),
):
    journal = db.query(Journal).filter(Journal.id == journal_id, Journal.deleted_at.is_(None)).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    if journal.status != "draft":
        raise HTTPException(400, "Only draft journals can be edited")
    try:
        if payload.description is not None:
            journal.description = payload.description
        if payload.date is not None:
            journal.date = payload.date
        if payload.reference_type is not None:
            journal.reference_type = payload.reference_type
        if payload.reference_id is not None:
            journal.reference_id = payload.reference_id
        if payload.internal_notes is not None:
            journal.internal_notes = payload.internal_notes
        if payload.remarks is not None:
            journal.remarks = payload.remarks
        if payload.lines is not None:
            entries = [
                JournalEntryData(
                    account_id=line.account_id, debit=line.debit, credit=line.credit,
                    narration=line.narration, description=line.description,
                    cost_center=line.cost_center, department=line.department,
                    project_id=line.project_id, property_id=line.property_id,
                    building=line.building, floor=line.floor, unit_id=line.unit_id,
                    customer_id=line.customer_id, vendor_id=line.vendor_id,
                    employee_id=line.employee_id,
                    tax_code=line.tax_code, tax_amount=line.tax_amount,
                    reference=line.reference, memo=line.memo, sort_order=line.sort_order,
                )
                for line in payload.lines
            ]
            JournalService.update_journal_lines(db, journal, entries)
        journal.modified_by = user.id
        journal.modified_at = datetime.utcnow()
        db.commit()
        db.refresh(journal)
        _log_audit(db, user, "UPDATE", "journals", "Journal", str(journal.id),
                   f"Updated journal #{journal.journal_number}")
        return _journal_to_response(db, journal)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/journals/{journal_id}/submit", response_model=JournalResponse)
async def submit_journal(
    journal_id: int,
    payload: JournalSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    journal = db.query(Journal).filter(Journal.id == journal_id, Journal.deleted_at.is_(None)).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    try:
        JournalService.submit_journal(db, journal, user, payload.internal_notes)
        db.commit()
        db.refresh(journal)
        _log_audit(db, user, "SUBMIT", "journals", "Journal", str(journal.id),
                   f"Submitted journal #{journal.journal_number}")
        await ws_manager.broadcast("journal_submitted", {"journal_id": journal.id})
        return _journal_to_response(db, journal)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/journals/{journal_id}/approve", response_model=JournalResponse)
async def approve_journal(
    journal_id: int,
    payload: JournalApprove,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    journal = db.query(Journal).filter(Journal.id == journal_id, Journal.deleted_at.is_(None)).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    try:
        JournalService.approve_journal(db, journal, user, payload.approval_level, payload.internal_notes)
        db.commit()
        db.refresh(journal)
        _log_audit(db, user, "APPROVE", "journals", "Journal", str(journal.id),
                   f"Approved journal #{journal.journal_number}")
        await ws_manager.broadcast("journal_approved", {"journal_id": journal.id})
        return _journal_to_response(db, journal)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/journals/{journal_id}/reject", response_model=JournalResponse)
async def reject_journal(
    journal_id: int,
    payload: JournalReject,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    journal = db.query(Journal).filter(Journal.id == journal_id, Journal.deleted_at.is_(None)).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    try:
        JournalService.reject_journal(db, journal, user, payload.reason)
        db.commit()
        db.refresh(journal)
        _log_audit(db, user, "REJECT", "journals", "Journal", str(journal.id),
                   f"Rejected journal #{journal.journal_number}")
        return _journal_to_response(db, journal)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/journals/{journal_id}/post", response_model=JournalResponse)
async def post_journal(
    journal_id: int,
    payload: JournalSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    journal = db.query(Journal).filter(Journal.id == journal_id, Journal.deleted_at.is_(None)).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    try:
        JournalService.post_journal(db, journal, user, payload.internal_notes)
        db.commit()
        db.refresh(journal)
        _log_audit(db, user, "POST", "journals", "Journal", str(journal.id),
                   f"Posted journal #{journal.journal_number}")
        await ws_manager.broadcast("journal_posted", {"journal_id": journal.id})
        return _journal_to_response(db, journal)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/journals/{journal_id}/reverse", response_model=JournalResponse)
async def reverse_journal(
    journal_id: int,
    payload: JournalReverse,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    journal = db.query(Journal).filter(Journal.id == journal_id, Journal.deleted_at.is_(None)).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    try:
        reversal = JournalService.reverse_journal(
            db, journal, user, payload.reason, payload.date, payload.internal_notes
        )
        db.commit()
        db.refresh(reversal)
        _log_audit(db, user, "REVERSE", "journals", "Journal", str(journal.id),
                   f"Reversed journal #{journal.journal_number}: {payload.reason}")
        await ws_manager.broadcast("journal_reversed", {"journal_id": journal.id, "reversal_id": reversal.id})
        return _journal_to_response(db, reversal)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/journals/{journal_id}")
async def delete_journal(
    journal_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
    _role: User = Depends(require_roles("Admin", "Accountant")),
):
    journal = db.query(Journal).filter(Journal.id == journal_id, Journal.deleted_at.is_(None)).first()
    if not journal:
        raise HTTPException(404, "Journal not found")
    if journal.status not in ("draft",):
        raise HTTPException(400, "Only draft journals can be deleted")
    journal.deleted_at = datetime.utcnow()
    db.commit()
    _log_audit(db, user, "DELETE", "journals", "Journal", str(journal.id),
               f"Deleted draft journal #{journal.journal_number}")
    await ws_manager.broadcast("journal_deleted", {"journal_id": journal_id})
    return {"deleted": True}


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
        account_id=account.id, code=account.code, name=account.name, type=account.account_type,
        entries=[LedgerEntryResponse(**e) for e in entries],
        opening_balance=opening, closing_balance=balance,
    )


# ── HELPERS ──────────────────────────────────────────────────────────────────

def _compute_invoice_totals(line_items: list[dict]) -> dict:
    subtotal = Decimal("0")
    discount_amount = Decimal("0")
    tax_amount = Decimal("0")
    for item in line_items:
        qty = Decimal(str(item.get("quantity", 1)))
        price = Decimal(str(item.get("unit_price", 0)))
        disc = Decimal(str(item.get("discount_pct", 0)))
        tax = Decimal(str(item.get("tax_pct", 0)))
        line_total = qty * price
        line_discount = line_total * disc / Decimal("100")
        line_tax = (line_total - line_discount) * tax / Decimal("100")
        line_amount = line_total - line_discount + line_tax
        item["amount"] = float(line_amount)
        subtotal += line_total
        discount_amount += line_discount
        tax_amount += line_tax
    grand_total = subtotal - discount_amount + tax_amount
    return {
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount_amount, 2),
        "tax_amount": round(tax_amount, 2),
        "amount": round(grand_total, 2),
    }


def _next_invoice_number(db: Session) -> str:
    today = datetime.utcnow()
    prefix = f"INV-{today.year}-"
    last = db.query(Invoice).filter(
        Invoice.invoice_number.like(f"{prefix}%")
    ).order_by(Invoice.invoice_number.desc()).first()
    seq = 1
    if last and last.invoice_number:
        try:
            seq = int(last.invoice_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}{seq:06d}"


def _update_invoice_status_from_payments(db: Session, invoice_id: int):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return
    total_paid = db.query(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).filter(
        PaymentAllocation.invoice_id == invoice_id
    ).scalar() or Decimal("0")
    invoice.paid_amount = total_paid
    invoice.remaining_amount = invoice.amount - total_paid
    if invoice.status in ("cancelled", "void"):
        return
    if total_paid >= invoice.amount:
        invoice.status = "paid"
    elif total_paid > 0:
        invoice.status = "partially_paid"
    elif invoice.due_date < datetime.utcnow() and invoice.status == "pending":
        invoice.status = "overdue"


# ── INVOICE ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/invoices", response_model=InvoiceResponse)
async def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        line_items_data = [item.model_dump() for item in payload.line_items]
        totals = _compute_invoice_totals(line_items_data)
        if not line_items_data:
            totals = {"subtotal": 0, "discount_amount": 0, "tax_amount": 0, "amount": 0}

        if payload.tenant_id is not None:
            tenant_exists = db.query(Tenant).filter(Tenant.id == payload.tenant_id).first()
            if not tenant_exists:
                raise HTTPException(status_code=400, detail=f"Tenant with id={payload.tenant_id} does not exist")

        invoice = Invoice(
            invoice_number=_next_invoice_number(db),
            invoice_date=payload.invoice_date or datetime.utcnow(),
            due_date=payload.due_date,
            status="draft",
            invoice_type=payload.invoice_type,
            currency=payload.currency or "PKR",
            subtotal=totals["subtotal"],
            discount_amount=totals["discount_amount"],
            tax_amount=totals["tax_amount"],
            adjustment=0,
            amount=totals["amount"],
            paid_amount=Decimal("0"),
            remaining_amount=totals["amount"],
            party_type=payload.party_type,
            party_id=payload.party_id,
            client_id=payload.client_id,
            client_name=payload.client_name,
            client_phone=payload.client_phone,
            client_email=payload.client_email,
            client_cnic=payload.client_cnic,
            client_ntn=payload.client_ntn,
            client_address=payload.client_address,
            reference=payload.reference,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            deal_id=payload.deal_id,
            booking_id=payload.booking_id,
            lease_id=payload.lease_id,
            property_id=payload.property_id,
            unit_id=payload.unit_id,
            maintenance_ticket_id=payload.maintenance_ticket_id,
            construction_project_id=payload.construction_project_id,
            purchase_order_id=payload.purchase_order_id,
            contract_id=payload.contract_id,
            payment_terms=payload.payment_terms or "due_immediately",
            internal_notes=payload.internal_notes,
            customer_notes=payload.customer_notes,
            terms_conditions=payload.terms_conditions,
            late_payment_policy=payload.late_payment_policy,
            footer_message=payload.footer_message,
            auto_generated=payload.auto_generated,
            source_module=payload.source_module,
            source_record_id=payload.source_record_id,
            tenant_id=payload.tenant_id,
        )
        if not user.is_super_admin:
            invoice.company_id = user.company_id
        db.add(invoice)
        db.flush()

        # Save line items as InvoiceItem rows
        for idx, item in enumerate(line_items_data):
            qty = Decimal(str(item.get("quantity", 1)))
            price = Decimal(str(item.get("unit_price", 0)))
            disc = Decimal(str(item.get("discount_pct", 0)))
            tax = Decimal(str(item.get("tax_pct", 0)))
            line_total = qty * price
            line_disc = line_total * disc / Decimal("100")
            line_tax = (line_total - line_disc) * tax / Decimal("100")
            line_amt = line_total - line_disc + line_tax
            db.add(InvoiceItem(
                invoice_id=invoice.id,
                description=str(item.get("description", ""))[:500],
                quantity=qty,
                unit=str(item.get("unit", ""))[:20] or None,
                unit_price=price,
                discount_pct=disc,
                tax_pct=tax,
                discount_amount=line_disc,
                tax_amount=line_tax,
                line_total=line_amt,
                sort_order=idx,
            ))
        db.flush()

        if invoice.status != "draft":
            dr_account = db.query(Account).filter(Account.code == "1200").first()
            cr_account_map = {
                "sale": "4500", "rental": "4100", "maintenance": "5100",
                "construction": "4520", "utility": "5200", "penalty": "4400",
                "service": "4300", "security_deposit": "2200",
            }
            cr_code = cr_account_map.get(payload.invoice_type, "4100")
            cr_account = db.query(Account).filter(Account.code == cr_code).first()
            if dr_account and cr_account:
                JournalService.create_journal_entry(
                    db=db,
                    entries=[
                        JournalEntryData(account_id=dr_account.id, debit=invoice.amount,
                                         description=f"Invoice {invoice.invoice_number}"),
                        JournalEntryData(account_id=cr_account.id, credit=invoice.amount,
                                         description=f"Invoice {invoice.invoice_number}"),
                    ],
                    reference_type="invoice",
                    reference_id=str(invoice.id),
                    description=f"Invoice {invoice.invoice_number}: {payload.client_name or ''}",
                    date=datetime.utcnow(),
                    user=user,
                    source="MANUAL",
                )

        db.commit()
        _log_audit(db, user, "CREATE", "invoices", "Invoice", str(invoice.id),
                   f"Created invoice {invoice.invoice_number} for {invoice.amount}", invoice.amount)
        log_activity(
            db=db, user=user, action="create", module="finance",
            record_type="Invoice", record_id=str(invoice.id),
            record_label=f"Invoice {invoice.invoice_number}",
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
    invoice_type: str | None = None,
    party_type: str | None = None,
    party_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Invoice).order_by(Invoice.created_at.desc())
    if not user.is_super_admin:
        query = query.filter(Invoice.company_id == user.company_id)
    if status:
        query = query.filter(Invoice.status == status)
    if invoice_type:
        query = query.filter(Invoice.invoice_type == invoice_type)
    if party_type:
        query = query.filter(Invoice.party_type == party_type)
    if party_id:
        query = query.filter(Invoice.party_id == party_id)
    actual_offset = offset if offset is not None else skip
    query, total = apply_table_filters(
        query=query, model=Invoice, limit=limit, offset=actual_offset,
        search=search,
        search_fields=[Invoice.client_name, Invoice.client_phone, Invoice.invoice_number, Invoice.reference],
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
    query = db.query(Invoice).options(
        joinedload(Invoice.items),
        joinedload(Invoice.allocations).joinedload(PaymentAllocation.payment),
    )
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
    if invoice.status in ("paid", "cancelled", "void") and payload.status not in ("cancelled", "void"):
        raise HTTPException(status_code=400, detail="Cannot modify a paid, cancelled, or void invoice")

    old_data = {k: str(v) for k, v in invoice.__dict__.items() if not k.startswith('_')}
    update_data = payload.model_dump(exclude_unset=True)

    if "line_items" in update_data and update_data["line_items"] is not None:
        items_dicts = [item.model_dump() if hasattr(item, "model_dump") else item for item in update_data["line_items"]]
        totals = _compute_invoice_totals(items_dicts)
        update_data["line_items"] = items_dicts
        update_data["subtotal"] = float(totals["subtotal"])
        update_data["discount_amount"] = float(totals["discount_amount"])
        update_data["tax_amount"] = float(totals["tax_amount"])
        update_data["amount"] = float(totals["amount"])
        remaining = float(invoice.amount) if isinstance(invoice.amount, Decimal) else invoice.amount
        paid = float(invoice.paid_amount) if isinstance(invoice.paid_amount, Decimal) else invoice.paid_amount
        update_data["remaining_amount"] = float(totals["amount"]) - paid

    for field, value in update_data.items():
        setattr(invoice, field, value)

    # Status change side effects
    if payload.status == "sent" and not invoice.sent_at:
        invoice.sent_at = datetime.utcnow()
    if payload.status == "cancelled":
        invoice.cancelled_at = datetime.utcnow()
    if payload.status == "void":
        invoice.voided_at = datetime.utcnow()

    db.commit()
    db.refresh(invoice)
    _log_audit(db, user, "UPDATE", "invoices", "Invoice", str(invoice_id),
               f"Updated invoice {invoice.invoice_number}")
    log_activity(
        db=db, user=user, action="update", module="finance",
        record_type="Invoice", record_id=str(invoice_id),
        record_label=f"Invoice {invoice.invoice_number}",
        old_values=old_data, new_values={k: str(v) for k, v in invoice.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return invoice


@router.post("/invoices/{invoice_id}/send")
async def send_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status not in ("draft", "pending"):
        raise HTTPException(status_code=400, detail="Only draft/pending invoices can be sent")
    invoice.status = "sent"
    invoice.sent_at = datetime.utcnow()
    db.commit()
    _log_audit(db, user, "SEND", "invoices", "Invoice", str(invoice_id),
               f"Sent invoice {invoice.invoice_number}")
    db.commit()
    return {"success": True, "message": f"Invoice {invoice.invoice_number} sent"}


@router.post("/invoices/{invoice_id}/cancel")
async def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel a paid invoice")
    invoice.status = "cancelled"
    invoice.cancelled_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": f"Invoice {invoice.invoice_number} cancelled"}


@router.post("/invoices/{invoice_id}/void")
async def void_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = "void"
    invoice.voided_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": f"Invoice {invoice.invoice_number} voided"}


@router.post("/invoices/auto-generate", response_model=InvoiceResponse)
async def auto_generate_invoice(
    payload: AutoGenerateInvoice,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """Auto-generate an invoice from a system transaction"""
    try:
        line_items = []
        client_name = ""
        client_id = None
        party_type = payload.party_type
        party_id = payload.party_id
        property_id = None
        unit_id = None
        due_date = payload.due_date or datetime.utcnow() + timedelta(days=30)
        invoice_type = payload.source_module

        if payload.source_module == "sale":
            deal = db.query(Deal).filter(Deal.id == payload.source_id).first()
            if not deal:
                raise HTTPException(404, "Deal not found")
            client = db.query(Client).filter(Client.id == deal.client_id).first()
            client_name = client.name if client else f"Client #{deal.client_id}"
            client_id = deal.client_id
            party_type = "client"
            party_id = deal.client_id
            property_id = deal.property_id
            line_items = [
                {"description": "Booking Amount", "quantity": 1, "unit": "lump", "unit_price": float(deal.down_payment or 0), "discount_pct": 0, "tax_pct": 0, "amount": float(deal.down_payment or 0)},
            ]
            invoice_type = "sale"

        elif payload.source_module == "rental":
            lease = db.query(Lease).filter(Lease.id == payload.source_id).first()
            if not lease:
                raise HTTPException(404, "Lease not found")
            tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
            client_name = tenant.name if tenant else f"Tenant #{lease.tenant_id}"
            party_type = "tenant"
            party_id = lease.tenant_id
            property_id = lease.property_id
            unit_id = lease.unit_id
            monthly_rent = lease.monthly_rent or 0
            late_charges = getattr(lease, "late_charge", 0) or 0
            line_items = [
                {"description": "Monthly Rent", "quantity": 1, "unit": "month", "unit_price": float(monthly_rent), "discount_pct": 0, "tax_pct": 0, "amount": float(monthly_rent)},
            ]
            if late_charges:
                line_items.append({"description": "Late Charges", "quantity": 1, "unit": "lump", "unit_price": float(late_charges), "discount_pct": 0, "tax_pct": 0, "amount": float(late_charges)})
            invoice_type = "rental"

        elif payload.source_module == "maintenance":
            line_items = [
                {"description": "Maintenance Charges", "quantity": 1, "unit": "lump", "unit_price": 0, "discount_pct": 0, "tax_pct": 0, "amount": 0},
            ]
            invoice_type = "maintenance"

        elif payload.source_module == "construction":
            line_items = [
                {"description": "Construction Installment", "quantity": 1, "unit": "lump", "unit_price": 0, "discount_pct": 0, "tax_pct": 0, "amount": 0},
            ]
            invoice_type = "construction"

        elif payload.source_module == "utility":
            line_items = [
                {"description": "Utility Bill", "quantity": 1, "unit": "lump", "unit_price": 0, "discount_pct": 0, "tax_pct": 0, "amount": 0},
            ]
            invoice_type = "utility"

        elif payload.source_module == "security_deposit":
            line_items = [
                {"description": "Security Deposit", "quantity": 1, "unit": "lump", "unit_price": 0, "discount_pct": 0, "tax_pct": 0, "amount": 0},
            ]
            invoice_type = "security_deposit"

        else:
            raise HTTPException(400, f"Unknown source module: {payload.source_module}")

        totals = _compute_invoice_totals(line_items)

        invoice = Invoice(
            invoice_number=_next_invoice_number(db),
            invoice_date=datetime.utcnow(),
            due_date=due_date,
            status="pending",
            invoice_type=invoice_type,
            currency="PKR",
            subtotal=totals["subtotal"],
            discount_amount=totals["discount_amount"],
            tax_amount=totals["tax_amount"],
            amount=totals["amount"],
            paid_amount=Decimal("0"),
            remaining_amount=totals["amount"],
            line_items=line_items,
            party_type=party_type,
            party_id=party_id,
            client_name=client_name,
            client_id=client_id,
            property_id=property_id,
            unit_id=unit_id,
            reference_type=payload.source_module,
            reference_id=payload.source_id,
            payment_terms="due_immediately",
            auto_generated=True,
            source_module=payload.source_module,
            source_record_id=payload.source_id,
            notes=payload.notes,
        )
        if not user.is_super_admin:
            invoice.company_id = user.company_id
        db.add(invoice)
        db.flush()

        dr_account = db.query(Account).filter(Account.code == "1200").first()
        cr_map = {"sale": "4500", "rental": "4100", "maintenance": "5100",
                  "construction": "4520", "utility": "5200", "security_deposit": "2200"}
        cr_code = cr_map.get(invoice_type, "4100")
        cr_account = db.query(Account).filter(Account.code == cr_code).first()
        if dr_account and cr_account:
            JournalService.create_journal_entry(
                db=db, entries=[
                    JournalEntryData(account_id=dr_account.id, debit=invoice.amount,
                                     description=f"Auto-invoice {invoice.invoice_number}"),
                    JournalEntryData(account_id=cr_account.id, credit=invoice.amount,
                                     description=f"Auto-invoice {invoice.invoice_number}"),
                ],
                reference_type="invoice", reference_id=str(invoice.id),
                description=payload.notes or f"Auto-generated {payload.source_module} invoice",
                date=datetime.utcnow(), user=user, source=payload.source_module.upper(),
            )

        db.commit()
        await ws_manager.broadcast("invoice_created", {"invoice_id": invoice.id})
        return invoice
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── INVOICE REPORTS ───────────────────────────────────────────────────────────

@router.get("/reports/invoices/outstanding")
def outstanding_invoices_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Invoice).filter(Invoice.status.in_(["pending", "partially_paid", "overdue"]))
    if not user.is_super_admin:
        query = query.filter(Invoice.company_id == user.company_id)
    invoices = query.order_by(Invoice.due_date.asc()).all()
    return [
        {"id": inv.id, "invoice_number": inv.invoice_number, "client_name": inv.client_name,
         "amount": float(inv.amount), "paid": float(inv.paid_amount), "remaining": float(inv.remaining_amount),
         "status": inv.status, "due_date": inv.due_date.isoformat(), "days_overdue": (datetime.utcnow() - inv.due_date).days if inv.due_date < datetime.utcnow() else 0}
        for inv in invoices
    ]


@router.get("/reports/invoices/aging")
def invoice_aging_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Invoice).filter(Invoice.status.in_(["pending", "partially_paid", "overdue"]))
    if not user.is_super_admin:
        query = query.filter(Invoice.company_id == user.company_id)
    invoices = query.all()
    buckets = {"0_30": [], "31_60": [], "61_90": [], "90_plus": []}
    now = datetime.utcnow()
    for inv in invoices:
        days = (now - inv.due_date).days if inv.due_date < now else 0
        bucket = "0_30" if days <= 30 else "31_60" if days <= 60 else "61_90" if days <= 90 else "90_plus"
        buckets[bucket].append({
            "id": inv.id, "invoice_number": inv.invoice_number, "client_name": inv.client_name,
            "amount": float(inv.amount), "remaining": float(inv.remaining_amount),
            "days_overdue": days, "due_date": inv.due_date.isoformat(),
        })
    result = []
    for label, key in [("0-30 Days", "0_30"), ("31-60 Days", "31_60"), ("61-90 Days", "61_90"), ("90+ Days", "90_plus")]:
        items = buckets[key]
        result.append({"label": label, "count": len(items), "total": sum(i["remaining"] for i in items), "invoices": items})
    return result


@router.get("/reports/invoices/monthly-revenue")
def monthly_revenue_report(
    year: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    y = year or datetime.utcnow().year
    query = db.query(
        func.extract("month", Invoice.created_at).label("month"),
        func.sum(Invoice.amount).label("total"),
        func.count(Invoice.id).label("count"),
    ).filter(
        func.extract("year", Invoice.created_at) == y,
        Invoice.status.in_(["paid", "partially_paid", "pending"]),
    )
    if not user.is_super_admin:
        query = query.filter(Invoice.company_id == user.company_id)
    query = query.group_by("month").order_by("month")
    rows = query.all()
    months = [{"month": int(r.month), "total": float(r.total), "count": int(r.count)} for r in rows]
    return months


def _next_payment_number(db: Session) -> str:
    today = datetime.utcnow()
    prefix = f"PAY-{today.year}-"
    last = db.query(Payment).filter(
        Payment.payment_number.like(f"{prefix}%")
    ).order_by(Payment.payment_number.desc()).first()
    seq = 1
    if last and last.payment_number:
        try:
            seq = int(last.payment_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}{seq:06d}"


def _compute_expense_totals(line_items: list[dict]) -> dict:
    subtotal = Decimal("0")
    discount_amount = Decimal("0")
    tax_amount = Decimal("0")
    for item in line_items:
        qty = Decimal(str(item.get("quantity", 1)))
        cost = Decimal(str(item.get("unit_cost", 0)))
        disc_pct = Decimal(str(item.get("discount_pct", 0)))
        tax_pct = Decimal(str(item.get("tax_pct", 0)))
        line_total = qty * cost
        line_discount = line_total * disc_pct / Decimal("100")
        line_tax = (line_total - line_discount) * tax_pct / Decimal("100")
        line_amount = line_total - line_discount + line_tax
        item["discount_amount"] = float(line_discount)
        item["tax_amount"] = float(line_tax)
        item["line_total"] = float(line_amount)
        subtotal += line_total
        discount_amount += line_discount
        tax_amount += line_tax
    grand_total = subtotal - discount_amount + tax_amount
    return {
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount_amount, 2),
        "tax_amount": round(tax_amount, 2),
        "amount": round(grand_total, 2),
    }


def _next_expense_number(db: Session) -> str:
    today = datetime.utcnow()
    prefix = f"EXP-{today.year}-"
    last = db.query(Expense).filter(
        Expense.expense_number.like(f"{prefix}%")
    ).order_by(Expense.expense_number.desc()).first()
    seq = 1
    if last and last.expense_number:
        try:
            seq = int(last.expense_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}{seq:06d}"


def _next_receipt_number(db: Session) -> str:
    today = datetime.utcnow()
    prefix = f"REC-{today.year}-"
    last = db.query(Payment).filter(
        Payment.receipt_number.like(f"{prefix}%")
    ).order_by(Payment.receipt_number.desc()).first()
    seq = 1
    if last and last.receipt_number:
        try:
            seq = int(last.receipt_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}{seq:06d}"


# ── PAYMENT ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/payments", response_model=PaymentResponse)
async def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    try:
        if payload.payment_type == "against_invoice" and not payload.allocations:
            raise HTTPException(400, "At least one invoice allocation is required for against_invoice payments")

        method_fields = payload.method_fields.model_dump(exclude_none=True) if payload.method_fields else None
        remaining = Decimal(str(payload.amount))

        # Validate allocations
        for alloc in payload.allocations:
            if alloc.allocated_amount > remaining + Decimal("0.01"):
                raise HTTPException(400, "Allocation amounts exceed payment amount")
            remaining -= alloc.allocated_amount

        # Create payment
        payment = Payment(
            payment_number=_next_payment_number(db),
            status="completed",
            payment_type=payload.payment_type,
            method=payload.method,
            amount=payload.amount,
            method_fields=method_fields,
            date=payload.date or datetime.utcnow(),
            reference_number=payload.reference_number,
            external_transaction_id=payload.external_transaction_id,
            received_by=payload.received_by or user.full_name,
            party_type=payload.party_type,
            party_id=payload.party_id,
            party_name=payload.party_name,
            party_phone=payload.party_phone,
            party_email=payload.party_email,
            party_cnic=payload.party_cnic,
            party_address=payload.party_address,
            source=payload.source or "MANUAL",
            source_id=payload.source_id,
            branch=payload.branch,
            cash_counter=payload.cash_counter,
            internal_notes=payload.internal_notes,
            posted_to_finance=False,
            receipt_number=_next_receipt_number(db),
            completed_at=datetime.utcnow(),
            created_by_user_id=user.id,
        )
        if not user.is_super_admin:
            payment.company_id = user.company_id
        db.add(payment)
        db.flush()

        # Create PaymentAllocations
        total_allocated = Decimal("0")
        for alloc in payload.allocations:
            invoice = db.query(Invoice).filter(Invoice.id == alloc.invoice_id).first()
            if not invoice:
                continue
            if invoice.status in ("cancelled", "void", "paid"):
                continue
            pa = PaymentAllocation(
                payment_id=payment.id,
                invoice_id=alloc.invoice_id,
                allocated_amount=alloc.allocated_amount,
            )
            db.add(pa)
            total_allocated += alloc.allocated_amount
            _update_invoice_status_from_payments(db, alloc.invoice_id)

        # Handle unallocated remainder → CustomerCredit (advance/overpayment)
        unallocated = Decimal(str(payload.amount)) - total_allocated
        if unallocated > Decimal("0.01"):
            cc = CustomerCredit(
                party_type=payload.party_type,
                party_id=payload.party_id,
                party_name=payload.party_name or payload.party_name,
                amount=unallocated,
                remaining_amount=unallocated,
                source="overpayment" if payload.allocations else "advance",
                source_payment_id=payment.id,
                company_id=payment.company_id,
            )
            db.add(cc)
            db.flush()

        # Post to finance (journal entry)
        dr_account_id = payload.account_id
        if payload.method == "cash":
            dr_account = db.query(Account).filter(Account.code == "1010").first()
            dr_account_id = dr_account.id if dr_account else None
        elif payload.method in ("bank_transfer", "cheque", "online", "credit_card", "debit_card",
                                "jazzcash", "easypaisa", "stripe", "paypal"):
            dr_account = db.query(Account).filter(Account.code == "1100").first()
            dr_account_id = dr_account.id if dr_account else None

        entry_lines = [
            JournalEntryData(account_id=dr_account_id, debit=payload.amount,
                             description=f"Payment {payment.payment_number}"),
        ]
        if payload.allocations:
            ar_account = db.query(Account).filter(Account.code == "1200").first()
            entry_lines.append(
                JournalEntryData(account_id=ar_account.id, credit=total_allocated,
                                 description=f"Payment {payment.payment_number}"),
            )
        if unallocated > Decimal("0.01"):
            if payload.payment_type == "advance":
                liab_account = db.query(Account).filter(Account.code == "2100").first()  # Customer Advances
            elif payload.payment_type == "security_deposit":
                liab_account = db.query(Account).filter(Account.code == "2200").first()
            else:
                liab_account = db.query(Account).filter(Account.code == "2100").first()
            if liab_account and dr_account_id:
                entry_lines.append(
                    JournalEntryData(account_id=liab_account.id, credit=unallocated,
                                     description=f"Customer Credit (Payment {payment.payment_number})"),
                )

        if len(entry_lines) >= 2 and dr_account_id:
            journal = JournalService.create_journal_entry(
                db=db,
                entries=entry_lines,
                reference_type="payment",
                reference_id=str(payment.id),
                description=f"Payment {payment.payment_number}: {payload.party_name or 'N/A'}",
                date=payment.date,
                user=user,
                source=payload.source or "MANUAL",
            )
            payment.posted_to_finance = True
            payment.finance_journal_id = journal.id

        db.commit()
        db.refresh(payment)

        _log_audit(db, user, "CREATE", "payments", "Payment", str(payment.id),
                   f"Payment {payment.payment_number} of {payload.amount} received", payload.amount)
        log_activity(
            db=db, user=user, action="create", module="finance",
            record_type="Payment", record_id=str(payment.id),
            record_label=f"Payment {payment.payment_number}",
            new_values={k: str(v) for k, v in payment.__dict__.items() if not k.startswith('_')},
        )
        db.commit()
        await ws_manager.broadcast("payment_processed", {"payment_id": payment.id})
        return payment
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payments/search-invoices", response_model=list[PaymentSearchInvoice])
async def search_payments_invoices(
    q: str = "",
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    """Search invoices for the payment dialog"""
    query = db.query(Invoice).filter(
        Invoice.status.in_(["pending", "sent", "partially_paid", "overdue"])
    )
    if not user.is_super_admin:
        query = query.filter(Invoice.company_id == user.company_id)
    if status:
        query = query.filter(Invoice.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Invoice.invoice_number.ilike(like),
                Invoice.client_name.ilike(like),
                Invoice.client_phone.ilike(like),
            )
        )
    invoices = query.order_by(Invoice.due_date.asc()).limit(50).all()
    return [
        PaymentSearchInvoice(
            id=inv.id,
            invoice_number=inv.invoice_number,
            client_name=inv.client_name,
            client_phone=inv.client_phone,
            amount=inv.amount,
            paid_amount=inv.paid_amount,
            remaining_amount=inv.remaining_amount,
            status=inv.status,
            due_date=inv.due_date,
            invoice_date=inv.invoice_date,
            invoice_type=inv.invoice_type,
        )
        for inv in invoices
    ]


@router.get("/payments", response_model=dict)
async def list_payments(
    response: Response,
    skip: int = 0,
    limit: int | None = 100,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    status: str | None = None,
    method: str | None = None,
    payment_type: str | None = None,
    party_name: str | None = None,
    branch: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Payment).filter(Payment.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Payment.company_id == user.company_id)
    if status:
        query = query.filter(Payment.status == status)
    if method:
        query = query.filter(Payment.method == method)
    if payment_type:
        query = query.filter(Payment.payment_type == payment_type)
    if party_name:
        query = query.filter(Payment.party_name.ilike(f"%{party_name}%"))
    if branch:
        query = query.filter(Payment.branch == branch)

    query = query.order_by(Payment.date.desc())
    actual_offset = offset if offset is not None else skip
    query, total = apply_table_filters(
        query=query, model=Payment, limit=limit, offset=actual_offset,
        search=search,
        search_fields=[Payment.payment_number, Payment.receipt_number, Payment.reference_number, Payment.party_name],
        date_filter=filter, date_field=Payment.date,
        start_date=startDate, end_date=endDate,
    )
    payments = query.all()
    response.headers["X-Total-Count"] = str(total)

    list_items = [PaymentListResponse.model_validate(p) for p in payments]
    return {"items": list_items, "total": total}


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Payment).options(
        joinedload(Payment.allocations),
        joinedload(Payment.attachments),
    ).filter(Payment.id == payment_id, Payment.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Payment.company_id == user.company_id)
    payment = query.first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    return payment


@router.patch("/payments/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: int,
    payload: PaymentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Payment).filter(Payment.id == payment_id, Payment.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Payment.company_id == user.company_id)
    payment = query.first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status in ("cancelled", "reversed", "refunded"):
        raise HTTPException(400, f"Cannot update a {payment.status} payment")

    old_data = {k: str(v) for k, v in payment.__dict__.items() if not k.startswith('_')}
    update_data = payload.model_dump(exclude_unset=True)
    if "method_fields" in update_data and update_data["method_fields"] is not None:
        update_data["method_fields"] = update_data["method_fields"].model_dump(exclude_none=True)

    for field, value in update_data.items():
        setattr(payment, field, value)

    db.commit()
    db.refresh(payment)
    _log_audit(db, user, "UPDATE", "payments", "Payment", str(payment_id),
               f"Updated payment {payment.payment_number}")
    db.commit()

    return payment


@router.post("/payments/{payment_id}/reverse")
async def reverse_payment(
    payment_id: int,
    payload: PaymentReverse,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Payment).filter(Payment.id == payment_id, Payment.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Payment.company_id == user.company_id)
    payment = query.first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != "completed":
        raise HTTPException(400, f"Cannot reverse a {payment.status} payment")

    # Reverse journal entry
    if payment.posted_to_finance and payment.finance_journal_id:
        original_journal = db.query(Journal).filter(Journal.id == payment.finance_journal_id).first()
        if original_journal:
            reverse_entries = []
            for entry in original_journal.entries:
                reverse_entries.append(
                    JournalEntryData(account_id=entry.account_id, debit=entry.credit,
                                     description=f"REVERSAL: {payload.reason}"),
                )
                reverse_entries.append(
                    JournalEntryData(account_id=entry.account_id, credit=entry.debit,
                                     description=f"REVERSAL: {payload.reason}"),
                )
            rev_journal = JournalService.create_journal_entry(
                db=db,
                entries=reverse_entries,
                reference_type="payment_reversal",
                reference_id=str(payment.id),
                description=f"Reversal: {payload.reason}",
                date=datetime.utcnow(),
                user=user,
                source="MANUAL",
            )

    payment.status = "reversed"
    payment.reversed_at = datetime.utcnow()
    if payload.internal_notes:
        payment.internal_notes = (payment.internal_notes or "") + f"\n[REVERSAL] {payload.internal_notes}"

    for alloc in payment.allocations:
        _update_invoice_status_from_payments(db, alloc.invoice_id)

    db.commit()
    _log_audit(db, user, "REVERSE", "payments", "Payment", str(payment_id),
               f"Reversed payment {payment.payment_number}: {payload.reason}", payment.amount)
    log_activity(
        db=db, user=user, action="reverse", module="finance",
        record_type="Payment", record_id=str(payment.id),
        record_label=f"Payment {payment.payment_number}",
        new_values={"status": "reversed", "reason": payload.reason},
    )
    db.commit()
    await ws_manager.broadcast("payment_reversed", {"payment_id": payment.id})
    return {"success": True, "message": f"Payment {payment.payment_number} reversed"}


@router.post("/payments/{payment_id}/refund")
async def refund_payment(
    payment_id: int,
    payload: PaymentRefund,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Payment).filter(Payment.id == payment_id, Payment.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Payment.company_id == user.company_id)
    payment = query.first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != "completed":
        raise HTTPException(400, f"Cannot refund a {payment.status} payment")

    refund_amount = payload.refund_amount or payment.amount

    # Create refund journal entry (reverse of original)
    if payment.posted_to_finance:
        dr_code = "5300"  # Refunds/Returns expense
        cr_code = "1010" if (payload.method or payment.method) == "cash" else "1100"
        dr_account = db.query(Account).filter(Account.code == dr_code).first()
        cr_account = db.query(Account).filter(Account.code == cr_code).first()
        if dr_account and cr_account:
            refund_journal = JournalService.create_journal_entry(
                db=db,
                entries=[
                    JournalEntryData(account_id=dr_account.id, debit=refund_amount,
                                     description=f"Refund of payment {payment.payment_number}"),
                    JournalEntryData(account_id=cr_account.id, credit=refund_amount,
                                     description=f"Refund of payment {payment.payment_number}"),
                ],
                reference_type="payment_refund",
                reference_id=str(payment.id),
                description=f"Refund: {payload.reason}",
                date=datetime.utcnow(),
                user=user,
                source="MANUAL",
            )

    payment.status = "refunded"
    payment.refunded_at = datetime.utcnow()
    if payload.internal_notes:
        payment.internal_notes = (payment.internal_notes or "") + f"\n[REFUND] {payload.internal_notes}"

    for alloc in payment.allocations:
        _update_invoice_status_from_payments(db, alloc.invoice_id)

    # Create refund payment record
    refund_payment = Payment(
        payment_number=_next_payment_number(db),
        status="completed",
        payment_type="refund",
        method=payload.method or payment.method,
        amount=-refund_amount,
        date=datetime.utcnow(),
        reference_number=payload.reference_number,
        party_name=payment.party_name,
        source="MANUAL",
        internal_notes=f"Refund of payment {payment.payment_number}: {payload.reason}",
        completed_at=datetime.utcnow(),
        created_by_user_id=user.id,
    )
    db.add(refund_payment)

    db.commit()
    _log_audit(db, user, "REFUND", "payments", "Payment", str(payment_id),
               f"Refunded payment {payment.payment_number}: {refund_amount}", refund_amount)
    db.commit()
    await ws_manager.broadcast("payment_refunded", {"payment_id": payment.id})
    return {"success": True, "message": f"Payment {payment.payment_number} refunded ({refund_amount})"}


@router.post("/payments/{payment_id}/cancel")
async def cancel_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Payment).filter(Payment.id == payment_id, Payment.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Payment.company_id == user.company_id)
    payment = query.first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != "pending":
        raise HTTPException(400, f"Cannot cancel a {payment.status} payment")

    payment.status = "cancelled"
    payment.cancelled_at = datetime.utcnow()

    for alloc in payment.allocations:
        _update_invoice_status_from_payments(db, alloc.invoice_id)

    db.commit()
    _log_audit(db, user, "CANCEL", "payments", "Payment", str(payment_id),
               f"Cancelled payment {payment.payment_number}")
    db.commit()
    await ws_manager.broadcast("payment_cancelled", {"payment_id": payment.id})
    return {"success": True, "message": f"Payment {payment.payment_number} cancelled"}


@router.delete("/payments/{payment_id}")
async def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Payment).filter(Payment.id == payment_id, Payment.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Payment.company_id == user.company_id)
    payment = query.first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status == "completed":
        raise HTTPException(400, "Cannot delete a completed payment. Reverse or refund it instead.")

    payment.deleted_at = datetime.utcnow()
    for alloc in payment.allocations:
        _update_invoice_status_from_payments(db, alloc.invoice_id)

    db.commit()
    _log_audit(db, user, "DELETE", "payments", "Payment", str(payment_id),
               f"Deleted payment {payment.payment_number}")
    db.commit()
    return {"success": True, "message": f"Payment {payment.payment_number} deleted"}


class PostPaymentRequest(BaseModel):
    credit_account_id: int | None = None
    debit_account_id: int | None = None


@router.patch("/payments/{payment_id}/post", response_model=PaymentResponse)
async def post_payment_to_finance(
    payment_id: int,
    body: PostPaymentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    payment = db.query(Payment).filter(Payment.id == payment_id, Payment.deleted_at.is_(None)).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.posted_to_finance:
        raise HTTPException(status_code=400, detail="Payment already posted to finance")
    if payment.status != "completed":
        raise HTTPException(status_code=400, detail="Only completed payments can be posted")

    dr_account_id = body.debit_account_id
    if not dr_account_id:
        if payment.method == "cash":
            dr_account = db.query(Account).filter(Account.code == "1010").first()
            dr_account_id = dr_account.id if dr_account else None
        elif payment.method in ("bank_transfer", "cheque", "online", "credit_card", "debit_card"):
            dr_account = db.query(Account).filter(Account.code == "1100").first()
            dr_account_id = dr_account.id if dr_account else None
        if not dr_account_id:
            raise HTTPException(status_code=400, detail="Cannot determine debit account")

    cr_account_id = body.credit_account_id
    if not cr_account_id:
        if payment.allocations:
            ar_account = db.query(Account).filter(Account.code == "1200").first()
            cr_account_id = ar_account.id if ar_account else None
        if not cr_account_id:
            other_income = db.query(Account).filter(Account.code == "4300").first()
            cr_account_id = other_income.id if other_income else None
        if not cr_account_id:
            raise HTTPException(status_code=400, detail="Cannot determine credit account")

    journal = JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=dr_account_id, debit=payment.amount,
                             description=f"Payment {payment.payment_number}"),
            JournalEntryData(account_id=cr_account_id, credit=payment.amount,
                             description=f"Payment {payment.payment_number}"),
        ],
        reference_type="payment",
        reference_id=str(payment.id),
        description=f"Payment {payment.payment_number}: {payment.party_name or 'N/A'}",
        date=payment.date,
        user=user,
        source=payment.source or "MANUAL",
    )

    payment.posted_to_finance = True
    payment.finance_journal_id = journal.id
    db.commit()
    log_activity(
        db=db, user=user, action="post_to_finance", module="finance",
        record_type="Payment", record_id=str(payment.id),
        record_label=f"Payment {payment.payment_number}",
        new_values={"posted_to_finance": True, "finance_journal_id": journal.id},
    )
    db.commit()
    await ws_manager.broadcast("payment_posted", {"payment_id": payment.id})
    db.refresh(payment)

    return payment


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
        # Check duplicate vendor invoice
        if payload.vendor_id and payload.invoice_bill_no:
            existing = db.query(Expense).filter(
                Expense.vendor_id == payload.vendor_id,
                Expense.invoice_bill_no == payload.invoice_bill_no,
                Expense.deleted_at.is_(None),
            ).first()
            if existing:
                raise HTTPException(400, f"Vendor invoice {payload.invoice_bill_no} already exists as expense {existing.expense_number}")

        # Compute totals from line items
        line_items_data = [item.model_dump() for item in payload.line_items]
        totals = _compute_expense_totals(line_items_data)

        expense = Expense(
            expense_number=_next_expense_number(db),
            expense_date=payload.expense_date or datetime.utcnow(),
            expense_type=payload.expense_type,
            status="draft",
            currency=payload.currency or "PKR",
            expense_source=payload.expense_source,
            source_id=payload.source_id,
            source_reference=payload.source_reference,
            vendor_id=payload.vendor_id,
            vendor_name=payload.vendor_name,
            vendor_phone=payload.vendor_phone,
            vendor_email=payload.vendor_email,
            vendor_address=payload.vendor_address,
            vendor_ntn=payload.vendor_ntn,
            vendor_strn=payload.vendor_strn,
            invoice_bill_no=payload.invoice_bill_no,
            vendor_invoice_date=payload.vendor_invoice_date,
            construction_project_id=payload.construction_project_id,
            property_id=payload.property_id,
            building=payload.building,
            floor=payload.floor,
            unit_id=payload.unit_id,
            maintenance_ticket_id=payload.maintenance_ticket_id,
            purchase_order_id=payload.purchase_order_id,
            department=payload.department,
            subtotal=totals["subtotal"],
            tax_amount=totals["tax_amount"],
            discount_amount=totals["discount_amount"],
            adjustment=payload.adjustment,
            amount=totals["amount"] + payload.adjustment,
            paid_amount=Decimal("0"),
            remaining_amount=totals["amount"] + payload.adjustment,
            line_items=line_items_data,
            account_id=payload.account_id,
            paid_from=payload.paid_from,
            payment_method=payload.payment_method,
            payment_status=payload.payment_status or "pending",
            paid_from_account_id=payload.paid_from_account_id,
            bank_account=payload.bank_account,
            transaction_reference=payload.transaction_reference,
            payment_date=payload.payment_date,
            cheque_number=payload.cheque_number,
            approved_budget=payload.approved_budget,
            budget_used=payload.budget_used,
            budget_remaining=payload.budget_remaining,
            budget_exceeded=payload.budget_exceeded,
            budget_approval_required=payload.budget_approval_required,
            is_recurring=payload.is_recurring,
            recurring_frequency=payload.recurring_frequency,
            next_due_date=payload.next_due_date,
            recurring_end_date=payload.recurring_end_date,
            internal_notes=payload.internal_notes,
            vendor_notes=payload.vendor_notes,
            remarks=payload.remarks,
            approval_status="draft",
            submitted_by=user.id,
            created_by_user_id=user.id,
        )
        if not user.is_super_admin:
            expense.company_id = user.company_id
        db.add(expense)
        db.flush()

        # Create expense line items
        for i, item in enumerate(line_items_data):
            ei = ExpenseItem(
                expense_id=expense.id,
                description=item.get("description", ""),
                category=item.get("category"),
                quantity=Decimal(str(item.get("quantity", 1))),
                unit=item.get("unit"),
                unit_cost=Decimal(str(item.get("unit_cost", 0))),
                discount_pct=Decimal(str(item.get("discount_pct", 0))),
                tax_pct=Decimal(str(item.get("tax_pct", 0))),
                discount_amount=Decimal(str(item.get("discount_amount", 0))),
                tax_amount=Decimal(str(item.get("tax_amount", 0))),
                line_total=Decimal(str(item.get("line_total", 0))),
                sort_order=i,
            )
            db.add(ei)

        db.flush()

        # Check budget exceed
        if payload.approved_budget and expense.amount > payload.approved_budget:
            expense.budget_exceeded = True
            if payload.budget_approval_required:
                expense.approval_status = "draft"

        db.commit()
        db.refresh(expense)
        _log_audit(db, user, "CREATE", "expenses", "Expense", str(expense.id),
                   f"Created expense {expense.expense_number}: {expense.vendor_name or ''}", expense.amount)
        log_activity(
            db=db, user=user, action="create", module="finance",
            record_type="Expense", record_id=str(expense.id),
            record_label=f"Expense {expense.expense_number}",
            new_values={k: str(v) for k, v in expense.__dict__.items() if not k.startswith('_')},
        )
        await ws_manager.broadcast("expense_created", {"expense_id": expense.id})

        # Build response with items
        items_resp = db.query(ExpenseItem).filter(ExpenseItem.expense_id == expense.id).order_by(ExpenseItem.sort_order).all()
        return _expense_to_full_response(expense, items_resp)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


def _expense_to_full_response(expense: Expense, items: list[ExpenseItem] | None = None) -> ExpenseResponse:
    if items is None:
        items = []
    account = None
    if expense.account_id:
        account = expense.account
    return ExpenseResponse(
        id=expense.id,
        expense_number=expense.expense_number,
        expense_date=expense.expense_date,
        expense_type=expense.expense_type or "miscellaneous",
        status=expense.status or "draft",
        currency=expense.currency or "PKR",
        expense_source=expense.expense_source,
        source_id=expense.source_id,
        source_reference=expense.source_reference,
        vendor_id=expense.vendor_id,
        vendor_name=expense.vendor_name,
        vendor_phone=expense.vendor_phone,
        vendor_email=expense.vendor_email,
        vendor_address=expense.vendor_address,
        vendor_ntn=expense.vendor_ntn,
        vendor_strn=expense.vendor_strn,
        vendor_outstanding=expense.vendor_outstanding,
        invoice_bill_no=expense.invoice_bill_no,
        vendor_invoice_date=expense.vendor_invoice_date,
        construction_project_id=expense.construction_project_id,
        property_id=expense.property_id,
        building=expense.building,
        floor=expense.floor,
        unit_id=expense.unit_id,
        maintenance_ticket_id=expense.maintenance_ticket_id,
        purchase_order_id=expense.purchase_order_id,
        department=expense.department,
        subtotal=expense.subtotal or Decimal("0"),
        tax_amount=expense.tax_amount or Decimal("0"),
        discount_amount=expense.discount_amount or Decimal("0"),
        adjustment=expense.adjustment or Decimal("0"),
        amount=expense.amount or Decimal("0"),
        paid_amount=expense.paid_amount or Decimal("0"),
        remaining_amount=expense.remaining_amount or Decimal("0"),
        line_items=[ExpenseLineItemResponse(
            id=item.id, expense_id=item.expense_id,
            description=item.description, category=item.category,
            quantity=item.quantity, unit=item.unit, unit_cost=item.unit_cost,
            discount_pct=item.discount_pct, tax_pct=item.tax_pct,
            discount_amount=item.discount_amount, tax_amount=item.tax_amount,
            line_total=item.line_total, sort_order=item.sort_order,
        ) for item in items],
        approved_budget=expense.approved_budget,
        budget_used=expense.budget_used,
        budget_remaining=expense.budget_remaining,
        budget_exceeded=expense.budget_exceeded or False,
        budget_approval_required=expense.budget_approval_required or False,
        account_id=expense.account_id,
        account_name=account.name if account else None,
        account_code=account.code if account else None,
        paid_from=expense.paid_from,
        payment_method=expense.payment_method,
        payment_status=expense.payment_status or "pending",
        paid_from_account_id=expense.paid_from_account_id,
        bank_account=expense.bank_account,
        transaction_reference=expense.transaction_reference,
        payment_date=expense.payment_date,
        cheque_number=expense.cheque_number,
        approval_status=expense.approval_status or "draft",
        approval_level=expense.approval_level,
        approved_by=expense.approved_by,
        approved_at=expense.approved_at,
        rejected_by=expense.rejected_by,
        rejected_at=expense.rejected_at,
        rejection_reason=expense.rejection_reason,
        submitted_by=expense.submitted_by,
        submitted_at=expense.submitted_at,
        is_recurring=expense.is_recurring or False,
        recurring_frequency=expense.recurring_frequency,
        next_due_date=expense.next_due_date,
        recurring_end_date=expense.recurring_end_date,
        internal_notes=expense.internal_notes,
        vendor_notes=expense.vendor_notes,
        remarks=expense.remarks,
        receipt_path=expense.receipt_path,
        deleted_at=expense.deleted_at,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
        created_by_user_id=expense.created_by_user_id,
    )


@router.get("/expenses", response_model=dict)
async def list_expenses(
    response: Response, skip: int = 0, limit: int | None = 100,
    offset: int | None = None, search: str | None = None,
    filter: str | None = None, startDate: date | None = None,
    endDate: date | None = None, status: str | None = None,
    expense_type: str | None = None, expense_source: str | None = None,
    payment_status: str | None = None, approval_status: str | None = None,
    vendor_id: int | None = None, department: str | None = None,
    construction_project_id: int | None = None, property_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Expense).filter(Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    if status:
        query = query.filter(Expense.status == status)
    if expense_type:
        query = query.filter(Expense.expense_type == expense_type)
    if expense_source:
        query = query.filter(Expense.expense_source == expense_source)
    if payment_status:
        query = query.filter(Expense.payment_status == payment_status)
    if approval_status:
        query = query.filter(Expense.approval_status == approval_status)
    if vendor_id:
        query = query.filter(Expense.vendor_id == vendor_id)
    if department:
        query = query.filter(Expense.department == department)
    if construction_project_id:
        query = query.filter(Expense.construction_project_id == construction_project_id)
    if property_id:
        query = query.filter(Expense.property_id == property_id)

    query = query.order_by(Expense.expense_date.desc())
    actual_offset = offset if offset is not None else skip
    query, total = apply_table_filters(
        query=query, model=Expense, limit=limit, offset=actual_offset,
        search=search,
        search_fields=[Expense.expense_number, Expense.vendor_name, Expense.invoice_bill_no,
                       Expense.internal_notes, Expense.remarks],
        date_filter=filter, date_field=Expense.expense_date,
        start_date=startDate, end_date=endDate,
    )
    rows = query.all()
    response.headers["X-Total-Count"] = str(total)
    list_items = [
        ExpenseListResponse(
            id=exp.id, expense_number=exp.expense_number,
            expense_date=exp.expense_date, expense_type=exp.expense_type or "",
            status=exp.status or "draft",
            vendor_name=exp.vendor_name, vendor_id=exp.vendor_id,
            invoice_bill_no=exp.invoice_bill_no,
            amount=exp.amount or Decimal("0"),
            paid_amount=exp.paid_amount or Decimal("0"),
            remaining_amount=exp.remaining_amount or Decimal("0"),
            payment_status=exp.payment_status,
            approval_status=exp.approval_status,
            department=exp.department,
            expense_source=exp.expense_source,
            created_at=exp.created_at,
            created_by_user_id=exp.created_by_user_id,
        ) for exp in rows
    ]
    return {"items": list_items, "total": total}


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expense = query.first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    items = db.query(ExpenseItem).filter(ExpenseItem.expense_id == expense.id).order_by(ExpenseItem.sort_order).all()
    return _expense_to_full_response(expense, items)


@router.patch("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expense = query.first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status not in ("draft", "submitted"):
        raise HTTPException(400, f"Cannot edit {expense.status} expense. Only draft expenses can be edited.")

    old_data = {k: str(v) for k, v in expense.__dict__.items() if not k.startswith('_')}
    update_data = payload.model_dump(exclude_unset=True)

    # Handle line items update
    if "line_items" in update_data and update_data["line_items"] is not None:
        items_data = [item.model_dump() if hasattr(item, "model_dump") else item for item in update_data["line_items"]]
        totals = _compute_expense_totals(items_data)
        update_data["line_items"] = items_data
        update_data["subtotal"] = float(totals["subtotal"])
        update_data["tax_amount"] = float(totals["tax_amount"])
        update_data["discount_amount"] = float(totals["discount_amount"])
        update_data["amount"] = float(totals["amount"]) + float(update_data.get("adjustment", 0) or 0)
        remaining = float(expense.amount) if isinstance(expense.amount, Decimal) else expense.amount
        paid = float(expense.paid_amount) if isinstance(expense.paid_amount, Decimal) else expense.paid_amount
        update_data["remaining_amount"] = float(totals["amount"]) - paid

        # Rebuild ExpenseItem records
        db.query(ExpenseItem).filter(ExpenseItem.expense_id == expense.id).delete()
        for i, item in enumerate(items_data):
            ei = ExpenseItem(
                expense_id=expense.id,
                description=item.get("description", ""),
                category=item.get("category"),
                quantity=Decimal(str(item.get("quantity", 1))),
                unit=item.get("unit"),
                unit_cost=Decimal(str(item.get("unit_cost", 0))),
                discount_pct=Decimal(str(item.get("discount_pct", 0))),
                tax_pct=Decimal(str(item.get("tax_pct", 0))),
                discount_amount=Decimal(str(item.get("discount_amount", 0))),
                tax_amount=Decimal(str(item.get("tax_amount", 0))),
                line_total=Decimal(str(item.get("line_total", 0))),
                sort_order=i,
            )
            db.add(ei)
    elif "adjustment" in update_data:
        update_data["amount"] = float(expense.subtotal) - float(expense.discount_amount) + float(expense.tax_amount) + float(update_data["adjustment"])
        remaining = float(expense.amount) if isinstance(expense.amount, Decimal) else expense.amount
        paid = float(expense.paid_amount) if isinstance(expense.paid_amount, Decimal) else expense.paid_amount
        update_data["remaining_amount"] = float(update_data["amount"]) - paid

    for field, value in update_data.items():
        if field != "line_items":
            setattr(expense, field, value)

    db.commit()
    _log_audit(db, user, "UPDATE", "expenses", "Expense", str(expense_id),
               f"Updated expense {expense.expense_number}")
    db.commit()

    items = db.query(ExpenseItem).filter(ExpenseItem.expense_id == expense.id).order_by(ExpenseItem.sort_order).all()
    return _expense_to_full_response(expense, items)


@router.post("/expenses/{expense_id}/submit")
async def submit_expense(
    expense_id: int,
    payload: ExpenseSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expense = query.first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status != "draft":
        raise HTTPException(400, f"Cannot submit a {expense.status} expense")

    expense.status = "submitted"
    expense.approval_status = "submitted"
    expense.submitted_by = user.id
    expense.submitted_at = datetime.utcnow()
    if payload.notes:
        expense.remarks = (expense.remarks or "") + f"\n[SUBMIT] {payload.notes}"

    db.commit()
    _log_audit(db, user, "SUBMIT", "expenses", "Expense", str(expense_id),
               f"Submitted expense {expense.expense_number}")
    db.commit()
    await ws_manager.broadcast("expense_submitted", {"expense_id": expense.id})
    return {"success": True, "message": f"Expense {expense.expense_number} submitted for approval"}


@router.post("/expenses/{expense_id}/approve")
async def approve_expense(
    expense_id: int,
    payload: ExpenseApprove,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expense = query.first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status != "submitted":
        raise HTTPException(400, f"Cannot approve a {expense.status} expense")

    expense.status = "approved"
    expense.approval_status = "approved"
    expense.approved_by = user.id
    expense.approved_at = datetime.utcnow()
    expense.approval_level = payload.approval_level or 1

    # Create journal entry
    if expense.account_id:
        expense_account = db.query(Account).filter(Account.id == expense.account_id).first()
    else:
        expense_account = db.query(Account).filter(Account.code == "5100").first()
    cash_code = "1010" if expense.paid_from == "cash" else "1100"
    cash_account = db.query(Account).filter(Account.code == cash_code).first()
    if expense_account and cash_account:
        JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=expense_account.id, debit=expense.amount,
                                 description=f"Expense {expense.expense_number}"),
                JournalEntryData(account_id=cash_account.id, credit=expense.amount,
                                 description=f"Expense {expense.expense_number}"),
            ],
            reference_type="expense",
            reference_id=str(expense.id),
            description=f"Expense {expense.expense_number}: {expense.vendor_name or ''}",
            date=expense.expense_date, user=user, source=expense.expense_source or "MANUAL",
        )

    if payload.notes:
        expense.remarks = (expense.remarks or "") + f"\n[APPROVE] {payload.notes}"

    db.commit()
    _log_audit(db, user, "APPROVE", "expenses", "Expense", str(expense_id),
               f"Approved expense {expense.expense_number}", expense.amount)
    log_activity(
        db=db, user=user, action="approve", module="finance",
        record_type="Expense", record_id=str(expense.id),
        record_label=f"Expense {expense.expense_number}",
        new_values={"status": "approved", "approved_by": user.id},
    )
    db.commit()
    await ws_manager.broadcast("expense_approved", {"expense_id": expense.id})
    return {"success": True, "message": f"Expense {expense.expense_number} approved"}


@router.post("/expenses/{expense_id}/reject")
async def reject_expense(
    expense_id: int,
    payload: ExpenseReject,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expense = query.first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status != "submitted":
        raise HTTPException(400, f"Cannot reject a {expense.status} expense")

    expense.status = "draft"
    expense.approval_status = "rejected"
    expense.rejected_by = user.id
    expense.rejected_at = datetime.utcnow()
    expense.rejection_reason = payload.reason
    if payload.notes:
        expense.remarks = (expense.remarks or "") + f"\n[REJECT] {payload.notes}"

    db.commit()
    _log_audit(db, user, "REJECT", "expenses", "Expense", str(expense_id),
               f"Rejected expense {expense.expense_number}: {payload.reason}")
    db.commit()
    await ws_manager.broadcast("expense_rejected", {"expense_id": expense.id})
    return {"success": True, "message": f"Expense {expense.expense_number} rejected"}


@router.post("/expenses/{expense_id}/pay", response_model=ExpenseResponse)
async def record_expense_payment(
    expense_id: int,
    payload: ExpenseRecordPayment,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expense = query.first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status in ("cancelled", "closed"):
        raise HTTPException(400, f"Cannot pay a {expense.status} expense")

    pay_amount = payload.amount
    if pay_amount > expense.remaining_amount:
        raise HTTPException(400, f"Payment amount ({pay_amount}) exceeds remaining balance ({expense.remaining_amount})")

    expense.paid_amount = (expense.paid_amount or Decimal("0")) + pay_amount
    expense.remaining_amount = expense.amount - expense.paid_amount
    expense.payment_method = payload.payment_method
    expense.paid_from = payload.paid_from
    expense.paid_from_account_id = payload.paid_from_account_id
    expense.bank_account = payload.bank_account
    expense.transaction_reference = payload.transaction_reference
    expense.payment_date = payload.payment_date or datetime.utcnow()
    expense.cheque_number = payload.cheque_number

    if expense.remaining_amount <= 0:
        expense.payment_status = "paid"
        expense.status = "closed"
    else:
        expense.payment_status = "partially_paid"

    # Journal entry for payment
    dr_code = "1010" if payload.paid_from == "cash" else "1100"
    dr_account = db.query(Account).filter(Account.code == dr_code).first()
    cr_code = "2100"
    cr_account = db.query(Account).filter(Account.code == cr_code).first()
    if dr_account and cr_account:
        JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(account_id=cr_account.id, debit=pay_amount,
                                 description=f"Payment for expense {expense.expense_number}"),
                JournalEntryData(account_id=dr_account.id, credit=pay_amount,
                                 description=f"Payment for expense {expense.expense_number}"),
            ],
            reference_type="expense_payment",
            reference_id=str(expense.id),
            description=f"Expense payment: {expense.expense_number} - {expense.vendor_name or ''}",
            date=payload.payment_date or datetime.utcnow(),
            user=user, source="MANUAL",
        )

    if payload.notes:
        expense.remarks = (expense.remarks or "") + f"\n[PAYMENT] {payload.notes}"

    db.commit()
    _log_audit(db, user, "PAY", "expenses", "Expense", str(expense_id),
               f"Payment of {pay_amount} recorded for expense {expense.expense_number}", pay_amount)
    db.commit()
    await ws_manager.broadcast("expense_paid", {"expense_id": expense.id})

    items = db.query(ExpenseItem).filter(ExpenseItem.expense_id == expense.id).order_by(ExpenseItem.sort_order).all()
    return _expense_to_full_response(expense, items)


@router.post("/expenses/{expense_id}/cancel")
async def cancel_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expense = query.first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status in ("paid", "closed"):
        raise HTTPException(400, f"Cannot cancel a {expense.status} expense")

    expense.status = "cancelled"
    db.commit()
    _log_audit(db, user, "CANCEL", "expenses", "Expense", str(expense_id),
               f"Cancelled expense {expense.expense_number}")
    db.commit()
    return {"success": True, "message": f"Expense {expense.expense_number} cancelled"}


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    query = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expense = query.first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status not in ("draft", "cancelled"):
        raise HTTPException(400, f"Cannot delete a {expense.status} expense. Only draft or cancelled expenses can be deleted.")

    expense.deleted_at = datetime.utcnow()
    db.commit()
    _log_audit(db, user, "DELETE", "expenses", "Expense", str(expense_id),
               f"Deleted expense {expense.expense_number}")
    db.commit()
    return {"success": True, "message": f"Expense {expense.expense_number} deleted"}


@router.get("/expenses/reports/by-category")
async def expense_report_by_category(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(
        Expense.expense_type,
        func.count(Expense.id).label("count"),
        func.sum(Expense.amount).label("total"),
    ).filter(Expense.deleted_at.is_(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    if start_date:
        query = query.filter(Expense.expense_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Expense.expense_date <= datetime.fromisoformat(end_date) + timedelta(days=1))
    query = query.group_by(Expense.expense_type).order_by(Expense.expense_type)
    rows = query.all()
    return [{"category": r.expense_type, "count": int(r.count), "total": float(r.total)} for r in rows]


@router.get("/expenses/reports/by-vendor")
async def expense_report_by_vendor(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(
        Expense.vendor_id, Expense.vendor_name,
        func.count(Expense.id).label("count"),
        func.sum(Expense.amount).label("total"),
        func.sum(Expense.paid_amount).label("paid"),
    ).filter(Expense.deleted_at.is_(None), Expense.vendor_name.isnot(None))
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    if start_date:
        query = query.filter(Expense.expense_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Expense.expense_date <= datetime.fromisoformat(end_date) + timedelta(days=1))
    query = query.group_by(Expense.vendor_id, Expense.vendor_name).order_by(Expense.vendor_name)
    rows = query.all()
    return [{"vendor_id": r.vendor_id, "vendor_name": r.vendor_name, "count": int(r.count),
             "total": float(r.total), "paid": float(r.paid), "balance": float(r.total - r.paid)} for r in rows]


@router.get("/expenses/reports/accounts-payable-aging")
async def accounts_payable_aging_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(Expense).filter(
        Expense.deleted_at.is_(None),
        Expense.status.in_(["approved", "submitted"]),
        Expense.remaining_amount > 0,
    )
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    expenses = query.order_by(Expense.expense_date.asc()).all()
    now = datetime.utcnow()
    buckets = {"0_30": [], "31_60": [], "61_90": [], "90_plus": []}
    for exp in expenses:
        days = (now - exp.expense_date).days if exp.expense_date < now else 0
        bucket = "0_30" if days <= 30 else "31_60" if days <= 60 else "61_90" if days <= 90 else "90_plus"
        buckets[bucket].append({
            "id": exp.id, "expense_number": exp.expense_number, "vendor_name": exp.vendor_name,
            "amount": float(exp.amount), "remaining": float(exp.remaining_amount),
            "days": days, "date": exp.expense_date.isoformat() if exp.expense_date else None,
        })
    result = []
    for label, key in [("0-30 Days", "0_30"), ("31-60 Days", "31_60"), ("61-90 Days", "61_90"), ("90+ Days", "90_plus")]:
        items = buckets[key]
        result.append({"label": label, "count": len(items), "total": sum(i["remaining"] for i in items), "expenses": items})
    return result


@router.get("/expenses/reports/budget-vs-actual")
async def budget_vs_actual_report(
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(
        Expense.department,
        func.count(Expense.id).label("count"),
        func.sum(Expense.amount).label("actual"),
        func.sum(Expense.approved_budget).label("budget"),
    ).filter(
        Expense.deleted_at.is_(None),
        Expense.department.isnot(None),
    )
    if not user.is_super_admin:
        query = query.filter(Expense.company_id == user.company_id)
    query = query.group_by(Expense.department).order_by(Expense.department)
    rows = query.all()
    return [{"department": r.department, "count": int(r.count),
             "actual": float(r.actual or 0), "budget": float(r.budget or 0),
             "variance": float((r.budget or 0) - (r.actual or 0)),
             "utilization_pct": round(float((r.actual or 0) / (r.budget or 1) * 100), 2) if r.budget else 0}
            for r in rows]


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

    bank_cash_ids = [a.id for a in [bank_account, cash_account] if a]

    balances_now = JournalService.get_account_balances(db, bank_cash_ids)
    balances_last = JournalService.get_account_balances(db, bank_cash_ids, first_of_last_month)

    bank_bal = balances_now.get(bank_account.id, Decimal("0")) if bank_account else Decimal("0")
    cash_bal = balances_now.get(cash_account.id, Decimal("0")) if cash_account else Decimal("0")
    bank_bal_last = balances_last.get(bank_account.id, Decimal("0")) if bank_account else Decimal("0")
    cash_bal_last = balances_last.get(cash_account.id, Decimal("0")) if cash_account else Decimal("0")

    income_accounts = db.query(Account).filter(Account.account_type == "Income").all()
    expense_accounts = db.query(Account).filter(Account.account_type == "Expense").all()

    income_ids = [a.id for a in income_accounts]
    expense_ids = [a.id for a in expense_accounts]

    inc_bal_now = JournalService.get_account_balances(db, income_ids, now)
    inc_bal_fom = JournalService.get_account_balances(db, income_ids, first_of_month)
    inc_bal_flm = JournalService.get_account_balances(db, income_ids, first_of_last_month) if first_of_last_month else {}

    exp_bal_now = JournalService.get_account_balances(db, expense_ids, now)
    exp_bal_fom = JournalService.get_account_balances(db, expense_ids, first_of_month)
    exp_bal_flm = JournalService.get_account_balances(db, expense_ids, first_of_last_month) if first_of_last_month else {}

    total_income = sum(inc_bal_now.values())
    total_expenses = sum(exp_bal_now.values())

    income_this = sum(inc_bal_now.get(aid, Decimal("0")) - inc_bal_fom.get(aid, Decimal("0")) for aid in income_ids)
    expense_this = sum(exp_bal_now.get(aid, Decimal("0")) - exp_bal_fom.get(aid, Decimal("0")) for aid in expense_ids)
    income_last = sum(inc_bal_fom.get(aid, Decimal("0")) - inc_bal_flm.get(aid, Decimal("0")) for aid in income_ids) if first_of_last_month else Decimal("0")
    expense_last = sum(exp_bal_fom.get(aid, Decimal("0")) - exp_bal_flm.get(aid, Decimal("0")) for aid in expense_ids) if first_of_last_month else Decimal("0")

    pending_receivables = db.query(func.coalesce(func.sum(Invoice.remaining_amount), 0)).filter(
        Invoice.status.in_(["pending", "partial"]),
    ).scalar() or Decimal("0")

    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    overdue_total = db.query(func.coalesce(func.sum(Invoice.remaining_amount), 0)).filter(
        Invoice.status.in_(["pending", "partial"]),
        Invoice.due_date < today,
    ).scalar() or Decimal("0")

    commission_payable = db.query(func.coalesce(func.sum(Commission.amount), 0)).filter(
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
    now = datetime.utcnow()
    income_ids = [a.id for a in db.query(Account).filter(Account.account_type == "Income").all()]
    expense_ids = [a.id for a in db.query(Account).filter(Account.account_type == "Expense").all()]

    month_boundaries = []
    for i in range(months - 1, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start.replace(month=month_start.month % 12 + 1, year=month_start.year + (month_start.month // 12)) - timedelta(days=1)) if i > 0 else now
        month_boundaries.append((month_start, month_end))

    all_dates = set()
    for start, end in month_boundaries:
        all_dates.add(start)
        all_dates.add(end)

    inc_balances = {}
    exp_balances = {}
    for d in all_dates:
        inc_balances[d] = JournalService.get_account_balances(db, income_ids, d)
        exp_balances[d] = JournalService.get_account_balances(db, expense_ids, d)

    results = []
    for month_start, month_end in month_boundaries:
        inc_end = inc_balances[month_end]
        inc_start = inc_balances[month_start]
        exp_end = exp_balances[month_end]
        exp_start = exp_balances[month_start]

        income = sum(inc_end.get(aid, Decimal("0")) - inc_start.get(aid, Decimal("0")) for aid in income_ids)
        expense = sum(exp_end.get(aid, Decimal("0")) - exp_start.get(aid, Decimal("0")) for aid in expense_ids)

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

    now = datetime.utcnow().replace(hour=23, minute=59, second=59)
    start_date = now - timedelta(days=days)
    cache_accounts = JournalService.get_account_balances(
        db, [bank_account.id, cash_account.id], start_date
    )

    entries = db.query(
        Journal.date,
        JournalEntry.account_id,
        func.coalesce(func.sum(JournalEntry.debit), 0),
        func.coalesce(func.sum(JournalEntry.credit), 0),
    ).join(Journal).filter(
        JournalEntry.account_id.in_([bank_account.id, cash_account.id]),
        Journal.date > start_date,
        Journal.date <= now,
    ).group_by(Journal.date, JournalEntry.account_id).order_by(Journal.date).all()

    daily: dict = {}
    for date_val, aid, debit, credit in entries:
        day_key = date_val.strftime("%Y-%m-%d")
        if day_key not in daily:
            daily[day_key] = {"bank": Decimal("0"), "cash": Decimal("0")}
        net = Decimal(str(debit)) - Decimal(str(credit))
        if aid == bank_account.id:
            daily[day_key]["bank"] += net
        else:
            daily[day_key]["cash"] += net

    running_bal = cache_accounts.get(bank_account.id, Decimal("0")) + cache_accounts.get(cash_account.id, Decimal("0"))

    results = []
    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        day_key = d.strftime("%Y-%m-%d")
        if day_key in daily:
            running_bal += daily[day_key]["bank"] + daily[day_key]["cash"]
        results.append(CashFlowPoint(date=day_key, balance=running_bal))

    return results


@router.get("/dashboard/invoice-status")
async def get_invoice_status(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    count_amount = db.query(
        Invoice.status,
        func.count(Invoice.id),
        func.coalesce(func.sum(Invoice.remaining_amount), 0),
    ).group_by(Invoice.status).all()

    remaining_map = {}
    count_map = {}
    for status, count, amount in count_amount:
        remaining_map[status] = Decimal(str(amount))
        count_map[status] = count

    paid_amount = db.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
        Invoice.status == "paid",
    ).scalar() or Decimal("0")

    statuses = ["paid", "partially_paid", "pending", "draft", "sent", "overdue", "cancelled", "void"]
    results = []
    total_outstanding = Decimal("0")
    for status in statuses:
        count = count_map.get(status, 0)
        if status == "paid":
            total = paid_amount
        elif status == "overdue":
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            count = db.query(func.count(Invoice.id)).filter(
                Invoice.status.in_(["pending", "partially_paid"]),
                Invoice.due_date < today,
            ).scalar() or 0
            total = db.query(func.coalesce(func.sum(Invoice.remaining_amount), 0)).filter(
                Invoice.status.in_(["pending", "partially_paid"]),
                Invoice.due_date < today,
            ).scalar() or Decimal("0")
            total_outstanding += total
        else:
            total = remaining_map.get(status, Decimal("0"))
            if status in ("pending", "partially_paid"):
                total_outstanding += total
        results.append(InvoiceStatusCount(status=status, count=count, amount=total))

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
        units = db.query(Unit).filter(Unit.property_id == prop.id).all()
        total_units = len(units)
        occupied_units = len([u for u in units if u.status in ("occupied", "rented")])
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


@router.get("/journals/reports/day-book", response_model=DayBookResponse)
async def get_day_book(
    date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    query = db.query(JournalEntry, Journal, Account).join(Journal).join(Account, JournalEntry.account_id == Account.id)
    day = datetime.fromisoformat(date).date() if date else None
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    if day:
        query = query.filter(func.date(Journal.date) == day)
    if start:
        query = query.filter(Journal.date >= start)
    if end:
        query = query.filter(Journal.date <= end)
    results = query.order_by(Journal.date, Journal.id, JournalEntry.id).all()
    entries = []
    total_dr = Decimal("0")
    total_cr = Decimal("0")
    for entry, journal, account in results:
        d = entry.debit or Decimal("0")
        c = entry.credit or Decimal("0")
        total_dr += d
        total_cr += c
        entries.append(DayBookEntry(
            journal_id=journal.id,
            journal_number=journal.journal_number,
            date=journal.date,
            reference_type=journal.reference_type,
            description=entry.narration or entry.description or journal.description,
            source=journal.source,
            account_code=account.code,
            account_name=account.name,
            debit=d,
            credit=c,
        ))
    return DayBookResponse(date=day, entries=entries, total_debit=total_dr, total_credit=total_cr)


@router.get("/journals/reports/cash-book", response_model=CashBookResponse)
async def get_cash_book(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    cash_account = db.query(Account).filter(Account.code.like("1010%")).first()
    if not cash_account:
        return CashBookResponse(opening_balance=Decimal("0"), entries=[], total_receipts=Decimal("0"), total_payments=Decimal("0"), closing_balance=Decimal("0"))
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    opening = JournalService.get_account_balance(db, cash_account.id, start) if start else (cash_account.opening_balance or Decimal("0"))
    ledger = JournalService.get_account_ledger(db, cash_account.id, start, end)
    entries = []
    total_dr = Decimal("0")
    total_cr = Decimal("0")
    for row in ledger:
        if row["id"] == 0:
            continue
        entries.append(CashBookEntry(
            journal_id=row["journal_id"],
            journal_number=None,
            date=row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
            reference_type=row["reference_type"],
            description=row["description"],
            debit=row["debit"],
            credit=row["credit"],
            balance=row["balance"],
        ))
        total_dr += row["debit"]
        total_cr += row["credit"]
    closing = JournalService.get_account_balance(db, cash_account.id, end) if end else JournalService.get_account_balance(db, cash_account.id)
    return CashBookResponse(
        opening_balance=opening,
        entries=entries,
        total_receipts=total_dr,
        total_payments=total_cr,
        closing_balance=closing,
    )


@router.get("/journals/reports/bank-book", response_model=BankBookResponse)
async def get_bank_book(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission("finance:manage", "finance:view")),
):
    bank_account = db.query(Account).filter(Account.code.like("1100%")).first()
    if not bank_account:
        return BankBookResponse(opening_balance=Decimal("0"), entries=[], total_deposits=Decimal("0"), total_withdrawals=Decimal("0"), closing_balance=Decimal("0"))
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    opening = JournalService.get_account_balance(db, bank_account.id, start) if start else (bank_account.opening_balance or Decimal("0"))
    ledger = JournalService.get_account_ledger(db, bank_account.id, start, end)
    entries = []
    total_dr = Decimal("0")
    total_cr = Decimal("0")
    for row in ledger:
        if row["id"] == 0:
            continue
        entries.append(BankBookEntry(
            journal_id=row["journal_id"],
            journal_number=None,
            date=row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
            reference_type=row["reference_type"],
            description=row["description"],
            debit=row["debit"],
            credit=row["credit"],
            balance=row["balance"],
        ))
        total_dr += row["debit"]
        total_cr += row["credit"]
    closing = JournalService.get_account_balance(db, bank_account.id, end) if end else JournalService.get_account_balance(db, bank_account.id)
    return BankBookResponse(
        opening_balance=opening,
        entries=entries,
        total_deposits=total_dr,
        total_withdrawals=total_cr,
        closing_balance=closing,
    )


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


# ── VENDOR ENDPOINTS ──────────────────────────────────────────────────────────


@router.post("/vendors", response_model=VendorResponse)
async def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    code = payload.name[:3].upper() + str(int(time.time()))[-6:]
    vendor = Vendor(
        vendor_code=code,
        name=payload.name,
        contact_person=payload.contact_person,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        ntn=payload.ntn,
        strn=payload.strn,
        payment_terms=payload.payment_terms,
        credit_limit=payload.credit_limit,
        is_active=payload.is_active,
        notes=payload.notes,
        created_by_user_id=user.id,
        company_id=user.company_id,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    log_activity(db, user, action="create", resource="vendor", resource_id=vendor.id, description=f"Created vendor {vendor.name}")
    ws_manager.broadcast("vendor_created", {"id": vendor.id, "name": vendor.name})
    return vendor


@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(
    active: bool = True,
    search: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    q = db.query(Vendor).filter(Vendor.deleted_at.is_(None))
    if not user.is_super_admin:
        q = q.filter(Vendor.company_id == user.company_id)
    if search:
        like = f"%{search}%"
        q = q.filter(Vendor.name.ilike(like) | Vendor.phone.ilike(like) | Vendor.email.ilike(like) | Vendor.ntn.ilike(like))
    if active:
        q = q.filter(Vendor.is_active == True)
    return q.order_by(Vendor.name).all()


@router.get("/vendors/search", response_model=list[VendorResponse])
async def search_vendors(
    q: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    """Quick search for vendor select/autocomplete"""
    vendors = db.query(Vendor).filter(Vendor.deleted_at.is_(None), Vendor.is_active == True)
    if not user.is_super_admin:
        vendors = vendors.filter(Vendor.company_id == user.company_id)
    if q:
        like = f"%{q}%"
        vendors = vendors.filter(Vendor.name.ilike(like) | Vendor.phone.ilike(like) | Vendor.email.ilike(like) | Vendor.ntn.ilike(like))
    return vendors.order_by(Vendor.name).limit(20).all()


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    q = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.deleted_at.is_(None))
    if not user.is_super_admin:
        q = q.filter(Vendor.company_id == user.company_id)
    vendor = q.first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    return vendor


@router.patch("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    q = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.deleted_at.is_(None))
    if not user.is_super_admin:
        q = q.filter(Vendor.company_id == user.company_id)
    vendor = q.first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vendor, field, value)
    db.commit()
    db.refresh(vendor)
    log_activity(db, user, action="update", resource="vendor", resource_id=vendor.id, description=f"Updated vendor {vendor.name}")
    ws_manager.broadcast("vendor_updated", {"id": vendor.id, "name": vendor.name})
    return vendor


@router.delete("/vendors/{vendor_id}")
async def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    q = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.deleted_at.is_(None))
    if not user.is_super_admin:
        q = q.filter(Vendor.company_id == user.company_id)
    vendor = q.first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    vendor.deleted_at = datetime.utcnow()
    db.commit()
    log_activity(db, user, action="delete", resource="vendor", resource_id=vendor.id, description=f"Deleted vendor {vendor.name}")
    ws_manager.broadcast("vendor_deleted", {"id": vendor_id})
    return {"deleted": True}


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
