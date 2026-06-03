from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


# ==================== ACCOUNT SCHEMAS ====================

class AccountCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=40)
    name: str = Field(..., min_length=1, max_length=255)
    account_type: str
    parent_id: int | None = None
    description: str | None = None
    is_system_account: bool = False
    opening_balance: Decimal = Decimal("0")
    opening_balance_date: datetime | None = None

    @field_validator("account_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"Asset", "Liability", "Income", "Expense", "Equity"}
        if v not in allowed:
            raise ValueError(f"account_type must be one of: {', '.join(allowed)}")
        return v


class AccountUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    parent_id: int | None = None
    is_active: bool | None = None
    is_system_account: bool | None = None
    opening_balance: Decimal | None = None
    opening_balance_date: datetime | None = None


class AccountResponse(BaseModel):
    id: int
    code: str
    name: str
    account_type: str
    parent_id: int | None
    description: str | None
    is_active: bool
    is_system_account: bool = False
    opening_balance: Decimal = Decimal("0")
    opening_balance_date: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AccountWithBalance(AccountResponse):
    balance: Decimal = Decimal("0")
    parent_name: str | None = None


class AccountTreeNode(BaseModel):
    id: int
    code: str
    name: str
    account_type: str
    type: str
    description: str | None
    is_active: bool
    is_system_account: bool = False
    parent_id: int | None
    balance: Decimal = Decimal("0")
    opening_balance: Decimal = Decimal("0")
    children: list["AccountTreeNode"] = []


AccountTreeNode.model_rebuild()


# ==================== JOURNAL SCHEMAS ====================

class JournalEntryLineCreate(BaseModel):
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
    reference_type: str
    reference_id: str | None = None
    description: str | None = None
    date: datetime | None = None
    source: str | None = "MANUAL"
    is_editable: bool = True
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
    id: int
    journal_id: int
    account_id: int
    debit: Decimal
    credit: Decimal
    description: str | None
    account_code: str | None = None
    account_name: str | None = None

    class Config:
        from_attributes = True


class JournalResponse(BaseModel):
    id: int
    date: datetime
    reference_type: str
    reference_id: str | None
    description: str | None
    source: str | None = "MANUAL"
    is_editable: bool = True
    created_at: datetime
    entries: list[JournalEntryResponse]
    dr_total: Decimal = Decimal("0")
    cr_total: Decimal = Decimal("0")
    balanced: bool = True

    class Config:
        from_attributes = True


class LedgerEntryResponse(BaseModel):
    id: int
    date: datetime
    reference_type: str
    reference_id: str | None
    description: str | None
    debit: Decimal
    credit: Decimal
    balance: Decimal


# ==================== INVOICE SCHEMAS ====================

class InvoiceLineItem(BaseModel):
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    tax_pct: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")


class InvoiceCreate(BaseModel):
    tenant_id: int | None = None
    property_id: int | None = None
    unit_id: int | None = None
    amount: Decimal
    due_date: datetime
    description: str | None = None
    invoice_type: str = "rent"
    client_id: int | None = None
    client_name: str | None = None
    reference: str | None = None
    line_items: list[InvoiceLineItem] = []
    dr_account_id: int | None = None
    cr_account_id: int | None = None


class InvoiceUpdate(BaseModel):
    amount: Decimal | None = None
    due_date: datetime | None = None
    status: str | None = None
    description: str | None = None


class InvoiceResponse(BaseModel):
    id: int
    tenant_id: int | None = None
    property_id: int | None = None
    unit_id: int | None = None
    amount: Decimal
    status: str
    due_date: datetime
    description: str | None = None
    invoice_type: str | None = "rent"
    client_id: int | None = None
    client_name: str | None = None
    reference: str | None = None
    paid_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== PAYMENT SCHEMAS ====================

class PaymentCreate(BaseModel):
    invoice_id: int | None = None
    method: str = "bank"
    amount: Decimal
    date: datetime | None = None
    reference_number: str | None = None
    received_from: str | None = None
    payment_type: str | None = "manual"
    source: str | None = "MANUAL"
    source_id: int | None = None
    notes: str | None = None
    account_id: int | None = None


class PaymentResponse(BaseModel):
    id: int
    invoice_id: int | None = None
    method: str
    amount: Decimal
    date: datetime
    reference_number: str | None = None
    received_from: str | None = None
    payment_type: str | None = None
    source: str | None = None
    source_id: int | None = None
    posted_to_finance: bool = False
    finance_journal_id: int | None = None
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== COMMISSION SCHEMAS ====================

class CommissionCreate(BaseModel):
    dealer_id: int
    property_id: int
    deal_id: int | None = None
    sale_amount: Decimal | None = None
    commission_rate: Decimal | None = None
    amount: Decimal | None = None
    type: str = "earned"
    date: datetime | None = None
    reference: str | None = None
    description: str | None = None
    allow_override: bool = False


class CommissionResponse(BaseModel):
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
    account_id: int
    code: str
    name: str
    type: str
    debit: Decimal
    credit: Decimal


class TrialBalanceResponse(BaseModel):
    rows: list[TrialBalanceRow]
    total_debit: Decimal
    total_credit: Decimal


class ProfitLossRow(BaseModel):
    account_id: int
    code: str
    name: str
    amount: Decimal


class ProfitLossResponse(BaseModel):
    income: list[ProfitLossRow]
    expenses: list[ProfitLossRow]
    total_income: Decimal
    total_expenses: Decimal
    net_profit: Decimal


class GeneralLedgerResponse(BaseModel):
    account_id: int
    code: str
    name: str
    type: str
    entries: list[LedgerEntryResponse]
    opening_balance: Decimal
    closing_balance: Decimal


# ==================== EXPENSE SCHEMAS ====================

class ExpenseCreate(BaseModel):
    account_id: int
    paid_from: str
    amount: Decimal
    date: datetime | None = None
    description: str
    reference: str | None = None
    vendor_name: str | None = None
    invoice_bill_no: str | None = None
    payment_method: str | None = None
    payment_status: str | None = "pending"
    paid_from_account_id: int | None = None
    property_id: int | None = None
    department: str | None = None
    is_recurring: bool = False
    recurring_frequency: str | None = None
    next_due_date: datetime | None = None
    recurring_end_date: datetime | None = None


class ExpenseResponse(BaseModel):
    id: int
    account_id: int
    account_name: str = ""
    account_code: str = ""
    paid_from: str
    amount: Decimal
    date: datetime
    description: str
    reference: str | None = None
    vendor_name: str | None = None
    invoice_bill_no: str | None = None
    payment_method: str | None = None
    payment_status: str | None = "pending"
    paid_from_account_id: int | None = None
    property_id: int | None = None
    department: str | None = None
    is_recurring: bool = False
    recurring_frequency: str | None = None
    next_due_date: datetime | None = None
    recurring_end_date: datetime | None = None
    approval_status: str | None = "submitted"
    approved_by: int | None = None
    approved_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== SYNC SCHEMAS ====================

class SyncPostResponse(BaseModel):
    success: bool
    journal_id: int | None = None
    message: str = ""


class SyncStatusResponse(BaseModel):
    posted_to_finance: bool = False
    finance_journal_id: int | None = None
    status: str = "pending"
    error_message: str | None = None
    log_id: int | None = None


# ==================== DASHBOARD SCHEMAS ====================

class DashboardKPI(BaseModel):
    label: str
    value: Decimal
    change_vs_last_month: Decimal = Decimal("0")
    trend_up: bool = True


class DashboardResponse(BaseModel):
    bank_balance: DashboardKPI
    cash_balance: DashboardKPI
    total_income: DashboardKPI
    total_expenses: DashboardKPI
    net_profit: DashboardKPI
    pending_receivables: DashboardKPI
    overdue_invoices: DashboardKPI
    commission_payable: DashboardKPI


class MonthlyIncomeExpense(BaseModel):
    month: str
    income: Decimal
    expense: Decimal


class CashFlowPoint(BaseModel):
    date: str
    balance: Decimal


class InvoiceStatusCount(BaseModel):
    status: str
    count: int
    amount: Decimal


class BankCashPosition(BaseModel):
    account_id: int
    code: str
    name: str
    balance: Decimal
    last_transaction_date: datetime | None = None
    status: str = "active"
