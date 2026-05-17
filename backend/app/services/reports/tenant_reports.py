"""
Tenant Reports — Tenant profile, rent ledger, due reports.

Reports:
  1. Tenant Profile Report
  2. Rent Ledger Report
  3. Rent Due Report
  4. Security Deposit Report
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.tenant import (
    RentRecord, Tenant, TenantLease, TenantPayment,
)
from app.models.property import Property, Unit
from app.services.reports.report_engine import (
    BaseReportService, ReportColumn, ReportFilter, ReportResult, ReportSummary,
)


# ── Tenant Profile Report ─────────────────────────────────────────────────────

class TenantProfileReportService(BaseReportService):
    """Detailed tenant profile with lease and payment history."""

    REPORT_KEY = "tenant_profile"
    REPORT_NAME = "Tenant Profile Report"
    REPORT_CATEGORY = "Tenant"
    REPORT_TYPE = "profile"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        tenant = (
            self.db.query(Tenant)
            .filter(Tenant.id == filters.tenant_id)
            .options(
                joinedload(Tenant.leases).joinedload(TenantLease.property_rel),
                joinedload(Tenant.leases).joinedload(TenantLease.unit_rel),
                joinedload(Tenant.payments),
            )
            .first()
        )

        if not tenant:
            return ReportResult(
                meta=self._make_meta("Tenant Profile", filters, 0),
                columns=[],
                rows=[],
                error="Tenant not found",
            )

        profile_data = {
            "Tenant ID": tenant.tenant_id,
            "Name": tenant.name,
            "Phone": tenant.phone,
            "Email": tenant.email or "N/A",
            "CNIC": tenant.cnic or "N/A",
            "Family Size": tenant.family_size or "N/A",
            "Status": "Active" if tenant.is_active else "Inactive",
            "Registered": self._format_datetime(tenant.created_at),
        }

        columns = [
            ReportColumn(key="field", label="Field", width="30%"),
            ReportColumn(key="value", label="Value", width="70%"),
        ]

        rows = [{"field": k, "value": v} for k, v in profile_data.items()]

        # Lease rows
        lease_rows = []
        for lease in tenant.leases:
            lease_rows.append({
                "property": lease.property_rel.name if lease.property_rel else "N/A",
                "unit": lease.unit_rel.unit_number if lease.unit_rel else "Full Property",
                "rent": self._format_currency(lease.rent_amount),
                "deposit": self._format_currency(lease.security_deposit),
                "start": self._format_date(lease.lease_start),
                "end": self._format_date(lease.lease_end) or "Ongoing",
                "status": lease.status.upper(),
            })

        meta = self._make_meta(
            title=f"Tenant Profile: {tenant.name}",
            filters=filters,
            total_records=len(rows),
            subtitle=f"Tenant ID: {tenant.tenant_id}",
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            sub_tables={"leases": {"rows": lease_rows}},
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Rent Ledger Report ────────────────────────────────────────────────────────

class RentLedgerReportService(BaseReportService):
    """Tenant rent ledger with payment history."""

    REPORT_KEY = "rent_ledger"
    REPORT_NAME = "Rent Ledger Report"
    REPORT_CATEGORY = "Tenant"
    REPORT_TYPE = "ledger"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        tenant = self.db.query(Tenant).filter(Tenant.id == filters.tenant_id).first()
        if not tenant:
            return ReportResult(
                meta=self._make_meta("Rent Ledger", filters, 0),
                columns=[],
                rows=[],
                error="Tenant not found",
            )

        # Get rent records
        query = (
            self.db.query(RentRecord)
            .filter(RentRecord.tenant_id == tenant.id)
        )

        if filters.date_from:
            query = query.filter(RentRecord.due_date >= filters.date_from)
        if filters.date_to:
            query = query.filter(RentRecord.due_date <= filters.date_to)

        rent_records = query.order_by(RentRecord.due_date.asc()).all()

        rows = []
        running_balance = 0.0
        total_due = 0.0
        total_paid = 0.0

        for record in rent_records:
            due = float(record.amount_due)
            paid = float(record.amount_paid)
            running_balance += due - paid
            total_due += due
            total_paid += paid

            rows.append({
                "due_date": self._format_date(record.due_date),
                "paid_date": self._format_date(record.paid_date) or "—",
                "amount_due": self._format_currency(due),
                "amount_paid": self._format_currency(paid),
                "late_fee": self._format_currency(record.late_fee),
                "balance": self._format_currency(running_balance),
                "status": record.status.upper(),
            })

        columns = [
            ReportColumn(key="due_date", label="Due Date", data_type="date", width="14%"),
            ReportColumn(key="paid_date", label="Paid Date", data_type="date", width="14%"),
            ReportColumn(key="amount_due", label="Amount Due", data_type="currency", align="right", width="15%"),
            ReportColumn(key="amount_paid", label="Paid", data_type="currency", align="right", width="15%"),
            ReportColumn(key="late_fee", label="Late Fee", data_type="currency", align="right", width="12%"),
            ReportColumn(key="balance", label="Balance", data_type="currency", align="right", width="15%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="15%"),
        ]

        summary = [
            ReportSummary(label="Total Due", value=total_due, format="currency", color="red"),
            ReportSummary(label="Total Paid", value=total_paid, format="currency", color="green"),
            ReportSummary(label="Outstanding", value=total_due - total_paid, format="currency", color="yellow"),
        ]

        meta = self._make_meta(
            title=f"Rent Ledger: {tenant.name}",
            filters=filters,
            total_records=len(rows),
            subtitle=f"Tenant ID: {tenant.tenant_id}",
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Rent Due Report ───────────────────────────────────────────────────────────

class RentDueReportService(BaseReportService):
    """All pending/overdue rent records."""

    REPORT_KEY = "rent_due_report"
    REPORT_NAME = "Rent Due Report"
    REPORT_CATEGORY = "Tenant"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(RentRecord, Tenant, TenantLease)
            .join(Tenant, RentRecord.tenant_id == Tenant.id)
            .join(TenantLease, RentRecord.lease_id == TenantLease.id)
            .filter(RentRecord.status.in_(["pending", "partial", "overdue"]))
        )

        if filters.date_from:
            query = query.filter(RentRecord.due_date >= filters.date_from)
        if filters.date_to:
            query = query.filter(RentRecord.due_date <= filters.date_to)
        if filters.tenant_id:
            query = query.filter(Tenant.id == filters.tenant_id)

        total_count = query.count()
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_outstanding = 0.0

        for record, tenant, lease in results:
            outstanding = float(record.amount_due) - float(record.amount_paid)
            total_outstanding += outstanding
            days_overdue = (datetime.utcnow().date() - record.due_date).days if record.due_date < datetime.utcnow().date() else 0

            rows.append({
                "tenant_name": tenant.name,
                "tenant_id": tenant.tenant_id,
                "phone": tenant.phone,
                "due_date": self._format_date(record.due_date),
                "amount_due": self._format_currency(record.amount_due),
                "amount_paid": self._format_currency(record.amount_paid),
                "outstanding": self._format_currency(outstanding),
                "days_overdue": days_overdue,
                "status": record.status.upper(),
            })

        columns = [
            ReportColumn(key="tenant_name", label="Tenant", width="18%"),
            ReportColumn(key="tenant_id", label="ID", width="10%"),
            ReportColumn(key="phone", label="Phone", width="13%"),
            ReportColumn(key="due_date", label="Due Date", data_type="date", width="12%"),
            ReportColumn(key="amount_due", label="Due", data_type="currency", align="right", width="12%"),
            ReportColumn(key="amount_paid", label="Paid", data_type="currency", align="right", width="12%"),
            ReportColumn(key="outstanding", label="Outstanding", data_type="currency", align="right", width="12%"),
            ReportColumn(key="days_overdue", label="Days Overdue", data_type="number", align="center", width="11%"),
        ]

        summary = [
            ReportSummary(label="Total Outstanding", value=total_outstanding, format="currency", color="red"),
            ReportSummary(label="Overdue Records", value=total_count, format="number", color="yellow"),
        ]

        meta = self._make_meta(
            title="Rent Due Report",
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


# ── Security Deposit Report ───────────────────────────────────────────────────

class SecurityDepositReportService(BaseReportService):
    """Security deposit summary for all tenants."""

    REPORT_KEY = "security_deposit_report"
    REPORT_NAME = "Security Deposit Report"
    REPORT_CATEGORY = "Tenant"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(TenantLease, Tenant)
            .join(Tenant, TenantLease.tenant_id == Tenant.id)
            .filter(TenantLease.security_deposit > 0)
        )

        if filters.status:
            query = query.filter(TenantLease.status == filters.status)

        total_count = query.count()
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_deposits = 0.0

        for lease, tenant in results:
            deposit = float(lease.security_deposit or 0)
            total_deposits += deposit

            rows.append({
                "tenant_name": tenant.name,
                "tenant_id": tenant.tenant_id,
                "phone": tenant.phone,
                "deposit": self._format_currency(deposit),
                "rent": self._format_currency(lease.rent_amount),
                "lease_start": self._format_date(lease.lease_start),
                "lease_end": self._format_date(lease.lease_end) or "Ongoing",
                "status": lease.status.upper(),
            })

        columns = [
            ReportColumn(key="tenant_name", label="Tenant", width="20%"),
            ReportColumn(key="tenant_id", label="ID", width="10%"),
            ReportColumn(key="phone", label="Phone", width="13%"),
            ReportColumn(key="deposit", label="Security Deposit", data_type="currency", align="right", width="15%"),
            ReportColumn(key="rent", label="Monthly Rent", data_type="currency", align="right", width="15%"),
            ReportColumn(key="lease_start", label="Start", data_type="date", width="12%"),
            ReportColumn(key="lease_end", label="End", width="10%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="5%"),
        ]

        summary = [
            ReportSummary(label="Total Deposits Held", value=total_deposits, format="currency", color="blue"),
            ReportSummary(label="Active Leases", value=total_count, format="number", color="green"),
        ]

        meta = self._make_meta(
            title="Security Deposit Report",
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
