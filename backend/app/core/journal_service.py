"""
Journal Service - Core double-entry accounting engine

This service handles all journal entry creation, validation, and ensures
that the fundamental accounting equation is maintained: Debit = Credit
"""

from datetime import datetime
from decimal import Decimal
from typing import List

from sqlalchemy.orm import Session

from app.models.finance import Account, Journal, JournalEntry
from app.models.auth import User


class JournalEntryData:
    """DTO for journal entry data"""
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
        """Validate individual entry"""
        if self.debit < 0 or self.credit < 0:
            raise ValueError("Amounts must be non-negative")
        if self.debit > 0 and self.credit > 0:
            raise ValueError("Entry cannot be both debit and credit")
        if self.debit == 0 and self.credit == 0:
            raise ValueError("Entry must have either debit or credit amount")


class JournalService:
    """
    Service for creating journal entries following double-entry accounting principles.
    
    Core principle: Every journal must have entries where total debits = total credits.
    """

    @staticmethod
    def create_journal_entry(
        db: Session,
        entries: List[JournalEntryData],
        reference_type: str,
        reference_id: str | None = None,
        description: str | None = None,
        date: datetime | None = None,
        user: User | None = None,
    ) -> Journal:
        """
        Create a complete journal with multiple entries.
        
        Args:
            db: Database session
            entries: List of JournalEntryData with account_id, debit, credit
            reference_type: Type of transaction (invoice, payment, commission, manual)
            reference_id: Optional reference identifier
            description: Optional description
            date: Transaction date (defaults to now)
            user: User creating the entry
            
        Returns:
            Created Journal object
            
        Raises:
            ValueError: If validation fails
            
        Example:
            entries = [
                JournalEntryData(account_id=1, debit=Decimal("1000")),  # AR
                JournalEntryData(account_id=2, credit=Decimal("1000")), # Income
            ]
            journal = JournalService.create_journal_entry(
                db=db,
                entries=entries,
                reference_type="invoice",
                reference_id="INV-001"
            )
        """
        if not entries:
            raise ValueError("Journal must have at least one entry")

        # Validate individual entries
        for entry in entries:
            entry.validate()
            
            # Verify account exists and is active
            account = db.query(Account).filter(
                Account.id == entry.account_id,
                Account.is_active.is_(True)
            ).first()
            if not account:
                raise ValueError(f"Account {entry.account_id} not found or inactive")

        # Validate double-entry principle
        total_debit = sum(Decimal(str(e.debit)) for e in entries)
        total_credit = sum(Decimal(str(e.credit)) for e in entries)

        if total_debit != total_credit:
            raise ValueError(
                f"Debits ({total_debit}) must equal credits ({total_credit})"
            )

        # Create journal header
        journal = Journal(
            date=date or datetime.utcnow(),
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            created_by_user_id=user.id if user else None,
        )
        db.add(journal)
        db.flush()  # Get journal.id

        # Create journal entries
        for entry_data in entries:
            entry = JournalEntry(
                journal_id=journal.id,
                account_id=entry_data.account_id,
                debit=entry_data.debit,
                credit=entry_data.credit,
                description=entry_data.description,
            )
            db.add(entry)

        db.flush()  # Flush to get IDs, but don't commit yet
        return journal

    @staticmethod
    def get_account_balance(
        db: Session,
        account_id: int,
        as_of_date: datetime | None = None,
    ) -> Decimal:
        """
        Calculate account balance using debits and credits.
        
        Formula: Balance = SUM(debit) - SUM(credit)
        
        Args:
            db: Database session
            account_id: Account ID
            as_of_date: Optional date cutoff
            
        Returns:
            Account balance as Decimal
        """
        query = db.query(JournalEntry).filter(JournalEntry.account_id == account_id)

        if as_of_date:
            query = query.join(Journal).filter(Journal.date <= as_of_date)

        entries = query.all()
        total_debit = sum(Decimal(str(e.debit)) for e in entries)
        total_credit = sum(Decimal(str(e.credit)) for e in entries)

        return total_debit - total_credit

    @staticmethod
    def get_account_ledger(
        db: Session,
        account_id: int,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> List[dict]:
        """
        Get ledger entries for an account with running balance.
        
        Args:
            db: Database session
            account_id: Account ID
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            List of ledger entries with running balances
        """
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
        running_balance = Decimal("0")

        for entry, journal in results:
            running_balance += entry.debit - entry.credit
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
        """
        Generate trial balance showing all accounts and their balances.
        
        Returns:
            List of accounts with total debits, credits, and balance
        """
        accounts = db.query(Account).filter(Account.is_active.is_(True)).all()

        trial_balance = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")

        for account in accounts:
            balance = JournalService.get_account_balance(
                db, account.id, as_of_date
            )

            # Determine if balance is debit or credit based on account type
            if account.account_type in ["Asset", "Expense"]:
                debit_amt = balance if balance >= 0 else Decimal("0")
                credit_amt = abs(balance) if balance < 0 else Decimal("0")
            else:  # Liability, Income, Equity
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

    @staticmethod
    def get_account_tree(db: Session) -> List[dict]:
        """
        Get hierarchical chart of accounts.
        
        Returns:
            Nested structure of accounts with children
        """
        def build_tree(parent_id: int | None) -> List[dict]:
            accounts = db.query(Account).filter(
                Account.parent_id == parent_id,
                Account.is_active.is_(True)
            ).order_by(Account.code).all()

            result = []
            for account in accounts:
                result.append({
                    "id": account.id,
                    "code": account.code,
                    "name": account.name,
                    "type": account.account_type,
                    "children": build_tree(account.id),
                })
            return result

        return build_tree(None)
