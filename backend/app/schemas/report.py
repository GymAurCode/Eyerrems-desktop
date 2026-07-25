from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Report Settings ────────────────────────────────────────────────────────────

class ReportSettingsBase(BaseModel):
    company_name: str = ""
    tagline: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    email: Optional[str] = ""
    uan_helpline: Optional[str] = ""
    website: Optional[str] = ""
    reg_no: Optional[str] = ""
    logo_url: Optional[str] = ""
    show_logo_watermark: bool = True
    currency_symbol: str = "PKR"
    currency_code: str = "PKR"
    thousands_separator: str = ","
    decimal_places: int = 2
    default_paper_size: str = "A4"
    default_orientation: str = "portrait"
    show_seal_config: Optional[str] = None
    footer_note: Optional[str] = ""


class ReportSettingsCreate(ReportSettingsBase):
    pass


class ReportSettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    uan_helpline: Optional[str] = None
    website: Optional[str] = None
    reg_no: Optional[str] = None
    logo_url: Optional[str] = None
    show_logo_watermark: Optional[bool] = None
    currency_symbol: Optional[str] = None
    currency_code: Optional[str] = None
    thousands_separator: Optional[str] = None
    decimal_places: Optional[int] = None
    default_paper_size: Optional[str] = None
    default_orientation: Optional[str] = None
    show_seal_config: Optional[str] = None
    footer_note: Optional[str] = None


class ReportSettingsResponse(ReportSettingsBase):
    id: int
    company_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Report Generation ──────────────────────────────────────────────────────────

class ReportGenerateRequest(BaseModel):
    report_type: str
    entity_id: Optional[int] = None
    filters: Optional[Dict[str, Any]] = None
    output_format: str = "html"  # html | pdf | xlsx
    paper_size: Optional[str] = None
    orientation: Optional[str] = None
    settings_overrides: Optional[Dict[str, Any]] = None  # per-report override of global ReportSettings
    prepared_for: Optional[str] = None
    prepared_by: Optional[str] = None
    note: Optional[str] = None


class ReportGenerateResponse(BaseModel):
    success: bool
    message: str = ""
    filename: Optional[str] = None
    html: Optional[str] = None
    download_url: Optional[str] = None


# ── Report Data Structures (used by mappers → template) ────────────────────────

class ReportLetterhead(BaseModel):
    title: str
    subtitle: Optional[str] = None
    reference_no: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None


class ReportInfoRow(BaseModel):
    label: str
    value: str


class ReportInfoGrid(BaseModel):
    left_column: List[ReportInfoRow] = []
    right_column: List[ReportInfoRow] = []


class ReportFinancialStripCell(BaseModel):
    label: str
    value: str
    inverted: bool = False


class ReportLedgerColumn(BaseModel):
    key: str
    label: str
    align: str = "left"
    format: Optional[str] = None  # currency | date | text


class ReportLedgerRow(BaseModel):
    cells: List[str] = []
    is_milestone: bool = False
    is_total: bool = False
    is_subtotal: bool = False
    status: Optional[str] = None  # paid | partial | pending | overdue


class ReportLedgerSection(BaseModel):
    columns: List[ReportLedgerColumn]
    rows: List[ReportLedgerRow]
    totals_row: Optional[ReportLedgerRow] = None


class ReportTerms(BaseModel):
    text: str


class ReportSignatureRow(BaseModel):
    customer_label: str = "Customer"
    customer_name: str = ""
    authorized_label: str = "Authorized Signatory"
    authorized_name: str = ""
    company_stamp_label: str = "Company Stamp"


class ReportData(BaseModel):
    letterhead: ReportLetterhead
    info_grid: ReportInfoGrid
    financial_strip: List[ReportFinancialStripCell] = []
    ledger: ReportLedgerSection
    terms: ReportTerms
    signature: ReportSignatureRow
    entity_info: Optional[List[ReportInfoRow]] = None  # property/entity details for the dedicated section
