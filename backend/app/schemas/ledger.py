"""Pydantic schemas for the Ledger module."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Shared ────────────────────────────────────────────────────────────────────

class LedgerSummary(BaseModel):
    total_debit:       Decimal
    total_credit:      Decimal
    opening_balance:   Decimal
    closing_balance:   Decimal
    entry_count:       int


# ── Client Ledger ─────────────────────────────────────────────────────────────

class ClientLedgerEntryCreate(BaseModel):
    client_id:      int
    journal_id:     Optional[int]   = None
    entry_date:     datetime
    description:    str
    reference_no:   Optional[str]   = None
    entry_type:     str             # booking|installment|refund|discount|tax|adjustment|penalty|transfer
    debit:          Decimal         = Decimal("0")
    credit:         Decimal         = Decimal("0")
    payment_method: Optional[str]   = None
    status:         str             = "posted"
    notes:          Optional[str]   = None


class ClientLedgerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              int
    tid:             str
    client_id:       int
    client_name:     Optional[str]  = None
    client_code:     Optional[str]  = None
    journal_id:      Optional[int]  = None
    entry_date:      datetime
    description:     str
    reference_no:    Optional[str]  = None
    entry_type:      str
    debit:           Decimal
    credit:          Decimal
    running_balance: Decimal
    payment_method:  Optional[str]  = None
    status:          str
    notes:           Optional[str]  = None
    created_by_name: Optional[str]  = None
    created_at:      datetime


class ClientLedgerResponse(BaseModel):
    client_id:   int
    client_name: str
    client_code: str
    entries:     list[ClientLedgerEntryResponse]
    summary:     LedgerSummary


# ── Dealer Ledger ─────────────────────────────────────────────────────────────

class DealerLedgerEntryCreate(BaseModel):
    dealer_id:       int
    deal_id:         Optional[int]     = None
    journal_id:      Optional[int]     = None
    entry_date:      datetime
    description:     str
    reference_no:    Optional[str]     = None
    entry_type:      str               # commission|payout|adjustment|bonus|penalty
    commission_rate: Optional[Decimal] = None
    gross_commission:Optional[Decimal] = None
    debit:           Decimal           = Decimal("0")
    credit:          Decimal           = Decimal("0")
    status:          str               = "posted"
    notes:           Optional[str]     = None


class DealerLedgerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              int
    tid:             str
    dealer_id:       int
    dealer_name:     Optional[str]  = None
    deal_id:         Optional[int]  = None
    deal_ref:        Optional[str]  = None
    journal_id:      Optional[int]  = None
    entry_date:      datetime
    description:     str
    reference_no:    Optional[str]  = None
    entry_type:      str
    commission_rate: Optional[Decimal] = None
    gross_commission:Optional[Decimal] = None
    debit:           Decimal
    credit:          Decimal
    running_balance: Decimal
    status:          str
    notes:           Optional[str]  = None
    created_by_name: Optional[str]  = None
    created_at:      datetime


class DealerLedgerResponse(BaseModel):
    dealer_id:   int
    dealer_name: str
    dealer_code: str
    entries:     list[DealerLedgerEntryResponse]
    summary:     LedgerSummary


# ── Property Ledger ───────────────────────────────────────────────────────────

class PropertyLedgerEntryCreate(BaseModel):
    property_id:  int
    client_id:    Optional[int]  = None
    journal_id:   Optional[int]  = None
    entry_date:   datetime
    description:  str
    reference_no: Optional[str]  = None
    entry_type:   str            # booking|installment|tax|transfer_fee|development|refund|ownership_transfer
    debit:        Decimal        = Decimal("0")
    credit:       Decimal        = Decimal("0")
    status:       str            = "posted"
    notes:        Optional[str]  = None


class PropertyLedgerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              int
    tid:             str
    property_id:     int
    property_name:   Optional[str]  = None
    property_tid:    Optional[str]  = None
    client_id:       Optional[int]  = None
    client_name:     Optional[str]  = None
    journal_id:      Optional[int]  = None
    entry_date:      datetime
    description:     str
    reference_no:    Optional[str]  = None
    entry_type:      str
    debit:           Decimal
    credit:          Decimal
    running_balance: Decimal
    status:          str
    notes:           Optional[str]  = None
    created_by_name: Optional[str]  = None
    created_at:      datetime


class PropertyLedgerResponse(BaseModel):
    property_id:   int
    property_name: str
    property_tid:  str
    entries:       list[PropertyLedgerEntryResponse]
    summary:       LedgerSummary
