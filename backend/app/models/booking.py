"""Booking models — Official financial commitment and payment workflow.

Architecture:
  Lead → Deal (negotiation) → Booking (financial commitment)
       → InstallmentPlan → Installments → InstallmentPayments

A Booking is the authoritative financial record. It owns:
  - final agreed price + all charges
  - installment plan and schedule
  - payment history
  - unit lock (unit.status = 'booked' → 'sold')

Deals are negotiation-only and do NOT own financial data.
"""
from datetime import datetime

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer,
    Numeric, String, Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Booking(Base):
    """
    Official property/unit reservation with full financial commitment.

    Status lifecycle:
      pending → reserved → confirmed → active → completed
      Any active state → cancelled | expired | refunded
    """
    __tablename__ = "bookings"

    id         = Column(Integer, primary_key=True)
    booking_id = Column(String(20), unique=True, nullable=False, index=True)  # BKG-0001

    # ── Source ────────────────────────────────────────────────────────────────
    deal_id    = Column(Integer, ForeignKey("deals.id"), nullable=True, index=True)
    # (nullable — bookings can be created directly without a deal)

    # ── References ────────────────────────────────────────────────────────────
    client_id   = Column(Integer, ForeignKey("clients.id"),    nullable=False, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True,  index=True)
    unit_id     = Column(Integer, ForeignKey("units.id"),      nullable=True,  index=True)
    project_id  = Column(Integer, nullable=True)

    # ── Assignment ────────────────────────────────────────────────────────────
    assigned_dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=True)
    assigned_staff_id  = Column(Integer, ForeignKey("users.id"),   nullable=True)
    nominee_name       = Column(String(120), nullable=True)
    nominee_phone      = Column(String(50),  nullable=True)
    nominee_cnic       = Column(String(20),  nullable=True)

    # ── Financial snapshot (immutable after confirmation) ─────────────────────
    property_price      = Column(Numeric(14, 2), nullable=False)  # listed price at booking
    final_price         = Column(Numeric(14, 2), nullable=True)   # agreed final price
    discount            = Column(Numeric(14, 2), nullable=False, default=0)
    booking_amount      = Column(Numeric(14, 2), nullable=False)  # token/booking fee
    down_payment        = Column(Numeric(14, 2), nullable=False, default=0)
    down_payment_status = Column(String(20),     nullable=False, default="pending")
    processing_fee      = Column(Numeric(14, 2), nullable=False, default=0)
    possession_charges  = Column(Numeric(14, 2), nullable=False, default=0)
    development_charges = Column(Numeric(14, 2), nullable=False, default=0)
    # JSON: [{"label": "Club Membership", "amount": 50000}, ...]
    custom_charges      = Column(Text, nullable=True)

    # ── Holding period ────────────────────────────────────────────────────────
    booking_date  = Column(DateTime, nullable=False, default=datetime.utcnow)
    expiry_date   = Column(DateTime, nullable=False)
    holding_days  = Column(Integer,  nullable=False, default=7)

    # ── Status ────────────────────────────────────────────────────────────────
    # pending | reserved | confirmed | active | completed
    # cancelled | expired | refunded
    status = Column(String(20), nullable=False, default="pending", index=True)

    notes               = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at    = Column(DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)
    confirmed_at  = Column(DateTime, nullable=True)
    active_at     = Column(DateTime, nullable=True)
    completed_at  = Column(DateTime, nullable=True)
    cancelled_at  = Column(DateTime, nullable=True)
    expired_at    = Column(DateTime, nullable=True)
    refunded_at   = Column(DateTime, nullable=True)
    converted_at  = Column(DateTime, nullable=True)  # kept for legacy compat

    # ── Relationships ─────────────────────────────────────────────────────────
    deal            = relationship("Deal",     foreign_keys=[deal_id])
    client          = relationship("Client",   foreign_keys=[client_id])
    property        = relationship("Property", foreign_keys=[property_id])
    unit            = relationship("Unit",     foreign_keys=[unit_id])
    assigned_dealer = relationship("Dealer",   foreign_keys=[assigned_dealer_id])
    assigned_staff  = relationship("User",     foreign_keys=[assigned_staff_id])

    installment_plan = relationship(
        "InstallmentPlan",
        back_populates="booking",
        uselist=False,
        cascade="all, delete-orphan",
    )
    logs = relationship(
        "BookingLog",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingLog.created_at.desc()",
    )
    attachments = relationship(
        "BookingAttachment",
        back_populates="booking",
        cascade="all, delete-orphan",
    )


class BookingLog(Base):
    """Immutable audit trail for every booking state change."""
    __tablename__ = "booking_logs"

    id              = Column(Integer, primary_key=True)
    booking_id      = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    action          = Column(String(50),  nullable=False)
    old_value       = Column(String(255), nullable=True)
    new_value       = Column(String(255), nullable=True)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    booking      = relationship("Booking",  back_populates="logs")
    performed_by = relationship("User",     foreign_keys=[performed_by_id])


class BookingAttachment(Base):
    """Supporting documents: agreements, payment receipts, ID proofs."""
    __tablename__ = "booking_attachments"

    id         = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    file_path  = Column(String(512), nullable=False)
    filename   = Column(String(255), nullable=False)
    file_type  = Column(String(50),  nullable=True)  # agreement|receipt|id_proof|other
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    booking = relationship("Booking", back_populates="attachments")
