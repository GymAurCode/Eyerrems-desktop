"""
Reports API — Enterprise-grade reporting endpoints for REMS.

All endpoints follow the pattern:
  POST /reports/{report_key}          → JSON data (for preview/table)
  POST /reports/{report_key}/export   → PDF or Excel file download

Endpoints are isolated from existing routes and do NOT modify any data.
"""
from __future__ import annotations

import io
import time
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.auth import User
from app.models.company import Company
from app.services.reports.report_engine import ReportFilter, ReportResult
from app.services.reports.crm_reports import (
    BookingFormReportService,
    CustomerLedgerReportService,
    CustomerProfileReportService,
    InstallmentPlanReportService,
    InstallmentScheduleReportService,
    LeadSummaryReportService,
    OutstandingReportService,
)
from app.services.reports.property_reports import (
    AvailableUnitsReportService,
    CategoryWiseReportService,
    FloorWiseReportService,
    InventoryReportService,
    TownInventoryReportService,
    BlockInventoryReportService,
    UnitStatusReportService,
)
from app.services.reports.finance_reports import (
    CashFlowReportService,
    DailyCollectionReportService,
    ExpenseReportService,
    MonthlyCollectionReportService,
)
from app.services.reports.tenant_reports import (
    RentDueReportService,
    RentLedgerReportService,
    SecurityDepositReportService,
    TenantProfileReportService,
)
from app.services.reports.hr_reports import (
    EmployeeListReportService,
    SalaryReportService,
    AttendanceReportService,
)
from app.services.reports.dealer_reports import (
    DealReportService,
    OutstandingPaymentsService,
    TokenReceiptService,
    UnitStatementService,
    TenantHistoryService,
)

router = APIRouter()


# ── Request / Response Models ─────────────────────────────────────────────────

class ReportRequest(BaseModel):
    """Universal report request body."""
    # Date range
    date_from: Optional[date] = None
    date_to: Optional[date] = None

    # Search
    search: Optional[str] = None

    # Status filters
    status: Optional[str] = None
    statuses: List[str] = Field(default_factory=list)

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
    deal_id: Optional[int] = None
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
    sort_order: str = "asc"

    # Pagination
    page: int = 1
    page_size: int = 50

    # Export mode
    export_mode: bool = False

    # Extra dynamic filters
    extra: Dict[str, Any] = Field(default_factory=dict)


class ExportRequest(ReportRequest):
    """Export request — adds format field."""
    format: str = "pdf"  # pdf | excel


# ── Registry of all report services ──────────────────────────────────────────

REPORT_REGISTRY = {
    # CRM Reports
    "customer_profile":       CustomerProfileReportService,
    "customer_ledger":        CustomerLedgerReportService,
    "installment_schedule":   InstallmentScheduleReportService,
    "installment_plan":       InstallmentPlanReportService,
    "booking_form":           BookingFormReportService,
    "outstanding_report":     OutstandingReportService,
    "lead_summary":           LeadSummaryReportService,

    # Property Reports
    "inventory_report":       InventoryReportService,
    "available_units":        AvailableUnitsReportService,
    "floor_wise_report":      FloorWiseReportService,
    "category_wise_report":   CategoryWiseReportService,
    "town_inventory":         TownInventoryReportService,
    "block_inventory":        BlockInventoryReportService,
    "unit_status":            UnitStatusReportService,

    # Finance Reports
    "daily_collection":       DailyCollectionReportService,
    "monthly_collection":     MonthlyCollectionReportService,
    "expense_report":         ExpenseReportService,
    "cash_flow":              CashFlowReportService,

    # Tenant Reports
    "tenant_profile":         TenantProfileReportService,
    "rent_ledger":            RentLedgerReportService,
    "rent_due_report":        RentDueReportService,
    "security_deposit_report": SecurityDepositReportService,

    # HR Reports
    "employees_list":          EmployeeListReportService,
    "salary_report":           SalaryReportService,
    "attendance_report":       AttendanceReportService,

    # Missing CRM / Property / Tenant reports
    "deal_report":             DealReportService,
    "outstanding_payments":    OutstandingPaymentsService,
    "token_receipt":           TokenReceiptService,
    "unit_statement":          UnitStatementService,
    "tenant_history":          TenantHistoryService,
}


# ── Helper: build filter from request ────────────────────────────────────────

def _build_filter(req: ReportRequest, company_id: int) -> ReportFilter:
    return ReportFilter(
        date_from=req.date_from,
        date_to=req.date_to,
        search=req.search,
        status=req.status,
        statuses=req.statuses,
        client_id=req.client_id,
        dealer_id=req.dealer_id,
        property_id=req.property_id,
        unit_id=req.unit_id,
        project_id=req.project_id,
        town_id=req.town_id,
        block_id=req.block_id,
        tenant_id=req.tenant_id,
        booking_id=req.booking_id,
        deal_id=req.deal_id,
        employee_id=req.employee_id,
        account_id=req.account_id,
        category=req.category,
        property_type=req.property_type,
        payment_method=req.payment_method,
        lead_source=req.lead_source,
        amount_min=req.amount_min,
        amount_max=req.amount_max,
        sort_by=req.sort_by,
        sort_order=req.sort_order,
        page=req.page,
        page_size=req.page_size,
        export_mode=req.export_mode,
        company_id=company_id,
        extra=req.extra,
    )


def _get_company_name(db: Session, company_id: int) -> str:
    company = db.query(Company).filter(Company.id == company_id).first()
    return company.name if company else "REMS"


def _get_company_currency_symbol(db: Session, company_id: int) -> str:
    """Return the currency symbol for the company (₨ for PKR, $ for USD)."""
    _SYMBOLS = {"PKR": "₨", "USD": "$"}
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return "₨"
    return _SYMBOLS.get(company.currency_code or "PKR", "₨")


def _result_to_dict(result: ReportResult) -> dict:
    """Convert ReportResult to JSON-serializable dict."""
    return {
        "meta": {
            "title": result.meta.title,
            "subtitle": result.meta.subtitle,
            "category": result.meta.category,
            "generated_at": result.meta.generated_at.isoformat(),
            "generated_by": result.meta.generated_by,
            "company_name": result.meta.company_name,
            "filters_applied": result.meta.filters_applied,
            "total_records": result.meta.total_records,
            "page": result.meta.page,
            "total_pages": result.meta.total_pages,
            "report_id": result.meta.report_id,
        },
        "columns": [
            {
                "key": col.key,
                "label": col.label,
                "data_type": col.data_type,
                "width": col.width,
                "align": col.align,
                "sortable": col.sortable,
                "visible": col.visible,
                "format": col.format,
                "badge_map": col.badge_map,
            }
            for col in result.columns
        ],
        "rows": result.rows,
        "summary": [
            {
                "label": s.label,
                "value": s.value,
                "sub_label": s.sub_label,
                "color": s.color,
                "icon": s.icon,
                "format": s.format,
            }
            for s in result.summary
        ],
        "sub_tables": result.sub_tables,
        "chart_data": result.chart_data,
        "generation_time_ms": result.generation_time_ms,
        "error": result.error,
    }


# ── Report Catalog ────────────────────────────────────────────────────────────

@router.get("/catalog")
def get_report_catalog(
    current_user: User = Depends(get_current_user),
):
    """Return list of all available reports grouped by category."""
    catalog = {}
    for key, service_class in REPORT_REGISTRY.items():
        category = service_class.REPORT_CATEGORY
        if category not in catalog:
            catalog[category] = []
        catalog[category].append({
            "key": key,
            "name": service_class.REPORT_NAME,
            "category": category,
            "type": service_class.REPORT_TYPE,
        })
    return {"catalog": catalog}


# ── Generic Report Endpoint ───────────────────────────────────────────────────

@router.post("/{report_key}")
def generate_report(
    report_key: str,
    req: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate report data as JSON.
    Used for preview/table display in the frontend.
    """
    service_class = REPORT_REGISTRY.get(report_key)
    if not service_class:
        raise HTTPException(status_code=404, detail=f"Report '{report_key}' not found")

    company_id = current_user.company_id or 0
    company_name = _get_company_name(db, company_id)
    currency_symbol = _get_company_currency_symbol(db, company_id)

    try:
        service = service_class(
            db=db,
            company_id=company_id,
            current_user_name=current_user.full_name,
            currency_symbol=currency_symbol,
        )

        filters = _build_filter(req, company_id)
        result = service.generate(filters)

        # Inject company name into meta
        result.meta.company_name = company_name
        result.meta.generated_by = current_user.full_name

        return _result_to_dict(result)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Report] {report_key} error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(e)}"
        )


# ── Export Endpoint ───────────────────────────────────────────────────────────

@router.post("/{report_key}/export")
def export_report(
    report_key: str,
    req: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export report as PDF or Excel.
    Returns file download response.
    """
    service_class = REPORT_REGISTRY.get(report_key)
    if not service_class:
        raise HTTPException(status_code=404, detail=f"Report '{report_key}' not found")

    company_id = current_user.company_id or 0
    company_name = _get_company_name(db, company_id)
    currency_symbol = _get_company_currency_symbol(db, company_id)

    service = service_class(
        db=db,
        company_id=company_id,
        current_user_name=current_user.full_name,
        currency_symbol=currency_symbol,
    )

    # Force export mode (no pagination)
    filters = _build_filter(req, company_id)
    filters.export_mode = True

    result = service.generate(filters)
    result.meta.company_name = company_name
    result.meta.generated_by = current_user.full_name

    export_format = req.format.lower()
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename_base = f"{report_key}_{timestamp}"

    if export_format == "pdf":
        try:
            # Document-type reports use dedicated PDF generators
            if report_key == "installment_plan":
                from app.services.reports.installment_plan_pdf import generate_installment_plan_pdf
                doc_data = result.sub_tables.get("document_data", {})
                doc_data["meta"] = {
                    "company_name": company_name,
                    "booking_id":   doc_data.get("booking_id", ""),
                    "report_id":    result.meta.report_id or "",
                    "generated_at": result.meta.generated_at.strftime("%Y-%m-%d %H:%M"),
                    "currency_symbol": currency_symbol,
                }
                pdf_bytes = generate_installment_plan_pdf(doc_data)
            elif report_key == "booking_form":
                from app.services.reports.booking_form_pdf import generate_booking_form_pdf
                doc_data = result.sub_tables.get("document_data", {})
                doc_data["meta"] = {
                    "company_name": company_name,
                    "report_id":    result.meta.report_id or "",
                    "generated_at": result.meta.generated_at.strftime("%Y-%m-%d %H:%M"),
                    "currency_symbol": currency_symbol,
                }
                pdf_bytes = generate_booking_form_pdf(doc_data)
            else:
                from app.services.reports.pdf_generator import generate_pdf_report
                pdf_bytes = generate_pdf_report(result)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename_base}.pdf"',
                    "Content-Length": str(len(pdf_bytes)),
                },
            )
        except ImportError as e:
            raise HTTPException(
                status_code=500,
                detail=f"PDF generation requires fpdf2: pip install fpdf2. Error: {e}",
            )

    elif export_format == "excel":
        try:
            from app.services.reports.excel_generator import generate_excel_report
            excel_bytes = generate_excel_report(result)
            return Response(
                content=excel_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename_base}.xlsx"',
                    "Content-Length": str(len(excel_bytes)),
                },
            )
        except ImportError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Excel generation requires openpyxl: pip install openpyxl. Error: {e}",
            )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {export_format}. Use 'pdf' or 'excel'")


# ── Convenience endpoints for specific reports ────────────────────────────────

@router.get("/customer/{client_id}/profile")
def customer_profile(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick customer profile report."""
    req = ReportRequest(client_id=client_id)
    return generate_report("customer_profile", req, db, current_user)


@router.get("/customer/{client_id}/ledger")
def customer_ledger(
    client_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick customer ledger report."""
    req = ReportRequest(client_id=client_id, date_from=date_from, date_to=date_to)
    return generate_report("customer_ledger", req, db, current_user)


@router.get("/booking/{booking_id}/installment-schedule")
def installment_schedule(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick installment schedule for a booking."""
    req = ReportRequest(booking_id=booking_id)
    return generate_report("installment_schedule", req, db, current_user)


@router.get("/booking/{booking_id}/installment-plan")
def installment_plan(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enterprise installment plan report for a booking."""
    req = ReportRequest(booking_id=booking_id)
    return generate_report("installment_plan", req, db, current_user)


@router.get("/booking/{booking_id}/booking-form")
def booking_form(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enterprise booking form / client profile report."""
    req = ReportRequest(booking_id=booking_id)
    return generate_report("booking_form", req, db, current_user)


@router.get("/tenant/{tenant_id}/profile")
def tenant_profile(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick tenant profile report."""
    req = ReportRequest(tenant_id=tenant_id)
    return generate_report("tenant_profile", req, db, current_user)


@router.get("/tenant/{tenant_id}/rent-ledger")
def tenant_rent_ledger(
    tenant_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick tenant rent ledger."""
    req = ReportRequest(tenant_id=tenant_id, date_from=date_from, date_to=date_to)
    return generate_report("rent_ledger", req, db, current_user)
