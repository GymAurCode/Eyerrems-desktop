from datetime import datetime
from decimal import Decimal
from typing import List

from sqlalchemy.orm import Session

from app.models.finance import Account, Journal, JournalEntry
from app.models.auth import User


class JournalEntryData:
    def __init__(
        self,
        account_id: int,
        debit: Decimal = Decimal("0"),
        credit: Decimal = Decimal("0"),
        description: str | None = None,
    ):
        self.account_id = account_id
        self.debit = Decimal(str(debit)) if debit else Decimal("0")
        self.credit = Decimal(str(credit)) if credit else Decimal("0")
        self.description = description

    def validate(self) -> None:
        if self.debit < 0 or self.credit < 0:
            raise ValueError("Amounts must be non-negative")
        if self.debit > 0 and self.credit > 0:
            raise ValueError("Entry cannot be both debit and credit")
        if self.debit == 0 and self.credit == 0:
            raise ValueError("Entry must have either debit or credit amount")


class JournalService:
    @staticmethod
    def create_journal_entry(
        db: Session,
        entries: List[JournalEntryData],
        reference_type: str,
        reference_id: str | None = None,
        description: str | None = None,
        date: datetime | None = None,
        user: User | None = None,
        source: str | None = "MANUAL",
        is_editable: bool = True,
    ) -> Journal:
        if not entries:
            raise ValueError("Journal must have at least one entry")

        for entry in entries:
            entry.validate()
            account = db.query(Account).filter(
                Account.id == entry.account_id,
                Account.is_active.is_(True)
            ).first()
            if not account:
                raise ValueError(f"Account {entry.account_id} not found or inactive")

        total_debit = sum(Decimal(str(e.debit)) for e in entries)
        total_credit = sum(Decimal(str(e.credit)) for e in entries)

        if total_debit != total_credit:
            raise ValueError(f"Debits ({total_debit}) must equal credits ({total_credit})")

        journal = Journal(
            date=date or datetime.utcnow(),
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            source=source,
            is_editable=is_editable,
            created_by_user_id=user.id if user else None,
        )
        db.add(journal)
        db.flush()

        for entry_data in entries:
            entry = JournalEntry(
                journal_id=journal.id,
                account_id=entry_data.account_id,
                debit=entry_data.debit,
                credit=entry_data.credit,
                description=entry_data.description,
            )
            db.add(entry)

        db.flush()
        return journal

    @staticmethod
    def get_account_balance(
        db: Session,
        account_id: int,
        as_of_date: datetime | None = None,
    ) -> Decimal:
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            return Decimal("0")

        opening = account.opening_balance or Decimal("0")

        query = db.query(JournalEntry).filter(JournalEntry.account_id == account_id)
        if as_of_date:
            query = query.join(Journal).filter(Journal.date <= as_of_date)

        entries = query.all()
        total_debit = sum(Decimal(str(e.debit)) for e in entries)
        total_credit = sum(Decimal(str(e.credit)) for e in entries)

        if account.account_type in ["Asset", "Expense"]:
            return opening + total_debit - total_credit
        else:
            return opening + total_credit - total_debit

    @staticmethod
    def get_account_ledger(
        db: Session,
        account_id: int,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> List[dict]:
        account = db.query(Account).filter(Account.id == account_id).first()
        opening_balance = account.opening_balance if account else Decimal("0")

        query = db.query(JournalEntry, Journal).join(Journal).filter(
            JournalEntry.account_id == account_id
        )
        if start_date:
            query = query.filter(Journal.date >= start_date)
        if end_date:
            query = query.filter(Journal.date <= end_date)

        query = query.order_by(Journal.date, JournalEntry.id)
        results = query.all()

        ledger = []
        running_balance = opening_balance if account and account.account_type in ["Asset", "Expense"] else opening_balance

        if not start_date and opening_balance > 0:
            ledger.append({
                "id": 0,
                "journal_id": 0,
                "date": account.opening_balance_date or datetime.utcnow(),
                "reference_type": "opening",
                "reference_id": None,
                "description": "Opening Balance",
                "debit": Decimal("0"),
                "credit": Decimal("0"),
                "balance": opening_balance,
            })

        for entry, journal in results:
            if account and account.account_type in ["Asset", "Expense"]:
                running_balance += entry.debit - entry.credit
            else:
                running_balance += entry.credit - entry.debit

            ledger.append({
                "id": entry.id,
                "journal_id": journal.id,
                "date": journal.date,
                "reference_type": journal.reference_type,
                "reference_id": journal.reference_id,
                "description": entry.description or journal.description,
                "debit": entry.debit,
                "credit": entry.credit,
                "balance": running_balance,
            })

        return ledger

    @staticmethod
    def get_trial_balance(db: Session, as_of_date: datetime | None = None) -> List[dict]:
        accounts = db.query(Account).filter(Account.is_active.is_(True)).order_by(Account.code).all()

        trial_balance = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")

        for account in accounts:
            balance = JournalService.get_account_balance(db, account.id, as_of_date)

            if account.account_type in ["Asset", "Expense"]:
                debit_amt = balance if balance >= 0 else Decimal("0")
                credit_amt = abs(balance) if balance < 0 else Decimal("0")
            else:
                credit_amt = balance if balance >= 0 else Decimal("0")
                debit_amt = abs(balance) if balance < 0 else Decimal("0")

            total_debit += debit_amt
            total_credit += credit_amt

            trial_balance.append({
                "account_id": account.id,
                "code": account.code,
                "name": account.name,
                "type": account.account_type,
                "debit": debit_amt,
                "credit": credit_amt,
            })

        return trial_balance
