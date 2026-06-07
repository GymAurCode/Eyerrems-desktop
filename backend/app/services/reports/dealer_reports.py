"""Dealer/CRM Reports — Deal summaries, token receipts, unit statements."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.crm import (
    Client, Deal, Dealer, Installment, InstallmentPayment, InstallmentPlan, Lead,
)
from app.models.booking import Booking
from app.models.property import Property, Unit
from app.models.tenant import Tenant, RentRecord, TenantLease
from app.services.reports.report_engine import (
    BaseReportService, ReportColumn, ReportFilter, ReportResult, ReportSummary,
)


class DealReportService(BaseReportService):
    """Complete deal summary with financial details."""

    REPORT_KEY = "deal_report"
    REPORT_NAME = "Deal Summary Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = self.db.query(Deal).options(
            joinedload(Deal.client),
            joinedload(Deal.property_rel),
            joinedload(Deal.dealer),
        )

        if filters.deal_id:
            query = query.filter(Deal.id == filters.deal_id)
        if filters.client_id:
            query = query.filter(Deal.client_id == filters.client_id)
        if filters.dealer_id:
            query = query.filter(Deal.dealer_id == filters.dealer_id)
        if filters.status:
            query = query.filter(Deal.status == filters.status)
        if filters.date_from:
            query = query.filter(Deal.deal_date >= filters.date_from)
        if filters.date_to:
            query = query.filter(Deal.deal_date <= filters.date_to)

        total_count = query.count()
        query = query.order_by(Deal.deal_date.desc())
        query = self._apply_pagination(query, filters)
        deals = query.all()

        rows = []
        total_value = 0.0
        total_down = 0.0

        for d in deals:
            val = self._safe_float(d.deal_value)
            down = self._safe_float(d.down_payment)
            total_value += val
            total_down += down

            rows.append({
                "id": d.deal_id or f"D-{d.id}",
                "title": d.deal_title or "N/A",
                "client_name": d.client.name if d.client else "N/A",
                "property_name": d.property_rel.name if d.property_rel else "N/A",
                "deal_value": val,
                "down_payment": down,
                "status": (d.status or "active").upper(),
                "dealer_name": d.dealer.name if d.dealer else "N/A",
                "deal_date": self._format_date(d.deal_date),
            })

        columns = [
            ReportColumn(key="id", label="Deal ID", width="14%"),
            ReportColumn(key="title", label="Deal Title", width="16%"),
            ReportColumn(key="client_name", label="Client", width="14%"),
            ReportColumn(key="property_name", label="Property", width="14%"),
            ReportColumn(key="deal_value", label="Deal Value", data_type="currency", align="right", width="13%"),
            ReportColumn(key="down_payment", label="Down Payment", data_type="currency", align="right", width="12%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="8%"),
            ReportColumn(key="dealer_name", label="Dealer", width="12%"),
        ]

        summary = [
            ReportSummary(label="Total Deals", value=total_count, format="number", color="blue"),
            ReportSummary(label="Total Value", value=total_value, format="currency", color="green"),
            ReportSummary(label="Total Down Payment", value=total_down, format="currency", color="purple"),
        ]

        meta = self._make_meta(
            title="Deal Summary Report",
            filters=filters,
            total_records=total_count,
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


class OutstandingPaymentsService(BaseReportService):
    """Customer outstanding payment summary."""

    REPORT_KEY = "outstanding_payments"
    REPORT_NAME = "Outstanding Payments Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(Installment, InstallmentPlan, Booking, Client)
            .join(InstallmentPlan, Installment.plan_id == InstallmentPlan.id)
            .join(Booking, InstallmentPlan.booking_id == Booking.id)
            .join(Client, Booking.client_id == Client.id)
            .filter(Installment.status.in_(["pending", "partial", "overdue"]))
        )

        if filters.client_id:
            query = query.filter(Client.id == filters.client_id)
        if filters.date_from:
            query = query.filter(Installment.due_date >= filters.date_from)
        if filters.date_to:
            query = query.filter(Installment.due_date <= filters.date_to)

        total_count = query.count()
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_outstanding = 0.0

        for inst, plan, booking, client in results:
            outstanding = float(inst.amount) - float(inst.paid_amount)
            total_outstanding += outstanding

            rows.append({
                "client_name": client.name,
                "booking_id": booking.booking_id,
                "due_date": self._format_date(inst.due_date),
                "amount": self._format_currency(inst.amount),
                "paid": self._format_currency(inst.paid_amount),
                "outstanding": self._format_currency(outstanding),
                "status": inst.status.upper(),
            })

        columns = [
            ReportColumn(key="client_name", label="Customer", width="20%"),
            ReportColumn(key="booking_id", label="Booking ID", width="15%"),
            ReportColumn(key="due_date", label="Due Date", data_type="date", width="15%"),
            ReportColumn(key="amount", label="Amount", data_type="currency", align="right", width="15%"),
            ReportColumn(key="paid", label="Paid", data_type="currency", align="right", width="15%"),
            ReportColumn(key="outstanding", label="Outstanding", data_type="currency", align="right", width="15%"),
        ]

        summary = [
            ReportSummary(label="Total Outstanding", value=total_outstanding, format="currency", color="red"),
            ReportSummary(label="Pending Items", value=total_count, format="number", color="yellow"),
        ]

        meta = self._make_meta(
            title="Outstanding Payments Report",
            filters=filters,
            total_records=total_count,
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


class TokenReceiptService(BaseReportService):
    """Booking token payment receipt report."""

    REPORT_KEY = "token_receipt"
    REPORT_NAME = "Token Receipt Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(Booking, Client, Property)
            .join(Client, Booking.client_id == Client.id)
            .join(Property, Booking.property_id == Property.id)
        )

        if filters.booking_id:
            query = query.filter(Booking.id == filters.booking_id)
        if filters.client_id:
            query = query.filter(Client.id == filters.client_id)

        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        for booking, client, prop in results:
            rows.append({
                "receipt_no": f"TKN-{booking.booking_id}",
                "booking_id": booking.booking_id,
                "client_name": client.name,
                "property": prop.name if prop else "N/A",
                "token_amount": self._format_currency(booking.booking_amount),
                "payment_method": booking.payment_method or "N/A",
                "booking_date": self._format_date(booking.booking_date),
                "status": booking.status.upper(),
            })

        columns = [
            ReportColumn(key="receipt_no", label="Receipt #", width="15%"),
            ReportColumn(key="booking_id", label="Booking ID", width="15%"),
            ReportColumn(key="client_name", label="Client", width="18%"),
            ReportColumn(key="property", label="Property", width="18%"),
            ReportColumn(key="token_amount", label="Token Amount", data_type="currency", align="right", width="15%"),
            ReportColumn(key="payment_method", label="Payment Method", width="14%"),
        ]

        meta = self._make_meta(
            title="Token Receipt Report",
            filters=filters,
            total_records=len(rows),
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            generation_time_ms=self._elapsed_ms(start),
        )


class UnitStatementService(BaseReportService):
    """Complete unit financial statement."""

    REPORT_KEY = "unit_statement"
    REPORT_NAME = "Unit Statement Report"
    REPORT_CATEGORY = "Property"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(Unit, Property)
            .join(Property, Unit.property_id == Property.id, isouter=True)
        )

        if filters.unit_id:
            query = query.filter(Unit.id == filters.unit_id)
        if filters.property_id:
            query = query.filter(Unit.property_id == filters.property_id)

        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_price = 0.0

        for unit, prop in results:
            price = self._safe_float(unit.sale_price)
            total_price += price
            rows.append({
                "unit_number": unit.unit_number,
                "property": prop.name if prop else "N/A",
                "floor": str(unit.floor_id) if unit.floor_id else "N/A",
                "size": unit.size or "N/A",
                "sale_price": self._format_currency(price),
                "rent_amount": self._format_currency(unit.rent_amount),
                "status": unit.status.upper(),
            })

        columns = [
            ReportColumn(key="unit_number", label="Unit #", width="12%"),
            ReportColumn(key="property", label="Property", width="20%"),
            ReportColumn(key="floor", label="Floor", width="10%"),
            ReportColumn(key="size", label="Size", width="10%"),
            ReportColumn(key="sale_price", label="Sale Price", data_type="currency", align="right", width="16%"),
            ReportColumn(key="rent_amount", label="Rent", data_type="currency", align="right", width="16%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="16%"),
        ]

        summary = [
            ReportSummary(label="Total Units", value=len(rows), format="number", color="blue"),
            ReportSummary(label="Total Value", value=total_price, format="currency", color="green"),
        ]

        meta = self._make_meta(
            title="Unit Statement Report",
            filters=filters,
            total_records=len(rows),
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


class TenantHistoryService(BaseReportService):
    """Tenant occupancy history for a unit."""

    REPORT_KEY = "tenant_history"
    REPORT_NAME = "Tenant History Report"
    REPORT_CATEGORY = "Tenant"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(TenantLease, Tenant)
            .join(Tenant, TenantLease.tenant_id == Tenant.id)
        )

        if filters.tenant_id:
            query = query.filter(Tenant.id == filters.tenant_id)
        if filters.unit_id:
            query = query.filter(TenantLease.unit_id == filters.unit_id)
        if filters.status:
            query = query.filter(TenantLease.status == filters.status)

        total_count = query.count()
        query = query.order_by(TenantLease.lease_start.desc())
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        for lease, tenant in results:
            rows.append({
                "tenant_name": tenant.name,
                "tenant_id": tenant.tenant_id,
                "phone": tenant.phone,
                "lease_start": self._format_date(lease.lease_start),
                "lease_end": self._format_date(lease.lease_end) or "Ongoing",
                "rent": self._format_currency(lease.rent_amount),
                "deposit": self._format_currency(lease.security_deposit),
                "status": lease.status.upper(),
            })

        columns = [
            ReportColumn(key="tenant_name", label="Tenant", width="18%"),
            ReportColumn(key="tenant_id", label="Tenant ID", width="12%"),
            ReportColumn(key="phone", label="Phone", width="14%"),
            ReportColumn(key="lease_start", label="Start Date", data_type="date", width="14%"),
            ReportColumn(key="lease_end", label="End Date", data_type="date", width="14%"),
            ReportColumn(key="rent", label="Rent", data_type="currency", align="right", width="14%"),
            ReportColumn(key="deposit", label="Deposit", data_type="currency", align="right", width="14%"),
        ]

        summary = [
            ReportSummary(label="Total Records", value=total_count, format="number", color="blue"),
        ]

        meta = self._make_meta(
            title="Tenant History Report",
            filters=filters,
            total_records=total_count,
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )
