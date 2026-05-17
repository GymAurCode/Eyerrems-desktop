"""
CRM Reports — Customer, Lead, Booking, Dealer reports.

Reports:
  1. Customer Profile Report
  2. Customer Ledger Report
  3. Booking Form Report
  4. Installment Schedule Report
  5. Outstanding Report
  6. Recovery Report
  7. Dealer Commission Report
  8. Payment Receipt Report
  9. Lead Summary Report
  10. Lead Source Report
  11. Conversion Report
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking
from app.models.crm import (
    Client, ClientAttachment, Deal, Dealer,
    Installment, InstallmentPayment, InstallmentPlan, Lead,
)
from app.models.property import Property, Unit
from app.services.reports.report_engine import (
    BaseReportService, ReportColumn, ReportFilter, ReportResult, ReportSummary,
)


# ── Customer Profile Report ──────────────────────────────────────────────────

class CustomerProfileReportService(BaseReportService):
    """Detailed customer profile with bookings and documents."""

    REPORT_KEY = "customer_profile"
    REPORT_NAME = "Customer Profile Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "profile"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        # Get customer
        query = self.db.query(Client).filter(Client.id == filters.client_id)
        client = query.first()

        if not client:
            return ReportResult(
                meta=self._make_meta("Customer Profile", filters, 0),
                columns=[],
                rows=[],
                error="Customer not found",
            )

        # Build profile data
        profile_data = {
            "client_id": client.client_id,
            "tracking_id": client.tracking_id,
            "name": client.name,
            "phone": client.phone,
            "email": client.email or "N/A",
            "cnic": client.cnic or "N/A",
            "address": client.address or "N/A",
            "status": client.status,
            "company_name": client.company_name or "N/A",
            "created_at": self._format_datetime(client.created_at),
        }

        # Get bookings
        bookings = (
            self.db.query(Booking)
            .filter(Booking.client_id == client.id)
            .options(joinedload(Booking.property), joinedload(Booking.unit))
            .all()
        )

        booking_rows = []
        for b in bookings:
            booking_rows.append({
                "booking_id": b.booking_id,
                "property": b.property.name if b.property else "N/A",
                "unit": b.unit.unit_number if b.unit else "N/A",
                "final_price": self._format_currency(b.final_price),
                "status": b.status,
                "booking_date": self._format_date(b.booking_date),
            })

        # Get attachments
        attachments = (
            self.db.query(ClientAttachment)
            .filter(ClientAttachment.client_id == client.id)
            .all()
        )

        attachment_rows = []
        for att in attachments:
            attachment_rows.append({
                "filename": att.filename,
                "uploaded_at": self._format_datetime(att.created_at),
            })

        columns = [
            ReportColumn(key="field", label="Field", width="30%"),
            ReportColumn(key="value", label="Value", width="70%"),
        ]

        # Convert profile dict to rows
        rows = [{"field": k.replace("_", " ").title(), "value": v} for k, v in profile_data.items()]

        meta = self._make_meta(
            title=f"Customer Profile: {client.name}",
            filters=filters,
            total_records=len(rows),
            subtitle=f"Client ID: {client.client_id}",
        )

        result = ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            sub_tables={
                "bookings": {"columns": [], "rows": booking_rows},
                "attachments": {"columns": [], "rows": attachment_rows},
            },
            generation_time_ms=self._elapsed_ms(start),
        )

        return result


# ── Customer Ledger Report ────────────────────────────────────────────────────

class CustomerLedgerReportService(BaseReportService):
    """Customer ledger with debit, credit, balance."""

    REPORT_KEY = "customer_ledger"
    REPORT_NAME = "Customer Ledger Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "ledger"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        # Get customer
        client = self.db.query(Client).filter(Client.id == filters.client_id).first()
        if not client:
            return ReportResult(
                meta=self._make_meta("Customer Ledger", filters, 0),
                columns=[],
                rows=[],
                error="Customer not found",
            )

        # Get all bookings for this client
        bookings = (
            self.db.query(Booking)
            .filter(Booking.client_id == client.id)
            .options(joinedload(Booking.installment_plan).joinedload(InstallmentPlan.installments))
            .all()
        )

        ledger_entries = []
        running_balance = Decimal("0.00")

        for booking in bookings:
            # Booking entry (debit)
            debit = booking.final_price or booking.property_price
            running_balance += debit
            ledger_entries.append({
                "date": booking.booking_date,
                "description": f"Booking: {booking.booking_id}",
                "debit": float(debit),
                "credit": 0.0,
                "balance": float(running_balance),
            })

            # Installment payments (credits)
            if booking.installment_plan:
                for inst in booking.installment_plan.installments:
                    for payment in inst.payments:
                        running_balance -= Decimal(str(payment.amount))
                        ledger_entries.append({
                            "date": payment.date,
                            "description": f"Payment: {payment.method.upper()} - {payment.reference_number or 'N/A'}",
                            "debit": 0.0,
                            "credit": float(payment.amount),
                            "balance": float(running_balance),
                        })

        # Sort by date
        ledger_entries.sort(key=lambda x: x["date"])

        # Format dates
        for entry in ledger_entries:
            entry["date"] = self._format_datetime(entry["date"])
            entry["debit"] = self._format_currency(entry["debit"])
            entry["credit"] = self._format_currency(entry["credit"])
            entry["balance"] = self._format_currency(entry["balance"])

        columns = [
            ReportColumn(key="date", label="Date", data_type="date", width="15%"),
            ReportColumn(key="description", label="Description", width="40%"),
            ReportColumn(key="debit", label="Debit", data_type="currency", align="right", width="15%"),
            ReportColumn(key="credit", label="Credit", data_type="currency", align="right", width="15%"),
            ReportColumn(key="balance", label="Balance", data_type="currency", align="right", width="15%"),
        ]

        total_debit = sum(float(e.get("debit", "0").replace(",", "")) for e in ledger_entries if e.get("debit"))
        total_credit = sum(float(e.get("credit", "0").replace(",", "")) for e in ledger_entries if e.get("credit"))

        summary = [
            ReportSummary(label="Total Debit", value=total_debit, format="currency", color="red"),
            ReportSummary(label="Total Credit", value=total_credit, format="currency", color="green"),
            ReportSummary(label="Outstanding", value=total_debit - total_credit, format="currency", color="blue"),
        ]

        meta = self._make_meta(
            title=f"Customer Ledger: {client.name}",
            filters=filters,
            total_records=len(ledger_entries),
            subtitle=f"Client ID: {client.client_id}",
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=ledger_entries,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Installment Schedule Report ──────────────────────────────────────────────

class InstallmentScheduleReportService(BaseReportService):
    """Professional installment schedule for a booking."""

    REPORT_KEY = "installment_schedule"
    REPORT_NAME = "Installment Schedule Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        # Get booking
        booking = (
            self.db.query(Booking)
            .filter(Booking.id == filters.booking_id)
            .options(
                joinedload(Booking.client),
                joinedload(Booking.property),
                joinedload(Booking.unit),
                joinedload(Booking.installment_plan).joinedload(InstallmentPlan.installments),
            )
            .first()
        )

        if not booking or not booking.installment_plan:
            return ReportResult(
                meta=self._make_meta("Installment Schedule", filters, 0),
                columns=[],
                rows=[],
                error="Booking or installment plan not found",
            )

        plan = booking.installment_plan
        installments = sorted(plan.installments, key=lambda x: x.due_date)

        rows = []
        for idx, inst in enumerate(installments, start=1):
            rows.append({
                "sr_no": idx,
                "due_date": self._format_date(inst.due_date),
                "amount": self._format_currency(inst.amount),
                "paid_amount": self._format_currency(inst.paid_amount),
                "balance": self._format_currency(float(inst.amount) - float(inst.paid_amount)),
                "status": inst.status.upper(),
            })

        columns = [
            ReportColumn(key="sr_no", label="Sr#", width="8%", align="center"),
            ReportColumn(key="due_date", label="Due Date", data_type="date", width="18%"),
            ReportColumn(key="amount", label="Amount", data_type="currency", align="right", width="18%"),
            ReportColumn(key="paid_amount", label="Paid", data_type="currency", align="right", width="18%"),
            ReportColumn(key="balance", label="Balance", data_type="currency", align="right", width="18%"),
            ReportColumn(key="status", label="Status", data_type="badge", width="20%", align="center"),
        ]

        summary = [
            ReportSummary(label="Total Amount", value=float(plan.total_amount), format="currency", color="blue"),
            ReportSummary(label="Down Payment", value=float(plan.down_payment), format="currency", color="green"),
            ReportSummary(label="Remaining", value=float(plan.remaining_amount), format="currency", color="red"),
            ReportSummary(label="Installments", value=len(installments), format="number", color="purple"),
        ]

        meta = self._make_meta(
            title="Installment Schedule",
            filters=filters,
            total_records=len(rows),
            subtitle=f"Booking: {booking.booking_id} | Customer: {booking.client.name}",
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Outstanding Report ────────────────────────────────────────────────────────

class OutstandingReportService(BaseReportService):
    """Overdue installments report."""

    REPORT_KEY = "outstanding_report"
    REPORT_NAME = "Outstanding Payments Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        # Get overdue installments
        query = (
            self.db.query(Installment, InstallmentPlan, Booking, Client)
            .join(InstallmentPlan, Installment.plan_id == InstallmentPlan.id)
            .join(Booking, InstallmentPlan.booking_id == Booking.id)
            .join(Client, Booking.client_id == Client.id)
            .filter(
                Installment.status.in_(["pending", "partial", "overdue"]),
                Installment.due_date < datetime.utcnow().date(),
            )
        )

        # Apply filters
        if filters.client_id:
            query = query.filter(Client.id == filters.client_id)
        if filters.date_from:
            query = query.filter(Installment.due_date >= filters.date_from)
        if filters.date_to:
            query = query.filter(Installment.due_date <= filters.date_to)

        # Count total
        total_count = query.count()

        # Apply pagination
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_outstanding = 0.0

        for inst, plan, booking, client in results:
            outstanding = float(inst.amount) - float(inst.paid_amount)
            total_outstanding += outstanding

            # Calculate days overdue
            days_overdue = (datetime.utcnow().date() - inst.due_date).days

            rows.append({
                "client_name": client.name,
                "client_id": client.client_id,
                "booking_id": booking.booking_id,
                "due_date": self._format_date(inst.due_date),
                "amount": self._format_currency(inst.amount),
                "paid": self._format_currency(inst.paid_amount),
                "outstanding": self._format_currency(outstanding),
                "days_overdue": days_overdue,
                "status": inst.status.upper(),
            })

        columns = [
            ReportColumn(key="client_name", label="Customer", width="15%"),
            ReportColumn(key="client_id", label="Client ID", width="10%"),
            ReportColumn(key="booking_id", label="Booking", width="10%"),
            ReportColumn(key="due_date", label="Due Date", data_type="date", width="12%"),
            ReportColumn(key="amount", label="Amount", data_type="currency", align="right", width="12%"),
            ReportColumn(key="paid", label="Paid", data_type="currency", align="right", width="12%"),
            ReportColumn(key="outstanding", label="Outstanding", data_type="currency", align="right", width="12%"),
            ReportColumn(key="days_overdue", label="Days Overdue", data_type="number", align="center", width="10%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="7%"),
        ]

        summary = [
            ReportSummary(label="Total Outstanding", value=total_outstanding, format="currency", color="red"),
            ReportSummary(label="Overdue Count", value=total_count, format="number", color="yellow"),
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


# ── Lead Summary Report ───────────────────────────────────────────────────────

class LeadSummaryReportService(BaseReportService):
    """Summary of all leads with status breakdown."""

    REPORT_KEY = "lead_summary"
    REPORT_NAME = "Lead Summary Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = self.db.query(Lead)

        # Apply filters
        if filters.status:
            query = query.filter(Lead.status == filters.status)
        if filters.lead_source:
            query = query.filter(Lead.source == filters.lead_source)
        if filters.date_from:
            query = query.filter(Lead.created_at >= filters.date_from)
        if filters.date_to:
            query = query.filter(Lead.created_at <= filters.date_to)
        if filters.search:
            query = query.filter(
                or_(
                    Lead.name.ilike(f"%{filters.search}%"),
                    Lead.phone.ilike(f"%{filters.search}%"),
                    Lead.email.ilike(f"%{filters.search}%"),
                )
            )

        # Count total
        total_count = query.count()

        # Apply sorting
        if filters.sort_by == "name":
            query = query.order_by(Lead.name.asc() if filters.sort_order == "asc" else Lead.name.desc())
        else:
            query = query.order_by(Lead.created_at.desc())

        # Apply pagination
        query = self._apply_pagination(query, filters)
        leads = query.all()

        rows = []
        for lead in leads:
            rows.append({
                "lead_id": lead.lead_id,
                "name": lead.name,
                "phone": lead.phone or "N/A",
                "email": lead.email or "N/A",
                "source": lead.source or "N/A",
                "status": lead.status.upper(),
                "created_at": self._format_datetime(lead.created_at),
            })

        columns = [
            ReportColumn(key="lead_id", label="Lead ID", width="10%"),
            ReportColumn(key="name", label="Name", width="18%"),
            ReportColumn(key="phone", label="Phone", width="15%"),
            ReportColumn(key="email", label="Email", width="20%"),
            ReportColumn(key="source", label="Source", width="12%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="10%"),
            ReportColumn(key="created_at", label="Created", data_type="date", width="15%"),
        ]

        # Status breakdown
        status_counts = (
            self.db.query(Lead.status, func.count(Lead.id))
            .group_by(Lead.status)
            .all()
        )

        summary = [
            ReportSummary(label="Total Leads", value=total_count, format="number", color="blue"),
        ]
        for status, count in status_counts[:3]:  # Top 3 statuses
            summary.append(
                ReportSummary(label=status.title(), value=count, format="number", color="gray")
            )

        meta = self._make_meta(
            title="Lead Summary Report",
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


# ── Installment Plan Report (Enterprise) ─────────────────────────────────────

class InstallmentPlanReportService(BaseReportService):
    """
    Enterprise Installment Plan Report.
    Returns rich structured data for both preview and PDF generation.
    """

    REPORT_KEY = "installment_plan"
    REPORT_NAME = "Installment Plan Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "document"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        booking = (
            self.db.query(Booking)
            .filter(Booking.id == filters.booking_id)
            .options(
                joinedload(Booking.client),
                joinedload(Booking.property),
                joinedload(Booking.unit).joinedload(Unit.floor),
                joinedload(Booking.installment_plan).joinedload(InstallmentPlan.installments)
                    .joinedload(Installment.payments),
                joinedload(Booking.assigned_dealer),
            )
            .first()
        )

        if not booking:
            return ReportResult(
                meta=self._make_meta("Installment Plan", filters, 0),
                columns=[],
                rows=[],
                error="Booking not found",
            )

        client = booking.client
        prop   = booking.property
        unit   = booking.unit
        plan   = booking.installment_plan

        # ── Customer section ──────────────────────────────────────────────────
        customer_data = {
            "name":            client.name if client else "N/A",
            "father_name":     getattr(client, "father_name", None) or "N/A",
            "cnic":            client.cnic if client else "N/A",
            "phone":           client.phone if client else "N/A",
            "whatsapp":        getattr(client, "whatsapp", None) or (client.phone if client else "N/A"),
            "email":           client.email if client else "N/A",
            "address":         client.address if client else "N/A",
            "country":         getattr(client, "country", None) or "Pakistan",
            "registration_no": client.client_id if client else "N/A",
            "booking_date":    self._format_date(booking.booking_date),
            "status":          booking.status.upper(),
            "client_id":       client.client_id if client else "N/A",
        }

        # ── Property section ──────────────────────────────────────────────────
        floor_num = None
        if unit and unit.floor:
            floor_num = f"Floor {unit.floor.floor_number}"

        property_data = {
            "project_name":       prop.name if prop else "N/A",
            "unit_number":        unit.unit_number if unit else "N/A",
            "floor":              floor_num or "N/A",
            "property_type":      (prop.category if prop else None) or "N/A",
            "category":           (prop.category if prop else None) or "N/A",
            "size":               (unit.size if unit else None) or (prop.size if prop else None) or "N/A",
            "rate_per_sqft":      "N/A",
            "gross_price":        self._format_currency(booking.property_price),
            "discount":           self._format_currency(booking.discount),
            "net_price":          self._format_currency(booking.final_price or booking.property_price),
            "processing_fee":     self._format_currency(booking.processing_fee),
            "possession_charges": self._format_currency(booking.possession_charges),
        }

        # ── Plan section ──────────────────────────────────────────────────────
        outstanding = 0.0
        last_payment_date = None
        half_yearly_amount = "N/A"

        if plan:
            outstanding = float(plan.remaining_amount or 0)
            # Find last installment date
            if plan.installments:
                sorted_insts = sorted(plan.installments, key=lambda x: x.due_date)
                last_payment_date = self._format_date(sorted_insts[-1].due_date)
                # Find half-yearly installments
                half_yearly = [i for i in plan.installments if i.type in ("half_yearly", "yearly")]
                if half_yearly:
                    half_yearly_amount = self._format_currency(half_yearly[0].amount)

        plan_data = {
            "down_payment":  self._format_currency(plan.down_payment if plan else 0),
            "total_count":   plan.total_count if plan else 0,
            "amount_per":    self._format_currency(plan.amount_per if plan else 0),
            "total_amount":  self._format_currency(plan.total_amount if plan else 0),
            "half_yearly":   half_yearly_amount,
            "last_payment":  last_payment_date or "N/A",
            "outstanding":   self._format_currency(outstanding),
            "frequency":     (plan.frequency or "N/A").replace("_", " ").title() if plan else "N/A",
        }

        # ── Installment rows ──────────────────────────────────────────────────
        inst_rows = []
        sr = 1

        # Processing fee row
        if float(booking.processing_fee or 0) > 0:
            inst_rows.append({
                "sr_no":        sr,
                "description":  "Processing Fee",
                "inst_no":      "—",
                "due_date":     self._format_date(booking.booking_date),
                "gross_amount": float(booking.processing_fee),
                "discount":     0.0,
                "net_amount":   float(booking.processing_fee),
                "outstanding":  float(booking.processing_fee),
                "status":       "PENDING",
            })
            sr += 1

        # Down payment row
        if float(booking.down_payment or 0) > 0:
            dp_status = booking.down_payment_status.upper() if booking.down_payment_status else "PENDING"
            inst_rows.append({
                "sr_no":        sr,
                "description":  "Down Payment",
                "inst_no":      "—",
                "due_date":     self._format_date(booking.booking_date),
                "gross_amount": float(booking.down_payment),
                "discount":     0.0,
                "net_amount":   float(booking.down_payment),
                "outstanding":  float(booking.down_payment) if dp_status != "PAID" else 0.0,
                "status":       dp_status,
            })
            sr += 1

        # Installment rows
        if plan and plan.installments:
            sorted_insts = sorted(plan.installments, key=lambda x: x.due_date)
            for idx, inst in enumerate(sorted_insts, 1):
                paid = float(inst.paid_amount or 0)
                gross = float(inst.amount or 0)
                out = max(0.0, gross - paid)
                inst_rows.append({
                    "sr_no":        sr,
                    "description":  inst.type.replace("_", " ").title() + " Installment",
                    "inst_no":      idx,
                    "due_date":     self._format_date(inst.due_date),
                    "gross_amount": gross,
                    "discount":     0.0,
                    "net_amount":   gross,
                    "outstanding":  out,
                    "status":       inst.status.upper(),
                })
                sr += 1

        # ── Summary ───────────────────────────────────────────────────────────
        total_payable = float(plan.total_amount if plan else booking.final_price or booking.property_price)
        total_paid    = total_payable - outstanding

        summary = [
            ReportSummary(label="Total Payable",  value=total_payable, format="currency", color="blue"),
            ReportSummary(label="Total Paid",     value=total_paid,    format="currency", color="green"),
            ReportSummary(label="Outstanding",    value=outstanding,   format="currency", color="red"),
            ReportSummary(label="Installments",   value=plan.total_count if plan else 0, format="number", color="purple"),
        ]

        # ── Columns (for table view) ───────────────────────────────────────────
        columns = [
            ReportColumn(key="sr_no",        label="Sr#",         width="5%",  align="center"),
            ReportColumn(key="description",  label="Description", width="20%"),
            ReportColumn(key="inst_no",      label="Inst#",       width="7%",  align="center"),
            ReportColumn(key="due_date",     label="Due Date",    width="11%", align="center", data_type="date"),
            ReportColumn(key="gross_amount", label="Gross Amt",   width="13%", align="right",  data_type="currency"),
            ReportColumn(key="discount",     label="Discount",    width="9%",  align="right",  data_type="currency"),
            ReportColumn(key="net_amount",   label="Net Amount",  width="13%", align="right",  data_type="currency"),
            ReportColumn(key="outstanding",  label="Outstanding", width="13%", align="right",  data_type="currency"),
            ReportColumn(key="status",       label="Status",      width="9%",  align="center", data_type="badge"),
        ]

        # Format currency in rows for table display
        display_rows = []
        for r in inst_rows:
            display_rows.append({
                **r,
                "gross_amount": r["gross_amount"],
                "discount":     r["discount"],
                "net_amount":   r["net_amount"],
                "outstanding":  r["outstanding"],
            })

        meta = self._make_meta(
            title=f"Installment Plan: {booking.booking_id}",
            filters=filters,
            total_records=len(inst_rows),
            subtitle=f"Customer: {client.name if client else 'N/A'} | Property: {prop.name if prop else 'N/A'}",
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=display_rows,
            summary=summary,
            sub_tables={
                "document_data": {
                    "customer":          customer_data,
                    "property":          property_data,
                    "plan":              plan_data,
                    "installment_rows":  inst_rows,
                    "booking_id":        booking.booking_id,
                }
            },
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Booking Form / Client Profile Report (Enterprise) ────────────────────────

class BookingFormReportService(BaseReportService):
    """
    Enterprise Booking Form / Client Profile Report.
    Returns rich structured data for both preview and PDF generation.
    """

    REPORT_KEY = "booking_form"
    REPORT_NAME = "Booking Form Report"
    REPORT_CATEGORY = "CRM"
    REPORT_TYPE = "document"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        booking = (
            self.db.query(Booking)
            .filter(Booking.id == filters.booking_id)
            .options(
                joinedload(Booking.client),
                joinedload(Booking.property),
                joinedload(Booking.unit).joinedload(Unit.floor),
                joinedload(Booking.installment_plan).joinedload(InstallmentPlan.installments),
                joinedload(Booking.assigned_dealer),
            )
            .first()
        )

        if not booking:
            return ReportResult(
                meta=self._make_meta("Booking Form", filters, 0),
                columns=[],
                rows=[],
                error="Booking not found",
            )

        client = booking.client
        prop   = booking.property
        unit   = booking.unit
        plan   = booking.installment_plan

        # ── Booking info ──────────────────────────────────────────────────────
        booking_info = {
            "booking_id":     booking.booking_id,
            "tracking_id":    client.tracking_id if client else "N/A",
            "booking_date":   self._format_date(booking.booking_date),
            "expiry_date":    self._format_date(booking.expiry_date),
            "status":         booking.status.upper(),
            "booking_amount": self._format_currency(booking.booking_amount),
        }

        # ── Applicant ─────────────────────────────────────────────────────────
        applicant = {
            "name":       client.name if client else "N/A",
            "cnic":       client.cnic if client else "N/A",
            "dob":        "N/A",
            "passport":   "N/A",
            "occupation": getattr(client, "occupation", None) or "N/A",
            "phone":      client.phone if client else "N/A",
            "whatsapp":   getattr(client, "whatsapp", None) or (client.phone if client else "N/A"),
            "email":      client.email if client else "N/A",
            "address":    client.address if client else "N/A",
            "country":    getattr(client, "country", None) or "Pakistan",
            "client_id":  client.client_id if client else "N/A",
            "status":     client.status.upper() if client else "N/A",
        }

        # ── Joint applicant (placeholder — extend when model supports it) ─────
        joint_applicant = {
            "name":     None,
            "cnic":     None,
            "relation": None,
            "contact":  None,
            "email":    None,
            "address":  None,
        }

        # ── Nominee ───────────────────────────────────────────────────────────
        nominee = {
            "name":     booking.nominee_name or "N/A",
            "relation": "N/A",
            "cnic":     booking.nominee_cnic or "N/A",
            "contact":  booking.nominee_phone or "N/A",
        }

        # ── Property ──────────────────────────────────────────────────────────
        floor_num = None
        if unit and unit.floor:
            floor_num = f"Floor {unit.floor.floor_number}"

        property_info = {
            "project_name":  prop.name if prop else "N/A",
            "unit_number":   unit.unit_number if unit else "N/A",
            "floor":         floor_num or "N/A",
            "property_type": (prop.category if prop else None) or "N/A",
            "category":      (prop.category if prop else None) or "N/A",
            "size":          (unit.size if unit else None) or (prop.size if prop else None) or "N/A",
            "rate_per_sqft": "N/A",
            "gross_price":   self._format_currency(booking.property_price),
            "discount":      self._format_currency(booking.discount),
            "net_price":     self._format_currency(booking.final_price or booking.property_price),
            "deal_valid_till": self._format_date(booking.expiry_date),
            "unit_status":   unit.status.upper() if unit else "N/A",
        }

        # ── Payment plan ──────────────────────────────────────────────────────
        outstanding = float(plan.remaining_amount if plan else 0)
        last_inst_date = None
        start_date = None

        if plan and plan.installments:
            sorted_insts = sorted(plan.installments, key=lambda x: x.due_date)
            last_inst_date = self._format_date(sorted_insts[-1].due_date)
            start_date     = self._format_date(sorted_insts[0].due_date)

        payment_plan = {
            "down_payment":    self._format_currency(plan.down_payment if plan else 0),
            "total_count":     plan.total_count if plan else 0,
            "last_installment": last_inst_date or "N/A",
            "processing_fee":  self._format_currency(booking.processing_fee),
            "start_date":      start_date or self._format_date(booking.booking_date),
            "frequency":       (plan.frequency or "N/A").replace("_", " ").title() if plan else "N/A",
            "total_amount":    self._format_currency(plan.total_amount if plan else booking.final_price or booking.property_price),
            "outstanding":     self._format_currency(outstanding),
        }

        # ── Summary ───────────────────────────────────────────────────────────
        total_payable = float(plan.total_amount if plan else booking.final_price or booking.property_price)
        total_paid    = total_payable - outstanding

        summary = [
            ReportSummary(label="Total Payable",  value=total_payable, format="currency", color="blue"),
            ReportSummary(label="Total Paid",     value=total_paid,    format="currency", color="green"),
            ReportSummary(label="Outstanding",    value=outstanding,   format="currency", color="red"),
            ReportSummary(label="Booking Amount", value=float(booking.booking_amount or 0), format="currency", color="purple"),
        ]

        # ── Columns (for table view) ───────────────────────────────────────────
        columns = [
            ReportColumn(key="field", label="Field", width="35%"),
            ReportColumn(key="value", label="Value", width="65%"),
        ]

        rows = [
            {"field": "Booking ID",     "value": booking.booking_id},
            {"field": "Customer",       "value": client.name if client else "N/A"},
            {"field": "CNIC",           "value": client.cnic if client else "N/A"},
            {"field": "Phone",          "value": client.phone if client else "N/A"},
            {"field": "Property",       "value": prop.name if prop else "N/A"},
            {"field": "Unit",           "value": unit.unit_number if unit else "N/A"},
            {"field": "Net Price",      "value": self._format_currency(booking.final_price or booking.property_price)},
            {"field": "Booking Date",   "value": self._format_date(booking.booking_date)},
            {"field": "Status",         "value": booking.status.upper()},
            {"field": "Nominee",        "value": booking.nominee_name or "N/A"},
            {"field": "Nominee CNIC",   "value": booking.nominee_cnic or "N/A"},
            {"field": "Nominee Phone",  "value": booking.nominee_phone or "N/A"},
        ]

        meta = self._make_meta(
            title=f"Booking Form: {booking.booking_id}",
            filters=filters,
            total_records=len(rows),
            subtitle=f"Customer: {client.name if client else 'N/A'} | Property: {prop.name if prop else 'N/A'}",
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            sub_tables={
                "document_data": {
                    "booking_info":     booking_info,
                    "applicant":        applicant,
                    "joint_applicant":  joint_applicant,
                    "nominee":          nominee,
                    "property":         property_info,
                    "payment_plan":     payment_plan,
                    "booking_id":       booking.booking_id,
                }
            },
            generation_time_ms=self._elapsed_ms(start),
        )
