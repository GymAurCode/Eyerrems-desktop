"""
Finance Reports — Cash flow, collections, expenses, income reports.

Reports:
  1. Daily Collection Report
  2. Monthly Collection Report
  3. Expense Report
  4. Income Report
  5. Cash Flow Report
  6. Overdue Payments Report
  7. Account Statement
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List

from sqlalchemy import and_, extract, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.crm import Installment, InstallmentPayment, InstallmentPlan
from app.models.booking import Booking
from app.models.crm import Client
from app.models.finance import Account, Expense, Invoice, Journal, JournalEntry, Payment
from app.services.reports.report_engine import (
    BaseReportService, ReportColumn, ReportFilter, ReportResult, ReportSummary,
)


# ── Daily Collection Report ───────────────────────────────────────────────────

class DailyCollectionReportService(BaseReportService):
    """Daily payment collections from installments."""

    REPORT_KEY = "daily_collection"
    REPORT_NAME = "Daily Collection Report"
    REPORT_CATEGORY = "Finance"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        # Default to today if no date range
        date_from = filters.date_from or datetime.utcnow().date()
        date_to = filters.date_to or datetime.utcnow().date()

        query = (
            self.db.query(InstallmentPayment, Installment, InstallmentPlan, Booking, Client)
            .join(Installment, InstallmentPayment.installment_id == Installment.id)
            .join(InstallmentPlan, Installment.plan_id == InstallmentPlan.id)
            .join(Booking, InstallmentPlan.booking_id == Booking.id)
            .join(Client, Booking.client_id == Client.id)
            .filter(
                func.date(InstallmentPayment.date) >= date_from,
                func.date(InstallmentPayment.date) <= date_to,
            )
        )

        # Apply filters
        if filters.payment_method:
            query = query.filter(InstallmentPayment.method == filters.payment_method)
        if filters.client_id:
            query = query.filter(Client.id == filters.client_id)

        # Count total
        total_count = query.count()

        # Apply sorting
        query = query.order_by(InstallmentPayment.date.desc())

        # Apply pagination
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_collected = 0.0
        cash_total = 0.0
        bank_total = 0.0

        for payment, inst, plan, booking, client in results:
            amount = float(payment.amount)
            total_collected += amount
            if payment.method == "cash":
                cash_total += amount
            else:
                bank_total += amount

            rows.append({
                "date": self._format_datetime(payment.date),
                "client_name": client.name,
                "booking_id": booking.booking_id,
                "method": payment.method.upper(),
                "reference": payment.reference_number or "N/A",
                "amount": self._format_currency(amount),
            })

        columns = [
            ReportColumn(key="date", label="Date", data_type="date", width="18%"),
            ReportColumn(key="client_name", label="Customer", width="22%"),
            ReportColumn(key="booking_id", label="Booking ID", width="15%"),
            ReportColumn(key="method", label="Method", data_type="badge", align="center", width="12%"),
            ReportColumn(key="reference", label="Reference", width="18%"),
            ReportColumn(key="amount", label="Amount", data_type="currency", align="right", width="15%"),
        ]

        summary = [
            ReportSummary(label="Total Collected", value=total_collected, format="currency", color="green"),
            ReportSummary(label="Cash", value=cash_total, format="currency", color="blue"),
            ReportSummary(label="Bank", value=bank_total, format="currency", color="purple"),
            ReportSummary(label="Transactions", value=total_count, format="number", color="gray"),
        ]

        meta = self._make_meta(
            title="Daily Collection Report",
            filters=filters,
            total_records=total_count,
            subtitle=f"Period: {date_from} to {date_to}",
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Monthly Collection Report ─────────────────────────────────────────────────

class MonthlyCollectionReportService(BaseReportService):
    """Monthly collection summary grouped by month."""

    REPORT_KEY = "monthly_collection"
    REPORT_NAME = "Monthly Collection Report"
    REPORT_CATEGORY = "Finance"
    REPORT_TYPE = "summary"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        # Default to current year
        year = filters.extra.get("year", datetime.utcnow().year)

        query = (
            self.db.query(
                extract("month", InstallmentPayment.date).label("month"),
                extract("year", InstallmentPayment.date).label("year"),
                func.sum(InstallmentPayment.amount).label("total"),
                func.sum(func.case((InstallmentPayment.method == "cash", InstallmentPayment.amount), else_=0)).label("cash"),
                func.sum(func.case((InstallmentPayment.method == "bank", InstallmentPayment.amount), else_=0)).label("bank"),
                func.count(InstallmentPayment.id).label("count"),
            )
            .filter(extract("year", InstallmentPayment.date) == year)
            .group_by(
                extract("year", InstallmentPayment.date),
                extract("month", InstallmentPayment.date),
            )
            .order_by(extract("month", InstallmentPayment.date).asc())
        )

        results = query.all()

        month_names = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]

        rows = []
        total_annual = 0.0

        for row in results:
            month_idx = int(row.month) - 1
            month_name = month_names[month_idx] if 0 <= month_idx < 12 else str(row.month)
            total = float(row.total or 0)
            total_annual += total

            rows.append({
                "month": month_name,
                "year": int(row.year),
                "total": self._format_currency(total),
                "cash": self._format_currency(float(row.cash or 0)),
                "bank": self._format_currency(float(row.bank or 0)),
                "transactions": row.count,
            })

        columns = [
            ReportColumn(key="month", label="Month", width="20%"),
            ReportColumn(key="year", label="Year", align="center", width="10%"),
            ReportColumn(key="total", label="Total Collected", data_type="currency", align="right", width="20%"),
            ReportColumn(key="cash", label="Cash", data_type="currency", align="right", width="20%"),
            ReportColumn(key="bank", label="Bank", data_type="currency", align="right", width="20%"),
            ReportColumn(key="transactions", label="Transactions", data_type="number", align="center", width="10%"),
        ]

        summary = [
            ReportSummary(label=f"Annual Total ({year})", value=total_annual, format="currency", color="green"),
            ReportSummary(label="Months Recorded", value=len(rows), format="number", color="blue"),
        ]

        meta = self._make_meta(
            title=f"Monthly Collection Report — {year}",
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


# ── Expense Report ────────────────────────────────────────────────────────────

class ExpenseReportService(BaseReportService):
    """Expense report with account breakdown."""

    REPORT_KEY = "expense_report"
    REPORT_NAME = "Expense Report"
    REPORT_CATEGORY = "Finance"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(Expense, Account)
            .join(Account, Expense.account_id == Account.id)
        )

        # Apply filters
        if filters.date_from:
            query = query.filter(func.date(Expense.date) >= filters.date_from)
        if filters.date_to:
            query = query.filter(func.date(Expense.date) <= filters.date_to)
        if filters.account_id:
            query = query.filter(Expense.account_id == filters.account_id)
        if filters.payment_method:
            query = query.filter(Expense.paid_from == filters.payment_method)
        if filters.search:
            query = query.filter(
                or_(
                    Expense.description.ilike(f"%{filters.search}%"),
                    Expense.reference.ilike(f"%{filters.search}%"),
                )
            )

        # Count total
        total_count = query.count()

        # Apply sorting
        query = query.order_by(Expense.date.desc())

        # Apply pagination
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_expense = 0.0

        for expense, account in results:
            amount = float(expense.amount)
            total_expense += amount

            rows.append({
                "date": self._format_datetime(expense.date),
                "account": account.name,
                "description": expense.description,
                "paid_from": expense.paid_from.upper(),
                "reference": expense.reference or "N/A",
                "amount": self._format_currency(amount),
            })

        columns = [
            ReportColumn(key="date", label="Date", data_type="date", width="15%"),
            ReportColumn(key="account", label="Account", width="20%"),
            ReportColumn(key="description", label="Description", width="25%"),
            ReportColumn(key="paid_from", label="Paid From", data_type="badge", align="center", width="12%"),
            ReportColumn(key="reference", label="Reference", width="15%"),
            ReportColumn(key="amount", label="Amount", data_type="currency", align="right", width="13%"),
        ]

        summary = [
            ReportSummary(label="Total Expenses", value=total_expense, format="currency", color="red"),
            ReportSummary(label="Transactions", value=total_count, format="number", color="gray"),
        ]

        meta = self._make_meta(
            title="Expense Report",
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


# ── Cash Flow Report ──────────────────────────────────────────────────────────

class CashFlowReportService(BaseReportService):
    """Cash flow summary — inflows vs outflows."""

    REPORT_KEY = "cash_flow"
    REPORT_NAME = "Cash Flow Report"
    REPORT_CATEGORY = "Finance"
    REPORT_TYPE = "financial_statement"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        date_from = filters.date_from or datetime.utcnow().date().replace(day=1)
        date_to = filters.date_to or datetime.utcnow().date()

        # Total inflows (installment payments)
        inflow_query = (
            self.db.query(func.sum(InstallmentPayment.amount))
            .filter(
                func.date(InstallmentPayment.date) >= date_from,
                func.date(InstallmentPayment.date) <= date_to,
            )
        )
        total_inflow = float(inflow_query.scalar() or 0)

        # Total outflows (expenses)
        outflow_query = (
            self.db.query(func.sum(Expense.amount))
            .filter(
                func.date(Expense.date) >= date_from,
                func.date(Expense.date) <= date_to,
            )
        )
        total_outflow = float(outflow_query.scalar() or 0)

        # Daily breakdown
        daily_inflows = (
            self.db.query(
                func.date(InstallmentPayment.date).label("day"),
                func.sum(InstallmentPayment.amount).label("amount"),
            )
            .filter(
                func.date(InstallmentPayment.date) >= date_from,
                func.date(InstallmentPayment.date) <= date_to,
            )
            .group_by(func.date(InstallmentPayment.date))
            .all()
        )

        daily_outflows = (
            self.db.query(
                func.date(Expense.date).label("day"),
                func.sum(Expense.amount).label("amount"),
            )
            .filter(
                func.date(Expense.date) >= date_from,
                func.date(Expense.date) <= date_to,
            )
            .group_by(func.date(Expense.date))
            .all()
        )

        # Merge into daily rows
        inflow_map = {str(row.day): float(row.amount) for row in daily_inflows}
        outflow_map = {str(row.day): float(row.amount) for row in daily_outflows}

        all_dates = sorted(set(list(inflow_map.keys()) + list(outflow_map.keys())))

        rows = []
        running_balance = 0.0

        for day in all_dates:
            inflow = inflow_map.get(day, 0.0)
            outflow = outflow_map.get(day, 0.0)
            net = inflow - outflow
            running_balance += net

            rows.append({
                "date": day,
                "inflow": self._format_currency(inflow),
                "outflow": self._format_currency(outflow),
                "net": self._format_currency(net),
                "balance": self._format_currency(running_balance),
            })

        columns = [
            ReportColumn(key="date", label="Date", data_type="date", width="20%"),
            ReportColumn(key="inflow", label="Inflow", data_type="currency", align="right", width="20%"),
            ReportColumn(key="outflow", label="Outflow", data_type="currency", align="right", width="20%"),
            ReportColumn(key="net", label="Net", data_type="currency", align="right", width="20%"),
            ReportColumn(key="balance", label="Running Balance", data_type="currency", align="right", width="20%"),
        ]

        summary = [
            ReportSummary(label="Total Inflow", value=total_inflow, format="currency", color="green"),
            ReportSummary(label="Total Outflow", value=total_outflow, format="currency", color="red"),
            ReportSummary(label="Net Cash Flow", value=total_inflow - total_outflow, format="currency", color="blue"),
        ]

        meta = self._make_meta(
            title="Cash Flow Report",
            filters=filters,
            total_records=len(rows),
            subtitle=f"Period: {date_from} to {date_to}",
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )
