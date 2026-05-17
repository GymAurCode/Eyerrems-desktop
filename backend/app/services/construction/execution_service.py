"""Execution service — daily progress & construction expenses (with finance link)"""
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.construction import ConstructionExpense, DailyProgress
from app.models.finance import Account, Expense, Journal, JournalEntry
from app.schemas.construction import (
    ConstructionExpenseCreate, DailyProgressCreate, DailyProgressUpdate,
)


class ExecutionService:

    # ── Daily Progress ────────────────────────────────────────────────────────

    @staticmethod
    def log_progress(db: Session, payload: DailyProgressCreate, user_id: int) -> DailyProgress:
        obj = DailyProgress(**payload.model_dump(), reported_by=user_id)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get_progress(db: Session, project_id: int) -> list[DailyProgress]:
        return (
            db.query(DailyProgress)
            .filter(DailyProgress.project_id == project_id)
            .order_by(DailyProgress.date.desc())
            .all()
        )

    @staticmethod
    def update_progress(db: Session, progress_id: int, payload: DailyProgressUpdate) -> DailyProgress:
        obj = db.query(DailyProgress).filter(DailyProgress.id == progress_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Progress record not found")
        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def delete_progress(db: Session, progress_id: int) -> None:
        obj = db.query(DailyProgress).filter(DailyProgress.id == progress_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Progress record not found")
        db.delete(obj)
        db.commit()

    # ── Expenses (with optional finance journal entry) ────────────────────────

    @staticmethod
    def add_expense(
        db: Session, payload: ConstructionExpenseCreate, user_id: int
    ) -> ConstructionExpense:
        finance_expense_id = None

        # If account_id + paid_from provided → create a real finance Expense + Journal
        if payload.account_id and payload.paid_from:
            account = db.query(Account).filter(Account.id == payload.account_id).first()
            if not account:
                raise HTTPException(status_code=400, detail="Finance account not found")

            # Determine cash/bank account code
            cash_code = "1001" if payload.paid_from == "cash" else "1002"
            cash_acc = db.query(Account).filter(Account.code == cash_code).first()
            if not cash_acc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cash/bank account '{cash_code}' not found in Chart of Accounts",
                )

            fin_expense = Expense(
                account_id  = payload.account_id,
                paid_from   = payload.paid_from,
                amount      = payload.amount,
                date        = datetime.combine(payload.date, datetime.min.time()),
                description = payload.description,
                reference   = f"CONST-{payload.project_id}",
            )
            db.add(fin_expense)
            db.flush()

            journal = Journal(
                date           = datetime.combine(payload.date, datetime.min.time()),
                reference_type = "construction_expense",
                reference_id   = str(fin_expense.id),
                description    = payload.description,
                created_by_user_id = user_id,
            )
            db.add(journal)
            db.flush()

            db.add(JournalEntry(
                journal_id  = journal.id,
                account_id  = payload.account_id,
                debit       = payload.amount,
                credit      = Decimal("0"),
                description = payload.description,
            ))
            db.add(JournalEntry(
                journal_id  = journal.id,
                account_id  = cash_acc.id,
                debit       = Decimal("0"),
                credit      = payload.amount,
                description = payload.description,
            ))
            finance_expense_id = fin_expense.id

        expense = ConstructionExpense(
            project_id   = payload.project_id,
            expense_id   = finance_expense_id,
            amount       = payload.amount,
            expense_type = payload.expense_type,
            description  = payload.description,
            reference_id = payload.reference_id,
            date         = payload.date,
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)
        return expense

    @staticmethod
    def get_expenses(db: Session, project_id: int) -> list[ConstructionExpense]:
        return (
            db.query(ConstructionExpense)
            .filter(ConstructionExpense.project_id == project_id)
            .order_by(ConstructionExpense.date.desc())
            .all()
        )
