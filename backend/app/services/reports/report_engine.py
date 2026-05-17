"""
Core Report Engine — Reusable base for all report types.

Provides:
  - ReportFilter: standardized filter model
  - ReportPagination: pagination model
  - ReportResult: standardized result wrapper
  - BaseReportService: base class for all report services
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session


# ── Filter Models ─────────────────────────────────────────────────────────────

@dataclass
class DateRange:
    """Date range filter."""
    start: Optional[date] = None
    end: Optional[date] = None


@dataclass
class ReportFilter:
    """
    Universal filter model for all reports.
    Each report service picks the fields it needs.
    """
    # Date range
    date_from: Optional[date] = None
    date_to: Optional[date] = None

    # Search
    search: Optional[str] = None

    # Status filters
    status: Optional[str] = None
    statuses: List[str] = field(default_factory=list)

    # Entity filters
    client_id: Optional[int] = None
    dealer_id: Optional[int] = None
    property_id: Optional[int] = None
    unit_id: Optional[int] = None
    project_id: Optional[int] = None
    town_id: Optional[int] = None
    block_id: Optional[int] = None
    tenant_id: Optional[int] = None
    booking_id: Optional[int] = None
    employee_id: Optional[int] = None
    account_id: Optional[int] = None

    # Category / type filters
    category: Optional[str] = None
    property_type: Optional[str] = None
    payment_method: Optional[str] = None
    lead_source: Optional[str] = None

    # Amount range
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None

    # Sorting
    sort_by: Optional[str] = None
    sort_order: str = "asc"  # asc | desc

    # Pagination
    page: int = 1
    page_size: int = 50

    # Export mode (skip pagination for exports)
    export_mode: bool = False

    # Company isolation
    company_id: Optional[int] = None

    # Extra dynamic filters
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportColumn:
    """Column definition for tabular reports."""
    key: str
    label: str
    data_type: str = "string"  # string | number | date | currency | percentage | badge
    width: Optional[str] = None
    align: str = "left"  # left | center | right
    sortable: bool = True
    visible: bool = True
    format: Optional[str] = None  # date format, number format, etc.
    badge_map: Optional[Dict[str, str]] = None  # status → color mapping


@dataclass
class ReportSummary:
    """Summary cards / KPIs for the report header."""
    label: str
    value: Any
    sub_label: Optional[str] = None
    color: str = "blue"  # blue | green | red | yellow | purple | gray
    icon: Optional[str] = None
    format: str = "number"  # number | currency | percentage | text


@dataclass
class ReportMeta:
    """Report metadata for header/footer rendering."""
    title: str
    subtitle: Optional[str] = None
    category: str = ""
    generated_at: datetime = field(default_factory=datetime.utcnow)
    generated_by: str = ""
    company_name: str = ""
    company_logo: Optional[str] = None
    filters_applied: Dict[str, Any] = field(default_factory=dict)
    total_records: int = 0
    page: int = 1
    total_pages: int = 1
    report_id: Optional[str] = None  # For QR verification
    currency_symbol: str = "₨"  # Dynamic currency symbol (PKR=₨, USD=$)


@dataclass
class ReportResult:
    """
    Standardized report result returned by all report services.
    Frontend consumes this directly for rendering, PDF, and Excel.
    """
    meta: ReportMeta
    columns: List[ReportColumn]
    rows: List[Dict[str, Any]]
    summary: List[ReportSummary] = field(default_factory=list)
    sub_tables: Dict[str, Any] = field(default_factory=dict)  # For nested/grouped data
    chart_data: Optional[Dict[str, Any]] = None  # For chart-enabled reports
    generation_time_ms: int = 0
    error: Optional[str] = None


# ── Base Report Service ───────────────────────────────────────────────────────

class BaseReportService:
    """
    Base class for all report services.
    Subclasses implement `generate()` and optionally `get_summary()`.
    """

    REPORT_KEY: str = ""
    REPORT_NAME: str = ""
    REPORT_CATEGORY: str = ""
    REPORT_TYPE: str = "tabular"  # tabular | ledger | profile | financial_statement | summary

    def __init__(self, db: Session, company_id: int, current_user_name: str = "System", currency_symbol: str = "₨"):
        self.db = db
        self.company_id = company_id
        self.current_user_name = current_user_name
        self.currency_symbol = currency_symbol

    def generate(self, filters: ReportFilter) -> ReportResult:
        """Override in subclass to generate report data."""
        raise NotImplementedError

    def _start_timer(self) -> float:
        return time.time()

    def _elapsed_ms(self, start: float) -> int:
        return int((time.time() - start) * 1000)

    def _make_meta(
        self,
        title: str,
        filters: ReportFilter,
        total_records: int,
        subtitle: Optional[str] = None,
        company_name: str = "",
        generated_by: str = "",
    ) -> ReportMeta:
        """Build standard report metadata."""
        page = filters.page if not filters.export_mode else 1
        page_size = filters.page_size if not filters.export_mode else total_records or 1
        total_pages = max(1, (total_records + page_size - 1) // page_size) if not filters.export_mode else 1

        # Build human-readable filter summary
        filters_applied: Dict[str, Any] = {}
        if filters.date_from:
            filters_applied["From"] = str(filters.date_from)
        if filters.date_to:
            filters_applied["To"] = str(filters.date_to)
        if filters.search:
            filters_applied["Search"] = filters.search
        if filters.status:
            filters_applied["Status"] = filters.status

        import uuid
        return ReportMeta(
            title=title,
            subtitle=subtitle,
            category=self.REPORT_CATEGORY,
            generated_at=datetime.utcnow(),
            generated_by=generated_by or self.current_user_name,
            company_name=company_name,
            filters_applied=filters_applied,
            total_records=total_records,
            page=page,
            total_pages=total_pages,
            report_id=str(uuid.uuid4())[:8].upper(),
            currency_symbol=self.currency_symbol,
        )

    def _apply_pagination(self, query, filters: ReportFilter):
        """Apply pagination to a SQLAlchemy query."""
        if filters.export_mode:
            return query
        offset = (filters.page - 1) * filters.page_size
        return query.offset(offset).limit(filters.page_size)

    def _format_currency(self, value) -> str:
        """Format a numeric value as currency string with the active symbol."""
        if value is None:
            return f"{self.currency_symbol} 0.00"
        try:
            return f"{self.currency_symbol} {float(value):,.2f}"
        except (TypeError, ValueError):
            return f"{self.currency_symbol} 0.00"

    def _safe_float(self, value, default: float = 0.0) -> float:
        """Safely convert to float."""
        if value is None:
            return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _safe_str(self, value, default: str = "") -> str:
        """Safely convert to string."""
        if value is None:
            return default
        return str(value)

    def _format_date(self, value) -> Optional[str]:
        """Format date to string."""
        if value is None:
            return None
        if isinstance(value, (date, datetime)):
            return value.strftime("%Y-%m-%d")
        return str(value)

    def _format_datetime(self, value) -> Optional[str]:
        """Format datetime to string."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d %H:%M")
        if isinstance(value, date):
            return value.strftime("%Y-%m-%d")
        return str(value)
