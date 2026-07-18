from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.finance import Account, Journal, JournalEntry
from app.models.auth import User


def _next_journal_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"JE-{year}-"
    last = db.query(Journal).filter(
        Journal.journal_number.like(f"{prefix}%")
    ).order_by(Journal.journal_number.desc()).first()
    if last and last.journal_number:
        seq = int(last.journal_number.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:06d}"


class JournalEntryData:
    def __init__(
        self,
        account_id: int,
        debit: Decimal = Decimal("0"),
        credit: Decimal = Decimal("0"),
        narration: str | None = None,
        description: str | None = None,
        cost_center: str | None = None,
        department: str | None = None,
        project_id: int | None = None,
        property_id: int | None = None,
        building: str | None = None,
        floor: str | None = None,
        unit_id: int | None = None,
        customer_id: int | None = None,
        vendor_id: int | None = None,
        employee_id: int | None = None,
        tax_code: str | None = None,
        tax_amount: Decimal | None = None,
        reference: str | None = None,
        memo: str | None = None,
        sort_order: int = 0,
    ):
        self.account_id = account_id
        self.debit = Decimal(str(debit)) if debit else Decimal("0")
        self.credit = Decimal(str(credit)) if credit else Decimal("0")
        self.narration = narration
        self.description = description
        self.cost_center = cost_center
        self.department = department
        self.project_id = project_id
        self.property_id = property_id
        self.building = building
        self.floor = floor
        self.unit_id = unit_id
        self.customer_id = customer_id
        self.vendor_id = vendor_id
        self.employee_id = employee_id
        self.tax_code = tax_code
        self.tax_amount = Decimal(str(tax_amount)) if tax_amount else None
        self.reference = reference
        self.memo = memo
        self.sort_order = sort_order

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
        source_module: str | None = None,
        source_document_id: int | None = None,
        source_document_number: str | None = None,
        source_document_status: str | None = None,
        source_document_date: datetime | None = None,
        status: str | None = None,
        is_editable: bool | None = None,
        approved_budget: Decimal | None = None,
        budget_used: Decimal | None = None,
        budget_remaining: Decimal | None = None,
        budget_exceeded: bool = False,
        budget_approval_required: bool = False,
        internal_notes: str | None = None,
        remarks: str | None = None,
        company_id: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
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

        if status is None:
            status = "posted" if is_editable is not True else "draft"
        journal = Journal(
            journal_number=_next_journal_number(db),
            date=date or datetime.utcnow(),
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            source=source,
            source_module=source_module,
            source_document_id=source_document_id,
            source_document_number=source_document_number,
            source_document_status=source_document_status,
            source_document_date=source_document_date,
            status=status,
            is_editable=is_editable if is_editable is not None else (status == "draft"),
            approved_budget=approved_budget,
            budget_used=budget_used,
            budget_remaining=budget_remaining,
            budget_exceeded=budget_exceeded,
            budget_approval_required=budget_approval_required,
            internal_notes=internal_notes,
            remarks=remarks,
            created_by_user_id=user.id if user else None,
            company_id=company_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(journal)
        db.flush()

        for i, entry_data in enumerate(entries):
            entry = JournalEntry(
                journal_id=journal.id,
                account_id=entry_data.account_id,
                debit=entry_data.debit,
                credit=entry_data.credit,
                narration=entry_data.narration,
                description=entry_data.description,
                cost_center=entry_data.cost_center,
                department=entry_data.department,
                project_id=entry_data.project_id,
                property_id=entry_data.property_id,
                building=entry_data.building,
                floor=entry_data.floor,
                unit_id=entry_data.unit_id,
                customer_id=entry_data.customer_id,
                vendor_id=entry_data.vendor_id,
                employee_id=entry_data.employee_id,
                tax_code=entry_data.tax_code,
                tax_amount=entry_data.tax_amount,
                reference=entry_data.reference,
                memo=entry_data.memo,
                sort_order=entry_data.sort_order or i,
            )
            db.add(entry)

        db.flush()
        return journal

    @staticmethod
    def update_journal_lines(
        db: Session,
        journal: Journal,
        entries: List[JournalEntryData],
    ) -> Journal:
        if journal.status not in ("draft",):
            raise ValueError("Only draft journals can be edited")
        total_debit = sum(Decimal(str(e.debit)) for e in entries)
        total_credit = sum(Decimal(str(e.credit)) for e in entries)
        if total_debit != total_credit:
            raise ValueError(f"Debits ({total_debit}) must equal credits ({total_credit})")

        db.query(JournalEntry).filter(JournalEntry.journal_id == journal.id).delete()
        db.flush()

        for i, entry_data in enumerate(entries):
            entry = JournalEntry(
                journal_id=journal.id,
                account_id=entry_data.account_id,
                debit=entry_data.debit,
                credit=entry_data.credit,
                narration=entry_data.narration,
                description=entry_data.description,
                cost_center=entry_data.cost_center,
                department=entry_data.department,
                project_id=entry_data.project_id,
                property_id=entry_data.property_id,
                building=entry_data.building,
                floor=entry_data.floor,
                unit_id=entry_data.unit_id,
                customer_id=entry_data.customer_id,
                vendor_id=entry_data.vendor_id,
                employee_id=entry_data.employee_id,
                tax_code=entry_data.tax_code,
                tax_amount=entry_data.tax_amount,
                reference=entry_data.reference,
                memo=entry_data.memo,
                sort_order=entry_data.sort_order or i,
            )
            db.add(entry)
        db.flush()
        return journal

    @staticmethod
    def submit_journal(db: Session, journal: Journal, user: User, notes: str | None = None) -> Journal:
        if journal.status != "draft":
            raise ValueError("Only draft journals can be submitted")
        journal.status = "submitted"
        journal.submitted_by = user.id
        journal.submitted_at = datetime.utcnow()
        journal.is_editable = False
        if notes:
            journal.internal_notes = (journal.internal_notes or "") + f"\n[Submitted] {notes}"
        db.flush()
        return journal

    @staticmethod
    def approve_journal(db: Session, journal: Journal, user: User, level: int | None = None, notes: str | None = None) -> Journal:
        if journal.status != "submitted":
            raise ValueError("Only submitted journals can be approved")
        journal.status = "approved"
        journal.approved_by = user.id
        journal.approved_at = datetime.utcnow()
        journal.approval_level = level
        if notes:
            journal.internal_notes = (journal.internal_notes or "") + f"\n[Approved] {notes}"
        db.flush()
        return journal

    @staticmethod
    def reject_journal(db: Session, journal: Journal, user: User, reason: str) -> Journal:
        if journal.status not in ("submitted", "approved"):
            raise ValueError("Only submitted or approved journals can be rejected")
        journal.status = "draft"
        journal.rejected_by = user.id
        journal.rejected_at = datetime.utcnow()
        journal.rejection_reason = reason
        journal.is_editable = True
        journal.internal_notes = (journal.internal_notes or "") + f"\n[Rejected] {reason}"
        db.flush()
        return journal

    @staticmethod
    def post_journal(db: Session, journal: Journal, user: User, notes: str | None = None) -> Journal:
        if journal.status not in ("draft", "approved"):
            raise ValueError("Journal must be draft or approved to be posted")
        if journal.status == "draft":
            journal.submitted_by = user.id
            journal.submitted_at = datetime.utcnow()
        journal.status = "posted"
        journal.posted_by = user.id
        journal.posted_at = datetime.utcnow()
        journal.is_editable = False
        if notes:
            journal.internal_notes = (journal.internal_notes or "") + f"\n[Posted] {notes}"
        db.flush()
        return journal

    @staticmethod
    def reverse_journal(
        db: Session,
        original: Journal,
        user: User,
        reason: str,
        date: datetime | None = None,
        notes: str | None = None,
    ) -> Journal:
        if original.status != "posted":
            raise ValueError("Only posted journals can be reversed")
        if original.is_reversal:
            raise ValueError("Cannot reverse a reversal journal")

        reversal_entries = []
        for e in db.query(JournalEntry).filter(JournalEntry.journal_id == original.id).order_by(JournalEntry.sort_order).all():
            reversal_entries.append(JournalEntryData(
                account_id=e.account_id,
                debit=e.credit,
                credit=e.debit,
                narration=f"Reversal of: {e.narration or e.description or ''}",
                description=e.description,
                cost_center=e.cost_center,
                department=e.department,
                project_id=e.project_id,
                property_id=e.property_id,
                building=e.building,
                floor=e.floor,
                unit_id=e.unit_id,
                customer_id=e.customer_id,
                vendor_id=e.vendor_id,
                employee_id=e.employee_id,
                tax_code=e.tax_code,
                tax_amount=e.tax_amount,
                reference=e.reference,
                memo=e.memo,
                sort_order=e.sort_order,
            ))

        reversal = JournalService.create_journal_entry(
            db=db,
            entries=reversal_entries,
            reference_type="reversal",
            reference_id=str(original.id),
            description=f"Reversal of JE-{original.id}: {reason}",
            date=date or datetime.utcnow(),
            user=user,
            source=original.source or "MANUAL",
            status="posted",
            internal_notes=notes,
            company_id=original.company_id,
            ip_address=getattr(user, 'ip_address', None),
        )

        reversal.is_reversal = True
        reversal.reversal_of = original.id
        reversal.reversal_reason = reason
        reversal.reversed_by = user.id
        reversal.reversed_at = datetime.utcnow()

        original.status = "reversed"
        original.reversed_by = user.id
        original.reversed_at = datetime.utcnow()
        original.is_editable = False
        original.internal_notes = (original.internal_notes or "") + f"\n[Reversed] {reason}"

        db.flush()
        return reversal

    @staticmethod
    def get_account_balance(
        db: Session,
        account_id: int,
        as_of_date: datetime | None = None,
    ) -> Decimal:
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            return Decimal("0")
        return JournalService._compute_balance(db, account, as_of_date)

    @staticmethod
    def get_account_balances(
        db: Session,
        account_ids: List[int],
        as_of_date: datetime | None = None,
    ) -> Dict[int, Decimal]:
        if not account_ids:
            return {}
        accounts = {a.id: a for a in db.query(Account).filter(Account.id.in_(account_ids)).all()}
        query = db.query(
            JournalEntry.account_id,
            func.coalesce(func.sum(JournalEntry.debit), 0),
            func.coalesce(func.sum(JournalEntry.credit), 0),
        ).filter(JournalEntry.account_id.in_(account_ids))
        if as_of_date:
            query = query.join(Journal).filter(Journal.date <= as_of_date)
        rows = query.group_by(JournalEntry.account_id).all()
        totals: Dict[int, Decimal] = {}
        for aid in account_ids:
            account = accounts.get(aid)
            if not account:
                totals[aid] = Decimal("0")
                continue
            totals[aid] = JournalService._compute_balance(db, account, as_of_date, prefetched=rows)
        return totals

    @staticmethod
    def _compute_balance(
        db: Session,
        account: Account,
        as_of_date: datetime | None = None,
        prefetched: list | None = None,
    ) -> Decimal:
        opening = account.opening_balance or Decimal("0")
        if prefetched is not None:
            match = [r for r in prefetched if r[0] == account.id]
            total_debit = Decimal(str(match[0][1])) if match else Decimal("0")
            total_credit = Decimal(str(match[0][2])) if match else Decimal("0")
        else:
            query = db.query(
                func.coalesce(func.sum(JournalEntry.debit), 0),
                func.coalesce(func.sum(JournalEntry.credit), 0),
            ).filter(JournalEntry.account_id == account.id)
            if as_of_date:
                query = query.join(Journal).filter(Journal.date <= as_of_date)
            totals = query.first()
            total_debit = Decimal(str(totals[0])) if totals else Decimal("0")
            total_credit = Decimal(str(totals[1])) if totals else Decimal("0")
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
                "id": 0, "journal_id": 0,
                "date": account.opening_balance_date or datetime.utcnow(),
                "reference_type": "opening", "reference_id": None,
                "description": "Opening Balance",
                "debit": Decimal("0"), "credit": Decimal("0"), "balance": opening_balance,
            })
        for entry, journal in results:
            if account and account.account_type in ["Asset", "Expense"]:
                running_balance += entry.debit - entry.credit
            else:
                running_balance += entry.credit - entry.debit
            ledger.append({
                "id": entry.id, "journal_id": journal.id,
                "date": journal.date,
                "reference_type": journal.reference_type,
                "reference_id": journal.reference_id,
                "description": entry.narration or entry.description or journal.description,
                "debit": entry.debit, "credit": entry.credit, "balance": running_balance,
            })
        return ledger

    @staticmethod
    def get_trial_balance(db: Session, as_of_date: datetime | None = None) -> List[dict]:
        accounts = db.query(Account).filter(Account.is_active.is_(True)).order_by(Account.code).all()
        if not accounts:
            return []
        account_ids = [a.id for a in accounts]
        prefetched = db.query(
            JournalEntry.account_id,
            func.coalesce(func.sum(JournalEntry.debit), 0),
            func.coalesce(func.sum(JournalEntry.credit), 0),
        ).filter(JournalEntry.account_id.in_(account_ids))
        if as_of_date:
            prefetched = prefetched.join(Journal).filter(Journal.date <= as_of_date)
        prefetched_rows = prefetched.group_by(JournalEntry.account_id).all()
        account_map = {a.id: a for a in accounts}
        total_map: Dict[int, tuple] = {}
        for row in prefetched_rows:
            total_map[row[0]] = (Decimal(str(row[1])), Decimal(str(row[2])))
        for aid in account_ids:
            if aid not in total_map:
                total_map[aid] = (Decimal("0"), Decimal("0"))
        trial_balance = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        for account in accounts:
            td, tc = total_map[account.id]
            opening = account.opening_balance or Decimal("0")
            if account.account_type in ["Asset", "Expense"]:
                balance = opening + td - tc
            else:
                balance = opening + tc - td
            if account.account_type in ["Asset", "Expense"]:
                debit_amt = balance if balance >= 0 else Decimal("0")
                credit_amt = abs(balance) if balance < 0 else Decimal("0")
            else:
                credit_amt = balance if balance >= 0 else Decimal("0")
                debit_amt = abs(balance) if balance < 0 else Decimal("0")
            total_debit += debit_amt
            total_credit += credit_amt
            trial_balance.append({
                "account_id": account.id, "code": account.code, "name": account.name,
                "type": account.account_type, "debit": debit_amt, "credit": credit_amt,
            })
        return trial_balance
