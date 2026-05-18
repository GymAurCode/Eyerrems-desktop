from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


# ==================== ACCOUNT SCHEMAS ====================

class AccountCreate(BaseModel):
    """Create new chart of accounts entry"""
    code: str = Field(..., min_length=1, max_length=40)
    name: str = Field(..., min_length=1, max_length=255)
    account_type: str  # Asset, Liability, Income, Expense, Equity
    parent_id: int | None = None
    description: str | None = None

    @field_validator("account_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"Asset", "Liability", "Income", "Expense", "Equity"}
        if v not in allowed:
            raise ValueError(f"account_type must be one of: {', '.join(allowed)}")
        return v


class AccountUpdate(BaseModel):
    """Update account"""
    name: str | None = None
    description: str | None = None
    parent_id: int | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    """Account response"""
    id: int
    code: str
    name: str
    account_type: str
    parent_id: int | None
    description: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AccountWithBalance(AccountResponse):
    """Account with computed balance"""
    balance: Decimal = Decimal("0")
    parent_name: str | None = None


class AccountTreeNode(BaseModel):
    """Hierarchical account node"""
    id: int
    code: str
    name: str
    account_type: str
    type: str  # alias
    description: str | None
    is_active: bool
    parent_id: int | None
    balance: Decimal = Decimal("0")
    children: list["AccountTreeNode"] = []


AccountTreeNode.model_rebuild()


# ==================== JOURNAL SCHEMAS ====================

class JournalEntryLineCreate(BaseModel):
    """Single line in journal entry"""
    account_id: int
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: str | None = None

    @field_validator("debit", "credit")
    @classmethod
    def validate_amount(cls, v):
        if v is None:
            return Decimal("0")
        v = Decimal(str(v))
        if v < 0:
            raise ValueError("Amounts must be non-negative")
        return v


class JournalCreate(BaseModel):
    """Create complete journal with entries"""
    reference_type: str  # invoice, payment, commission, manual
    reference_id: str | None = None
    description: str | None = None
    date: datetime | None = None
    lines: list[JournalEntryLineCreate]

    @field_validator("lines")
    @classmethod
    def validate_lines(cls, v):
        if not v or len(v) < 2:
            raise ValueError("Journal must have at least 2 lines")
        
        total_debit = sum(Decimal(str(line.debit)) for line in v)
        total_credit = sum(Decimal(str(line.credit)) for line in v)
        
        if total_debit != total_credit:
            raise ValueError(f"Debits ({total_debit}) must equal credits ({total_credit})")
        
        return v


class JournalEntryResponse(BaseModel):
    """Journal entry response"""
    id: int
    journal_id: int
    account_id: int
    debit: Decimal
    credit: Decimal
    description: str | None

    class Config:
        from_attributes = True


class JournalResponse(BaseModel):
    """Journal response"""
    id: int
    date: datetime
    reference_type: str
    reference_id: str | None
    description: str | None
    created_at: datetime
    entries: list[JournalEntryResponse]

    class Config:
        from_attributes = True


class LedgerEntryResponse(BaseModel):
    """Single ledger entry"""
    id: int
    date: datetime
    reference_type: str
    reference_id: str | None
    description: str | None
    debit: Decimal
    credit: Decimal
    balance: Decimal


# ==================== INVOICE SCHEMAS ====================

class InvoiceCreate(BaseModel):
    """Create invoice"""
    tenant_id: int
    property_id: int
    unit_id: int | None = None
    amount: Decimal
    due_date: datetime
    description: str | None = None


class InvoiceUpdate(BaseModel):
    """Update invoice"""
    amount: Decimal | None = None
    due_date: datetime | None = None
    status: str | None = None
    description: str | None = None


class InvoiceResponse(BaseModel):
    """Invoice response"""
    id: int
    tenant_id: int
    property_id: int
    unit_id: int | None
    amount: Decimal
    status: str
    due_date: datetime
    description: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== PAYMENT SCHEMAS ====================

class PaymentCreate(BaseModel):
    """Record payment"""
    invoice_id: int
    method: str  # cash, bank
    amount: Decimal
    date: datetime | None = None
    reference_number: str | None = None


class PaymentResponse(BaseModel):
    """Payment response"""
    id: int
    invoice_id: int
    method: str
    amount: Decimal
    date: datetime
    reference_number: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== COMMISSION SCHEMAS ====================

class CommissionCreate(BaseModel):
    """Record commission (smart workflow)"""
    dealer_id: int
    property_id: int
    deal_id: int | None = None
    sale_amount: Decimal | None = None
    commission_rate: Decimal | None = None
    amount: Decimal | None = None  # manual override when permitted
    type: str = "earned"  # earned, paid
    date: datetime | None = None
    reference: str | None = None
    description: str | None = None
    allow_override: bool = False


class CommissionResponse(BaseModel):
    """Commission response"""
    id: int
    agent_id: int | None = None
    dealer_id: int | None = None
    dealer_name: str | None = None
    dealer_code: str | None = None
    property_id: int
    property_code: str | None = None
    property_name: str | None = None
    deal_id: int | None = None
    deal_code: str | None = None
    sale_amount: Decimal | None = None
    commission_rate: Decimal | None = None
    calculated_amount: Decimal | None = None
    amount: Decimal
    type: str
    payment_status: str = "unpaid"
    date: datetime
    reference: str | None
    description: str | None
    journal_id: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class CommissionCalculateRequest(BaseModel):
    dealer_id: int
    property_id: int
    deal_id: int | None = None
    sale_amount: Decimal | None = None
    commission_rate: Decimal | None = None


class CommissionCalculateResponse(BaseModel):
    sale_amount: Decimal
    commission_rate: Decimal
    commission_type: str
    calculated_amount: Decimal


# ==================== REPORT SCHEMAS ====================

class TrialBalanceRow(BaseModel):
    """Trial balance row"""
    account_id: int
    code: str
    name: str
    type: str
    debit: Decimal
    credit: Decimal


class TrialBalanceResponse(BaseModel):
    """Trial balance report"""
    rows: list[TrialBalanceRow]
    total_debit: Decimal
    total_credit: Decimal


class ProfitLossRow(BaseModel):
    """P&L row"""
    account_id: int
    code: str
    name: str
    amount: Decimal


class ProfitLossResponse(BaseModel):
    """Profit and Loss report"""
    income: list[ProfitLossRow]
    expenses: list[ProfitLossRow]
    total_income: Decimal
    total_expenses: Decimal
    net_profit: Decimal


class GeneralLedgerResponse(BaseModel):
    """General ledger for account"""
    account_id: int
    code: str
    name: str
    type: str
    entries: list[LedgerEntryResponse]
    opening_balance: Decimal
    closing_balance: Decimal


# ==================== EXPENSE SCHEMAS ====================

class ExpenseCreate(BaseModel):
    """Record direct expense"""
    account_id: int
    paid_from: str  # cash, bank
    amount: Decimal
    date: datetime | None = None
    description: str
    reference: str | None = None


class ExpenseResponse(BaseModel):
    """Expense response with account details"""
    id: int
    account_id: int
    account_name: str
    account_code: str
    paid_from: str
    amount: Decimal
    date: datetime
    description: str
    reference: str | None
    created_at: datetime

    class Config:
        from_attributes = True

