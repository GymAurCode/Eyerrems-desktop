from decimal import Decimal
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

# Valid operation types
OPERATION_TYPES = {"REVENUE", "EXPENSE", "REFUND", "TRANSFER", "ADJUSTMENT", "MERGE"}

# Sub-types per operation
REVENUE_SUB_TYPES = {"rent_received", "income_entry", "security_deposit_received"}
EXPENSE_SUB_TYPES = {"maintenance_cost", "salary", "utility_bills"}
REFUND_SUB_TYPES  = {"rent_refund", "deposit_return", "overpayment_correction"}
ADJUSTMENT_SUB_TYPES = {"correction", "discount", "tax_adjustment"}


# ── Revenue ───────────────────────────────────────────────────────────────────

class RevenueCreate(BaseModel):
    sub_type: str = Field(..., description="rent_received | income_entry | security_deposit_received")
    amount: Decimal = Field(..., gt=0)
    credit_account_id: int   # Income / Liability account to credit
    debit_account_id: int    # Cash / Bank / AR account to debit
    description: str = Field(..., min_length=1)
    entity_type: str | None = None   # tenant | property
    entity_id: int | None = None
    date: datetime | None = None

    @field_validator("sub_type")
    @classmethod
    def validate_sub(cls, v: str) -> str:
        if v not in REVENUE_SUB_TYPES:
            raise ValueError(f"sub_type must be one of: {', '.join(REVENUE_SUB_TYPES)}")
        return v

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


# ── Expense ───────────────────────────────────────────────────────────────────

class ExpenseOpCreate(BaseModel):
    sub_type: str = Field(..., description="maintenance_cost | salary | utility_bills")
    amount: Decimal = Field(..., gt=0)
    debit_account_id: int    # Expense account to debit
    credit_account_id: int   # Cash / Bank account to credit
    description: str = Field(..., min_length=1)
    entity_type: str | None = None
    entity_id: int | None = None
    date: datetime | None = None

    @field_validator("sub_type")
    @classmethod
    def validate_sub(cls, v: str) -> str:
        if v not in EXPENSE_SUB_TYPES:
            raise ValueError(f"sub_type must be one of: {', '.join(EXPENSE_SUB_TYPES)}")
        return v

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


# ── Refund ────────────────────────────────────────────────────────────────────

class RefundCreate(BaseModel):
    sub_type: str = "rent_refund"
    original_journal_id: int
    refund_amount: Decimal = Field(..., gt=0)
    reason: str = Field(..., min_length=1)

    @field_validator("sub_type")
    @classmethod
    def validate_sub(cls, v: str) -> str:
        if v not in REFUND_SUB_TYPES:
            raise ValueError(f"sub_type must be one of: {', '.join(REFUND_SUB_TYPES)}")
        return v

    @field_validator("refund_amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Refund amount must be positive")
        return v


# ── Transfer ──────────────────────────────────────────────────────────────────

class TransferCreate(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: Decimal = Field(..., gt=0)
    note: str | None = None

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Transfer amount must be positive")
        return v


# ── Adjustment ────────────────────────────────────────────────────────────────

class AdjustmentCreate(BaseModel):
    sub_type: str = Field(..., description="correction | discount | tax_adjustment")
    debit_account_id: int
    credit_account_id: int
    amount: Decimal = Field(..., gt=0)
    reason: str = Field(..., min_length=1)
    entity_type: str | None = None
    entity_id: int | None = None
    date: datetime | None = None

    @field_validator("sub_type")
    @classmethod
    def validate_sub(cls, v: str) -> str:
        if v not in ADJUSTMENT_SUB_TYPES:
            raise ValueError(f"sub_type must be one of: {', '.join(ADJUSTMENT_SUB_TYPES)}")
        return v

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


# ── Merge ─────────────────────────────────────────────────────────────────────

class MergeCreate(BaseModel):
    source_account_id: int
    target_account_id: int
    note: str | None = None


# ── Response ──────────────────────────────────────────────────────────────────

class FinanceOperationResponse(BaseModel):
    id: int
    type: str
    sub_type: str | None = None
    journal_id: int
    reference_journal_id: int | None
    from_account_id: int | None
    to_account_id: int | None
    from_account_name: str | None = None
    to_account_name: str | None = None
    amount: Decimal
    reason: str | None
    meta: dict | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True
