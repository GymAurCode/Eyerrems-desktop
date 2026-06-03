"""
Finance Operations Engine — REVENUE, EXPENSE, REFUND, TRANSFER, ADJUSTMENT, MERGE

Core rule: NEVER modify existing journals/vouchers.
Every operation creates a NEW journal entry and a FinanceOperation record.
"""
import json
from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_permissions, require_any_permission
from app.core.audit import log_action
from app.core.database import get_db
from app.core.journal_service import JournalService, JournalEntryData
from app.core.websocket_manager import ws_manager
from app.models.auth import User
from app.models.finance import Account, Journal
from app.models.finance_operations import FinanceOperation
from app.schemas.finance_operations import (
    AdjustmentCreate,
    ExpenseOpCreate,
    FinanceOperationResponse,
    MergeCreate,
    RefundCreate,
    RevenueCreate,
    TransferCreate,
)

router = APIRouter()


def _op_to_response(op: FinanceOperation) -> FinanceOperationResponse:
    return FinanceOperationResponse(
        id=op.id,
        type=op.type,
        sub_type=op.sub_type,
        journal_id=op.journal_id,
        reference_journal_id=op.reference_journal_id,
        from_account_id=op.from_account_id,
        to_account_id=op.to_account_id,
        from_account_name=op.from_account.name if op.from_account else None,
        to_account_name=op.to_account.name if op.to_account else None,
        amount=op.amount,
        reason=op.reason,
        meta=op.get_meta(),
        entity_type=op.entity_type,
        entity_id=op.entity_id,
        created_at=op.created_at,
    )


def _get_account(db: Session, account_id: int, label: str) -> Account:
    acc = db.query(Account).filter(Account.id == account_id, Account.is_active.is_(True)).first()
    if not acc:
        raise HTTPException(status_code=404, detail=f"{label} account not found or inactive")
    return acc


# ── Revenue ───────────────────────────────────────────────────────────────────

@router.post("/revenue", response_model=FinanceOperationResponse)
async def create_revenue(
    payload: RevenueCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """
    Record a revenue event (rent received, income entry, security deposit).
    DR debit_account (Cash/Bank/AR) / CR credit_account (Income/Liability).
    Creates a NEW journal + FinanceOperation record.
    """
    debit_acc  = _get_account(db, payload.debit_account_id,  "Debit")
    credit_acc = _get_account(db, payload.credit_account_id, "Credit")

    try:
        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(
                    account_id=debit_acc.id,
                    debit=payload.amount,
                    description=payload.description,
                ),
                JournalEntryData(
                    account_id=credit_acc.id,
                    credit=payload.amount,
                    description=payload.description,
                ),
            ],
            reference_type=f"revenue_{payload.sub_type}",
            description=payload.description,
            date=payload.date or datetime.utcnow(),
            user=user,
        )
        db.flush()

        op = FinanceOperation(
            type="REVENUE",
            sub_type=payload.sub_type,
            journal_id=journal.id,
            from_account_id=debit_acc.id,
            to_account_id=credit_acc.id,
            amount=payload.amount,
            reason=payload.description,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            meta=json.dumps({"debit_account_code": debit_acc.code, "credit_account_code": credit_acc.code}),
            created_by_user_id=user.id,
        )
        db.add(op)
        db.commit()
        db.refresh(op)

        log_action(
            db=db, module="finance", action="CREATE",
            record_id=str(op.id), record_label=f"Revenue: {payload.sub_type}",
            changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
            new_data={"type": op.type, "sub_type": op.sub_type, "amount": str(op.amount)},
        )
        await ws_manager.broadcast("finance_updated", {"type": "revenue_created", "operation_id": op.id})
        return _op_to_response(op)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── Expense ───────────────────────────────────────────────────────────────────

@router.post("/expense", response_model=FinanceOperationResponse)
async def create_expense_op(
    payload: ExpenseOpCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """
    Record a structured expense operation (maintenance, salary, utility bills).
    DR debit_account (Expense) / CR credit_account (Cash/Bank).
    Creates a NEW journal + FinanceOperation record.
    """
    debit_acc  = _get_account(db, payload.debit_account_id,  "Expense")
    credit_acc = _get_account(db, payload.credit_account_id, "Cash/Bank")

    if debit_acc.account_type != "Expense":
        raise HTTPException(status_code=400, detail="Debit account must be an Expense account")

    try:
        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(
                    account_id=debit_acc.id,
                    debit=payload.amount,
                    description=payload.description,
                ),
                JournalEntryData(
                    account_id=credit_acc.id,
                    credit=payload.amount,
                    description=payload.description,
                ),
            ],
            reference_type=f"expense_{payload.sub_type}",
            description=payload.description,
            date=payload.date or datetime.utcnow(),
            user=user,
        )
        db.flush()

        op = FinanceOperation(
            type="EXPENSE",
            sub_type=payload.sub_type,
            journal_id=journal.id,
            from_account_id=debit_acc.id,
            to_account_id=credit_acc.id,
            amount=payload.amount,
            reason=payload.description,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            meta=json.dumps({"expense_account_code": debit_acc.code, "paid_from_code": credit_acc.code}),
            created_by_user_id=user.id,
        )
        db.add(op)
        db.commit()
        db.refresh(op)

        log_action(
            db=db, module="finance", action="CREATE",
            record_id=str(op.id), record_label=f"Expense Op: {payload.sub_type}",
            changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
            new_data={"type": op.type, "sub_type": op.sub_type, "amount": str(op.amount)},
        )
        await ws_manager.broadcast("finance_updated", {"type": "expense_op_created", "operation_id": op.id})
        return _op_to_response(op)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── Refund ────────────────────────────────────────────────────────────────────

@router.post("/refund", response_model=FinanceOperationResponse)
async def create_refund(
    payload: RefundCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """
    Create a refund against an original journal.
    Reverses entries proportionally. Creates a NEW journal.
    NEVER modifies the original journal.
    """
    original = db.query(Journal).filter(Journal.id == payload.original_journal_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Original journal not found")

    original_amount = sum(Decimal(str(e.debit)) for e in original.entries if e.debit > 0)
    if original_amount == 0:
        raise HTTPException(status_code=400, detail="Original journal has no debit entries to refund")

    if payload.refund_amount > original_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Refund amount ({payload.refund_amount}) exceeds original ({original_amount})",
        )

    existing_refunds = (
        db.query(FinanceOperation)
        .filter(
            FinanceOperation.reference_journal_id == payload.original_journal_id,
            FinanceOperation.type == "REFUND",
        )
        .all()
    )
    total_refunded = sum(op.amount for op in existing_refunds)
    if total_refunded + payload.refund_amount > original_amount:
        remaining = original_amount - total_refunded
        raise HTTPException(
            status_code=400,
            detail=f"Cannot refund {payload.refund_amount}. Only {remaining} remaining.",
        )

    try:
        scale = payload.refund_amount / original_amount
        refund_entries = []
        for entry in original.entries:
            debit_amt  = Decimal(str(entry.debit))  * scale
            credit_amt = Decimal(str(entry.credit)) * scale
            refund_entries.append(
                JournalEntryData(
                    account_id=entry.account_id,
                    debit=credit_amt,
                    credit=debit_amt,
                    description=f"REFUND of journal #{original.id}: {entry.description or ''}",
                )
            )

        journal = JournalService.create_journal_entry(
            db=db,
            entries=refund_entries,
            reference_type=f"refund_{payload.sub_type}",
            reference_id=str(original.id),
            description=f"Refund ({payload.sub_type}) — {payload.reason}",
            date=datetime.utcnow(),
            user=user,
        )
        db.flush()

        op = FinanceOperation(
            type="REFUND",
            sub_type=payload.sub_type,
            journal_id=journal.id,
            reference_journal_id=original.id,
            amount=payload.refund_amount,
            reason=payload.reason,
            meta=json.dumps({"original_amount": float(original_amount), "scale": float(scale)}),
            created_by_user_id=user.id,
        )
        db.add(op)
        db.commit()
        db.refresh(op)

        log_action(
            db=db, module="finance", action="CREATE",
            record_id=str(op.id), record_label=f"Refund: {payload.sub_type}",
            changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
            new_data={"type": "REFUND", "amount": str(payload.refund_amount)},
        )
        await ws_manager.broadcast("finance_updated", {"type": "refund_created", "operation_id": op.id})
        return _op_to_response(op)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── Transfer ──────────────────────────────────────────────────────────────────

@router.post("/transfer", response_model=FinanceOperationResponse)
async def create_transfer(
    payload: TransferCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """
    Transfer funds between two accounts.
    Creates ONE operation record + 2 ledger movements (DR to / CR from).
    """
    if payload.from_account_id == payload.to_account_id:
        raise HTTPException(status_code=400, detail="From and To accounts must be different")

    from_acc = _get_account(db, payload.from_account_id, "Source")
    to_acc   = _get_account(db, payload.to_account_id,   "Destination")

    from_balance = JournalService.get_account_balance(db, from_acc.id)
    if from_balance < payload.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance in {from_acc.name}. Available: {from_balance}, Required: {payload.amount}",
        )

    try:
        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(
                    account_id=from_acc.id,
                    credit=payload.amount,
                    description=f"Transfer to {to_acc.name}: {payload.note or ''}",
                ),
                JournalEntryData(
                    account_id=to_acc.id,
                    debit=payload.amount,
                    description=f"Transfer from {from_acc.name}: {payload.note or ''}",
                ),
            ],
            reference_type="transfer",
            description=f"Transfer: {from_acc.name} → {to_acc.name}" + (f" — {payload.note}" if payload.note else ""),
            date=datetime.utcnow(),
            user=user,
        )
        db.flush()

        op = FinanceOperation(
            type="TRANSFER",
            journal_id=journal.id,
            from_account_id=from_acc.id,
            to_account_id=to_acc.id,
            amount=payload.amount,
            reason=payload.note,
            meta=json.dumps({"from_account_code": from_acc.code, "to_account_code": to_acc.code}),
            created_by_user_id=user.id,
        )
        db.add(op)
        db.commit()
        db.refresh(op)

        log_action(
            db=db, module="finance", action="CREATE",
            record_id=str(op.id), record_label=f"Transfer: {op.id}",
            changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
            new_data={"type": "TRANSFER", "amount": str(payload.amount)},
        )
        await ws_manager.broadcast("finance_updated", {"type": "transfer_created", "operation_id": op.id})
        return _op_to_response(op)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── Adjustment ────────────────────────────────────────────────────────────────

@router.post("/adjustment", response_model=FinanceOperationResponse)
async def create_adjustment(
    payload: AdjustmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """
    Record a correction/adjustment entry.
    DR debit_account / CR credit_account with full audit trail.
    Creates a NEW journal + FinanceOperation record.
    """
    if payload.debit_account_id == payload.credit_account_id:
        raise HTTPException(status_code=400, detail="Debit and credit accounts must be different")

    debit_acc  = _get_account(db, payload.debit_account_id,  "Debit")
    credit_acc = _get_account(db, payload.credit_account_id, "Credit")

    try:
        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(
                    account_id=debit_acc.id,
                    debit=payload.amount,
                    description=f"ADJUSTMENT ({payload.sub_type}): {payload.reason}",
                ),
                JournalEntryData(
                    account_id=credit_acc.id,
                    credit=payload.amount,
                    description=f"ADJUSTMENT ({payload.sub_type}): {payload.reason}",
                ),
            ],
            reference_type=f"adjustment_{payload.sub_type}",
            description=f"Adjustment ({payload.sub_type}): {payload.reason}",
            date=payload.date or datetime.utcnow(),
            user=user,
        )
        db.flush()

        op = FinanceOperation(
            type="ADJUSTMENT",
            sub_type=payload.sub_type,
            journal_id=journal.id,
            from_account_id=debit_acc.id,
            to_account_id=credit_acc.id,
            amount=payload.amount,
            reason=payload.reason,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            meta=json.dumps({"debit_account_code": debit_acc.code, "credit_account_code": credit_acc.code}),
            created_by_user_id=user.id,
        )
        db.add(op)
        db.commit()
        db.refresh(op)

        log_action(
            db=db, module="finance", action="CREATE",
            record_id=str(op.id), record_label=f"Adjustment: {payload.sub_type}",
            changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
            new_data={"type": "ADJUSTMENT", "sub_type": payload.sub_type, "amount": str(payload.amount)},
        )
        await ws_manager.broadcast("finance_updated", {"type": "adjustment_created", "operation_id": op.id})
        return _op_to_response(op)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── Merge ─────────────────────────────────────────────────────────────────────

@router.post("/merge", response_model=FinanceOperationResponse)
async def create_merge(
    payload: MergeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions("finance:manage")),
):
    """
    Merge source account into target account.
    Moves balance via adjustment journal. Soft-deletes source.
    NEVER deletes any journal entries.
    """
    if payload.source_account_id == payload.target_account_id:
        raise HTTPException(status_code=400, detail="Source and target accounts must be different")

    source = _get_account(db, payload.source_account_id, "Source")
    target = _get_account(db, payload.target_account_id, "Target")

    source_balance = JournalService.get_account_balance(db, source.id)

    try:
        amount = abs(source_balance)
        journal = None

        if source_balance != 0:
            if source_balance > 0:
                entries = [
                    JournalEntryData(account_id=source.id, credit=source_balance,
                                     description=f"MERGE: closing {source.name} into {target.name}"),
                    JournalEntryData(account_id=target.id, debit=source_balance,
                                     description=f"MERGE: receiving balance from {source.name}"),
                ]
            else:
                credit_balance = abs(source_balance)
                entries = [
                    JournalEntryData(account_id=source.id, debit=credit_balance,
                                     description=f"MERGE: closing {source.name} into {target.name}"),
                    JournalEntryData(account_id=target.id, credit=credit_balance,
                                     description=f"MERGE: receiving balance from {source.name}"),
                ]

            journal = JournalService.create_journal_entry(
                db=db,
                entries=entries,
                reference_type="merge",
                description=f"Merge {source.name} → {target.name}" + (f" — {payload.note}" if payload.note else ""),
                date=datetime.utcnow(),
                user=user,
            )
            db.flush()

        # Soft-delete source
        source.is_active = False

        if journal is None:
            marker = Journal(
                date=datetime.utcnow(),
                reference_type="merge",
                description=f"Merge {source.name} → {target.name} (zero balance)",
                created_by_user_id=user.id,
            )
            db.add(marker)
            db.flush()
            journal = marker

        op = FinanceOperation(
            type="MERGE",
            journal_id=journal.id,
            from_account_id=source.id,
            to_account_id=target.id,
            amount=amount,
            reason=payload.note,
            meta=json.dumps({
                "source_account_code": source.code,
                "target_account_code": target.code,
                "source_balance_moved": float(source_balance),
            }),
            created_by_user_id=user.id,
        )
        db.add(op)
        db.commit()
        db.refresh(op)

        log_action(
            db=db, module="finance", action="CREATE",
            record_id=str(op.id), record_label=f"Merge: {op.id}",
            changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
            new_data={"type": "MERGE", "amount": str(op.amount)},
        )
        await ws_manager.broadcast("finance_updated", {"type": "merge_created", "operation_id": op.id})
        return _op_to_response(op)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── History / Get ─────────────────────────────────────────────────────────────

@router.get("/operations/history", response_model=list[FinanceOperationResponse])
async def get_operations_history(
    skip: int = 0,
    limit: int = 200,
    type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    q = db.query(FinanceOperation)
    if type:
        q = q.filter(FinanceOperation.type == type.upper())
    ops = q.order_by(FinanceOperation.created_at.desc()).offset(skip).limit(limit).all()
    return [_op_to_response(op) for op in ops]


@router.get("/operations", response_model=list[FinanceOperationResponse])
async def list_operations(
    skip: int = 0,
    limit: int = 100,
    type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    q = db.query(FinanceOperation)
    if type:
        q = q.filter(FinanceOperation.type == type.upper())
    ops = q.order_by(FinanceOperation.created_at.desc()).offset(skip).limit(limit).all()
    return [_op_to_response(op) for op in ops]


@router.get("/operations/{operation_id}", response_model=FinanceOperationResponse)
async def get_operation(
    operation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("finance:manage", "finance:view")),
):
    op = db.query(FinanceOperation).filter(FinanceOperation.id == operation_id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    return _op_to_response(op)
