from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Account(Base):
    """Chart of Accounts - hierarchical structure"""
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    code = Column(String(40), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    account_type = Column(String(30), nullable=False, index=True)  # Asset, Liability, Income, Expense, Equity
    parent_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Self-referential relationship
    parent = relationship("Account", remote_side=[id], backref="children")
    journal_entries = relationship("JournalEntry", back_populates="account")


class Journal(Base):
    """Journal header - groups related entries"""
    __tablename__ = "journals"

    id = Column(Integer, primary_key=True)
    date = Column(DateTime, nullable=False, index=True)
    reference_type = Column(String(50), nullable=False, index=True)  # invoice, payment, commission, expense, manual
    reference_id = Column(String(100), nullable=True)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    entries = relationship("JournalEntry", back_populates="journal", cascade="all, delete-orphan")
    created_by = relationship("User")


class JournalEntry(Base):
    """Individual debit/credit entries - double-entry accounting"""
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True)
    journal_id = Column(Integer, ForeignKey("journals.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    debit = Column(Numeric(12, 2), nullable=False, default=0)
    credit = Column(Numeric(12, 2), nullable=False, default=0)
    description = Column(String(500), nullable=True)

    journal = relationship("Journal", back_populates="entries")
    account = relationship("Account", back_populates="journal_entries")


class Invoice(Base):
    """Rent invoices to tenants"""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending, paid, partial
    due_date = Column(DateTime, nullable=False)
    description = Column(String(500), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    tenant = relationship("Tenant")
    property = relationship("Property")
    unit = relationship("Unit")


class Payment(Base):
    """Payments received against invoices"""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    method = Column(String(20), nullable=False)  # cash, bank
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(DateTime, nullable=False, index=True)
    reference_number = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice", back_populates="payments")


class Commission(Base):
    """Dealer/agent commissions — earned accruals and payout records."""
    __tablename__ = "commissions"

    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # legacy
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=True, index=True)
    sale_amount = Column(Numeric(14, 2), nullable=True)
    commission_rate = Column(Numeric(12, 4), nullable=True)
    calculated_amount = Column(Numeric(14, 2), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(20), nullable=False, index=True)  # earned, paid
    payment_status = Column(String(20), nullable=False, default="unpaid")  # unpaid, paid
    date = Column(DateTime, nullable=False)
    reference = Column(String(100), nullable=True)
    description = Column(String(500), nullable=True)
    journal_id = Column(Integer, ForeignKey("journals.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    agent = relationship("User")
    dealer = relationship("Dealer", foreign_keys=[dealer_id])
    property = relationship("Property")
    deal = relationship("Deal", foreign_keys=[deal_id])
    journal = relationship("Journal", foreign_keys=[journal_id])


class Expense(Base):
    """Direct expenses - debit expense account, credit cash/bank"""
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    paid_from = Column(String(20), nullable=False)  # cash, bank
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(DateTime, nullable=False, index=True)
    description = Column(String(500), nullable=False)
    reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    account = relationship("Account")
