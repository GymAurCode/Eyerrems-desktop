"""Auto-posting finance service — wires every client payment trigger to
ReceiptVoucher, Subsidiary Ledger, and General Ledger automatically.

Trigger → Voucher → SubsidiaryLedgerEntry + LedgerEntry (GL)
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.journal_service import JournalService, JournalEntryData
from app.models.auth import User
from app.models.booking import Booking
from app.models.client_pipeline import ReceiptVoucher
from app.models.crm import Client, Installment, InstallmentPlan
from app.models.finance import Account, Journal
from app.models.ledger import ClientLedgerEntry


# ── Helpers ────────────────────────────────────────────────────────────────────

def _next_voucher_no(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(ReceiptVoucher).count() + 1
    return f"RCP-{year}-{count:04d}"


def _next_ledger_tid(db: Session, prefix: str = "LED") -> str:
    count = db.query(ClientLedgerEntry).count() + 1
    return f"{prefix}-{count:04d}"


def _get_or_create_account(db: Session, code: str, name: str,
                           account_type: str) -> Account:
    """Find account by code or create it if it doesn't exist."""
    acc = db.query(Account).filter(Account.code == code).first()
    if acc:
        return acc
    acc = Account(
        code=code,
        name=name,
        account_type=account_type,
        is_system_account=True,
        is_active=True,
    )
    db.add(acc)
    db.flush()
    return acc


def _post_to_client_ledger(db: Session, client_id: int, journal_id: int,
                           amount: Decimal, entry_type: str, description: str,
                           reference_no: Optional[str] = None,
                           payment_method: str = "cash",
                           is_debit: bool = False) -> ClientLedgerEntry:
    """Create a subsidiary ledger entry for a client with running balance."""
    last_entry = db.query(ClientLedgerEntry).filter(
        ClientLedgerEntry.client_id == client_id
    ).order_by(ClientLedgerEntry.id.desc()).first()
    prev_balance = last_entry.running_balance if last_entry else Decimal("0")

    debit = amount if is_debit else Decimal("0")
    credit = Decimal("0") if is_debit else amount

    new_balance = prev_balance + debit - credit

    entry = ClientLedgerEntry(
        tid=_next_ledger_tid(db),
        client_id=client_id,
        journal_id=journal_id,
        entry_date=datetime.utcnow(),
        description=description,
        reference_no=reference_no,
        entry_type=entry_type,
        debit=debit,
        credit=credit,
        running_balance=new_balance,
        payment_method=payment_method,
        status="posted",
    )
    db.add(entry)
    db.flush()
    return entry


def _create_receipt_voucher(db: Session, client_id: int, amount: Decimal,
                             payment_mode: str, receipt_type: str,
                             description: str,
                             booking_id: Optional[int] = None,
                             installment_id: Optional[int] = None,
                             deal_id: Optional[int] = None,
                             journal_id: Optional[int] = None,
                             reference_no: Optional[str] = None,
                             user: Optional[User] = None) -> ReceiptVoucher:
    """Create a receipt voucher with auto-generated number."""
    voucher = ReceiptVoucher(
        voucher_no=_next_voucher_no(db),
        voucher_type="receipt",
        client_id=client_id,
        booking_id=booking_id,
        installment_id=installment_id,
        deal_id=deal_id,
        journal_id=journal_id,
        amount=amount,
        payment_mode=payment_mode,
        payment_date=datetime.utcnow(),
        reference_no=reference_no,
        description=description,
        receipt_type=receipt_type,
        posted_to_subsidiary=True,
        posted_to_ledger=True,
        created_by_user_id=user.id if user else None,
    )
    db.add(voucher)
    db.flush()
    return voucher


# ── Account codes (system-defined Chart of Accounts) ───────────────────────────

def _ensure_system_accounts(db: Session) -> dict:
    """Ensure standard COA accounts exist for auto-posting.
    Returns a dict of account short-name → Account instance.
    """
    accounts = {}

    # Asset accounts
    accounts["cash"] = _get_or_create_account(db, "1.1.01", "Cash in Hand", "Asset")
    accounts["bank"] = _get_or_create_account(db, "1.1.02", "Bank Account", "Asset")
    accounts["receivables"] = _get_or_create_account(db, "1.2.01", "Accounts Receivable", "Asset")
    accounts["advance"] = _get_or_create_account(db, "1.2.02", "Customer Advance", "Asset")

    # Liability accounts
    accounts["customer_advance"] = _get_or_create_account(db, "2.1.01", "Customer Advances", "Liability")

    # Income accounts
    accounts["sales_revenue"] = _get_or_create_account(db, "4.1.01", "Sales Revenue", "Income")
    accounts["fee_income"] = _get_or_create_account(db, "4.1.02", "Fee Income", "Income")
    accounts["transfer_fee_income"] = _get_or_create_account(db, "4.1.03", "Transfer Fee Income", "Income")
    accounts["service_income"] = _get_or_create_account(db, "4.1.04", "Service Income", "Income")

    return accounts


# ── Public posting functions ───────────────────────────────────────────────────

def post_token_receipt(db: Session, booking: Booking, amount: Decimal,
                       payment_mode: str = "cash",
                       reference_no: Optional[str] = None,
                       user: Optional[User] = None) -> ReceiptVoucher:
    """Booking token received → Dr Bank/Cash · Cr Customer Advance."""
    accts = _ensure_system_accounts(db)

    payment_acct = accts["bank"] if payment_mode in ("bank", "cheque") else accts["cash"]

    journal = JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=payment_acct.id, debit=amount,
                             description=f"Token from {booking.client.name}"),
            JournalEntryData(account_id=accts["customer_advance"].id, credit=amount,
                             description=f"Token for {booking.booking_id}"),
        ],
        reference_type="booking",
        reference_id=str(booking.id),
        description=f"Booking token receipt — {booking.booking_id}",
        user=user,
        source="CLIENT_PIPELINE",
        is_editable=False,
    )

    voucher = _create_receipt_voucher(
        db=db, client_id=booking.client_id, amount=amount,
        payment_mode=payment_mode, receipt_type="token_amount",
        description=f"Token amount for {booking.booking_id}",
        booking_id=booking.id, journal_id=journal.id,
        reference_no=reference_no, user=user,
    )

    _post_to_client_ledger(
        db=db, client_id=booking.client_id, journal_id=journal.id,
        amount=amount, entry_type="booking",
        description=f"Token — {booking.booking_id}",
        reference_no=voucher.voucher_no, payment_method=payment_mode,
    )

    return voucher


def post_booking_fee(db: Session, booking: Booking, fee_amount: Decimal,
                     fee_type: str = "processing_fee",
                     payment_mode: str = "cash",
                     reference_no: Optional[str] = None,
                     user: Optional[User] = None) -> ReceiptVoucher:
    """Booking fee received → Dr Bank/Cash · Cr Fee Income."""
    accts = _ensure_system_accounts(db)
    payment_acct = accts["bank"] if payment_mode in ("bank", "cheque") else accts["cash"]

    journal = JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=payment_acct.id, debit=fee_amount,
                             description=f"Fee from {booking.client.name}"),
            JournalEntryData(account_id=accts["fee_income"].id, credit=fee_amount,
                             description=f"{fee_type} — {booking.booking_id}"),
        ],
        reference_type="booking",
        reference_id=str(booking.id),
        description=f"Booking fee — {booking.booking_id}",
        user=user,
        source="CLIENT_PIPELINE",
        is_editable=False,
    )

    voucher = _create_receipt_voucher(
        db=db, client_id=booking.client_id, amount=fee_amount,
        payment_mode=payment_mode, receipt_type=fee_type,
        description=f"{fee_type} — {booking.booking_id}",
        booking_id=booking.id, journal_id=journal.id,
        reference_no=reference_no, user=user,
    )

    _post_to_client_ledger(
        db=db, client_id=booking.client_id, journal_id=journal.id,
        amount=fee_amount, entry_type="booking",
        description=f"Fee ({fee_type}) — {booking.booking_id}",
        reference_no=voucher.voucher_no, payment_method=payment_mode,
    )

    return voucher


def post_contract_signing(db: Session, booking: Booking,
                          contract_total: Decimal,
                          user: Optional[User] = None) -> Journal:
    """Contract signed → Dr Accounts Receivable · Cr Sales Revenue."""
    accts = _ensure_system_accounts(db)

    journal = JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=accts["receivables"].id, debit=contract_total,
                             description=f"Sale — {booking.booking_id}"),
            JournalEntryData(account_id=accts["sales_revenue"].id, credit=contract_total,
                             description=f"Revenue — {booking.booking_id}"),
        ],
        reference_type="contract",
        reference_id=str(booking.id),
        description=f"Contract signing — {booking.booking_id}",
        user=user,
        source="CLIENT_PIPELINE",
        is_editable=False,
    )

    _post_to_client_ledger(
        db=db, client_id=booking.client_id, journal_id=journal.id,
        amount=contract_total, entry_type="booking",
        description=f"Contract signed — {booking.booking_id}",
        is_debit=True,
    )

    return journal


def post_installment_payment(db: Session, installment: Installment,
                             amount: Decimal, payment_mode: str = "cash",
                             reference_no: Optional[str] = None,
                             user: Optional[User] = None) -> ReceiptVoucher:
    """Installment paid → Dr Bank/Cash · Cr Accounts Receivable."""
    accts = _ensure_system_accounts(db)
    payment_acct = accts["bank"] if payment_mode in ("bank", "cheque") else accts["cash"]

    plan = db.query(InstallmentPlan).filter(InstallmentPlan.id == installment.plan_id).first()
    booking = db.query(Booking).filter(Booking.id == plan.booking_id).first() if plan else None
    client_id = booking.client_id if booking else None

    journal = JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=payment_acct.id, debit=amount,
                             description=f"Installment payment"),
            JournalEntryData(account_id=accts["receivables"].id, credit=amount,
                             description=f"Installment #{installment.id}"),
        ],
        reference_type="installment",
        reference_id=str(installment.id),
        description=f"Installment payment — {installment.id}",
        user=user,
        source="CLIENT_PIPELINE",
        is_editable=False,
    )

    installment.paid_amount = (installment.paid_amount or Decimal("0")) + amount
    if installment.paid_amount >= installment.amount:
        installment.status = "paid"
    elif installment.paid_amount > 0:
        installment.status = "partial"

    voucher = _create_receipt_voucher(
        db=db, client_id=client_id, amount=amount,
        payment_mode=payment_mode, receipt_type="installment",
        description=f"Installment #{installment.id}",
        booking_id=booking.id if booking else None,
        installment_id=installment.id,
        journal_id=journal.id, reference_no=reference_no, user=user,
    )

    if client_id:
        _post_to_client_ledger(
            db=db, client_id=client_id, journal_id=journal.id,
            amount=amount, entry_type="installment",
            description=f"Installment #{installment.id} paid",
            reference_no=voucher.voucher_no, payment_method=payment_mode,
        )

    return voucher


def post_transfer_fee(db: Session, client_id: int, fee_amount: Decimal,
                      booking_id: int, payment_mode: str = "cash",
                      reference_no: Optional[str] = None,
                      user: Optional[User] = None) -> ReceiptVoucher:
    """Transfer fee charged → Dr Bank/Cash · Cr Transfer Fee Income."""
    accts = _ensure_system_accounts(db)
    payment_acct = accts["bank"] if payment_mode in ("bank", "cheque") else accts["cash"]

    journal = JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=payment_acct.id, debit=fee_amount,
                             description="Transfer fee"),
            JournalEntryData(account_id=accts["transfer_fee_income"].id, credit=fee_amount,
                             description="Transfer fee income"),
        ],
        reference_type="transfer",
        reference_id=str(booking_id),
        description="Transfer fee receipt",
        user=user,
        source="CLIENT_PIPELINE",
        is_editable=False,
    )

    voucher = _create_receipt_voucher(
        db=db, client_id=client_id, amount=fee_amount,
        payment_mode=payment_mode, receipt_type="transfer_fee",
        description="Transfer fee",
        booking_id=booking_id, journal_id=journal.id,
        reference_no=reference_no, user=user,
    )

    _post_to_client_ledger(
        db=db, client_id=client_id, journal_id=journal.id,
        amount=fee_amount, entry_type="transfer",
        description="Transfer fee charged",
        reference_no=voucher.voucher_no, payment_method=payment_mode,
    )

    return voucher


def post_chargeable_service(db: Session, client_id: int, amount: Decimal,
                            description: str, payment_mode: str = "cash",
                            booking_id: Optional[int] = None,
                            reference_no: Optional[str] = None,
                            user: Optional[User] = None) -> ReceiptVoucher:
    """Chargeable after-sales service → Dr Bank/Cash · Cr Service Income."""
    accts = _ensure_system_accounts(db)
    payment_acct = accts["bank"] if payment_mode in ("bank", "cheque") else accts["cash"]

    journal = JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=payment_acct.id, debit=amount,
                             description=description),
            JournalEntryData(account_id=accts["service_income"].id, credit=amount,
                             description=description),
        ],
        reference_type="service",
        reference_id=str(booking_id) if booking_id else None,
        description=description,
        user=user,
        source="CLIENT_PIPELINE",
        is_editable=False,
    )

    voucher = _create_receipt_voucher(
        db=db, client_id=client_id, amount=amount,
        payment_mode=payment_mode, receipt_type="service_charge",
        description=description,
        booking_id=booking_id, journal_id=journal.id,
        reference_no=reference_no, user=user,
    )

    _post_to_client_ledger(
        db=db, client_id=client_id, journal_id=journal.id,
        amount=amount, entry_type="service",
        description=description,
        reference_no=voucher.voucher_no, payment_method=payment_mode,
    )

    return voucher
