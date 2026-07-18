"""Client pipeline models — unified sales-to-finance workflow.
Entities: Contract, ReceiptVoucher, Transfer, Handover, AfterSalesTicket.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Contract(Base):
    """Signed agreement between client and company for a booking."""
    __tablename__ = "contracts"

    id          = Column(Integer, primary_key=True)
    contract_id = Column(String(20), unique=True, nullable=False, index=True)  # CTR-0001

    booking_id  = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    client_id   = Column(Integer, ForeignKey("clients.id"),  nullable=False, index=True)
    deal_id     = Column(Integer, ForeignKey("deals.id"),    nullable=True)

    agreement_doc_url = Column(String(512), nullable=True)
    signed_date       = Column(DateTime, nullable=True)
    effective_date    = Column(DateTime, nullable=True)
    expiry_date       = Column(DateTime, nullable=True)

    # Terms (snapshot at contract signing)
    total_amount        = Column(Numeric(14, 2), nullable=False)
    down_payment_amount = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    installment_count   = Column(Integer, nullable=True)
    installment_freq    = Column(String(20), nullable=True)  # monthly|quarterly|yearly|custom

    status = Column(String(20), nullable=False, default="draft")
    # draft | sent | signed | expired | terminated

    terms_text  = Column(Text, nullable=True)
    notes       = Column(Text, nullable=True)
    signed_by   = Column(String(120), nullable=True)
    witness     = Column(String(120), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    booking = relationship("Booking", foreign_keys=[booking_id])
    client  = relationship("Client",  foreign_keys=[client_id])
    deal    = relationship("Deal",    foreign_keys=[deal_id])


class ReceiptVoucher(Base):
    """Auto-generated receipt voucher for every financial transaction.
    Each voucher posts to both SubsidiaryLedger and General Ledger.
    """
    __tablename__ = "receipt_vouchers"

    id          = Column(Integer, primary_key=True)
    voucher_no  = Column(String(30), unique=True, nullable=False, index=True)  # RCP-YYYY-0001
    voucher_type = Column(String(20), nullable=False, default="receipt")
    # receipt | payment | contra

    client_id      = Column(Integer, ForeignKey("clients.id"),    nullable=True, index=True)
    booking_id     = Column(Integer, ForeignKey("bookings.id"),   nullable=True)
    installment_id = Column(Integer, ForeignKey("installments.id"), nullable=True)
    deal_id        = Column(Integer, ForeignKey("deals.id"),      nullable=True)
    journal_id     = Column(Integer, ForeignKey("journals.id"),   nullable=True)

    amount          = Column(Numeric(14, 2), nullable=False)
    payment_mode    = Column(String(20), nullable=False, default="cash")
    # cash | bank | cheque | online
    payment_date    = Column(DateTime, nullable=False, default=datetime.utcnow)
    reference_no    = Column(String(100), nullable=True)  # cheque number, transaction ID
    description     = Column(String(500), nullable=True)

    # token_amount | booking_fee | processing_fee | registration_fee |
    # down_payment | installment | transfer_fee | possession_fee | service_charge
    receipt_type = Column(String(30), nullable=False, default="installment")

    posted_to_ledger       = Column(Boolean, nullable=False, default=False)
    posted_to_subsidiary   = Column(Boolean, nullable=False, default=False)

    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow, nullable=False)

    client      = relationship("Client",      foreign_keys=[client_id])
    booking     = relationship("Booking",     foreign_keys=[booking_id])
    installment = relationship("Installment", foreign_keys=[installment_id])
    deal        = relationship("Deal",        foreign_keys=[deal_id])
    journal     = relationship("Journal",     foreign_keys=[journal_id])
    created_by  = relationship("User",        foreign_keys=[created_by_user_id])


class Transfer(Base):
    """Ownership transfer of a booking to a new client."""
    __tablename__ = "transfers"

    id             = Column(Integer, primary_key=True)
    transfer_id    = Column(String(20), unique=True, nullable=False, index=True)  # TRF-0001
    booking_id     = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    from_client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    to_client_id   = Column(Integer, ForeignKey("clients.id"), nullable=False)
    transfer_fee   = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    transfer_date  = Column(DateTime, nullable=False, default=datetime.utcnow)
    reason         = Column(Text, nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status         = Column(String(20), nullable=False, default="pending")
    # pending | approved | completed | rejected
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)

    booking     = relationship("Booking", foreign_keys=[booking_id])
    from_client = relationship("Client",  foreign_keys=[from_client_id])
    to_client   = relationship("Client",  foreign_keys=[to_client_id])
    approved_by = relationship("User",    foreign_keys=[approved_by_id])


class Handover(Base):
    """Property possession/handover to client after completion."""
    __tablename__ = "handovers"

    id              = Column(Integer, primary_key=True)
    handover_id     = Column(String(20), unique=True, nullable=False, index=True)  # HND-0001
    booking_id      = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    client_id       = Column(Integer, ForeignKey("clients.id"), nullable=False)
    unit_id         = Column(Integer, ForeignKey("units.id"), nullable=True)
    possession_date = Column(DateTime, nullable=False)
    snag_list_status = Column(String(20), nullable=False, default="pending")
    # pending | in_progress | resolved
    snag_list_notes = Column(Text, nullable=True)
    handover_notes  = Column(Text, nullable=True)
    doc_url         = Column(String(512), nullable=True)
    status          = Column(String(20), nullable=False, default="pending")
    # pending | completed | cancelled
    completed_at    = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    booking = relationship("Booking", foreign_keys=[booking_id])
    client  = relationship("Client",  foreign_keys=[client_id])
    unit    = relationship("Unit",    foreign_keys=[unit_id])


class AfterSalesTicket(Base):
    """Post-possession service/maintenance requests from the client."""
    __tablename__ = "after_sales_tickets"

    id              = Column(Integer, primary_key=True)
    ticket_id       = Column(String(20), unique=True, nullable=False, index=True)  # AST-0001
    client_id       = Column(Integer, ForeignKey("clients.id"),  nullable=False, index=True)
    unit_id         = Column(Integer, ForeignKey("units.id"),    nullable=True)
    booking_id      = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    ticket_type     = Column(String(40), nullable=False)
    # defect | maintenance | modification | handover_issue | documentation | other
    description     = Column(Text, nullable=False)
    priority        = Column(String(20), nullable=False, default="medium")
    # low | medium | high | urgent
    status          = Column(String(20), nullable=False, default="open")
    # open | in_progress | resolved | closed
    chargeable      = Column(Boolean, nullable=False, default=False)
    charge_amount   = Column(Numeric(14, 2), nullable=True)
    assigned_to_id  = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at     = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    client    = relationship("Client", foreign_keys=[client_id])
    unit      = relationship("Unit",   foreign_keys=[unit_id])
    booking   = relationship("Booking", foreign_keys=[booking_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
