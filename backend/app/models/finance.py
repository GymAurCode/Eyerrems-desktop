from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, JSON
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
    is_system_account = Column(Boolean, nullable=False, default=False)
    opening_balance = Column(Numeric(14, 2), nullable=False, default=0)
    opening_balance_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    parent = relationship("Account", remote_side=[id], backref="children")
    journal_entries = relationship("JournalEntry", back_populates="account")


class Journal(Base):
    """ERP General Journal - double-entry accounting backbone"""
    __tablename__ = "journals"

    id = Column(Integer, primary_key=True)

    # Auto-generated number
    journal_number = Column(String(50), nullable=True, unique=True, index=True)

    # Basic info
    date = Column(DateTime, nullable=False, index=True)
    reference_type = Column(String(50), nullable=False, index=True, default="manual")
    reference_id = Column(String(100), nullable=True)
    description = Column(String(500), nullable=True)
    source = Column(String(20), nullable=True, index=True)  # MANUAL, CRM, PROPERTY, EXPENSE, PAYROLL, etc

    # Status / Workflow
    status = Column(String(20), nullable=False, default="draft", index=True)  # draft, submitted, approved, posted, reversed, cancelled
    is_editable = Column(Boolean, nullable=False, default=True)

    # Approval workflow
    approval_level = Column(Integer, nullable=True)
    approved_by = Column(Integer, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    submitted_by = Column(Integer, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    rejected_by = Column(Integer, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Posting
    posted_by = Column(Integer, nullable=True)
    posted_at = Column(DateTime, nullable=True)

    # Reversal
    is_reversal = Column(Boolean, nullable=False, default=False)
    reversal_of = Column(Integer, nullable=True, index=True)  # original journal id
    reversal_reason = Column(String(500), nullable=True)
    reversed_by = Column(Integer, nullable=True)
    reversed_at = Column(DateTime, nullable=True)

    # Budget
    approved_budget = Column(Numeric(14, 2), nullable=True)
    budget_used = Column(Numeric(14, 2), nullable=True)
    budget_remaining = Column(Numeric(14, 2), nullable=True)
    budget_exceeded = Column(Boolean, nullable=False, default=False)
    budget_approval_required = Column(Boolean, nullable=False, default=False)

    # Source document linking
    source_module = Column(String(50), nullable=True)
    source_document_id = Column(Integer, nullable=True)
    source_document_number = Column(String(100), nullable=True)
    source_document_status = Column(String(50), nullable=True)
    source_document_date = Column(DateTime, nullable=True)

    # Notes
    internal_notes = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)

    # Audit
    modified_by = Column(Integer, nullable=True)
    modified_at = Column(DateTime, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Soft delete & timestamps
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)

    # Relationships
    entries = relationship("JournalEntry", back_populates="journal", cascade="all, delete-orphan",
                           order_by="JournalEntry.sort_order")
    created_by = relationship("User")


class JournalEntry(Base):
    """Individual debit/credit entries with full ERP context"""
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True)
    journal_id = Column(Integer, ForeignKey("journals.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)

    # Amounts
    debit = Column(Numeric(14, 2), nullable=False, default=0)
    credit = Column(Numeric(14, 2), nullable=False, default=0)

    # Narration / Description
    narration = Column(String(500), nullable=True)
    description = Column(String(500), nullable=True)

    # Dimension tracking
    cost_center = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    project_id = Column(Integer, nullable=True)
    property_id = Column(Integer, nullable=True)
    building = Column(String(100), nullable=True)
    floor = Column(String(50), nullable=True)
    unit_id = Column(Integer, nullable=True)
    customer_id = Column(Integer, nullable=True)
    vendor_id = Column(Integer, nullable=True)
    employee_id = Column(Integer, nullable=True)

    # Tax
    tax_code = Column(String(50), nullable=True)
    tax_amount = Column(Numeric(14, 2), nullable=True, default=0)

    # Reference
    reference = Column(String(200), nullable=True)
    memo = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    # Relationships
    journal = relationship("Journal", back_populates="entries")
    account = relationship("Account", back_populates="journal_entries")


class Invoice(Base):
    """ERP Invoice — creates receivables. Payments are separate documents."""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True)
    invoice_number = Column(String(50), nullable=True, unique=True, index=True)
    invoice_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False, default="draft", index=True)
    invoice_type = Column(String(30), nullable=True, default="manual")

    # Amounts
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(14, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0)
    adjustment = Column(Numeric(14, 2), nullable=False, default=0)
    amount = Column(Numeric(14, 2), nullable=False, default=0)
    paid_amount = Column(Numeric(14, 2), nullable=False, default=0)
    remaining_amount = Column(Numeric(14, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="PKR")

    # Party info
    party_type = Column(String(30), nullable=True)
    party_id = Column(Integer, nullable=True, index=True)
    client_id = Column(Integer, nullable=True)
    client_name = Column(String(255), nullable=True)
    client_phone = Column(String(50), nullable=True)
    client_email = Column(String(255), nullable=True)
    client_cnic = Column(String(50), nullable=True)
    client_ntn = Column(String(50), nullable=True)
    client_address = Column(Text, nullable=True)

    # Reference links
    reference = Column(String(100), nullable=True)
    reference_type = Column(String(30), nullable=True)
    reference_id = Column(Integer, nullable=True)
    deal_id = Column(Integer, nullable=True)
    booking_id = Column(Integer, nullable=True)
    lease_id = Column(Integer, nullable=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    maintenance_ticket_id = Column(Integer, nullable=True)
    construction_project_id = Column(Integer, nullable=True)
    purchase_order_id = Column(Integer, nullable=True)
    contract_id = Column(Integer, nullable=True)

    # Payment terms
    payment_terms = Column(String(50), nullable=True, default="due_immediately")

    # Notes
    internal_notes = Column(Text, nullable=True)
    customer_notes = Column(Text, nullable=True)
    terms_conditions = Column(Text, nullable=True)
    late_payment_policy = Column(Text, nullable=True)
    footer_message = Column(Text, nullable=True)

    # Auto-generation source
    auto_generated = Column(Boolean, nullable=False, default=False)
    source_module = Column(String(30), nullable=True)
    source_record_id = Column(Integer, nullable=True)

    # Timestamps
    sent_at = Column(DateTime, nullable=True)
    viewed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    voided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Tenant/Company
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)

    # Relationships
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan",
                         order_by="InvoiceItem.sort_order")
    allocations = relationship("PaymentAllocation", back_populates="invoice")
    tenant = relationship("Tenant")
    property = relationship("Property")
    unit = relationship("Unit")


class InvoiceItem(Base):
    """Individual line items for an invoice."""
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(12, 4), nullable=False, default=1)
    unit = Column(String(20), nullable=True)
    unit_price = Column(Numeric(14, 2), nullable=False, default=0)
    discount_pct = Column(Numeric(8, 4), nullable=False, default=0)
    tax_pct = Column(Numeric(8, 4), nullable=False, default=0)
    discount_amount = Column(Numeric(14, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0)
    line_total = Column(Numeric(14, 2), nullable=False, default=0)
    sort_order = Column(Integer, nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="items")


class Payment(Base):
    """ERP Payment — settles receivables. Never creates invoices."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    payment_number = Column(String(50), nullable=True, unique=True, index=True)
    receipt_number = Column(String(50), nullable=True, unique=True, index=True)

    # Status
    status = Column(String(20), nullable=False, default="completed", index=True)

    # Source / Type
    payment_type = Column(String(30), nullable=False, default="against_invoice")
    method = Column(String(20), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)

    # Method-specific fields (JSON)
    method_fields = Column(JSON, nullable=True)

    # Date
    date = Column(DateTime, nullable=False, index=True)

    # Reference
    reference_number = Column(String(100), nullable=True)
    external_transaction_id = Column(String(100), nullable=True)
    received_by = Column(String(255), nullable=True)

    # Party info
    party_type = Column(String(30), nullable=True)
    party_id = Column(Integer, nullable=True)
    party_name = Column(String(255), nullable=True)
    party_phone = Column(String(50), nullable=True)
    party_email = Column(String(255), nullable=True)
    party_cnic = Column(String(50), nullable=True)
    party_address = Column(Text, nullable=True)

    # Source document
    source = Column(String(20), nullable=True)
    source_id = Column(Integer, nullable=True)

    # Branch / register
    branch = Column(String(100), nullable=True)
    cash_counter = Column(String(100), nullable=True)

    # Finance posting
    posted_to_finance = Column(Boolean, nullable=False, default=False)
    finance_journal_id = Column(Integer, nullable=True)

    # Notes
    internal_notes = Column(Text, nullable=True)

    # Timestamps
    completed_at = Column(DateTime, nullable=True)
    reversed_at = Column(DateTime, nullable=True)
    refunded_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_user_id = Column(Integer, nullable=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)

    # Relationships
    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")
    attachments = relationship("PaymentAttachment", back_populates="payment", cascade="all, delete-orphan")


class PaymentAllocation(Base):
    """Links a Payment to one or more Invoices with allocated amounts."""
    __tablename__ = "payment_allocations"

    id = Column(Integer, primary_key=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    allocated_amount = Column(Numeric(14, 2), nullable=False)

    payment = relationship(lambda: Payment, back_populates="allocations")
    invoice = relationship("Invoice", back_populates="allocations")


class CustomerCredit(Base):
    """Advance payments, overpayments, and refund credits available for future invoices."""
    __tablename__ = "customer_credits"

    id = Column(Integer, primary_key=True)
    party_type = Column(String(30), nullable=True, index=True)
    party_id = Column(Integer, nullable=True, index=True)
    party_name = Column(String(255), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    remaining_amount = Column(Numeric(14, 2), nullable=False)
    source = Column(String(30), nullable=False)
    source_payment_id = Column(Integer, ForeignKey("payments.id", ondelete="SET NULL"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)

    payment = relationship(lambda: Payment, foreign_keys=[source_payment_id])
    invoice = relationship("Invoice", foreign_keys=[invoice_id])


class PaymentAttachment(Base):
    """Documents attached to a payment after it's recorded."""
    __tablename__ = "payment_attachments"

    id = Column(Integer, primary_key=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    payment = relationship(lambda: Payment, back_populates="attachments")


class Commission(Base):
    """Dealer/agent commissions — earned accruals and payout records."""
    __tablename__ = "commissions"

    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=True, index=True)
    sale_amount = Column(Numeric(14, 2), nullable=True)
    commission_rate = Column(Numeric(12, 4), nullable=True)
    calculated_amount = Column(Numeric(14, 2), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(20), nullable=False, index=True)
    payment_status = Column(String(20), nullable=False, default="unpaid")
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


class ExpenseItem(Base):
    """Line items for professional expense management"""
    __tablename__ = "expense_items"

    id = Column(Integer, primary_key=True)
    expense_id = Column(Integer, ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(500), nullable=False)
    category = Column(String(50), nullable=True)
    quantity = Column(Numeric(12, 4), nullable=False, default=1)
    unit = Column(String(20), nullable=True)
    unit_cost = Column(Numeric(14, 2), nullable=False, default=0)
    discount_pct = Column(Numeric(8, 4), nullable=False, default=0)
    tax_pct = Column(Numeric(8, 4), nullable=False, default=0)
    discount_amount = Column(Numeric(14, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0)
    line_total = Column(Numeric(14, 2), nullable=False, default=0)
    sort_order = Column(Integer, nullable=False, default=0)

    expense = relationship("Expense", back_populates="items")


class Expense(Base):
    """Professional ERP Accounts Payable & Expense Management System"""
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)

    # Auto-generated number
    expense_number = Column(String(50), nullable=True, unique=True, index=True)

    # Basic info
    expense_date = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    expense_type = Column(String(50), nullable=False, default="miscellaneous")
    status = Column(String(20), nullable=False, default="draft", index=True)
    currency = Column(String(10), nullable=False, default="PKR")

    # Source tracking
    expense_source = Column(String(30), nullable=True)  # purchase_order, vendor_bill, construction, maintenance, utility, department, manual
    source_id = Column(Integer, nullable=True)
    source_reference = Column(String(100), nullable=True)

    # Vendor info
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True, index=True)
    vendor_name = Column(String(255), nullable=True)
    vendor_phone = Column(String(50), nullable=True)
    vendor_email = Column(String(255), nullable=True)
    vendor_address = Column(Text, nullable=True)
    vendor_ntn = Column(String(50), nullable=True)
    vendor_strn = Column(String(50), nullable=True)
    vendor_outstanding = Column(Numeric(14, 2), nullable=True, default=0)

    # Invoice reference
    invoice_bill_no = Column(String(100), nullable=True)
    vendor_invoice_date = Column(DateTime, nullable=True)

    # Project / Property association
    construction_project_id = Column(Integer, nullable=True)
    property_id = Column(Integer, nullable=True)
    building = Column(String(100), nullable=True)
    floor = Column(String(50), nullable=True)
    unit_id = Column(Integer, nullable=True)
    maintenance_ticket_id = Column(Integer, nullable=True)
    purchase_order_id = Column(Integer, nullable=True)
    department = Column(String(100), nullable=True)

    # Totals (auto-calculated from items)
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(14, 2), nullable=False, default=0)
    adjustment = Column(Numeric(14, 2), nullable=False, default=0)
    amount = Column(Numeric(14, 2), nullable=False, default=0)
    paid_amount = Column(Numeric(14, 2), nullable=False, default=0)
    remaining_amount = Column(Numeric(14, 2), nullable=False, default=0)

    # Items stored as JSON for flexibility
    line_items = Column(JSON, nullable=True)

    # Budget
    approved_budget = Column(Numeric(14, 2), nullable=True)
    budget_used = Column(Numeric(14, 2), nullable=True)
    budget_remaining = Column(Numeric(14, 2), nullable=True)
    budget_exceeded = Column(Boolean, nullable=False, default=False)
    budget_approval_required = Column(Boolean, nullable=False, default=False)

    # Payment
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True, index=True)
    paid_from = Column(String(20), nullable=True)
    payment_method = Column(String(30), nullable=True)
    payment_status = Column(String(20), nullable=True, default="pending")
    paid_from_account_id = Column(Integer, nullable=True)
    bank_account = Column(String(100), nullable=True)
    transaction_reference = Column(String(100), nullable=True)
    payment_date = Column(DateTime, nullable=True)
    cheque_number = Column(String(50), nullable=True)

    # Approval workflow
    approval_status = Column(String(20), nullable=True, default="draft")
    approval_level = Column(Integer, nullable=True)
    approved_by = Column(Integer, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_by = Column(Integer, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    submitted_by = Column(Integer, nullable=True)
    submitted_at = Column(DateTime, nullable=True)

    # Recurring
    is_recurring = Column(Boolean, nullable=False, default=False)
    recurring_frequency = Column(String(20), nullable=True)
    next_due_date = Column(DateTime, nullable=True)
    recurring_end_date = Column(DateTime, nullable=True)

    # Notes
    internal_notes = Column(Text, nullable=True)
    vendor_notes = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)

    # Attachments
    receipt_path = Column(String(500), nullable=True)

    # Soft delete & timestamps
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_user_id = Column(Integer, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)

    # Relationships
    account = relationship("Account")
    vendor = relationship("Vendor", back_populates="expenses")
    items = relationship("ExpenseItem", back_populates="expense", cascade="all, delete-orphan",
                         order_by="ExpenseItem.sort_order")


class SyncLog(Base):
    """Cross-module sync failure log"""
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True)
    source_module = Column(String(20), nullable=False, index=True)
    source_record_type = Column(String(30), nullable=False)
    source_record_id = Column(Integer, nullable=False)
    action = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="failed")
    error_message = Column(Text, nullable=True)
    journal_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    retried_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)


class Vendor(Base):
    """ERP Vendor/Supplier Management - integrated with Accounts Payable"""
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True)
    vendor_code = Column(String(50), nullable=True, unique=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    contact_person = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    ntn = Column(String(50), nullable=True)
    strn = Column(String(50), nullable=True)
    payment_terms = Column(String(50), nullable=True)
    credit_limit = Column(Numeric(14, 2), nullable=True)
    outstanding_amount = Column(Numeric(14, 2), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)

    # Soft delete & timestamps
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_user_id = Column(Integer, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)

    # Relationships
    expenses = relationship("Expense", back_populates="vendor", foreign_keys=[Expense.vendor_id])


class AuditLog(Base):
    """Finance audit log - every action logged, non-deletable"""
    __tablename__ = "finance_audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(50), nullable=False)
    module = Column(String(50), nullable=False)
    record_type = Column(String(50), nullable=True)
    record_id = Column(String(50), nullable=True)
    description = Column(String(500), nullable=True)
    amount = Column(Numeric(14, 2), nullable=True)
    extra_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
