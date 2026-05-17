"""Ledger models — Client, Dealer, and Property ledger entries.

Each table stores a running_balance snapshot per entry so the UI can
display ledgers without recalculating from scratch on every request.
Running balance is recalculated and stored whenever an entry is added.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class ClientLedgerEntry(Base):
    """All financial activity linked to a CRM client."""
    __tablename__ = "client_ledger_entries"

    id               = Column(Integer, primary_key=True)
    tid              = Column(String(20), unique=True, nullable=False)
    client_id        = Column(Integer, ForeignKey("clients.id",  ondelete="CASCADE"),  nullable=False, index=True)
    journal_id       = Column(Integer, ForeignKey("journals.id", ondelete="SET NULL"), nullable=True)
    entry_date       = Column(DateTime, nullable=False, index=True)
    description      = Column(String(500), nullable=False)
    reference_no     = Column(String(100), nullable=True)
    # booking | installment | refund | discount | tax | adjustment | penalty | transfer
    entry_type       = Column(String(50), nullable=False, index=True)
    debit            = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    credit           = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    running_balance  = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    # cash | bank | cheque | online
    payment_method   = Column(String(30), nullable=True)
    # posted | pending | reversed
    status           = Column(String(20), nullable=False, default="posted")
    notes            = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)

    client     = relationship("Client",  foreign_keys=[client_id])
    journal    = relationship("Journal", foreign_keys=[journal_id])
    created_by = relationship("User",    foreign_keys=[created_by_user_id])


class DealerLedgerEntry(Base):
    """Commission and payout tracking for dealers."""
    __tablename__ = "dealer_ledger_entries"

    id               = Column(Integer, primary_key=True)
    tid              = Column(String(20), unique=True, nullable=False)
    dealer_id        = Column(Integer, ForeignKey("dealers.id", ondelete="CASCADE"),  nullable=False, index=True)
    deal_id          = Column(Integer, ForeignKey("deals.id",   ondelete="SET NULL"), nullable=True)
    journal_id       = Column(Integer, ForeignKey("journals.id", ondelete="SET NULL"), nullable=True)
    entry_date       = Column(DateTime, nullable=False, index=True)
    description      = Column(String(500), nullable=False)
    reference_no     = Column(String(100), nullable=True)
    # commission | payout | adjustment | bonus | penalty
    entry_type       = Column(String(50), nullable=False)
    commission_rate  = Column(Numeric(7, 4), nullable=True)    # e.g. 0.0250 = 2.5%
    gross_commission = Column(Numeric(14, 2), nullable=True)
    debit            = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    credit           = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    running_balance  = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    # posted | pending | reversed
    status           = Column(String(20), nullable=False, default="posted")
    notes            = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)

    dealer     = relationship("Dealer",  foreign_keys=[dealer_id])
    deal       = relationship("Deal",    foreign_keys=[deal_id])
    journal    = relationship("Journal", foreign_keys=[journal_id])
    created_by = relationship("User",    foreign_keys=[created_by_user_id])


class PropertyLedgerEntry(Base):
    """All financial activity linked to a property."""
    __tablename__ = "property_ledger_entries"

    id               = Column(Integer, primary_key=True)
    tid              = Column(String(20), unique=True, nullable=False)
    property_id      = Column(Integer, ForeignKey("properties.id", ondelete="CASCADE"),  nullable=False, index=True)
    client_id        = Column(Integer, ForeignKey("clients.id",    ondelete="SET NULL"), nullable=True, index=True)
    journal_id       = Column(Integer, ForeignKey("journals.id",   ondelete="SET NULL"), nullable=True)
    entry_date       = Column(DateTime, nullable=False, index=True)
    description      = Column(String(500), nullable=False)
    reference_no     = Column(String(100), nullable=True)
    # booking | installment | tax | transfer_fee | development | refund | ownership_transfer
    entry_type       = Column(String(50), nullable=False)
    debit            = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    credit           = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    running_balance  = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    # posted | pending | reversed
    status           = Column(String(20), nullable=False, default="posted")
    notes            = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)

    property   = relationship("Property", foreign_keys=[property_id])
    client     = relationship("Client",   foreign_keys=[client_id])
    journal    = relationship("Journal",  foreign_keys=[journal_id])
    created_by = relationship("User",     foreign_keys=[created_by_user_id])
