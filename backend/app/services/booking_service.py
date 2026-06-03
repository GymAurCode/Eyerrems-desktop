"""Booking service — business logic, installment generation, payment processing.

This is the authoritative financial service. All money flows through here.
"""
import json
from datetime import datetime, timedelta, date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking, BookingLog
from app.models.crm import (
    Client, Deal, Dealer, Installment, InstallmentPlan, InstallmentPayment,
)
from app.models.finance import Account
from app.models.property import Property, Unit
from app.models.auth import User
from app.core.journal_service import JournalService, JournalEntryData


# ── Installment frequency intervals (months) ─────────────────────────────────

FREQ_MONTHS = {
    "monthly":    1,
    "quarterly":  3,
    "half_yearly": 6,
    "yearly":     12,
    "balloon":    0,   # single lump sum on a specific date
    "custom":     0,   # caller provides explicit due_date
}


# ── Standalone financial helpers (replaces model @property) ──────────────────

def booking_effective_price(booking: "Booking") -> Decimal:
    """Final price after discount, or property_price if not set."""
    return Decimal(str(booking.final_price or booking.property_price))


def booking_total_charges(booking: "Booking") -> Decimal:
    """Sum of processing_fee + possession + development + custom charges."""
    base = (
        Decimal(str(booking.processing_fee or 0))
        + Decimal(str(booking.possession_charges or 0))
        + Decimal(str(booking.development_charges or 0))
    )
    if booking.custom_charges:
        try:
            for c in json.loads(booking.custom_charges):
                base += Decimal(str(c.get("amount", 0)))
        except (json.JSONDecodeError, TypeError):
            pass
    return base


def booking_total_payable(booking: "Booking") -> Decimal:
    """effective_price + all charges."""
    return booking_effective_price(booking) + booking_total_charges(booking)


def booking_remaining_after_down(booking: "Booking") -> Decimal:
    """Amount to be covered by installments."""
    return booking_total_payable(booking) - Decimal(str(booking.down_payment or 0))


class BookingService:
    """Service layer for booking operations."""

    # ── Availability ──────────────────────────────────────────────────────────

    @staticmethod
    def check_unit_availability(
        db: Session,
        unit_id: Optional[int] = None,
        property_id: Optional[int] = None,
        exclude_booking_id: Optional[int] = None,
    ) -> bool:
        """
        Return True if the unit/property is available for booking.
        A unit is unavailable if an active (non-expired, non-cancelled) booking exists.
        """
        active_statuses = ["pending", "reserved", "confirmed", "active"]

        query = db.query(Booking).filter(
            Booking.status.in_(active_statuses),
            Booking.expiry_date > datetime.utcnow(),
        )
        if unit_id:
            query = query.filter(Booking.unit_id == unit_id)
        elif property_id:
            query = query.filter(Booking.property_id == property_id)
        else:
            return True

        if exclude_booking_id:
            query = query.filter(Booking.id != exclude_booking_id)

        return query.first() is None

    # ── Date helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def calculate_expiry_date(booking_date: datetime, holding_days: int) -> datetime:
        return booking_date + timedelta(days=holding_days)

    @staticmethod
    def is_booking_expired(booking: Booking) -> bool:
        terminal = {"cancelled", "expired", "completed", "refunded"}
        return (
            datetime.utcnow() > booking.expiry_date
            and booking.status not in terminal
        )

    @staticmethod
    def get_days_remaining(booking: Booking) -> Optional[int]:
        terminal = {"cancelled", "expired", "completed", "refunded"}
        if booking.status in terminal:
            return None
        delta = booking.expiry_date - datetime.utcnow()
        return max(0, delta.days) if delta.days >= 0 else None

    # ── Audit log ─────────────────────────────────────────────────────────────

    @staticmethod
    def create_log(
        db: Session,
        booking_id: int,
        action: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        performed_by_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> BookingLog:
        log = BookingLog(
            booking_id=booking_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            performed_by_id=performed_by_id,
            notes=notes,
        )
        db.add(log)
        return log

    # ── Status transitions ────────────────────────────────────────────────────

    VALID_TRANSITIONS: dict[str, list[str]] = {
        "pending":   ["reserved", "confirmed", "cancelled", "expired"],
        "reserved":  ["confirmed", "cancelled", "expired"],
        "confirmed": ["active", "cancelled"],
        "active":    ["completed", "cancelled", "refunded"],
        "completed": [],
        "cancelled": [],
        "expired":   [],
        "refunded":  [],
    }

    @classmethod
    def update_booking_status(
        cls,
        db: Session,
        booking: Booking,
        new_status: str,
        performed_by_id: Optional[int] = None,
        notes: Optional[str] = None,
        cancellation_reason: Optional[str] = None,
    ) -> None:
        allowed = cls.VALID_TRANSITIONS.get(booking.status, [])
        if new_status not in allowed:
            raise HTTPException(
                400,
                f"Cannot transition from '{booking.status}' to '{new_status}'. "
                f"Allowed: {allowed or 'none (terminal state)'}",
            )

        old_status = booking.status
        booking.status = new_status
        now = datetime.utcnow()

        if new_status == "confirmed":
            booking.confirmed_at = now
            # ── Finance sync: journalize booking token ────────────────────────
            if booking.booking_amount > 0:
                try:
                    cash_account = db.query(Account).filter(Account.code == "1100").first()
                    revenue_account = cls._resolve_revenue_account(db, booking)
                    if cash_account and revenue_account:
                        JournalService.create_journal_entry(
                            db=db,
                            entries=[
                                JournalEntryData(
                                    account_id=cash_account.id,
                                    debit=booking.booking_amount,
                                    description=f"Booking token {booking.booking_id}",
                                ),
                                JournalEntryData(
                                    account_id=revenue_account.id,
                                    credit=booking.booking_amount,
                                    description=f"Booking token {booking.booking_id} revenue",
                                ),
                            ],
                            reference_type="booking_confirmation",
                            reference_id=str(booking.id),
                            description=f"Booking {booking.booking_id} token payment — {booking.booking_amount}",
                            date=now,
                        )
                except ValueError:
                    pass  # journal creation failed silently
        elif new_status == "active":
            booking.active_at = now
            # Lock the unit
            if booking.unit_id:
                unit = db.query(Unit).filter(Unit.id == booking.unit_id).first()
                if unit:
                    unit.status = "booked"
        elif new_status == "completed":
            booking.completed_at = now
            # Mark unit as sold
            if booking.unit_id:
                unit = db.query(Unit).filter(Unit.id == booking.unit_id).first()
                if unit:
                    unit.status = "sold"
        elif new_status == "cancelled":
            booking.cancelled_at = now
            booking.cancellation_reason = cancellation_reason
            # Release the unit
            if booking.unit_id:
                unit = db.query(Unit).filter(Unit.id == booking.unit_id).first()
                if unit and unit.status == "booked":
                    unit.status = "available"
        elif new_status == "expired":
            booking.expired_at = now
            if booking.unit_id:
                unit = db.query(Unit).filter(Unit.id == booking.unit_id).first()
                if unit and unit.status == "booked":
                    unit.status = "available"
        elif new_status == "refunded":
            booking.refunded_at = now
            if booking.unit_id:
                unit = db.query(Unit).filter(Unit.id == booking.unit_id).first()
                if unit and unit.status in ("booked", "sold"):
                    unit.status = "available"

        cls.create_log(
            db=db,
            booking_id=booking.id,
            action="status_changed",
            old_value=old_status,
            new_value=new_status,
            performed_by_id=performed_by_id,
            notes=notes,
        )

    # ── Installment plan generation ───────────────────────────────────────────

    @staticmethod
    def generate_installment_schedule(
        total_amount: Decimal,
        down_payment: Decimal,
        frequency: str,
        count: int,
        start_date: date,
        due_day: Optional[int] = None,
        grace_days: int = 0,
        type_id: Optional[int] = None,
    ) -> list[dict]:
        """
        Auto-generate installment records.

        Args:
            total_amount:  Total payable (price + charges)
            down_payment:  Already paid upfront
            frequency:     monthly | quarterly | half_yearly | yearly | balloon | custom
            count:         Number of installments
            start_date:    First installment due date
            due_day:       Day of month for due dates (1-28). If None, uses start_date.day
            grace_days:    Grace period before late fee kicks in
            type_id:       InstallmentType FK

        Returns:
            List of dicts: {due_date, amount, type, installment_number}
        """
        if count <= 0:
            raise ValueError("count must be >= 1")

        remaining = total_amount - down_payment
        if remaining < 0:
            raise ValueError("down_payment cannot exceed total_amount")
        if remaining == 0:
            return []

        interval_months = FREQ_MONTHS.get(frequency, 1)
        per_installment = (remaining / count).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        # Last installment absorbs rounding difference
        last_amount = remaining - (per_installment * (count - 1))

        records = []
        for i in range(count):
            if interval_months > 0:
                due = start_date + relativedelta(months=interval_months * i)
            else:
                # balloon / custom: all on start_date (caller adjusts manually)
                due = start_date

            # Snap to due_day if specified
            if due_day and 1 <= due_day <= 28:
                try:
                    due = due.replace(day=due_day)
                except ValueError:
                    pass  # month doesn't have that day — keep as-is

            amount = last_amount if i == count - 1 else per_installment
            records.append({
                "installment_number": i + 1,
                "due_date": due,
                "amount": amount,
                "type": frequency,
                "grace_days": grace_days,
            })

        return records

    @classmethod
    def create_installment_plan(
        cls,
        db: Session,
        booking: Booking,
        frequency: str,
        count: int,
        start_date: date,
        due_day: Optional[int] = None,
        grace_days: int = 0,
        type_id: Optional[int] = None,
        performed_by_id: Optional[int] = None,
    ) -> InstallmentPlan:
        """
        Create an InstallmentPlan for a Booking and auto-generate the schedule.
        Can only be called once per booking (raises 400 if plan already exists).
        """
        if booking.installment_plan:
            raise HTTPException(400, "Installment plan already exists for this booking")

        total = booking_total_payable(booking)
        down  = Decimal(str(booking.down_payment or 0))

        schedule = cls.generate_installment_schedule(
            total_amount=total,
            down_payment=down,
            frequency=frequency,
            count=count,
            start_date=start_date,
            due_day=due_day,
            grace_days=grace_days,
        )

        plan = InstallmentPlan(
            booking_id=booking.id,
            type_id=type_id,
            total_amount=total,
            down_payment=down,
            remaining_amount=total - down,
            down_payment_status=booking.down_payment_status,
            total_count=len(schedule),
            frequency=frequency,
            amount_per=schedule[0]["amount"] if schedule else None,
        )
        db.add(plan)
        db.flush()

        for rec in schedule:
            db.add(Installment(
                plan_id=plan.id,
                due_date=rec["due_date"],
                amount=rec["amount"],
                type=rec["type"],
                status="pending",
            ))

        cls.create_log(
            db=db,
            booking_id=booking.id,
            action="installment_plan_created",
            new_value=f"{count}x {frequency}",
            performed_by_id=performed_by_id,
            notes=f"Auto-generated {len(schedule)} installments",
        )

        return plan

    # ── Payment processing ────────────────────────────────────────────────────

    @staticmethod
    def _resolve_revenue_account(db: Session, booking: Booking) -> Optional[Account]:
        """Resolve the revenue GL account from the booking's property, or fallback to 4300."""
        if booking.property_id:
            prop = db.query(Property).filter(Property.id == booking.property_id).first()
            if prop and prop.income_gl_account_id:
                rev = db.query(Account).filter(Account.id == prop.income_gl_account_id).first()
                if rev:
                    return rev
        return db.query(Account).filter(Account.code == "4300").first()

    @staticmethod
    def record_payment(
        db: Session,
        installment: Installment,
        method: str,
        amount: Decimal,
        reference_number: Optional[str] = None,
        payment_date: Optional[datetime] = None,
        notes: Optional[str] = None,
    ) -> InstallmentPayment:
        """
        Record a payment against an installment.
        - Supports partial payments (multiple payments per installment)
        - Creates double-entry journal: Debit Cash/Bank, Credit Property Revenue
        - Prevents overpayment
        """
        new_paid = Decimal(str(installment.paid_amount)) + amount
        if new_paid > Decimal(str(installment.amount)):
            raise HTTPException(
                400,
                f"Payment of {amount} would exceed installment balance. "
                f"Remaining: {Decimal(str(installment.amount)) - Decimal(str(installment.paid_amount))}",
            )

        # Resolve accounts
        cash_code = "1010" if method == "cash" else "1100"
        cash_account = db.query(Account).filter(Account.code == cash_code).first()

        # Resolve property revenue account from installment plan's deal/booking
        revenue_account = None
        plan = installment.plan
        if plan:
            if plan.deal_id:
                deal = db.query(Deal).options(
                    joinedload(Deal.property)
                ).filter(Deal.id == plan.deal_id).first()
                if deal and deal.property and deal.property.income_gl_account_id:
                    revenue_account = db.query(Account).filter(Account.id == deal.property.income_gl_account_id).first()
            elif plan.booking_id:
                booking = db.query(Booking).options(
                    joinedload(Booking.property)
                ).filter(Booking.id == plan.booking_id).first()
                if booking and booking.property and booking.property.income_gl_account_id:
                    revenue_account = db.query(Account).filter(Account.id == booking.property.income_gl_account_id).first()
        if not revenue_account:
            revenue_account = db.query(Account).filter(Account.code == "4300").first()

        if not cash_account or not revenue_account:
            raise HTTPException(
                400,
                "Required accounts (Cash/Bank + Revenue) not found. Run default COA setup.",
            )

        pay_date = payment_date or datetime.utcnow()

        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(
                    account_id=cash_account.id,
                    debit=amount,
                    description=f"Installment #{installment.id} payment",
                ),
                JournalEntryData(
                    account_id=revenue_account.id,
                    credit=amount,
                    description=f"Installment #{installment.id} revenue",
                ),
            ],
            reference_type="installment_payment",
            reference_id=str(installment.id),
            description=f"Installment #{installment.id} payment via {method}",
            date=pay_date,
        )

        payment = InstallmentPayment(
            installment_id=installment.id,
            method=method,
            amount=amount,
            date=pay_date,
            reference_number=reference_number,
            journal_id=journal.id,
        )
        db.add(payment)

        # Update installment status
        installment.paid_amount = new_paid
        if new_paid >= Decimal(str(installment.amount)):
            installment.status = "paid"
        else:
            installment.status = "partial"

        return payment

    # ── Overdue detection ─────────────────────────────────────────────────────

    @staticmethod
    def mark_overdue_installments(db: Session) -> int:
        """Mark all past-due unpaid installments as overdue. Returns count."""
        today = date.today()
        result = (
            db.query(Installment)
            .filter(
                Installment.status.in_(["pending", "partial"]),
                Installment.due_date < today,
            )
            .all()
        )
        for inst in result:
            inst.status = "overdue"
        db.commit()
        return len(result)

    # ── Booking extension ─────────────────────────────────────────────────────

    @staticmethod
    def extend_booking(
        db: Session,
        booking: Booking,
        additional_days: int,
        performed_by_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> None:
        if additional_days < 1 or additional_days > 90:
            raise HTTPException(400, "additional_days must be between 1 and 90")
        old_expiry = booking.expiry_date
        booking.expiry_date = booking.expiry_date + timedelta(days=additional_days)
        booking.holding_days += additional_days
        BookingService.create_log(
            db=db,
            booking_id=booking.id,
            action="extended",
            old_value=str(old_expiry.date()),
            new_value=str(booking.expiry_date.date()),
            performed_by_id=performed_by_id,
            notes=notes,
        )

    # ── Convert deal → booking ────────────────────────────────────────────────

    @staticmethod
    def create_booking_from_deal(
        db: Session,
        deal: Deal,
        booking_id_str: str,
        final_price: Decimal,
        booking_amount: Decimal,
        down_payment: Decimal,
        holding_days: int,
        performed_by_id: Optional[int] = None,
        **kwargs,
    ) -> Booking:
        """
        Create a Booking from a WON deal.
        Sets deal.status = 'won' and links booking.deal_id = deal.id.
        """
        if deal.status not in ("won", "negotiating", "open"):
            raise HTTPException(
                400,
                f"Deal must be in open/negotiating/won state to create a booking. "
                f"Current: {deal.status}",
            )

        # Check availability
        if not BookingService.check_unit_availability(
            db=db,
            unit_id=deal.unit_id,
            property_id=deal.property_id if not deal.unit_id else None,
        ):
            raise HTTPException(
                400,
                "This unit/property is already booked. "
                "The existing booking must be cancelled or expired first.",
            )

        now = datetime.utcnow()
        booking = Booking(
            booking_id=booking_id_str,
            deal_id=deal.id,
            client_id=deal.client_id,
            property_id=deal.property_id,
            unit_id=deal.unit_id,
            property_price=deal.deal_value,
            final_price=final_price,
            booking_amount=booking_amount,
            down_payment=down_payment,
            booking_date=now,
            expiry_date=now + timedelta(days=holding_days),
            holding_days=holding_days,
            status="pending",
            **kwargs,
        )
        db.add(booking)
        db.flush()

        # Mark deal as won
        deal.status = "won"

        BookingService.create_log(
            db=db,
            booking_id=booking.id,
            action="created",
            new_value="pending",
            performed_by_id=performed_by_id,
            notes=f"Created from deal {deal.deal_id}",
        )

        return booking

    # ── Statistics ────────────────────────────────────────────────────────────

    @staticmethod
    def get_booking_stats(db: Session) -> dict:
        from sqlalchemy import case
        rows = db.query(
            Booking.status,
            func.count(Booking.id).label("cnt"),
            func.sum(Booking.booking_amount).label("total_booking"),
            func.sum(Booking.property_price).label("total_property"),
        ).group_by(Booking.status).all()

        stats: dict = {
            "total_bookings": 0,
            "pending_bookings": 0,
            "reserved_bookings": 0,
            "confirmed_bookings": 0,
            "active_bookings": 0,
            "completed_bookings": 0,
            "cancelled_bookings": 0,
            "expired_bookings": 0,
            "refunded_bookings": 0,
            "expiring_soon": 0,
            "total_booking_amount": Decimal("0"),
            "total_property_value": Decimal("0"),
        }
        for row in rows:
            key = f"{row.status}_bookings"
            stats["total_bookings"] += row.cnt
            if key in stats:
                stats[key] = row.cnt
            stats["total_booking_amount"] += Decimal(str(row.total_booking or 0))
            stats["total_property_value"] += Decimal(str(row.total_property or 0))

        # Expiring in next 24 hours
        soon = datetime.utcnow() + timedelta(hours=24)
        stats["expiring_soon"] = db.query(func.count(Booking.id)).filter(
            Booking.status.in_(["pending", "reserved", "confirmed"]),
            Booking.expiry_date <= soon,
            Booking.expiry_date > datetime.utcnow(),
        ).scalar() or 0

        return stats

    @staticmethod
    def get_expiring_soon(db: Session, hours: int = 24) -> list[Booking]:
        soon = datetime.utcnow() + timedelta(hours=hours)
        return (
            db.query(Booking)
            .filter(
                Booking.status.in_(["pending", "reserved", "confirmed"]),
                Booking.expiry_date <= soon,
                Booking.expiry_date > datetime.utcnow(),
            )
            .all()
        )

    @staticmethod
    def expire_old_bookings(db: Session) -> int:
        """Auto-expire bookings past their expiry_date. Returns count."""
        expired = (
            db.query(Booking)
            .filter(
                Booking.status.in_(["pending", "reserved"]),
                Booking.expiry_date < datetime.utcnow(),
            )
            .all()
        )
        for b in expired:
            b.status = "expired"
            b.expired_at = datetime.utcnow()
            if b.unit_id:
                unit = db.query(Unit).filter(Unit.id == b.unit_id).first()
                if unit and unit.status == "booked":
                    unit.status = "available"
        db.commit()
        return len(expired)
