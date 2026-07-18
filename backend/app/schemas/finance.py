from decimal import Decimal
from datetime import date as date_type, datetime

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
    narration: str | None = None
    description: str | None = None
    cost_center: str | None = None
    department: str | None = None
    project_id: int | None = None
    property_id: int | None = None
    building: str | None = None
    floor: str | None = None
    unit_id: int | None = None
    customer_id: int | None = None
    vendor_id: int | None = None
    employee_id: int | None = None
    tax_code: str | None = None
    tax_amount: Decimal | None = None
    reference: str | None = None
    memo: str | None = None
    sort_order: int = 0

    @field_validator("debit", "credit", "tax_amount")
    @classmethod
    def validate_amount(cls, v):
        if v is None:
            return Decimal("0")
        v = Decimal(str(v))
        if v < 0:
            raise ValueError("Amounts must be non-negative")
        return v


class JournalCreate(BaseModel):
    reference_type: str = "manual"
    reference_id: str | None = None
    description: str | None = None
    date: datetime | None = None
    source: str | None = "MANUAL"
    source_module: str | None = None
    source_document_id: int | None = None
    source_document_number: str | None = None
    source_document_status: str | None = None
    source_document_date: datetime | None = None
    internal_notes: str | None = None
    remarks: str | None = None
    approved_budget: Decimal | None = None
    budget_used: Decimal | None = None
    budget_remaining: Decimal | None = None
    budget_exceeded: bool = False
    budget_approval_required: bool = False
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


class JournalUpdate(BaseModel):
    description: str | None = None
    date: datetime | None = None
    reference_type: str | None = None
    reference_id: str | None = None
    internal_notes: str | None = None
    remarks: str | None = None
    lines: list[JournalEntryLineCreate] | None = None


class JournalSubmit(BaseModel):
    internal_notes: str | None = None


class JournalApprove(BaseModel):
    approval_level: int | None = None
    internal_notes: str | None = None


class JournalReverse(BaseModel):
    reason: str
    date: datetime | None = None
    internal_notes: str | None = None


class JournalReject(BaseModel):
    reason: str
    internal_notes: str | None = None


class JournalEntryResponse(BaseModel):
    id: int
    journal_id: int
    account_id: int
    debit: Decimal
    credit: Decimal
    narration: str | None = None
    description: str | None = None
    cost_center: str | None = None
    department: str | None = None
    project_id: int | None = None
    property_id: int | None = None
    building: str | None = None
    floor: str | None = None
    unit_id: int | None = None
    customer_id: int | None = None
    vendor_id: int | None = None
    employee_id: int | None = None
    tax_code: str | None = None
    tax_amount: Decimal | None = None
    reference: str | None = None
    memo: str | None = None
    sort_order: int = 0
    account_code: str | None = None
    account_name: str | None = None

    class Config:
        from_attributes = True


class JournalResponse(BaseModel):
    id: int
    journal_number: str | None = None
    date: datetime
    reference_type: str
    reference_id: str | None = None
    description: str | None = None
    source: str | None = "MANUAL"
    source_module: str | None = None
    source_document_id: int | None = None
    source_document_number: str | None = None
    source_document_status: str | None = None
    source_document_date: datetime | None = None
    status: str = "draft"
    is_editable: bool = True
    is_reversal: bool = False
    reversal_of: int | None = None
    reversal_reason: str | None = None
    approved_by: int | None = None
    approved_at: datetime | None = None
    posted_by: int | None = None
    posted_at: datetime | None = None
    submitted_by: int | None = None
    submitted_at: datetime | None = None
    rejected_by: int | None = None
    rejected_at: datetime | None = None
    rejection_reason: str | None = None
    internal_notes: str | None = None
    remarks: str | None = None
    approved_budget: Decimal | None = None
    budget_exceeded: bool = False
    created_at: datetime
    updated_at: datetime | None = None
    created_by_user_id: int | None = None
    company_id: int | None = None
    entries: list[JournalEntryResponse] = []
    dr_total: Decimal = Decimal("0")
    cr_total: Decimal = Decimal("0")
    balanced: bool = True

    class Config:
        from_attributes = True


class JournalListResponse(BaseModel):
    id: int
    journal_number: str | None = None
    date: datetime
    reference_type: str
    reference_id: str | None = None
    description: str | None = None
    source: str | None = "MANUAL"
    status: str = "draft"
    is_reversal: bool = False
    reversal_of: int | None = None
    created_at: datetime
    created_by_user_id: int | None = None
    entry_count: int = 0
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
    description: str = ""
    quantity: Decimal = Decimal("1")
    unit: str = ""
    unit_price: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    tax_pct: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")


class InvoiceItemResponse(BaseModel):
    id: int
    invoice_id: int
    description: str
    quantity: Decimal = Decimal("1")
    unit: str | None = None
    unit_price: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    tax_pct: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    line_total: Decimal = Decimal("0")
    sort_order: int = 0

    class Config:
        from_attributes = True


class AutoGenerateInvoice(BaseModel):
    source_module: str
    source_id: int
    party_type: str | None = None
    party_id: int | None = None
    due_date: datetime | None = None
    notes: str | None = None


class InvoiceCreate(BaseModel):
    invoice_date: datetime | None = None
    due_date: datetime
    invoice_type: str = "manual"
    currency: str = "PKR"

    line_items: list[InvoiceLineItem] = []

    party_type: str | None = None
    party_id: int | None = None
    client_id: int | None = None
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    client_cnic: str | None = None
    client_ntn: str | None = None
    client_address: str | None = None

    reference: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    deal_id: int | None = None
    booking_id: int | None = None
    lease_id: int | None = None
    property_id: int | None = None
    unit_id: int | None = None
    maintenance_ticket_id: int | None = None
    construction_project_id: int | None = None
    purchase_order_id: int | None = None
    contract_id: int | None = None

    payment_terms: str | None = "due_immediately"

    internal_notes: str | None = None
    customer_notes: str | None = None
    terms_conditions: str | None = None
    late_payment_policy: str | None = None
    footer_message: str | None = None

    auto_generated: bool = False
    source_module: str | None = None
    source_record_id: int | None = None

    tenant_id: int | None = None


class InvoiceUpdate(BaseModel):
    invoice_date: datetime | None = None
    due_date: datetime | None = None
    status: str | None = None
    invoice_type: str | None = None
    currency: str | None = None
    line_items: list[InvoiceLineItem] | None = None
    party_type: str | None = None
    party_id: int | None = None
    client_id: int | None = None
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    client_cnic: str | None = None
    client_ntn: str | None = None
    client_address: str | None = None
    reference: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    deal_id: int | None = None
    booking_id: int | None = None
    lease_id: int | None = None
    property_id: int | None = None
    unit_id: int | None = None
    maintenance_ticket_id: int | None = None
    construction_project_id: int | None = None
    purchase_order_id: int | None = None
    contract_id: int | None = None
    payment_terms: str | None = None
    internal_notes: str | None = None
    customer_notes: str | None = None
    terms_conditions: str | None = None
    late_payment_policy: str | None = None
    footer_message: str | None = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str | None = None
    invoice_date: datetime | None = None
    due_date: datetime
    status: str = "draft"
    invoice_type: str | None = "manual"
    currency: str = "PKR"

    subtotal: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    adjustment: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")
    paid_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")

    items: list[InvoiceItemResponse] = []

    party_type: str | None = None
    party_id: int | None = None
    client_id: int | None = None
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    client_cnic: str | None = None
    client_ntn: str | None = None
    client_address: str | None = None

    reference: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    deal_id: int | None = None
    booking_id: int | None = None
    lease_id: int | None = None
    property_id: int | None = None
    unit_id: int | None = None
    maintenance_ticket_id: int | None = None
    construction_project_id: int | None = None
    purchase_order_id: int | None = None
    contract_id: int | None = None

    payment_terms: str | None = "due_immediately"

    internal_notes: str | None = None
    customer_notes: str | None = None
    terms_conditions: str | None = None
    late_payment_policy: str | None = None
    footer_message: str | None = None

    auto_generated: bool = False
    source_module: str | None = None
    source_record_id: int | None = None

    sent_at: datetime | None = None
    viewed_at: datetime | None = None
    cancelled_at: datetime | None = None
    voided_at: datetime | None = None

    allocations: list["PaymentAllocationResponse"] = []

    tenant_id: int | None = None
    property_id: int | None = None
    unit_id: int | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InvoiceStatusFlow(BaseModel):
    status: str
    timestamp: datetime | None = None
    updated_by: str | None = None


class InvoiceReportRow(BaseModel):
    id: int
    invoice_number: str | None = None
    client_name: str | None = None
    invoice_type: str | None = None
    amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    status: str
    due_date: datetime
    invoice_date: datetime | None = None
    days_overdue: int = 0


# ==================== PAYMENT ALLOCATION SCHEMAS ====================

class PaymentAllocationCreate(BaseModel):
    invoice_id: int
    allocated_amount: Decimal = Field(..., gt=0)


class PaymentAllocationResponse(BaseModel):
    id: int
    payment_id: int
    invoice_id: int | None = None
    allocated_amount: Decimal
    invoice_number: str | None = None

    class Config:
        from_attributes = True


# ==================== PAYMENT SCHEMAS ====================

class PaymentMethodFields(BaseModel):
    bank_name: str | None = None
    branch_code: str | None = None
    account_number: str | None = None
    account_title: str | None = None
    cheque_number: str | None = None
    cheque_date: datetime | None = None
    cheque_type: str | None = None
    iban: str | None = None
    swift_code: str | None = None
    card_type: str | None = None
    card_last4: str | None = None
    card_holder: str | None = None
    card_expiry: str | None = None
    auth_code: str | None = None
    terminal_id: str | None = None
    transaction_id: str | None = None
    gateway: str | None = None
    gateway_fee: Decimal = Decimal("0")
    gateway_fee_paid_by: str | None = "customer"
    mobile_account: str | None = None
    payment_proof: str | None = None
    cash_denominations: str | None = None
    cash_received: Decimal = Decimal("0")
    cash_change: Decimal = Decimal("0")
    cashier_name: str | None = None
    counter: str | None = None


class PaymentCreate(BaseModel):
    payment_type: str = "against_invoice"
    method: str = "bank_transfer"
    amount: Decimal = Field(..., gt=0)
    date: datetime | None = None
    reference_number: str | None = None
    external_transaction_id: str | None = None
    received_by: str | None = None
    party_type: str | None = None
    party_id: int | None = None
    party_name: str | None = None
    party_phone: str | None = None
    party_email: str | None = None
    party_cnic: str | None = None
    party_address: str | None = None
    source: str | None = "MANUAL"
    source_id: int | None = None
    branch: str | None = None
    cash_counter: str | None = None
    method_fields: PaymentMethodFields | None = None
    internal_notes: str | None = None
    account_id: int | None = None
    allocations: list[PaymentAllocationCreate] = []


class PaymentUpdate(BaseModel):
    method: str | None = None
    reference_number: str | None = None
    external_transaction_id: str | None = None
    method_fields: PaymentMethodFields | None = None
    internal_notes: str | None = None


class PaymentReverse(BaseModel):
    reason: str = "Payment reversal"
    internal_notes: str | None = None


class PaymentRefund(BaseModel):
    refund_amount: Decimal | None = None
    reason: str = "Payment refund"
    method: str | None = None
    reference_number: str | None = None
    internal_notes: str | None = None


class PaymentReceipt(BaseModel):
    include_qr: bool = True
    include_barcode: bool = True
    include_company_logo: bool = True
    include_breakdown: bool = True
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: int
    payment_number: str | None = None
    receipt_number: str | None = None
    status: str = "completed"
    payment_type: str = "against_invoice"
    method: str
    amount: Decimal
    method_fields: dict | None = None
    date: datetime
    reference_number: str | None = None
    external_transaction_id: str | None = None
    received_by: str | None = None
    party_type: str | None = None
    party_id: int | None = None
    party_name: str | None = None
    party_phone: str | None = None
    party_email: str | None = None
    party_cnic: str | None = None
    party_address: str | None = None
    source: str | None = None
    source_id: int | None = None
    branch: str | None = None
    cash_counter: str | None = None
    posted_to_finance: bool = False
    finance_journal_id: int | None = None
    internal_notes: str | None = None
    allocations: list[PaymentAllocationResponse] = []
    attachments: list["PaymentAttachmentResponse"] = []
    completed_at: datetime | None = None
    reversed_at: datetime | None = None
    refunded_at: datetime | None = None
    cancelled_at: datetime | None = None
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    created_by_user_id: int | None = None

    class Config:
        from_attributes = True


class PaymentListResponse(BaseModel):
    id: int
    payment_number: str | None = None
    receipt_number: str | None = None
    status: str
    payment_type: str
    method: str
    amount: Decimal
    date: datetime
    reference_number: str | None = None
    party_name: str | None = None
    party_type: str | None = None
    created_at: datetime
    created_by_user_id: int | None = None

    class Config:
        from_attributes = True


class PaymentSearchInvoice(BaseModel):
    id: int
    invoice_number: str | None = None
    client_name: str | None = None
    client_phone: str | None = None
    amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    status: str
    due_date: datetime
    invoice_date: datetime | None = None
    invoice_type: str | None = None


class PaymentAttachmentResponse(BaseModel):
    id: int
    payment_id: int
    file_path: str
    file_name: str
    file_type: str | None = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ==================== CUSTOMER CREDIT SCHEMAS ====================

class CustomerCreditResponse(BaseModel):
    id: int
    party_type: str | None = None
    party_id: int | None = None
    party_name: str | None = None
    amount: Decimal
    remaining_amount: Decimal
    source: str
    source_payment_id: int | None = None
    invoice_id: int | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerCreditApply(BaseModel):
    invoice_id: int
    amount: Decimal = Field(..., gt=0)


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

class ExpenseLineItemCreate(BaseModel):
    description: str = ""
    category: str | None = None
    quantity: Decimal = Decimal("1")
    unit: str | None = None
    unit_cost: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    tax_pct: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    line_total: Decimal = Decimal("0")
    sort_order: int = 0


class ExpenseLineItemResponse(BaseModel):
    id: int
    expense_id: int
    description: str
    category: str | None = None
    quantity: Decimal
    unit: str | None = None
    unit_cost: Decimal
    discount_pct: Decimal
    tax_pct: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    line_total: Decimal
    sort_order: int

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    expense_date: datetime | None = None
    expense_type: str = "miscellaneous"
    currency: str = "PKR"
    expense_source: str | None = None
    source_id: int | None = None
    source_reference: str | None = None
    vendor_id: int | None = None
    vendor_name: str | None = None
    vendor_phone: str | None = None
    vendor_email: str | None = None
    vendor_address: str | None = None
    vendor_ntn: str | None = None
    vendor_strn: str | None = None
    invoice_bill_no: str | None = None
    vendor_invoice_date: datetime | None = None
    construction_project_id: int | None = None
    property_id: int | None = None
    building: str | None = None
    floor: str | None = None
    unit_id: int | None = None
    maintenance_ticket_id: int | None = None
    purchase_order_id: int | None = None
    department: str | None = None
    line_items: list[ExpenseLineItemCreate] = []
    subtotal: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    adjustment: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")
    approved_budget: Decimal | None = None
    budget_used: Decimal | None = None
    budget_remaining: Decimal | None = None
    budget_exceeded: bool = False
    budget_approval_required: bool = False
    account_id: int | None = None
    paid_from: str | None = None
    payment_method: str | None = None
    payment_status: str | None = "pending"
    paid_from_account_id: int | None = None
    bank_account: str | None = None
    transaction_reference: str | None = None
    payment_date: datetime | None = None
    cheque_number: str | None = None
    is_recurring: bool = False
    recurring_frequency: str | None = None
    next_due_date: datetime | None = None
    recurring_end_date: datetime | None = None
    internal_notes: str | None = None
    vendor_notes: str | None = None
    remarks: str | None = None


class ExpenseUpdate(BaseModel):
    expense_date: datetime | None = None
    expense_type: str | None = None
    currency: str | None = None
    expense_source: str | None = None
    source_id: int | None = None
    source_reference: str | None = None
    vendor_id: int | None = None
    vendor_name: str | None = None
    vendor_phone: str | None = None
    vendor_email: str | None = None
    vendor_address: str | None = None
    vendor_ntn: str | None = None
    vendor_strn: str | None = None
    invoice_bill_no: str | None = None
    vendor_invoice_date: datetime | None = None
    construction_project_id: int | None = None
    property_id: int | None = None
    building: str | None = None
    floor: str | None = None
    unit_id: int | None = None
    maintenance_ticket_id: int | None = None
    purchase_order_id: int | None = None
    department: str | None = None
    line_items: list[ExpenseLineItemCreate] | None = None
    adjustment: Decimal | None = None
    payment_method: str | None = None
    payment_status: str | None = None
    paid_from_account_id: int | None = None
    bank_account: str | None = None
    transaction_reference: str | None = None
    payment_date: datetime | None = None
    cheque_number: str | None = None
    internal_notes: str | None = None
    vendor_notes: str | None = None
    remarks: str | None = None


class ExpenseSubmit(BaseModel):
    notes: str | None = None


class ExpenseApprove(BaseModel):
    notes: str | None = None
    approval_level: int | None = None


class ExpenseReject(BaseModel):
    reason: str
    notes: str | None = None


class ExpenseRecordPayment(BaseModel):
    amount: Decimal
    payment_method: str = "bank_transfer"
    paid_from: str = "bank"
    paid_from_account_id: int | None = None
    bank_account: str | None = None
    transaction_reference: str | None = None
    payment_date: datetime | None = None
    cheque_number: str | None = None
    notes: str | None = None


class ExpenseResponse(BaseModel):
    id: int
    expense_number: str | None = None
    expense_date: datetime
    expense_type: str = "miscellaneous"
    status: str = "draft"
    currency: str = "PKR"
    expense_source: str | None = None
    source_id: int | None = None
    source_reference: str | None = None
    vendor_id: int | None = None
    vendor_name: str | None = None
    vendor_phone: str | None = None
    vendor_email: str | None = None
    vendor_address: str | None = None
    vendor_ntn: str | None = None
    vendor_strn: str | None = None
    vendor_outstanding: Decimal | None = None
    invoice_bill_no: str | None = None
    vendor_invoice_date: datetime | None = None
    construction_project_id: int | None = None
    property_id: int | None = None
    building: str | None = None
    floor: str | None = None
    unit_id: int | None = None
    maintenance_ticket_id: int | None = None
    purchase_order_id: int | None = None
    department: str | None = None
    subtotal: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    adjustment: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")
    paid_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    line_items: list[ExpenseLineItemResponse] = []
    approved_budget: Decimal | None = None
    budget_used: Decimal | None = None
    budget_remaining: Decimal | None = None
    budget_exceeded: bool = False
    budget_approval_required: bool = False
    account_id: int | None = None
    account_name: str | None = None
    account_code: str | None = None
    paid_from: str | None = None
    payment_method: str | None = None
    payment_status: str | None = "pending"
    paid_from_account_id: int | None = None
    bank_account: str | None = None
    transaction_reference: str | None = None
    payment_date: datetime | None = None
    cheque_number: str | None = None
    approval_status: str | None = "draft"
    approval_level: int | None = None
    approved_by: int | None = None
    approved_at: datetime | None = None
    rejected_by: int | None = None
    rejected_at: datetime | None = None
    rejection_reason: str | None = None
    submitted_by: int | None = None
    submitted_at: datetime | None = None
    is_recurring: bool = False
    recurring_frequency: str | None = None
    next_due_date: datetime | None = None
    recurring_end_date: datetime | None = None
    internal_notes: str | None = None
    vendor_notes: str | None = None
    remarks: str | None = None
    receipt_path: str | None = None
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    created_by_user_id: int | None = None

    class Config:
        from_attributes = True


class ExpenseListResponse(BaseModel):
    id: int
    expense_number: str | None = None
    expense_date: datetime
    expense_type: str
    status: str
    vendor_name: str | None = None
    vendor_id: int | None = None
    invoice_bill_no: str | None = None
    amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    payment_status: str | None = None
    approval_status: str | None = None
    department: str | None = None
    expense_source: str | None = None
    created_at: datetime
    created_by_user_id: int | None = None

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


# ── VENDOR ─────────────────────────────────────────────────────────────────────

class VendorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    ntn: str | None = None
    strn: str | None = None
    payment_terms: str | None = None
    credit_limit: Decimal | None = None
    is_active: bool = True
    notes: str | None = None


class VendorUpdate(BaseModel):
    name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    ntn: str | None = None
    strn: str | None = None
    payment_terms: str | None = None
    credit_limit: Decimal | None = None
    is_active: bool | None = None
    notes: str | None = None


class VendorResponse(BaseModel):
    id: int
    vendor_code: str | None = None
    name: str
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    ntn: str | None = None
    strn: str | None = None
    payment_terms: str | None = None
    credit_limit: Decimal | None = None
    outstanding_amount: Decimal = Decimal("0")
    is_active: bool = True
    notes: str | None = None
    deleted_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class DayBookEntry(BaseModel):
    journal_id: int
    journal_number: str | None = None
    date: date_type
    reference_type: str
    description: str | None = None
    source: str | None = None
    account_code: str
    account_name: str
    debit: Decimal
    credit: Decimal


class DayBookResponse(BaseModel):
    date: date_type | None = None
    entries: list[DayBookEntry]
    total_debit: Decimal
    total_credit: Decimal


class CashBookEntry(BaseModel):
    journal_id: int
    journal_number: str | None = None
    date: date_type | str
    reference_type: str
    description: str | None = None
    debit: Decimal
    credit: Decimal
    balance: Decimal


class CashBookResponse(BaseModel):
    opening_balance: Decimal
    entries: list[CashBookEntry]
    total_receipts: Decimal
    total_payments: Decimal
    closing_balance: Decimal


class BankBookEntry(BaseModel):
    journal_id: int
    journal_number: str | None = None
    date: date_type | str
    reference_type: str
    description: str | None = None
    debit: Decimal
    credit: Decimal
    balance: Decimal


class BankBookResponse(BaseModel):
    opening_balance: Decimal
    entries: list[BankBookEntry]
    total_deposits: Decimal
    total_withdrawals: Decimal
    closing_balance: Decimal
