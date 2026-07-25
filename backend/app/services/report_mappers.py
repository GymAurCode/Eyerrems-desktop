"""Report data mappers — each registered report type maps DB data to ReportData.

To add a new report:
  1. Write a function that accepts (db: Session, payload: dict) → ReportData
  2. Decorate it with @register_report("your_report_type")
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.auth import User
from app.models.booking import Booking, BookingLog
from app.models.crm import (
    Client, Dealer, Deal, Installment, InstallmentPayment, InstallmentPlan, Lead,
    Payment as CrmPayment,
)
from app.models.finance import Commission, Payment, PaymentAllocation, Invoice
from app.models.property import Floor, Property, Unit
from app.models.tenant import Tenant, TenantLease, RentRecord, TenantPayment as TenantPaymentModel
from app.models.hr import Employee as HREmployee
from app.models.ledger import ClientLedgerEntry, DealerLedgerEntry, PropertyLedgerEntry
from app.schemas.report import (
    ReportData, ReportLetterhead, ReportInfoGrid, ReportInfoRow,
    ReportFinancialStripCell, ReportLedgerColumn, ReportLedgerRow,
    ReportLedgerSection, ReportTerms, ReportSignatureRow,
)
from app.services.report_engine import register_report


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt(amount) -> str:
    """Format a number as currency string."""
    if amount is None:
        return "\u2014"
    val = float(amount)
    return f"{val:,.2f}"


def _date(dt) -> str:
    if dt is None:
        return "\u2014"
    if hasattr(dt, "strftime"):
        return dt.strftime("%d/%m/%Y")
    return str(dt)


def _status_dots(status: str) -> str:
    """Map status to dot state for the template."""
    s = (status or "").lower()
    if s in ("paid", "completed", "confirmed", "active", "posted"):
        return "paid"
    if s in ("partial", "pending", "reserved"):
        return "partial"
    return "pending"


# ══════════════════════════════════════════════════════════════════════════════
# 1. Customer / Booking Statement
# ══════════════════════════════════════════════════════════════════════════════

@register_report("booking_statement")
def booking_statement(db: Session, payload: dict) -> Optional[ReportData]:
    booking_id = payload.get("entity_id")
    booking = db.query(Booking).options(
        joinedload(Booking.client),
        joinedload(Booking.property),
        joinedload(Booking.unit),
        joinedload(Booking.installment_plan),
        joinedload(Booking.assigned_dealer),
    ).filter(Booking.id == booking_id).first()
    if not booking:
        return None

    client = booking.client
    prop = booking.property

    # Installments as ledger
    plan = booking.installment_plan
    ledger_rows = []
    total_paid = Decimal("0")
    total_due = Decimal("0")

    if plan and plan.installments:
        for inst in plan.installments:
            paid = inst.paid_amount or Decimal("0")
            due = inst.amount or Decimal("0")
            total_paid += paid
            total_due += due
            ledger_rows.append(ReportLedgerRow(
                cells=[
                    _date(inst.due_date),
                    f"Installment #{inst.id}",
                    _fmt(inst.amount),
                    _fmt(paid),
                    _fmt(due - paid),
                ],
                status=_status_dots(inst.status),
                is_milestone=inst.type == "milestone",
            ))

    # Totals from booking financials
    price = booking.final_price or booking.property_price or Decimal("0")
    outstanding = total_due - total_paid

    entity_rows = [
        ReportInfoRow(label="Project", value=prop.name if prop else "N/A"),
        ReportInfoRow(label="Unit No.", value=booking.unit.unit_number if booking.unit else "N/A"),
    ]
    if prop:
        if prop.address:
            entity_rows.append(ReportInfoRow(label="Address", value=prop.address))
        if prop.size:
            unit_label = prop.size_unit or ""
            entity_rows.append(ReportInfoRow(label="Size", value=f"{prop.size} {unit_label}".strip()))
        if prop.category:
            entity_rows.append(ReportInfoRow(label="Category", value=prop.category))
        if prop.owner_name:
            entity_rows.append(ReportInfoRow(label="Owner", value=prop.owner_name))
        if prop.regulatory_authority:
            entity_rows.append(ReportInfoRow(label="Authority", value=prop.regulatory_authority))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Booking Statement",
            subtitle=f"Property: {prop.name if prop else 'N/A'} | Unit: {booking.unit.unit_number if booking.unit else 'N/A'}",
            reference_no=booking.booking_id,
            date=_date(booking.created_at),
            status=booking.status,
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Customer Name", value=client.name if client else ""),
                ReportInfoRow(label="CNIC", value=client.cnic or ""),
                ReportInfoRow(label="Phone", value=client.phone or ""),
            ],
            right_column=[
                ReportInfoRow(label="Booking ID", value=booking.booking_id),
                ReportInfoRow(label="Booking Date", value=_date(booking.booking_date)),
                ReportInfoRow(label="Status", value=booking.status.upper()),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Property Price", value=_fmt(price)),
            ReportFinancialStripCell(label="Down Payment", value=_fmt(booking.down_payment)),
            ReportFinancialStripCell(label="Total Paid", value=_fmt(total_paid)),
            ReportFinancialStripCell(label="Total Due", value=_fmt(total_due)),
            ReportFinancialStripCell(label="Outstanding", value=_fmt(outstanding), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="due_date", label="Due Date", align="left"),
                ReportLedgerColumn(key="description", label="Description", align="left"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
                ReportLedgerColumn(key="paid", label="Paid", align="right", format="currency"),
                ReportLedgerColumn(key="balance", label="Balance", align="right", format="currency"),
            ],
            rows=ledger_rows,
            totals_row=ReportLedgerRow(
                cells=["", "TOTAL", _fmt(total_due), _fmt(total_paid), _fmt(outstanding)],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text=(
            "This is a computer-generated statement and does not require a physical signature. "
            "All amounts are in PKR. E&OE."
        )),
        signature=ReportSignatureRow(
            customer_name=client.name if client else "",
            authorized_name="Authorized Signatory",
        ),
        entity_info=entity_rows,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 2. Payment Ledger / Installment Schedule
# ══════════════════════════════════════════════════════════════════════════════

@register_report("payment_ledger")
def payment_ledger(db: Session, payload: dict) -> Optional[ReportData]:
    entity_id = payload.get("entity_id")
    client = db.query(Client).filter(Client.id == entity_id).first()
    if not client:
        return None

    entries = db.query(ClientLedgerEntry).filter(
        ClientLedgerEntry.client_id == entity_id
    ).order_by(ClientLedgerEntry.entry_date).all()

    rows = []
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    for e in entries:
        total_debit += e.debit or Decimal("0")
        total_credit += e.credit or Decimal("0")
        rows.append(ReportLedgerRow(
            cells=[
                _date(e.entry_date),
                e.reference_no or "\u2014",
                e.description,
                _fmt(e.debit),
                _fmt(e.credit),
                _fmt(e.running_balance),
            ],
            status=_status_dots(e.status),
        ))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Payment Ledger",
            subtitle=f"Customer: {client.name}",
            reference_no=f"CL-{client.client_id}",
            status="Posted",
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Customer Name", value=client.name),
                ReportInfoRow(label="Client ID", value=client.client_id),
                ReportInfoRow(label="CNIC", value=client.cnic or ""),
            ],
            right_column=[
                ReportInfoRow(label="Phone", value=client.phone or ""),
                ReportInfoRow(label="Email", value=client.email or ""),
                ReportInfoRow(label="City", value=client.city or ""),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Debit", value=_fmt(total_debit)),
            ReportFinancialStripCell(label="Total Credit", value=_fmt(total_credit)),
            ReportFinancialStripCell(
                label="Running Balance",
                value=_fmt(total_debit - total_credit),
                inverted=True,
            ),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="date", label="Date", align="left"),
                ReportLedgerColumn(key="ref", label="Ref #", align="left"),
                ReportLedgerColumn(key="description", label="Description", align="left"),
                ReportLedgerColumn(key="debit", label="Debit", align="right", format="currency"),
                ReportLedgerColumn(key="credit", label="Credit", align="right", format="currency"),
                ReportLedgerColumn(key="balance", label="Balance", align="right", format="currency"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(
                cells=["", "", "TOTAL", _fmt(total_debit), _fmt(total_credit), _fmt(total_debit - total_credit)],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text="This is a computer-generated ledger statement. E&OE."),
        signature=ReportSignatureRow(customer_name=client.name),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 3. Payment Plan / Agreement
# ══════════════════════════════════════════════════════════════════════════════

@register_report("payment_plan")
def payment_plan(db: Session, payload: dict) -> Optional[ReportData]:
    plan_id = payload.get("entity_id")
    plan = db.query(InstallmentPlan).options(
        joinedload(InstallmentPlan.booking),
        joinedload(InstallmentPlan.installments),
    ).filter(InstallmentPlan.id == plan_id).first()
    if not plan:
        return None

    booking = plan.booking
    rows = []
    total_amount = Decimal("0")
    for inst in plan.installments:
        total_amount += inst.amount or Decimal("0")
        rows.append(ReportLedgerRow(
            cells=[
                _date(inst.due_date),
                f"Installment #{inst.id}",
                inst.type.capitalize() if inst.type else "Custom",
                _fmt(inst.amount),
                inst.status.upper(),
            ],
            status=_status_dots(inst.status),
        ))

    client_name = booking.client.name if booking and booking.client else ""

    return ReportData(
        letterhead=ReportLetterhead(
            title="Payment Plan / Agreement",
            reference_no=booking.booking_id if booking else None,
            status=plan.down_payment_status or "Pending",
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Customer", value=client_name),
                ReportInfoRow(label="Total Amount", value=_fmt(plan.total_amount)),
                ReportInfoRow(label="Down Payment", value=_fmt(plan.down_payment)),
            ],
            right_column=[
                ReportInfoRow(label="Installments", value=str(plan.total_count or len(plan.installments))),
                ReportInfoRow(label="Frequency", value=(plan.frequency or "").capitalize()),
                ReportInfoRow(label="Amount/Installment", value=_fmt(plan.amount_per or 0)),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Plan Value", value=_fmt(plan.total_amount)),
            ReportFinancialStripCell(label="Down Payment", value=_fmt(plan.down_payment)),
            ReportFinancialStripCell(label="Remaining", value=_fmt(plan.remaining_amount), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="due_date", label="Due Date", align="left"),
                ReportLedgerColumn(key="description", label="Description", align="left"),
                ReportLedgerColumn(key="type", label="Type", align="left"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(
                cells=["", "TOTAL", "", _fmt(total_amount), ""],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text=(
            "This Payment Plan is an agreement between the Customer and the Company. "
            "All payments must be made by the due dates specified above. Late payments may incur additional charges."
        )),
        signature=ReportSignatureRow(
            customer_name=client_name,
            authorized_name="Authorized Signatory",
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 4. Outstanding Dues / Overdue Installments
# ══════════════════════════════════════════════════════════════════════════════

@register_report("outstanding_dues")
def outstanding_dues(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    today = datetime.now(timezone.utc).date()

    query = db.query(Installment).join(InstallmentPlan).join(
        Booking, InstallmentPlan.booking_id == Booking.id
    ).options(
        joinedload(Installment.plan).joinedload(InstallmentPlan.booking).joinedload(Booking.client),
    ).filter(
        Installment.status.in_(["pending", "partial"]),
        Installment.due_date <= today,
    )

    if filters.get("client_id"):
        query = query.filter(Booking.client_id == filters["client_id"])
    if filters.get("project_id"):
        query = query.filter(Booking.project_id == filters["project_id"])

    installments = query.order_by(Installment.due_date).all()

    rows = []
    total_due = Decimal("0")
    total_paid = Decimal("0")
    total_outstanding = Decimal("0")
    for inst in installments:
        due = inst.amount or Decimal("0")
        paid = inst.paid_amount or Decimal("0")
        outstanding = due - paid
        total_due += due
        total_paid += paid
        total_outstanding += outstanding
        client_name = inst.plan.booking.client.name if inst.plan and inst.plan.booking and inst.plan.booking.client else ""
        rows.append(ReportLedgerRow(
            cells=[
                client_name,
                inst.plan.booking.booking_id if inst.plan and inst.plan.booking else "",
                _date(inst.due_date),
                _fmt(due),
                _fmt(paid),
                _fmt(outstanding),
            ],
            status="pending",
        ))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Outstanding Dues Report",
            subtitle=f"As of {_date(today)}",
            status="Overdue",
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Report Date", value=_date(today)),
                ReportInfoRow(label="Total Overdue Installments", value=str(len(installments))),
            ],
            right_column=[
                ReportInfoRow(label="Filter: Client ID", value=str(filters.get("client_id", "All"))),
                ReportInfoRow(label="Filter: Project", value=str(filters.get("project_id", "All"))),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Due", value=_fmt(total_due)),
            ReportFinancialStripCell(label="Total Paid", value=_fmt(total_paid)),
            ReportFinancialStripCell(label="Outstanding", value=_fmt(total_outstanding), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="customer", label="Customer", align="left"),
                ReportLedgerColumn(key="booking", label="Booking", align="left"),
                ReportLedgerColumn(key="due_date", label="Due Date", align="left"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
                ReportLedgerColumn(key="paid", label="Paid", align="right", format="currency"),
                ReportLedgerColumn(key="outstanding", label="Outstanding", align="right", format="currency"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(
                cells=["", "", "TOTAL", _fmt(total_due), _fmt(total_paid), _fmt(total_outstanding)],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text="This report lists all installment dues that are past their due date. E&OE."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 5. Unit / Inventory Availability
# ══════════════════════════════════════════════════════════════════════════════

@register_report("unit_availability")
def unit_availability(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Unit).options(
        joinedload(Unit.floor).joinedload(Floor.property)
    )

    if filters.get("project_id"):
        query = query.filter(Unit.property_id == filters["project_id"])
    if filters.get("status"):
        query = query.filter(Unit.status == filters["status"])
    if filters.get("floor_id"):
        query = query.filter(Unit.floor_id == filters["floor_id"])

    units = query.order_by(Unit.property_id, Unit.floor_number, Unit.unit_number).all()

    rows = []
    total_available = 0
    total_booked = 0
    total_sold = 0
    for u in units:
        s = (u.status or "").lower()
        if s == "available":
            total_available += 1
        elif s in ("booked", "reserved"):
            total_booked += 1
        elif s == "sold":
            total_sold += 1
        prop_name = u.floor.property.name if u.floor and u.floor.property else ""
        rows.append(ReportLedgerRow(
            cells=[
                prop_name,
                f"Floor {u.floor_number or ''}",
                u.unit_number,
                u.unit_type or "",
                (u.status or "").upper(),
            ],
        ))

    total_units = len(units)

    return ReportData(
        letterhead=ReportLetterhead(
            title="Unit Availability Report",
            subtitle=f"Total Units: {total_units}",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Total Units", value=str(total_units)),
                ReportInfoRow(label="Available", value=str(total_available)),
            ],
            right_column=[
                ReportInfoRow(label="Booked/Reserved", value=str(total_booked)),
                ReportInfoRow(label="Sold", value=str(total_sold)),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Available", value=str(total_available)),
            ReportFinancialStripCell(label="Booked", value=str(total_booked)),
            ReportFinancialStripCell(label="Sold", value=str(total_sold)),
            ReportFinancialStripCell(label="Total", value=str(total_units), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="property", label="Property/Project", align="left"),
                ReportLedgerColumn(key="floor", label="Floor", align="left"),
                ReportLedgerColumn(key="unit", label="Unit", align="left"),
                ReportLedgerColumn(key="type", label="Type", align="left"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Unit availability is as of the report date and subject to change."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 6. Sales Summary Report
# ══════════════════════════════════════════════════════════════════════════════

@register_report("sales_summary")
def sales_summary(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Booking).options(
        joinedload(Booking.client),
        joinedload(Booking.property),
        joinedload(Booking.assigned_dealer),
    )

    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(Booking.booking_date >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(Booking.booking_date <= dt.strptime(filters["date_to"], "%Y-%m-%d"))
    if filters.get("project_id"):
        query = query.filter(Booking.project_id == filters["project_id"])
    if filters.get("dealer_id"):
        query = query.filter(Booking.assigned_dealer_id == filters["dealer_id"])
    if filters.get("status"):
        query = query.filter(Booking.status == filters["status"])

    bookings = query.order_by(Booking.booking_date.desc()).all()

    rows = []
    total_value = Decimal("0")
    total_down = Decimal("0")
    for b in bookings:
        val = b.final_price or b.property_price or Decimal("0")
        total_value += val
        total_down += b.down_payment or Decimal("0")
        dealer_name = b.assigned_dealer.name if b.assigned_dealer else ""
        rows.append(ReportLedgerRow(
            cells=[
                b.booking_id,
                b.client.name if b.client else "",
                b.property.name if b.property else "",
                dealer_name,
                _date(b.booking_date),
                _fmt(val),
                b.status.upper(),
            ],
        ))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Sales Summary Report",
            subtitle=f"Total Bookings: {len(bookings)}",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Period From", value=filters.get("date_from", "All")),
                ReportInfoRow(label="Period To", value=filters.get("date_to", "All")),
            ],
            right_column=[
                ReportInfoRow(label="Project", value=str(filters.get("project_id", "All"))),
                ReportInfoRow(label="Status", value=filters.get("status", "All")),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Bookings", value=str(len(bookings))),
            ReportFinancialStripCell(label="Total Value", value=_fmt(total_value)),
            ReportFinancialStripCell(label="Total Down Payment", value=_fmt(total_down)),
            ReportFinancialStripCell(label="Avg. Booking Value", value=_fmt(total_value / len(bookings) if bookings else 0), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="booking_id", label="Booking ID", align="left"),
                ReportLedgerColumn(key="customer", label="Customer", align="left"),
                ReportLedgerColumn(key="property", label="Property", align="left"),
                ReportLedgerColumn(key="dealer", label="Agent/Dealer", align="left"),
                ReportLedgerColumn(key="date", label="Date", align="left"),
                ReportLedgerColumn(key="value", label="Value", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(
                cells=["", "", "", "", "TOTAL", _fmt(total_value), ""],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text="Sales summary is based on confirmed booking records. E&OE."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 7. Agent / Dealer Commission Report
# ══════════════════════════════════════════════════════════════════════════════

@register_report("commission_report")
def commission_report(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Commission).options(
        joinedload(Commission.dealer),
        joinedload(Commission.property),
        joinedload(Commission.deal),
    )

    if filters.get("dealer_id"):
        query = query.filter(Commission.dealer_id == filters["dealer_id"])
    if filters.get("payment_status"):
        query = query.filter(Commission.payment_status == filters["payment_status"])
    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(Commission.date >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(Commission.date <= dt.strptime(filters["date_to"], "%Y-%m-%d"))

    commissions = query.order_by(Commission.date.desc()).all()

    rows = []
    total_commission = Decimal("0")
    total_paid = Decimal("0")
    total_unpaid = Decimal("0")
    for c in commissions:
        amount = c.amount or Decimal("0")
        total_commission += amount
        if c.payment_status == "paid":
            total_paid += amount
        else:
            total_unpaid += amount
        rows.append(ReportLedgerRow(
            cells=[
                c.dealer.name if c.dealer else "",
                c.property.name if c.property else "",
                _date(c.date),
                c.type or "",
                _fmt(c.sale_amount or 0),
                f"{float(c.commission_rate or 0) * 100:.2f}%",
                _fmt(amount),
                (c.payment_status or "").upper(),
            ],
        ))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Agent / Dealer Commission Report",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Total Entries", value=str(len(commissions))),
                ReportInfoRow(label="Total Commission", value=_fmt(total_commission)),
            ],
            right_column=[
                ReportInfoRow(label="Total Paid", value=_fmt(total_paid)),
                ReportInfoRow(label="Total Unpaid", value=_fmt(total_unpaid)),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Commission", value=_fmt(total_commission)),
            ReportFinancialStripCell(label="Paid", value=_fmt(total_paid)),
            ReportFinancialStripCell(label="Unpaid", value=_fmt(total_unpaid), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="dealer", label="Agent/Dealer", align="left"),
                ReportLedgerColumn(key="property", label="Property", align="left"),
                ReportLedgerColumn(key="date", label="Date", align="left"),
                ReportLedgerColumn(key="type", label="Type", align="left"),
                ReportLedgerColumn(key="sale", label="Sale Amount", align="right", format="currency"),
                ReportLedgerColumn(key="rate", label="Rate", align="right"),
                ReportLedgerColumn(key="commission", label="Commission", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(
                cells=["", "", "", "", "", "", _fmt(total_commission), ""],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text="Commission report based on recorded transactions. E&OE."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 8. Cancellation / Refund Report
# ══════════════════════════════════════════════════════════════════════════════

@register_report("cancellation_report")
def cancellation_report(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Booking).options(
        joinedload(Booking.client),
        joinedload(Booking.property),
    ).filter(Booking.status.in_(["cancelled", "refunded", "expired"]))

    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(Booking.cancelled_at >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(Booking.cancelled_at <= dt.strptime(filters["date_to"], "%Y-%m-%d"))
    if filters.get("status"):
        query = query.filter(Booking.status == filters["status"])

    cancelled = query.order_by(Booking.cancelled_at.desc()).all()

    rows = []
    total_value = Decimal("0")
    total_down = Decimal("0")
    for b in cancelled:
        val = b.final_price or b.property_price or Decimal("0")
        total_value += val
        total_down += b.down_payment or Decimal("0")
        rows.append(ReportLedgerRow(
            cells=[
                b.booking_id,
                b.client.name if b.client else "",
                b.property.name if b.property else "",
                _date(b.booking_date),
                _date(b.cancelled_at),
                _fmt(val),
                (b.status or "").upper(),
            ],
        ))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Cancellation / Refund Report",
            subtitle=f"Records: {len(cancelled)}",
            date=_date(datetime.now(timezone.utc)),
            status="Cancelled",
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Cancelled Bookings", value=str(len(cancelled))),
                ReportInfoRow(label="Total Value", value=_fmt(total_value)),
            ],
            right_column=[
                ReportInfoRow(label="Total Down Payment", value=_fmt(total_down)),
                ReportInfoRow(label="Total Refundable", value="\u2014"),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Cancelled", value=str(len(cancelled))),
            ReportFinancialStripCell(label="Booking Value", value=_fmt(total_value)),
            ReportFinancialStripCell(label="Down Payment", value=_fmt(total_down)),
            ReportFinancialStripCell(label="Net Impact", value=_fmt(total_value), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="booking_id", label="Booking ID", align="left"),
                ReportLedgerColumn(key="customer", label="Customer", align="left"),
                ReportLedgerColumn(key="property", label="Property", align="left"),
                ReportLedgerColumn(key="booking_date", label="Booking Date", align="left"),
                ReportLedgerColumn(key="cancelled_at", label="Cancelled On", align="left"),
                ReportLedgerColumn(key="value", label="Value", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="All cancellation and refund records as per system logs. E&OE."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 9. Receipt / Voucher (single transaction)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("receipt_voucher")
def receipt_voucher(db: Session, payload: dict) -> Optional[ReportData]:
    payment_id = payload.get("entity_id")
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        return None

    allocations = db.query(PaymentAllocation).filter(
        PaymentAllocation.payment_id == payment_id
    ).all()

    rows = []
    total_allocated = Decimal("0")
    for alloc in allocations:
        total_allocated += alloc.allocated_amount or Decimal("0")
        inv_no = alloc.invoice.invoice_number if alloc.invoice else "\u2014"
        rows.append(ReportLedgerRow(
            cells=[
                inv_no,
                _date(alloc.invoice.invoice_date if alloc.invoice else None),
                _fmt(alloc.allocated_amount),
            ],
        ))

    if not rows:
        rows.append(ReportLedgerRow(
            cells=[payment.receipt_number or payment.payment_number or "", "\u2014", _fmt(payment.amount)],
        ))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Payment Receipt / Voucher",
            reference_no=f"RCT-{payment.receipt_number or payment.payment_number or payment.id}",
            date=_date(payment.date),
            status="Paid",
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Receipt No.", value=payment.receipt_number or payment.payment_number or ""),
                ReportInfoRow(label="Payment Date", value=_date(payment.date)),
                ReportInfoRow(label="Payment Method", value=(payment.method or "").upper()),
            ],
            right_column=[
                ReportInfoRow(label="Party Name", value=payment.party_name or ""),
                ReportInfoRow(label="Party CNIC", value=payment.party_cnic or ""),
                ReportInfoRow(label="Reference", value=payment.reference_number or ""),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(
                label="Amount Received",
                value=_fmt(payment.amount),
                inverted=True,
            ),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="invoice", label="Invoice", align="left"),
                ReportLedgerColumn(key="date", label="Date", align="left"),
                ReportLedgerColumn(key="amount", label="Allocated Amount", align="right", format="currency"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(
                cells=["", "TOTAL", _fmt(total_allocated or payment.amount)],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text="This is a computer-generated receipt. No signature required."),
        signature=ReportSignatureRow(
            customer_name=payment.party_name or "",
            authorized_name="Received By",
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 10. Booking Detail (single booking, full breakdown)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("booking_detail")
def booking_detail(db: Session, payload: dict) -> Optional[ReportData]:
    booking_id = payload.get("entity_id")
    booking = db.query(Booking).options(
        joinedload(Booking.client),
        joinedload(Booking.property),
        joinedload(Booking.unit),
        joinedload(Booking.installment_plan),
        joinedload(Booking.assigned_dealer),
    ).filter(Booking.id == booking_id).first()
    if not booking:
        return None

    client = booking.client
    prop = booking.property
    unit = booking.unit
    plan = booking.installment_plan
    dealer = booking.assigned_dealer

    rows = []
    total_paid = Decimal("0")
    total_due = Decimal("0")
    if plan and plan.installments:
        for inst in plan.installments:
            paid = inst.paid_amount or Decimal("0")
            due = inst.amount or Decimal("0")
            total_paid += paid
            total_due += due
            rows.append(ReportLedgerRow(
                cells=[_date(inst.due_date), f"#{inst.id}", inst.type.capitalize() if inst.type else "",
                       _fmt(inst.amount), _fmt(paid), _fmt(due - paid), (inst.status or "").upper()],
                status=_status_dots(inst.status),
                is_milestone=inst.type == "milestone",
            ))

    price = booking.final_price or booking.property_price or Decimal("0")
    outstanding = total_due - total_paid

    entity_rows = [
        ReportInfoRow(label="Project", value=prop.name if prop else "N/A"),
        ReportInfoRow(label="Unit No.", value=unit.unit_number if unit else "N/A"),
    ]
    if prop:
        if prop.address:
            entity_rows.append(ReportInfoRow(label="Address", value=prop.address))
        if prop.size:
            ul = prop.size_unit or ""
            entity_rows.append(ReportInfoRow(label="Size", value=f"{prop.size} {ul}".strip()))
        if prop.category:
            entity_rows.append(ReportInfoRow(label="Category", value=prop.category))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Booking Detail Report",
            subtitle=f"{prop.name if prop else 'N/A'} | Unit: {unit.unit_number if unit else 'N/A'}",
            reference_no=booking.booking_id,
            date=_date(booking.created_at),
            status=booking.status,
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Customer", value=client.name if client else ""),
                ReportInfoRow(label="CNIC", value=client.cnic or "" if client else ""),
                ReportInfoRow(label="Phone", value=client.phone or "" if client else ""),
                ReportInfoRow(label="Dealer", value=dealer.name if dealer else ""),
            ],
            right_column=[
                ReportInfoRow(label="Booking ID", value=booking.booking_id),
                ReportInfoRow(label="Booking Date", value=_date(booking.booking_date)),
                ReportInfoRow(label="Property Price", value=_fmt(price)),
                ReportInfoRow(label="Status", value=(booking.status or "").upper()),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Price", value=_fmt(price)),
            ReportFinancialStripCell(label="Down Payment", value=_fmt(booking.down_payment)),
            ReportFinancialStripCell(label="Total Paid", value=_fmt(total_paid)),
            ReportFinancialStripCell(label="Total Due", value=_fmt(total_due)),
            ReportFinancialStripCell(label="Outstanding", value=_fmt(outstanding), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="due_date", label="Due Date"),
                ReportLedgerColumn(key="inst_no", label="Inst #"),
                ReportLedgerColumn(key="type", label="Type"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
                ReportLedgerColumn(key="paid", label="Paid", align="right", format="currency"),
                ReportLedgerColumn(key="balance", label="Balance", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(
                cells=["", "", "TOTAL", _fmt(total_due), _fmt(total_paid), _fmt(outstanding), ""],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text="Booking detail report generated from system records."),
        signature=ReportSignatureRow(
            customer_name=client.name if client else "",
            authorized_name="Authorized Signatory",
        ),
        entity_info=entity_rows,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 11. Bookings Register (all bookings, filterable)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("bookings_register")
def bookings_register(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Booking).options(
        joinedload(Booking.client), joinedload(Booking.property),
        joinedload(Booking.assigned_dealer),
    )

    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(Booking.booking_date >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(Booking.booking_date <= dt.strptime(filters["date_to"], "%Y-%m-%d"))
    if filters.get("project_id"):
        query = query.filter(Booking.project_id == filters["project_id"])
    if filters.get("status"):
        query = query.filter(Booking.status == filters["status"])

    bookings = query.order_by(Booking.booking_date.desc()).all()

    rows = []
    total_value = Decimal("0")
    total_down = Decimal("0")
    for b in bookings:
        val = b.final_price or b.property_price or Decimal("0")
        total_value += val
        total_down += b.down_payment or Decimal("0")
        rows.append(ReportLedgerRow(cells=[
            b.booking_id, b.client.name if b.client else "",
            b.property.name if b.property else "",
            _date(b.booking_date), _fmt(val), (b.status or "").upper(),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Bookings Register",
            subtitle=f"Total: {len(bookings)} bookings",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Period", value=f"{filters.get('date_from', 'All')} — {filters.get('date_to', 'All')}")],
            right_column=[ReportInfoRow(label="Status Filter", value=filters.get("status", "All"))],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Bookings", value=str(len(bookings))),
            ReportFinancialStripCell(label="Total Value", value=_fmt(total_value)),
            ReportFinancialStripCell(label="Avg Value", value=_fmt(total_value / len(bookings) if bookings else 0), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="id", label="Booking ID"),
                ReportLedgerColumn(key="customer", label="Customer"),
                ReportLedgerColumn(key="property", label="Property"),
                ReportLedgerColumn(key="date", label="Date"),
                ReportLedgerColumn(key="value", label="Value", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(cells=["", "", "", "TOTAL", _fmt(total_value), ""], is_total=True),
        ),
        terms=ReportTerms(text="Booking register as of report date."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 12. Customer Portfolio Summary
# ══════════════════════════════════════════════════════════════════════════════

@register_report("customer_portfolio_summary")
def customer_portfolio_summary(db: Session, payload: dict) -> Optional[ReportData]:
    clients = db.query(Client).outerjoin(Booking).all()
    total = len(clients)
    active = sum(1 for c in clients if any(b.status == "active" for b in c.bookings))
    total_bookings = sum(len(c.bookings) for c in clients)
    total_value = sum((b.final_price or b.property_price or Decimal("0")) for c in clients for b in c.bookings)
    rows = []
    for c in clients:
        bc = len(c.bookings)
        bv = sum((b.final_price or b.property_price or Decimal("0")) for b in c.bookings)
        rows.append(ReportLedgerRow(cells=[
            c.name or "", c.client_id or "", c.phone or "",
            str(bc), _fmt(bv),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Customer Portfolio Summary",
            subtitle=f"{total} customers · {total_bookings} bookings",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Total Customers", value=str(total)),
                ReportInfoRow(label="Active Customers", value=str(active)),
            ],
            right_column=[
                ReportInfoRow(label="Total Bookings", value=str(total_bookings)),
                ReportInfoRow(label="Portfolio Value", value=_fmt(total_value)),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Customers", value=str(total)),
            ReportFinancialStripCell(label="Bookings", value=str(total_bookings)),
            ReportFinancialStripCell(label="Portfolio Value", value=_fmt(total_value), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="name", label="Customer Name"),
                ReportLedgerColumn(key="id", label="Client ID"),
                ReportLedgerColumn(key="phone", label="Phone"),
                ReportLedgerColumn(key="bookings", label="Bookings", align="right"),
                ReportLedgerColumn(key="value", label="Total Value", align="right", format="currency"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Customer portfolio summary — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 13. Customers Register
# ══════════════════════════════════════════════════════════════════════════════

@register_report("customers_register")
def customers_register(db: Session, payload: dict) -> Optional[ReportData]:
    clients = db.query(Client).order_by(Client.name).all()
    rows = []
    for c in clients:
        bc = len(c.bookings)
        rows.append(ReportLedgerRow(cells=[
            c.name or "", c.client_id or "", c.cnic or "",
            c.phone or "", c.email or "", c.city or "",
            str(bc),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Customers Register",
            subtitle=f"{len(clients)} registered customers",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(),
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="name", label="Name"),
                ReportLedgerColumn(key="id", label="Client ID"),
                ReportLedgerColumn(key="cnic", label="CNIC"),
                ReportLedgerColumn(key="phone", label="Phone"),
                ReportLedgerColumn(key="email", label="Email"),
                ReportLedgerColumn(key="city", label="City"),
                ReportLedgerColumn(key="bookings", label="Bookings", align="right"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Customer register — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 14. Pipeline Summary (deals by stage)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("pipeline_summary")
def pipeline_summary(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Deal).options(joinedload(Deal.client), joinedload(Deal.property))
    if filters.get("dealer_id"):
        query = query.filter(Deal.dealer_id == filters["dealer_id"])
    deals = query.all()

    stages = {}
    for d in deals:
        s = d.status or "unknown"
        stages.setdefault(s, {"count": 0, "value": Decimal("0")})
        stages[s]["count"] += 1
        stages[s]["value"] += d.deal_value or Decimal("0")

    stage_order = ["draft", "negotiation", "won", "lost", "cancelled"]
    rows = []
    total_count = 0
    total_value = Decimal("0")
    for s in stage_order:
        if s in stages:
            st = stages[s]
            total_count += st["count"]
            total_value += st["value"]
            rows.append(ReportLedgerRow(cells=[s.upper(), str(st["count"]), _fmt(st["value"])]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Pipeline Summary",
            subtitle=f"{total_count} total deals",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Total Deals", value=str(total_count))],
            right_column=[ReportInfoRow(label="Pipeline Value", value=_fmt(total_value))],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Deals", value=str(total_count)),
            ReportFinancialStripCell(label="Pipeline Value", value=_fmt(total_value), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="stage", label="Stage", align="center"),
                ReportLedgerColumn(key="count", label="Count", align="right"),
                ReportLedgerColumn(key="value", label="Value", align="right", format="currency"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(cells=["TOTAL", str(total_count), _fmt(total_value)], is_total=True),
        ),
        terms=ReportTerms(text="Pipeline summary by deal stage."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 15. Deal Detail (single deal full breakdown)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("deal_detail")
def deal_detail(db: Session, payload: dict) -> Optional[ReportData]:
    deal_id = payload.get("entity_id")
    deal = db.query(Deal).options(
        joinedload(Deal.client), joinedload(Deal.property),
        joinedload(Deal.unit), joinedload(Deal.dealer),
    ).filter(Deal.id == deal_id).first()
    if not deal:
        return None

    return ReportData(
        letterhead=ReportLetterhead(
            title="Deal Detail Report",
            reference_no=deal.deal_id,
            date=_date(deal.deal_date),
            status=deal.status,
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Deal ID", value=deal.deal_id),
                ReportInfoRow(label="Title", value=deal.deal_title or ""),
                ReportInfoRow(label="Client", value=deal.client.name if deal.client else ""),
                ReportInfoRow(label="Client Role", value=deal.client_role or ""),
                ReportInfoRow(label="Dealer/Agent", value=deal.dealer.name if deal.dealer else ""),
            ],
            right_column=[
                ReportInfoRow(label="Property", value=deal.property.name if deal.property else ""),
                ReportInfoRow(label="Deal Value", value=_fmt(deal.deal_value)),
                ReportInfoRow(label="Down Payment", value=_fmt(deal.down_payment)),
                ReportInfoRow(label="Discount", value=_fmt(deal.discount)),
                ReportInfoRow(label="Status", value=(deal.status or "").upper()),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Deal Value", value=_fmt(deal.deal_value)),
            ReportFinancialStripCell(label="Down Payment", value=_fmt(deal.down_payment)),
            ReportFinancialStripCell(label="Discount", value=_fmt(deal.discount)),
            ReportFinancialStripCell(label="Net Amount", value=_fmt(deal.net_amount or deal.deal_value), inverted=True),
        ],
        ledger=ReportLedgerSection(columns=[], rows=[]),
        terms=ReportTerms(text=deal.notes or "Deal detail from system records."),
        signature=ReportSignatureRow(
            customer_name=deal.client.name if deal.client else "",
            authorized_name="Authorized Signatory",
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 16. Deals Register (all deals filterable)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("deals_register")
def deals_register(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Deal).options(joinedload(Deal.client), joinedload(Deal.property), joinedload(Deal.dealer))
    if filters.get("status"):
        query = query.filter(Deal.status == filters["status"])
    if filters.get("dealer_id"):
        query = query.filter(Deal.dealer_id == filters["dealer_id"])
    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(Deal.deal_date >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(Deal.deal_date <= dt.strptime(filters["date_to"], "%Y-%m-%d"))

    deals = query.order_by(Deal.deal_date.desc()).all()
    rows = []
    total_value = Decimal("0")
    for d in deals:
        total_value += d.deal_value or Decimal("0")
        rows.append(ReportLedgerRow(cells=[
            d.deal_id, d.deal_title or "", d.client.name if d.client else "",
            d.property.name if d.property else "", _fmt(d.deal_value),
            (d.status or "").upper(), _date(d.deal_date),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Deals Register",
            subtitle=f"{len(deals)} deals",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Status Filter", value=filters.get("status", "All"))],
            right_column=[ReportInfoRow(label="Total Value", value=_fmt(total_value))],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Deals", value=str(len(deals))),
            ReportFinancialStripCell(label="Total Value", value=_fmt(total_value), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="id", label="Deal ID"),
                ReportLedgerColumn(key="title", label="Title"),
                ReportLedgerColumn(key="client", label="Client"),
                ReportLedgerColumn(key="property", label="Property"),
                ReportLedgerColumn(key="value", label="Value", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
                ReportLedgerColumn(key="date", label="Date"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(cells=["", "", "", "", _fmt(total_value), "", ""], is_total=True),
        ),
        terms=ReportTerms(text="Deals register — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 17. Collections Summary (by period/project)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("collections_summary")
def collections_summary(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(InstallmentPayment).options(
        joinedload(InstallmentPayment.installment).joinedload(Installment.plan).joinedload(InstallmentPlan.booking)
    )
    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(InstallmentPayment.payment_date >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(InstallmentPayment.payment_date <= dt.strptime(filters["date_to"], "%Y-%m-%d"))
    if filters.get("project_id"):
        query = query.filter(InstallmentPayment.installment.has(Installment.plan.has(InstallmentPlan.booking.has(Booking.project_id == filters["project_id"]))))

    payments = query.all()
    total_collected = sum(p.amount or Decimal("0") for p in payments)
    count = len(payments)

    rows = []
    for p in payments[:50]:
        b = p.installment.plan.booking if p.installment and p.installment.plan else None
        rows.append(ReportLedgerRow(cells=[
            _date(p.payment_date), b.booking_id if b else "",
            b.client.name if b and b.client else "", _fmt(p.amount),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Collections Summary",
            subtitle=f"{count} payments collected",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Period", value=f"{filters.get('date_from', 'All')} — {filters.get('date_to', 'All')}")],
            right_column=[ReportInfoRow(label="Total Collected", value=_fmt(total_collected))],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Payments", value=str(count)),
            ReportFinancialStripCell(label="Total Collected", value=_fmt(total_collected), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="date", label="Date"),
                ReportLedgerColumn(key="booking", label="Booking"),
                ReportLedgerColumn(key="customer", label="Customer"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(cells=["", "", "TOTAL", _fmt(total_collected)], is_total=True),
        ),
        terms=ReportTerms(text="Collections summary — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 18. Inventory Summary (units by project/floor/status)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("inventory_summary")
def inventory_summary(db: Session, payload: dict) -> Optional[ReportData]:
    units = db.query(Unit).options(joinedload(Unit.floor).joinedload(Floor.property)).all()
    total = len(units)
    avail = sum(1 for u in units if (u.status or "").lower() == "available")
    booked = sum(1 for u in units if (u.status or "").lower() in ("booked", "reserved"))
    sold = sum(1 for u in units if (u.status or "").lower() == "sold")

    projects = {}
    for u in units:
        pn = u.floor.property.name if u.floor and u.floor.property else "Unknown"
        projects.setdefault(pn, {"total": 0, "avail": 0, "booked": 0, "sold": 0})
        projects[pn]["total"] += 1
        s = (u.status or "").lower()
        if s == "available": projects[pn]["avail"] += 1
        elif s in ("booked", "reserved"): projects[pn]["booked"] += 1
        elif s == "sold": projects[pn]["sold"] += 1

    rows = []
    for pn, st in sorted(projects.items()):
        rows.append(ReportLedgerRow(cells=[pn, str(st["avail"]), str(st["booked"]), str(st["sold"]), str(st["total"])]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Inventory Summary",
            subtitle=f"{total} total units",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Available", value=str(avail)), ReportInfoRow(label="Booked/Reserved", value=str(booked))],
            right_column=[ReportInfoRow(label="Sold", value=str(sold)), ReportInfoRow(label="Total Units", value=str(total))],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Available", value=str(avail)),
            ReportFinancialStripCell(label="Booked", value=str(booked)),
            ReportFinancialStripCell(label="Sold", value=str(sold)),
            ReportFinancialStripCell(label="Total", value=str(total), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="project", label="Project"),
                ReportLedgerColumn(key="avail", label="Available", align="right"),
                ReportLedgerColumn(key="booked", label="Booked", align="right"),
                ReportLedgerColumn(key="sold", label="Sold", align="right"),
                ReportLedgerColumn(key="total", label="Total", align="right"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(cells=["TOTAL", str(avail), str(booked), str(sold), str(total)], is_total=True),
        ),
        terms=ReportTerms(text="Inventory summary — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 19. Unit Detail (single unit full history)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("unit_detail")
def unit_detail(db: Session, payload: dict) -> Optional[ReportData]:
    unit_id = payload.get("entity_id")
    unit = db.query(Unit).options(
        joinedload(Unit.floor).joinedload(Floor.property),
    ).filter(Unit.id == unit_id).first()
    if not unit:
        return None

    prop_name = unit.floor.property.name if unit.floor and unit.floor.property else ""
    bookings = db.query(Booking).filter(Booking.unit_id == unit.id).options(
        joinedload(Booking.client)
    ).order_by(Booking.created_at.desc()).all()

    rows = []
    for b in bookings:
        rows.append(ReportLedgerRow(cells=[
            b.booking_id, b.client.name if b.client else "",
            _date(b.booking_date), _fmt(b.final_price or b.property_price or 0),
            (b.status or "").upper(),
        ]))

    unit_area = f"{unit.area or ''} {unit.area_unit or ''}".strip()
    entity_rows = [
        ReportInfoRow(label="Project", value=prop_name or "N/A"),
        ReportInfoRow(label="Unit No.", value=unit.unit_number or "N/A"),
        ReportInfoRow(label="Type", value=unit.unit_type or ""),
        ReportInfoRow(label="Floor", value=str(unit.floor_number or "")),
    ]
    if unit_area:
        entity_rows.append(ReportInfoRow(label="Area", value=unit_area))
    if unit.price:
        entity_rows.append(ReportInfoRow(label="Price", value=_fmt(unit.price)))
    if prop := (unit.floor.property if unit.floor and unit.floor.property else None):
        if prop.address:
            entity_rows.append(ReportInfoRow(label="Address", value=prop.address))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Unit Detail Report",
            subtitle=f"{prop_name} · {unit.unit_number} ({unit.unit_type or ''})",
            reference_no=f"U-{unit.id}",
            status=unit.status,
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Unit Number", value=unit.unit_number or ""),
                ReportInfoRow(label="Type", value=unit.unit_type or ""),
                ReportInfoRow(label="Floor", value=str(unit.floor_number or "")),
                ReportInfoRow(label="Project", value=prop_name),
            ],
            right_column=[
                ReportInfoRow(label="Area", value=f"{unit.area or ''} {unit.area_unit or ''}"),
                ReportInfoRow(label="Price", value=_fmt(unit.price)),
                ReportInfoRow(label="Status", value=(unit.status or "").upper()),
                ReportInfoRow(label="Bookings", value=str(len(bookings))),
            ],
        ),
        financial_strip=[],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="booking_id", label="Booking ID"),
                ReportLedgerColumn(key="customer", label="Customer"),
                ReportLedgerColumn(key="date", label="Date"),
                ReportLedgerColumn(key="value", label="Value", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Unit detail from system records."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
        entity_info=entity_rows,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 20. Agent Commission Detail (per-deal breakdown for one agent)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("agent_commission_detail")
def agent_commission_detail(db: Session, payload: dict) -> Optional[ReportData]:
    dealer_id = payload.get("entity_id")
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        return None

    commissions = db.query(Commission).options(
        joinedload(Commission.property), joinedload(Commission.deal),
    ).filter(Commission.dealer_id == dealer_id).order_by(Commission.date.desc()).all()

    rows = []
    total_commission = Decimal("0")
    total_paid = Decimal("0")
    for c in commissions:
        amt = c.amount or Decimal("0")
        total_commission += amt
        if c.payment_status == "paid":
            total_paid += amt
        rows.append(ReportLedgerRow(cells=[
            c.property.name if c.property else "", _date(c.date),
            c.type or "", _fmt(c.sale_amount or 0), _fmt(amt),
            (c.payment_status or "").upper(),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Agent Commission Detail",
            subtitle=dealer.name,
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Agent", value=dealer.name),
                ReportInfoRow(label="Phone", value=dealer.phone or ""),
                ReportInfoRow(label="Email", value=dealer.email or ""),
            ],
            right_column=[
                ReportInfoRow(label="Total Commission", value=_fmt(total_commission)),
                ReportInfoRow(label="Paid", value=_fmt(total_paid)),
                ReportInfoRow(label="Unpaid", value=_fmt(total_commission - total_paid)),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Commission", value=_fmt(total_commission)),
            ReportFinancialStripCell(label="Paid", value=_fmt(total_paid)),
            ReportFinancialStripCell(label="Unpaid", value=_fmt(total_commission - total_paid), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="property", label="Property"),
                ReportLedgerColumn(key="date", label="Date"),
                ReportLedgerColumn(key="type", label="Type"),
                ReportLedgerColumn(key="sale", label="Sale Amount", align="right", format="currency"),
                ReportLedgerColumn(key="commission", label="Commission", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(cells=["", "", "", "", _fmt(total_commission), ""], is_total=True),
        ),
        terms=ReportTerms(text="Commission detail — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 21. Agents Register (all agents with totals)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("agents_register")
def agents_register(db: Session, payload: dict) -> Optional[ReportData]:
    dealers = db.query(Dealer).outerjoin(Commission).order_by(Dealer.name).all()
    rows = []
    total_commission = Decimal("0")
    for d in dealers:
        cm = sum((c.amount or Decimal("0")) for c in d.commissions)
        total_commission += cm
        rows.append(ReportLedgerRow(cells=[
            d.name or "", d.phone or "", d.email or "",
            str(len(d.commissions)), _fmt(cm),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Agents Register",
            subtitle=f"{len(dealers)} agents",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Total Agents", value=str(len(dealers)))],
            right_column=[ReportInfoRow(label="Total Commission", value=_fmt(total_commission))],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Agents", value=str(len(dealers))),
            ReportFinancialStripCell(label="Total Commission", value=_fmt(total_commission), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="name", label="Name"),
                ReportLedgerColumn(key="phone", label="Phone"),
                ReportLedgerColumn(key="email", label="Email"),
                ReportLedgerColumn(key="deals", label="Deals", align="right"),
                ReportLedgerColumn(key="commission", label="Commission", align="right", format="currency"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(cells=["", "", "", "", _fmt(total_commission)], is_total=True),
        ),
        terms=ReportTerms(text="Agents register — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 22. Cancellation Detail (single cancellation full trail)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("cancellation_detail")
def cancellation_detail(db: Session, payload: dict) -> Optional[ReportData]:
    booking_id = payload.get("entity_id")
    booking = db.query(Booking).options(
        joinedload(Booking.client), joinedload(Booking.property),
        joinedload(Booking.unit),
    ).filter(Booking.id == booking_id, Booking.status.in_(["cancelled", "refunded", "expired"])).first()
    if not booking:
        return None

    client = booking.client
    prop = booking.property
    price = booking.final_price or booking.property_price or Decimal("0")
    down = booking.down_payment or Decimal("0")

    return ReportData(
        letterhead=ReportLetterhead(
            title="Cancellation Detail",
            subtitle=f"Booking: {booking.booking_id}",
            date=_date(booking.cancelled_at or booking.updated_at),
            status=booking.status,
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Booking ID", value=booking.booking_id),
                ReportInfoRow(label="Customer", value=client.name if client else ""),
                ReportInfoRow(label="Property", value=prop.name if prop else ""),
                ReportInfoRow(label="Booking Date", value=_date(booking.booking_date)),
            ],
            right_column=[
                ReportInfoRow(label="Status", value=(booking.status or "").upper()),
                ReportInfoRow(label="Cancelled On", value=_date(booking.cancelled_at)),
                ReportInfoRow(label="Value", value=_fmt(price)),
                ReportInfoRow(label="Down Payment", value=_fmt(down)),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Booking Value", value=_fmt(price)),
            ReportFinancialStripCell(label="Down Payment", value=_fmt(down)),
            ReportFinancialStripCell(label="Net Impact", value=_fmt(price), inverted=True),
        ],
        ledger=ReportLedgerSection(columns=[], rows=[]),
        terms=ReportTerms(text=f"Cancellation detail for booking {booking.booking_id}."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 23. Property Listing (all properties with details)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("property_listing")
def property_listing(db: Session, payload: dict) -> Optional[ReportData]:
    properties = db.query(Property).order_by(Property.name).all()
    rows = []
    for p in properties:
        rows.append(ReportLedgerRow(cells=[
            p.name or "", p.tid or "", p.address or "",
            p.category or p.property_type_option.name if hasattr(p, 'property_type_option') and p.property_type_option else "",
            _fmt(p.sale_price), p.status or "",
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Property Listing",
            subtitle=f"{len(properties)} properties",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(),
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="name", label="Property Name"),
                ReportLedgerColumn(key="id", label="Property ID"),
                ReportLedgerColumn(key="address", label="Address"),
                ReportLedgerColumn(key="category", label="Category"),
                ReportLedgerColumn(key="price", label="Price", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Property listing — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 24. Unit Listing (all units with details)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("unit_listing")
def unit_listing(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Unit).options(
        joinedload(Unit.floor).joinedload(Floor.property)
    )

    if filters.get("status"):
        query = query.filter(Unit.status == filters["status"])
    if filters.get("status_in"):
        statuses = [s.strip() for s in filters["status_in"].split(",")]
        query = query.filter(Unit.status.in_(statuses))
    if filters.get("property_id"):
        query = query.filter(Unit.property_id == int(filters["property_id"]))
    if filters.get("unit_type"):
        query = query.filter(Unit.unit_type == filters["unit_type"])

    units = query.order_by(Unit.property_id, Unit.floor_number, Unit.unit_number).all()

    rows = []
    for u in units:
        prop_name = u.floor.property.name if u.floor and u.floor.property else ""
        rows.append(ReportLedgerRow(cells=[
            u.unit_number or "", prop_name, str(u.floor_number or ""),
            u.unit_type or "", u.size or "", u.area_unit or "",
            _fmt(u.sale_price), (u.status or "").upper(),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Unit Listing",
            subtitle=f"{len(units)} units",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(),
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="unit", label="Unit"),
                ReportLedgerColumn(key="property", label="Property"),
                ReportLedgerColumn(key="floor", label="Floor"),
                ReportLedgerColumn(key="type", label="Type"),
                ReportLedgerColumn(key="size", label="Size"),
                ReportLedgerColumn(key="area_unit", label="Unit"),
                ReportLedgerColumn(key="price", label="Price", align="right", format="currency"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Unit listing — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 25. Unit Occupied (units that are booked, sold, or occupied)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("unit_occupied")
def unit_occupied(db: Session, payload: dict) -> Optional[ReportData]:
    units = db.query(Unit).options(
        joinedload(Unit.floor).joinedload(Floor.property)
    ).filter(
        Unit.status.in_(["booked", "reserved", "sold", "occupied", "rented"])
    ).order_by(Unit.property_id, Unit.floor_number, Unit.unit_number).all()

    rows = []
    for u in units:
        prop_name = u.floor.property.name if u.floor and u.floor.property else ""
        rows.append(ReportLedgerRow(cells=[
            u.unit_number or "", prop_name, u.unit_type or "",
            (u.status or "").upper(),
            _fmt(u.sale_price or u.rent_amount),
            u.current_tenant_name or "\u2014",
            _date(u.lease_end_date) if u.lease_end_date else "\u2014",
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Unit Occupied Report",
            subtitle=f"{len(units)} occupied/booked/sold units",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Total Occupied", value=str(len(units)))],
            right_column=[ReportInfoRow(label="Status Filter", value="booked / reserved / sold / occupied / rented")],
        ),
        financial_strip=[],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="unit", label="Unit"),
                ReportLedgerColumn(key="property", label="Property"),
                ReportLedgerColumn(key="type", label="Type"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
                ReportLedgerColumn(key="value", label="Value", align="right", format="currency"),
                ReportLedgerColumn(key="tenant", label="Tenant / Party"),
                ReportLedgerColumn(key="lease_end", label="Lease End"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Occupied units report — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 26. Clients List (all registered clients)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("clients_list")
def clients_list(db: Session, payload: dict) -> Optional[ReportData]:
    clients = db.query(Client).order_by(Client.name).all()
    rows = []
    for c in clients:
        rows.append(ReportLedgerRow(cells=[
            c.name or "", c.client_id or "", c.cnic or "",
            c.phone or "", c.email or "", c.city or "",
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Clients List",
            subtitle=f"{len(clients)} clients",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(),
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="name", label="Name"),
                ReportLedgerColumn(key="id", label="Client ID"),
                ReportLedgerColumn(key="cnic", label="CNIC"),
                ReportLedgerColumn(key="phone", label="Phone"),
                ReportLedgerColumn(key="email", label="Email"),
                ReportLedgerColumn(key="city", label="City"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Clients list — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 27. Leads List (all CRM leads)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("leads_list")
def leads_list(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Lead).options(joinedload(Lead.assigned_dealer))

    if filters.get("status"):
        query = query.filter(Lead.status == filters["status"])
    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(Lead.created_at >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(Lead.created_at <= dt.strptime(filters["date_to"], "%Y-%m-%d"))
    if filters.get("source"):
        query = query.filter(Lead.source == filters["source"])

    leads = query.order_by(Lead.created_at.desc()).all()
    rows = []
    for l in leads:
        rows.append(ReportLedgerRow(cells=[
            l.lead_id, l.name or "", l.phone or "",
            l.status.upper(), l.source or "",
            l.assigned_dealer.name if l.assigned_dealer else "",
            _date(l.created_at),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Leads List",
            subtitle=f"{len(leads)} leads",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Status Filter", value=filters.get("status", "All"))],
            right_column=[ReportInfoRow(label="Source Filter", value=filters.get("source", "All"))],
        ),
        financial_strip=[],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="id", label="Lead ID"),
                ReportLedgerColumn(key="name", label="Name"),
                ReportLedgerColumn(key="phone", label="Phone"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
                ReportLedgerColumn(key="source", label="Source"),
                ReportLedgerColumn(key="dealer", label="Assigned To"),
                ReportLedgerColumn(key="date", label="Created"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Leads list — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 28. Tenant List (all tenants)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("tenant_list")
def tenant_list(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Tenant)

    if filters.get("status"):
        is_active = filters["status"] == "active"
        query = query.filter(Tenant.is_active == is_active)
    if filters.get("search"):
        search = f"%{filters['search']}%"
        query = query.filter(Tenant.name.ilike(search))

    tenants = query.order_by(Tenant.name).all()
    rows = []
    for t in tenants:
        rows.append(ReportLedgerRow(cells=[
            t.tenant_id, t.name or "", t.phone or "",
            t.email or "", t.cnic or "",
            "Active" if t.is_active else "Inactive",
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Tenant List",
            subtitle=f"{len(tenants)} tenants",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Total Tenants", value=str(len(tenants)))],
        ),
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="id", label="Tenant ID"),
                ReportLedgerColumn(key="name", label="Name"),
                ReportLedgerColumn(key="phone", label="Phone"),
                ReportLedgerColumn(key="email", label="Email"),
                ReportLedgerColumn(key="cnic", label="CNIC"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Tenant list — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 29. Tenant Profile (single tenant full picture)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("tenant_profile")
def tenant_profile(db: Session, payload: dict) -> Optional[ReportData]:
    tenant_id = payload.get("entity_id")
    if not tenant_id:
        return None
    t = db.query(Tenant).filter(Tenant.id == int(tenant_id)).first()
    if not t:
        return None

    leases = db.query(TenantLease).options(
        joinedload(TenantLease.property_rel), joinedload(TenantLease.unit_rel)
    ).filter(TenantLease.tenant_id == t.id).all()

    rent_records = db.query(RentRecord).filter(
        RentRecord.tenant_id == t.id
    ).order_by(RentRecord.due_date.desc()).limit(12).all()

    payments = db.query(TenantPaymentModel).filter(
        TenantPaymentModel.tenant_id == t.id
    ).order_by(TenantPaymentModel.payment_date.desc()).limit(12).all()

    total_due = db.query(RentRecord).filter(
        RentRecord.tenant_id == t.id,
        RentRecord.status.in_(["pending", "partial", "overdue"])
    ).with_entities(func.sum(RentRecord.amount_due - RentRecord.amount_paid)).scalar() or 0

    ledger_rows = []
    for r in rent_records:
        ledger_rows.append(ReportLedgerRow(cells=[
            _date(r.due_date), _fmt(r.amount_due), _fmt(r.amount_paid),
            _fmt(float(r.amount_due) - float(r.amount_paid)),
            _status_dots(r.status), r.status.upper(),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Tenant Profile",
            subtitle=f"{t.name} \u2014 {t.tenant_id}",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Name", value=t.name),
                ReportInfoRow(label="Tenant ID", value=t.tenant_id),
                ReportInfoRow(label="Phone", value=t.phone or "\u2014"),
                ReportInfoRow(label="Email", value=t.email or "\u2014"),
                ReportInfoRow(label="CNIC", value=t.cnic or "\u2014"),
            ],
            right_column=[
                ReportInfoRow(label="Status", value="Active" if t.is_active else "Inactive"),
                ReportInfoRow(label="Family Size", value=str(t.family_size) if t.family_size else "\u2014"),
                ReportInfoRow(label="Active Leases", value=str(sum(1 for l in leases if l.status == "active"))),
                ReportInfoRow(label="Total Outstanding", value=_fmt(total_due)),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Due", value=_fmt(total_due), format="currency"),
            ReportFinancialStripCell(label="Active Leases", value=str(sum(1 for l in leases if l.status == "active"))),
            ReportFinancialStripCell(label="Total Leases", value=str(len(leases))),
            ReportFinancialStripCell(label="Recent Payments", value=str(len(payments))),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="due_date", label="Due Date"),
                ReportLedgerColumn(key="amount_due", label="Amount Due", align="right", format="currency"),
                ReportLedgerColumn(key="amount_paid", label="Paid", align="right", format="currency"),
                ReportLedgerColumn(key="balance", label="Balance", align="right", format="currency"),
                ReportLedgerColumn(key="dot", label="", align="center"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=ledger_rows,
        ),
        terms=ReportTerms(text="Tenant profile — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 30. Employee List (all employees)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("employee_list")
def employee_list(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(HREmployee).options(
        joinedload(HREmployee.department), joinedload(HREmployee.position),
        joinedload(HREmployee.branch),
    )

    if filters.get("department_id"):
        query = query.filter(HREmployee.department_id == int(filters["department_id"]))
    if filters.get("employment_status"):
        query = query.filter(HREmployee.employment_status == filters["employment_status"])
    if filters.get("branch_id"):
        query = query.filter(HREmployee.branch_id == int(filters["branch_id"]))

    employees = query.order_by(HREmployee.full_name).all()
    rows = []
    for e in employees:
        rows.append(ReportLedgerRow(cells=[
            e.employee_id, e.full_name or "",
            e.department.name if e.department else "",
            e.position.title if e.position else "",
            e.employment_status or "",
            e.work_email or "\u2014", e.work_phone or "\u2014",
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Employee List",
            subtitle=f"{len(employees)} employees",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Total Employees", value=str(len(employees)))],
        ),
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="id", label="Employee ID"),
                ReportLedgerColumn(key="name", label="Name"),
                ReportLedgerColumn(key="dept", label="Department"),
                ReportLedgerColumn(key="position", label="Position"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
                ReportLedgerColumn(key="email", label="Email"),
                ReportLedgerColumn(key="phone", label="Phone"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Employee list — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 31. Employee Profile (single employee)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("employee_profile")
def employee_profile(db: Session, payload: dict) -> Optional[ReportData]:
    emp_id = payload.get("entity_id")
    if not emp_id:
        return None
    e = db.query(HREmployee).options(
        joinedload(HREmployee.department), joinedload(HREmployee.position),
        joinedload(HREmployee.branch), joinedload(HREmployee.manager),
        joinedload(HREmployee.salary_structure),
    ).filter(HREmployee.id == int(emp_id)).first()
    if not e:
        return None

    salary = e.salary_structure
    ledger_rows = []
    if salary:
        from decimal import Decimal
        allowances = [
            ("Basic Salary", _fmt(salary.basic_salary)),
            ("House Rent", _fmt(salary.house_rent or 0)),
            ("Conveyance", _fmt(salary.conveyance or 0)),
            ("Medical", _fmt(salary.medical_allowance or 0)),
            ("Other Allowances", _fmt(salary.other_allowances or 0)),
        ]
        total_allow = Decimal(str(salary.house_rent or 0)) + Decimal(str(salary.conveyance or 0)) + Decimal(str(salary.medical_allowance or 0)) + Decimal(str(salary.other_allowances or 0))
        deductions = [
            ("Income Tax", _fmt(salary.income_tax or 0)),
            ("Loan Deduction", _fmt(salary.loan_deduction or 0)),
            ("Other Deductions", _fmt(salary.other_deductions or 0)),
        ]
        total_ded = Decimal(str(salary.income_tax or 0)) + Decimal(str(salary.loan_deduction or 0)) + Decimal(str(salary.other_deductions or 0))
        net_salary = Decimal(str(salary.basic_salary or 0)) + total_allow - total_ded
        for label, val in allowances:
            ledger_rows.append(ReportLedgerRow(cells=[label, val, "", ""]))
        ledger_rows.append(ReportLedgerRow(cells=["\u2014" * 20, "", "", ""]))
        for label, val in deductions:
            ledger_rows.append(ReportLedgerRow(cells=["", "", label, val]))
        ledger_rows.append(ReportLedgerRow(cells=["", "", "Net Salary", _fmt(net_salary)]))
    else:
        ledger_rows.append(ReportLedgerRow(cells=["No salary structure defined", "", "", ""]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Employee Profile",
            subtitle=f"{e.full_name} \u2014 {e.employee_id}",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Employee ID", value=e.employee_id),
                ReportInfoRow(label="Full Name", value=e.full_name),
                ReportInfoRow(label="Department", value=e.department.name if e.department else "\u2014"),
                ReportInfoRow(label="Position", value=e.position.title if e.position else "\u2014"),
                ReportInfoRow(label="Branch", value=e.branch.name if e.branch else "\u2014"),
                ReportInfoRow(label="Employment Type", value=e.employment_type or "\u2014"),
            ],
            right_column=[
                ReportInfoRow(label="Status", value=e.employment_status or "\u2014"),
                ReportInfoRow(label="Joining Date", value=_date(e.joining_date)),
                ReportInfoRow(label="Work Email", value=e.work_email or "\u2014"),
                ReportInfoRow(label="Work Phone", value=e.work_phone or "\u2014"),
                ReportInfoRow(label="Manager", value=e.manager.full_name if e.manager else "\u2014"),
                ReportInfoRow(label="Reporting To", value=e.manager.full_name if e.manager else "\u2014"),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Employees", value=str(db.query(HREmployee).count())),
            ReportFinancialStripCell(label="Department", value=e.department.name if e.department else "\u2014"),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="allowance", label="Allowance"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
                ReportLedgerColumn(key="deduction", label="Deduction"),
                ReportLedgerColumn(key="ded_amount", label="Amount", align="right", format="currency"),
            ],
            rows=ledger_rows,
            title="Salary Structure" if salary else "Salary Structure (Not Set)",
        ),
        terms=ReportTerms(text="Employee profile — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 32. Payment History (all payments across system)
# ══════════════════════════════════════════════════════════════════════════════

@register_report("payment_history")
def payment_history(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(CrmPayment).options(
        joinedload(CrmPayment.client), joinedload(CrmPayment.booking),
        joinedload(CrmPayment.deal),
    )

    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(CrmPayment.payment_date >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(CrmPayment.payment_date <= dt.strptime(filters["date_to"], "%Y-%m-%d"))
    if filters.get("payment_method"):
        query = query.filter(CrmPayment.payment_method == filters["payment_method"])

    payments = query.order_by(CrmPayment.payment_date.desc()).limit(200).all()
    rows = []
    for p in payments:
        client_name = p.client.name if p.client else (p.booking.client_name if p.booking else "\u2014")
        rows.append(ReportLedgerRow(cells=[
            p.receipt_number or str(p.id), _date(p.payment_date),
            client_name,
            p.payment_method or "", _fmt(p.amount),
        ]))

    return ReportData(
        letterhead=ReportLetterhead(
            title="Payment History",
            subtitle=f"{len(payments)} payments",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Total Payments", value=str(len(payments)))],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total Collected", value=_fmt(sum(float(p.amount) for p in payments)), format="currency"),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="receipt", label="Receipt No"),
                ReportLedgerColumn(key="date", label="Date"),
                ReportLedgerColumn(key="client", label="Client"),
                ReportLedgerColumn(key="method", label="Method"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Payment history — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 33. Due / Pending Payments
# ══════════════════════════════════════════════════════════════════════════════

@register_report("due_payments")
def due_payments(db: Session, payload: dict) -> Optional[ReportData]:
    filters = payload.get("filters", {})
    query = db.query(Installment).options(
        joinedload(Installment.plan).joinedload(InstallmentPlan.deal).joinedload(Deal.client),
    ).filter(Installment.status.in_(["pending", "partial", "overdue"]))

    if filters.get("date_from"):
        from datetime import datetime as dt
        query = query.filter(Installment.due_date >= dt.strptime(filters["date_from"], "%Y-%m-%d"))
    if filters.get("date_to"):
        from datetime import datetime as dt
        query = query.filter(Installment.due_date <= dt.strptime(filters["date_to"], "%Y-%m-%d"))

    installments = query.order_by(Installment.due_date.asc()).all()
    rows = []
    for i in installments:
        client_name = i.plan.deal.client.name if i.plan and i.plan.deal and i.plan.deal.client else "\u2014"
        balance = float(i.amount) - float((i.paid_amount or 0))
        rows.append(ReportLedgerRow(cells=[
            _date(i.due_date), client_name,
            _fmt(i.amount), _fmt(i.paid_amount or 0),
            _fmt(balance), _status_dots(i.status), i.status.upper(),
        ]))

    total_balance = sum(float(i.amount) - float((i.paid_amount or 0)) for i in installments)

    return ReportData(
        letterhead=ReportLetterhead(
            title="Due / Pending Payments",
            subtitle=f"{len(installments)} pending or overdue installments",
            date=_date(datetime.now(timezone.utc)),
        ),
        info_grid=ReportInfoGrid(
            left_column=[ReportInfoRow(label="Pending Installments", value=str(len(installments)))],
            right_column=[ReportInfoRow(label="Total Outstanding", value=_fmt(total_balance))],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Outstanding Amount", value=_fmt(total_balance), format="currency"),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="due_date", label="Due Date"),
                ReportLedgerColumn(key="client", label="Client / Party"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
                ReportLedgerColumn(key="paid", label="Paid", align="right", format="currency"),
                ReportLedgerColumn(key="balance", label="Balance", align="right", format="currency"),
                ReportLedgerColumn(key="dot", label="", align="center"),
                ReportLedgerColumn(key="status", label="Status", align="center"),
            ],
            rows=rows,
        ),
        terms=ReportTerms(text="Due payments report — computer generated."),
        signature=ReportSignatureRow(authorized_name="Authorized Signatory"),
    )
