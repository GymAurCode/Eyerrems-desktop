"""CRM import handlers: leads, clients, dealers, crm_contacts."""
from sqlalchemy import func

from app.models.crm import Client, Dealer, Lead
from app.services.bulk_import.types import ColumnDef, ImportContext, ImportModuleHandler, RowImportResult, RowValidationResult
from app.services.bulk_import.handlers.base import base_validate, merge_errors
from app.services.bulk_import import validator as v


def _next_lead_id(db):
    n = db.query(func.count(Lead.id)).scalar() or 0
    return f"LD-{n + 1:04d}"


def _next_client_id(db, converted=False):
    n = db.query(func.count(Client.id)).scalar() or 0
    return f"{'LD-CLI' if converted else 'CLI'}-{n + 1:04d}"


def _next_tracking_id(db):
    n = db.query(func.count(Client.id)).scalar() or 0
    return f"TRK-{n + 1:04d}"


def _next_dealer_id(db):
    n = db.query(func.count(Dealer.id)).scalar() or 0
    return f"DEA-{n + 1:04d}"


LEAD_COLUMNS = [
    ColumnDef("name", "Name", required=True, sample="Ahmed Khan"),
    ColumnDef("phone", "Phone", sample="+923001234567"),
    ColumnDef("email", "Email", sample="ahmed@example.com", hint="Valid email format"),
    ColumnDef("source", "Source", sample="Website"),
    ColumnDef("assigned_to", "Assigned To", sample="Sales Team", hint="Optional assignee name"),
    ColumnDef("status", "Status", sample="new", enum_values=["new", "contacted", "qualified", "lost", "converted"]),
]

CLIENT_COLUMNS = [
    ColumnDef("name", "Name", required=True, sample="Sara Ali"),
    ColumnDef("phone", "Phone", required=True, sample="+923009876543"),
    ColumnDef("email", "Email", sample="sara@example.com"),
    ColumnDef("cnic", "CNIC", sample="12345-1234567-1"),
    ColumnDef("status", "Status", sample="active", enum_values=["active", "inactive", "potential"]),
    ColumnDef("company_name", "Company Name", sample="Ali Traders"),
    ColumnDef("address", "Address", sample="Karachi"),
    ColumnDef("dealer_code", "Dealer Code", sample="DEA-0001", hint="Existing dealer_id"),
    ColumnDef("notes", "Notes", sample="VIP client"),
]

DEALER_COLUMNS = [
    ColumnDef("name", "Name", required=True, sample="Prime Realtors"),
    ColumnDef("email", "Email", sample="info@primerealtors.com"),
    ColumnDef("phone", "Phone", sample="+923111222333"),
    ColumnDef("company", "Company", sample="Prime Realtors Pvt Ltd"),
    ColumnDef("commission_type", "Commission Type", sample="percentage", enum_values=["percentage", "fixed"]),
    ColumnDef("commission_rate", "Commission Rate", sample="2.5"),
    ColumnDef("cnic", "CNIC", sample="42101-1234567-1"),
    ColumnDef("address", "Address", sample="Lahore"),
    ColumnDef("notes", "Notes", sample="Top performer"),
]


def validate_lead(row, ctx: ImportContext, row_number: int) -> RowValidationResult:
    email = v.opt_str(row, "email")
    status = v.opt_str(row, "status") or "new"
    extra = [
        v.validate_email(email),
        v.validate_enum(status, {"new", "contacted", "qualified", "lost", "converted"}, "status"),
    ]
    dup = (v.opt_str(row, "email") or v.opt_str(row, "phone") or "").lower() or None
    return base_validate(row, ctx, row_number, [("name", "Name")], dup, extra)


def import_lead(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    email = v.opt_str(row, "email")
    phone = v.opt_str(row, "phone")
    existing = None
    if email:
        existing = db.query(Lead).filter(Lead.email == email).first()
    if not existing and phone:
        existing = db.query(Lead).filter(Lead.phone == phone).first()

    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Duplicate lead skipped", "lead", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Duplicate lead exists")
        existing.name = v.opt_str(row, "name") or existing.name
        existing.phone = phone or existing.phone
        existing.email = email or existing.email
        existing.source = v.opt_str(row, "source") or existing.source
        existing.status = v.opt_str(row, "status") or existing.status
        db.flush()
        return RowImportResult(True, "updated", "Lead updated", "lead", existing.id)

    lead = Lead(
        lead_id=_next_lead_id(db),
        name=v.opt_str(row, "name") or "",
        phone=phone,
        email=email,
        source=v.opt_str(row, "source"),
        status=v.opt_str(row, "status") or "new",
    )
    db.add(lead)
    db.flush()
    return RowImportResult(True, "created", "Lead created", "lead", lead.id)


def validate_client(row, ctx, row_number: int) -> RowValidationResult:
    extra = [
        v.validate_email(v.opt_str(row, "email")),
        v.validate_phone(v.opt_str(row, "phone"), required=True),
        v.validate_enum(v.opt_str(row, "status") or "active", {"active", "inactive", "potential"}, "status"),
    ]
    dup = (v.opt_str(row, "phone") or "").lower() or None
    return base_validate(row, ctx, row_number, [("name", "Name"), ("phone", "Phone")], dup, extra)


def import_client(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    phone = v.opt_str(row, "phone") or ""
    existing = db.query(Client).filter(Client.phone == phone).first()
    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Duplicate client skipped", "client", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Duplicate client exists")
        existing.name = v.opt_str(row, "name") or existing.name
        existing.email = v.opt_str(row, "email") or existing.email
        existing.status = v.opt_str(row, "status") or existing.status
        db.flush()
        return RowImportResult(True, "updated", "Client updated", "client", existing.id)

    dealer_id = None
    dcode = v.opt_str(row, "dealer_code")
    if dcode:
        dealer = db.query(Dealer).filter(Dealer.dealer_id == dcode).first()
        if dealer:
            dealer_id = dealer.id

    client = Client(
        client_id=_next_client_id(db),
        tracking_id=_next_tracking_id(db),
        name=v.opt_str(row, "name") or "",
        phone=phone,
        email=v.opt_str(row, "email"),
        cnic=v.opt_str(row, "cnic"),
        status=v.opt_str(row, "status") or "active",
        company_name=v.opt_str(row, "company_name"),
        address=v.opt_str(row, "address"),
        dealer_id=dealer_id,
        notes=v.opt_str(row, "notes"),
    )
    db.add(client)
    db.flush()
    return RowImportResult(True, "created", "Client created", "client", client.id)


def validate_dealer(row, ctx, row_number: int) -> RowValidationResult:
    extra = [v.validate_email(v.opt_str(row, "email"))]
    dup = (v.opt_str(row, "email") or v.opt_str(row, "phone") or "").lower() or None
    return base_validate(row, ctx, row_number, [("name", "Name")], dup, extra)


def import_dealer(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    email = v.opt_str(row, "email")
    existing = None
    if email:
        existing = db.query(Dealer).filter(Dealer.email == email).first()
    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Duplicate skipped", "dealer", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Duplicate exists")
        existing.name = v.opt_str(row, "name") or existing.name
        existing.phone = v.opt_str(row, "phone") or existing.phone
        db.flush()
        return RowImportResult(True, "updated", "Dealer updated", "dealer", existing.id)

    rate, err = v.parse_decimal(v.opt_str(row, "commission_rate"), "commission_rate")
    if err:
        return RowImportResult(False, "failed", err)

    dealer = Dealer(
        dealer_id=_next_dealer_id(db),
        name=v.opt_str(row, "name") or "",
        email=email,
        phone=v.opt_str(row, "phone"),
        company=v.opt_str(row, "company"),
        commission_type=v.opt_str(row, "commission_type") or "percentage",
        commission_rate=rate,
        cnic=v.opt_str(row, "cnic"),
        address=v.opt_str(row, "address"),
        notes=v.opt_str(row, "notes"),
    )
    db.add(dealer)
    db.flush()
    return RowImportResult(True, "created", "Dealer created", "dealer", dealer.id)


def get_crm_handlers() -> list[ImportModuleHandler]:
    return [
        ImportModuleHandler(
            key="leads", label="Leads", description="Import CRM leads",
            category="CRM", permission="crm:manage",
            columns=LEAD_COLUMNS, validate_row=validate_lead, import_row=import_lead,
            duplicate_key=lambda r: (v.opt_str(r, "email") or v.opt_str(r, "phone") or "").lower() or None,
        ),
        ImportModuleHandler(
            key="clients", label="Clients", description="Import CRM clients",
            category="CRM", permission="crm:manage",
            columns=CLIENT_COLUMNS, validate_row=validate_client, import_row=import_client,
            duplicate_key=lambda r: (v.opt_str(r, "phone") or "").lower() or None,
        ),
        ImportModuleHandler(
            key="crm_contacts", label="CRM Contacts", description="Import contacts (same as clients)",
            category="CRM", permission="crm:manage",
            columns=CLIENT_COLUMNS, validate_row=validate_client, import_row=import_client,
            duplicate_key=lambda r: (v.opt_str(r, "phone") or "").lower() or None,
        ),
        ImportModuleHandler(
            key="dealers", label="Dealers", description="Import dealers / agents",
            category="CRM", permission="crm:manage",
            columns=DEALER_COLUMNS, validate_row=validate_dealer, import_row=import_dealer,
            duplicate_key=lambda r: (v.opt_str(r, "email") or "").lower() or None,
        ),
    ]
