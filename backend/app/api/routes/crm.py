"""CRM routes — full ERP-grade implementation."""
import shutil
import uuid
from datetime import datetime, date, timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, Response, Request
from sqlalchemy import func, exists
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_any_permission
from app.core.db_compat import date_format, date_diff_days
from app.core.audit import log_action
from app.core.activity_logger import log_activity
from app.core.config import settings
from app.core.database import get_db
from app.core.table_query import apply_table_filters
from app.core.journal_service import JournalService, JournalEntryData
from app.core.websocket_manager import ws_manager
from app.models.auth import User
from app.models.booking import Booking
from app.models.ledger import DealerLedgerEntry
from app.models.crm import (
    AutomationRule, Client, ClientAttachment, Communication, CrmTimelineEntry,
    Deal, DealAttachment, Dealer, DealerAttachment, FollowUp,
    Installment, InstallmentPayment, InstallmentPlan, InstallmentType,
    Lead, LeadActivity, Payment, SiteVisit,
)
from app.models.finance import Account, Commission
from app.models.property import Floor, Property, Unit
from app.services.business_rules import (
    validate_unit_available_for_deal,
    sync_unit_status,
    UnitNotAvailableError,
)
from app.schemas.crm import (
    ActivityCreate, ActivityOut, ActivityUpdate,
    AutomationRuleCreate, AutomationRuleOut,
    ClientCreate, ClientAttachmentOut, ClientOut, ClientUpdate,
    CommunicationCreate, CommunicationOut,
    ConvertLeadToClient,
    CrmDashboardData, CrmDashboardStats,
    DealCreate, DealAttachmentOut, DealLedgerOut, DealOut, DealUpdate,
    DealerCreate, DealerAttachmentOut, DealerDetailOut, DealerLedgerEntryOut, DealerLedgerCreate, DealerPaymentCreate, DealerOut, DealerUpdate,
    FinancialSummary, LeadStats, LeadCostSummary, CommissionSummary, RecentAssignedLead,
    FollowUpCreate, FollowUpOut, FollowUpUpdate,
    GlobalSearchResult,
    InstallmentPlanCreate, InstallmentPlanOut,
    InstallmentPaymentCreate, InstallmentPaymentOut,
    InstallmentTypeCreate, InstallmentTypeOut,
    InstallmentUpdate,
    LeadCreate, LeadOut, LeadUpdate,
    PaginatedFollowUps, PaginatedLeads, PaginatedClients, PaginatedDealers, PaginatedDeals, PaginatedPayments, PaginatedSiteVisits,
    PaginatedPaymentLedger, PaymentCreate, PaymentOut,
    RecentActivity,
    SiteVisitCreate, SiteVisitOut, SiteVisitUpdate,
    TimelineEntryOut,
)

router = APIRouter()

PERM_VIEW   = ("crm:manage", "crm:view")
PERM_MANAGE = ("crm:manage",)


# ── helpers ───────────────────────────────────────────────────────────────────

def _next_lead_id(db: Session) -> str:
    count = db.query(func.count(Lead.id)).scalar() or 0
    return f"LD-{count + 1:04d}"


def _next_client_id(db: Session, converted: bool = False) -> str:
    count = db.query(func.count(Client.id)).scalar() or 0
    prefix = "LD-CLI" if converted else "CLI"
    return f"{prefix}-{count + 1:04d}"


def _next_tracking_id(db: Session) -> str:
    year  = datetime.utcnow().year
    count = db.query(func.count(Client.id)).scalar() or 0
    return f"TRX-{year}-{count + 1:04d}"


def _next_deal_id(db: Session) -> str:
    count = db.query(func.count(Deal.id)).scalar() or 0
    return f"DEAL-{count + 1:04d}"


def _next_dealer_id(db: Session) -> str:
    count = db.query(func.count(Dealer.id)).scalar() or 0
    return f"DEA-{count + 1:04d}"


def _next_followup_id(db: Session) -> str:
    count = db.query(func.count(FollowUp.id)).scalar() or 0
    return f"FU-{count + 1:04d}"


def _next_visit_id(db: Session) -> str:
    count = db.query(func.count(SiteVisit.id)).scalar() or 0
    return f"VIS-{count + 1:04d}"


def _next_payment_id(db: Session) -> str:
    count = db.query(func.count(Payment.id)).scalar() or 0
    return f"PAY-{count + 1:04d}"


def _add_timeline_entry(db: Session, entity_type: str, entity_id: int,
                         action: str, description: str | None = None,
                         old_value: str | None = None,
                         new_value: str | None = None,
                         performed_by_id: int | None = None):
    entry = CrmTimelineEntry(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        description=description,
        old_value=old_value,
        new_value=new_value,
        performed_by_id=performed_by_id,
    )
    db.add(entry)
    db.flush()
    return entry


def _save_file(file: UploadFile, sub: str) -> tuple[str, str]:
    base = Path(settings.upload_dir) / sub
    base.mkdir(parents=True, exist_ok=True)
    ext  = Path(file.filename or "file").suffix or ".bin"
    name = f"{uuid.uuid4().hex}{ext}"
    dest = base / name
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return f"{sub}/{name}", file.filename or name


def _record_dealer_lead_cost(db: Session, lead: Lead, current_user: User) -> None:
    """If the lead has an assigned dealer with cost_per_lead > 0, record a
    DealerLedgerEntry debit and set lead.lead_cost to that amount."""
    if not lead.assigned_dealer_id:
        return
    dealer = db.query(Dealer).filter(Dealer.id == lead.assigned_dealer_id).first()
    if not dealer or not dealer.cost_per_lead or float(dealer.cost_per_lead) <= 0:
        return
    cost = dealer.cost_per_lead
    last_entry = db.query(DealerLedgerEntry.running_balance).filter(
        DealerLedgerEntry.dealer_id == dealer.id
    ).order_by(DealerLedgerEntry.id.desc()).first()
    prev_balance = last_entry[0] if last_entry else Decimal("0")
    entry = DealerLedgerEntry(
        tid=f"DLE-{db.query(func.count(DealerLedgerEntry.id)).scalar() + 1:04d}",
        dealer_id=dealer.id,
        lead_id=lead.id,
        entry_date=datetime.utcnow(),
        description=f"Lead cost — {lead.lead_id} ({lead.name})",
        entry_type="lead_cost",
        debit=cost,
        credit=Decimal("0"),
        running_balance=prev_balance - cost,
        status="posted",
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    lead.lead_cost = cost


def _client_out(client: Client) -> dict:
    d = ClientOut.model_validate(client).model_dump()
    d["converted_from_lead"] = client.lead_id is not None
    d["original_lead_id"]    = client.lead.lead_id if client.lead else None
    d["dealer_name"]         = client.assigned_dealer.name if client.assigned_dealer else None
    return d


def _deal_out(deal: Deal) -> dict:
    d = DealOut.model_validate(deal).model_dump()
    d["client_name"]   = deal.client.name if deal.client else None
    d["dealer_name"]   = deal.dealer.name if deal.dealer else None
    d["property_name"] = deal.property.name if deal.property else None
    return d


# ── Leads ─────────────────────────────────────────────────────────────────────

@router.get("/leads", response_model=PaginatedLeads)
def list_leads(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    print("CRM Query Params:", request.query_params)
    query = db.query(Lead).options(joinedload(Lead.client)).order_by(Lead.id.desc())
    query, total = apply_table_filters(
        query=query,
        model=Lead,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Lead.name, Lead.phone, Lead.email, Lead.source, Lead.lead_id],
        date_filter=filter,
        date_field=Lead.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    leads = query.all()
    result = []
    for lead in leads:
        d = LeadOut.model_validate(lead).model_dump()
        d["is_converted"] = lead.client is not None
        result.append(d)
    return {"items": result, "total": total, "limit": limit, "offset": offset}


@router.post("/leads", response_model=LeadOut)
def create_lead(payload: LeadCreate, request: Request, db: Session = Depends(get_db),
                current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    data = payload.model_dump()
    lead = Lead(lead_id=_next_lead_id(db), **data)
    db.add(lead)
    db.flush()
    _record_dealer_lead_cost(db, lead, current_user)
    _add_timeline_entry(
        db, entity_type="lead", entity_id=lead.id,
        action="lead_created",
        description=f"Lead {lead.name} created",
        performed_by_id=current_user.id,
    )
    db.commit()
    db.refresh(lead)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(lead.id), record_label=f"Lead: {lead.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in lead.__dict__.items() if not k.startswith('_')},
    )
    d = LeadOut.model_validate(lead).model_dump()
    d["is_converted"] = False
    d["assigned_dealer_name"] = lead.assigned_dealer.name if lead.assigned_dealer else None
    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="lead", record_id=lead.lead_id,
        record_label=f"Lead {lead.name}",
        new_values={k: str(v) for k, v in lead.__dict__.items() if not k.startswith('_')},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return d


@router.get("/leads/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: str, db: Session = Depends(get_db),
             _=Depends(require_any_permission(*PERM_VIEW))):
    lead = None
    if lead_id.startswith("LD-"):
        lead = db.query(Lead).options(
            joinedload(Lead.client), joinedload(Lead.assigned_dealer),
        ).filter(Lead.lead_id == lead_id).first()
    else:
        try:
            numeric_id = int(lead_id)
            lead = db.query(Lead).options(
                joinedload(Lead.client), joinedload(Lead.assigned_dealer),
            ).filter(Lead.id == numeric_id).first()
        except ValueError:
            lead = db.query(Lead).options(
                joinedload(Lead.client), joinedload(Lead.assigned_dealer),
            ).filter(Lead.lead_id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    d = LeadOut.model_validate(lead).model_dump()
    d["is_converted"] = lead.client is not None
    d["assigned_dealer_name"] = lead.assigned_dealer.name if lead.assigned_dealer else None
    return d


@router.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db),
                current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    lead = db.query(Lead).options(
        joinedload(Lead.client), joinedload(Lead.assigned_dealer),
    ).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    # ── Linear pipeline enforcement ───────────────────────────────────────────
    if payload.status and payload.status != lead.status:
        new_stage = payload.status
        old_stage = lead.status
        if new_stage not in Lead.STATUS_ORDER:
            raise HTTPException(400, f"Invalid status '{new_stage}'")
        if old_stage not in Lead.STATUS_ORDER:
            raise HTTPException(400, f"Current status '{old_stage}' is invalid")
        old_idx = Lead.STATUS_ORDER.index(old_stage)
        new_idx = Lead.STATUS_ORDER.index(new_stage)

        # Allow moving forward or to "lost" from any active stage
        if new_stage == "lost":
            pass  # always allowed
        elif new_idx <= old_idx:
            raise HTTPException(400,
                f"Cannot move from '{old_stage}' to '{new_stage}'. "
                f"Pipeline stages are forward-only (current: {old_stage})."
            )
        # Skip stages check — allow skipping for flexibility,
        # but enforce "converted" is reached only through deal_won
        if new_stage == "converted" and old_stage != "deal_won":
            raise HTTPException(400,
                "Lead must reach 'deal_won' stage before conversion. "
                f"Current stage is '{old_stage}'."
            )

    # ── Auto-record dealer lead cost when dealer assigned/changed ────────────
    old_dealer_id = lead.assigned_dealer_id
    old_data = {k: str(v) for k, v in lead.__dict__.items() if not k.startswith('_')}
    old_status = lead.status
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(lead, k, v)
    if payload.assigned_dealer_id is not None and payload.assigned_dealer_id != old_dealer_id:
        _record_dealer_lead_cost(db, lead, current_user)
    if payload.status and payload.status != old_status:
        _add_timeline_entry(
            db, entity_type="lead", entity_id=lead.id,
            action="lead_status_changed",
            description=f"Lead status changed from {old_status} to {payload.status}",
            old_value=old_status, new_value=payload.status,
            performed_by_id=current_user.id,
        )
    db.commit()
    db.refresh(lead)
    new_data = {k: str(v) for k, v in lead.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="crm", action="UPDATE",
        record_id=str(lead_id), record_label=f"Lead: {lead.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="crm",
        record_type="lead", record_id=lead.lead_id,
        record_label=f"Lead {lead.name}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    d = LeadOut.model_validate(lead).model_dump()
    d["is_converted"] = lead.client is not None
    d["assigned_dealer_name"] = lead.assigned_dealer.name if lead.assigned_dealer else None
    return d


@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.client:
        raise HTTPException(400, "Cannot delete a converted lead")
    old_data = {k: str(v) for k, v in lead.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="crm", action="DELETE",
        record_id=str(lead_id), record_label=f"Lead: {lead.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data,
    )
    log_activity(
        db=db, user=current_user, action="delete", module="crm",
        record_type="lead", record_id=lead.lead_id,
        record_label=f"Lead {lead.name}",
        old_values=old_data,
    )
    db.delete(lead)
    db.commit()


# ── Clients ───────────────────────────────────────────────────────────────────

def _load_client(db: Session, client_id: str | int) -> Client:
    c = None
    if isinstance(client_id, str):
        if client_id.startswith("TRX-"):
            c = (
                db.query(Client)
                .options(joinedload(Client.lead), joinedload(Client.assigned_dealer), joinedload(Client.attachments))
                .filter(Client.tracking_id == client_id).first()
            )
        elif client_id.startswith("CLI-") or client_id.startswith("LD-CLI"):
            c = (
                db.query(Client)
                .options(joinedload(Client.lead), joinedload(Client.assigned_dealer), joinedload(Client.attachments))
                .filter(Client.client_id == client_id).first()
            )
        else:
            try:
                numeric_id = int(client_id)
                c = (
                    db.query(Client)
                    .options(joinedload(Client.lead), joinedload(Client.assigned_dealer), joinedload(Client.attachments))
                    .filter(Client.id == numeric_id).first()
                )
            except ValueError:
                c = (
                    db.query(Client)
                    .options(joinedload(Client.lead), joinedload(Client.assigned_dealer), joinedload(Client.attachments))
                    .filter(Client.client_id == client_id).first()
                )
    else:
        c = (
            db.query(Client)
            .options(joinedload(Client.lead), joinedload(Client.assigned_dealer), joinedload(Client.attachments))
            .filter(Client.id == client_id).first()
        )
    if not c:
        raise HTTPException(404, "Client not found")
    return c


@router.get("/clients", response_model=PaginatedClients)
def list_clients(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    print("CRM Query Params:", request.query_params)
    query = (
        db.query(Client)
        .options(joinedload(Client.lead), joinedload(Client.assigned_dealer),
                 joinedload(Client.attachments))
        .order_by(Client.id.desc())
    )
    query, total = apply_table_filters(
        query=query,
        model=Client,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Client.name, Client.phone, Client.email, Client.client_id, Client.tracking_id],
        date_filter=filter,
        date_field=Client.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    clients = query.all()
    result = [_client_out(c) for c in clients]
    return {"items": result, "total": total, "limit": limit, "offset": offset}


@router.post("/clients", response_model=ClientOut)
def create_client(payload: ClientCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    client = Client(
        client_id=_next_client_id(db, converted=False),
        tracking_id=_next_tracking_id(db),
        **payload.model_dump(),
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(client.id), record_label=f"Client: {client.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in client.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="client", record_id=client.client_id,
        record_label=f"Client {client.name}",
        new_values={k: str(v) for k, v in client.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return _client_out(_load_client(db, client.id))


@router.post("/leads/{lead_id}/convert", response_model=ClientOut)
def convert_lead_to_client(lead_id: int, payload: ConvertLeadToClient,
                            db: Session = Depends(get_db),
                            current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.client:
        raise HTTPException(400, "Lead already converted")

    # Enforce pipeline: must be at deal_won stage before conversion
    if lead.status != "deal_won" and lead.status != "converted":
        raise HTTPException(400,
            f"Lead must be at 'deal_won' stage before conversion. "
            f"Current stage: '{lead.status}'."
        )

    data = payload.model_dump(exclude={"lead_id"})
    client = Client(
        client_id=_next_client_id(db, converted=True),
        tracking_id=_next_tracking_id(db),
        lead_id=lead.id,
        **data,
    )
    db.add(client)
    db.flush()

    # Mark lead as converted
    lead.status = "converted"

    # Log timeline
    _add_timeline_entry(
        db, entity_type="lead", entity_id=lead.id,
        action="converted",
        description=f"Lead converted to client {client.client_id}",
        old_value="deal_won", new_value="converted",
        performed_by_id=current_user.id,
    )

    db.commit()
    db.refresh(client)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(client.id), record_label=f"Client (converted): {client.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in client.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="client", record_id=client.client_id,
        record_label=f"Client {client.name} (converted from lead)",
        new_values={k: str(v) for k, v in client.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return _client_out(_load_client(db, client.id))


@router.get("/clients/{client_id}", response_model=ClientOut)
def get_client(client_id: str, db: Session = Depends(get_db),
               _=Depends(require_any_permission(*PERM_VIEW))):
    return _client_out(_load_client(db, client_id))


@router.patch("/clients/{client_id}", response_model=ClientOut)
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    client = _load_client(db, client_id)
    old_data = {k: str(v) for k, v in client.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(client, k, v)
    db.commit()
    db.refresh(client)
    new_data = {k: str(v) for k, v in client.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="crm", action="UPDATE",
        record_id=str(client_id), record_label=f"Client: {client.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="crm",
        record_type="client", record_id=client.client_id,
        record_label=f"Client {client.name}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return _client_out(_load_client(db, client_id))


@router.post("/clients/{client_id}/attachments", response_model=ClientAttachmentOut)
def upload_client_attachment(client_id: int, file: UploadFile = File(...),
                              db: Session = Depends(get_db),
                              _=Depends(require_any_permission(*PERM_MANAGE))):
    _load_client(db, client_id)
    rel, fname = _save_file(file, f"clients/{client_id}")
    att = ClientAttachment(client_id=client_id, file_path=rel, filename=fname)
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


# ── Dealers ───────────────────────────────────────────────────────────────────

def _load_dealer(db: Session, dealer_id: str | int) -> Dealer:
    d = None
    if isinstance(dealer_id, str):
        if dealer_id.startswith("DEA-"):
            d = db.query(Dealer).options(joinedload(Dealer.attachments)).filter(Dealer.dealer_id == dealer_id).first()
        else:
            try:
                d = db.query(Dealer).options(joinedload(Dealer.attachments)).filter(Dealer.id == int(dealer_id)).first()
            except ValueError:
                d = db.query(Dealer).options(joinedload(Dealer.attachments)).filter(Dealer.dealer_id == dealer_id).first()
    else:
        d = db.query(Dealer).options(joinedload(Dealer.attachments)).filter(Dealer.id == dealer_id).first()
    if not d:
        raise HTTPException(404, "Dealer not found")
    return d


@router.get("/dealers", response_model=PaginatedDealers)
def list_dealers(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    print("CRM Query Params:", request.query_params)
    query = db.query(Dealer).options(joinedload(Dealer.attachments)).order_by(Dealer.id.desc())
    query, total = apply_table_filters(
        query=query,
        model=Dealer,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Dealer.name, Dealer.phone, Dealer.company, Dealer.dealer_id],
        date_filter=filter,
        date_field=Dealer.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    dealers = query.all()
    result = [DealerOut.model_validate(d).model_dump() for d in dealers]
    return {"items": result, "total": total, "limit": limit, "offset": offset}


@router.post("/dealers", response_model=DealerOut)
def create_dealer(payload: DealerCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    dealer = Dealer(dealer_id=_next_dealer_id(db), **payload.model_dump())
    db.add(dealer)
    db.commit()
    db.refresh(dealer)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(dealer.id), record_label=f"Dealer: {dealer.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in dealer.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="dealer", record_id=dealer.dealer_id,
        record_label=f"Dealer {dealer.name}",
        new_values={k: str(v) for k, v in dealer.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return _load_dealer(db, dealer.id)


@router.get("/dealers/{dealer_id}", response_model=DealerOut)
def get_dealer(dealer_id: str, db: Session = Depends(get_db),
               _=Depends(require_any_permission(*PERM_VIEW))):
    return _load_dealer(db, dealer_id)


@router.get("/dealers/{dealer_id}/detail", response_model=DealerDetailOut)
def get_dealer_detail(dealer_id: str, db: Session = Depends(get_db),
                      _=Depends(require_any_permission(*PERM_VIEW))):
    try:
        return _build_dealer_detail(db, dealer_id)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=str(exc))

def _build_dealer_detail(db: Session, dealer_id: str) -> DealerDetailOut:
    dealer = _load_dealer(db, dealer_id)
    did = dealer.id
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    first_of_last_month = (first_of_month - timedelta(days=1)).replace(day=1)

    # ── Ledger totals ──────────────────────────────────────────────────────
    last_entry = db.query(DealerLedgerEntry.running_balance).filter(
        DealerLedgerEntry.dealer_id == did
    ).order_by(DealerLedgerEntry.id.desc()).first()
    current_balance = last_entry[0] if last_entry else Decimal("0")

    total_commission_raw = db.query(func.coalesce(func.sum(DealerLedgerEntry.credit), 0)).filter(
        DealerLedgerEntry.dealer_id == did,
        DealerLedgerEntry.entry_type == "commission",
    ).scalar()
    total_commission_earned = total_commission_raw or Decimal("0")

    total_lead_cost_raw = db.query(func.coalesce(func.sum(DealerLedgerEntry.debit), 0)).filter(
        DealerLedgerEntry.dealer_id == did,
        DealerLedgerEntry.entry_type == "lead_cost",
    ).scalar()
    total_lead_cost = total_lead_cost_raw or Decimal("0")

    total_payouts_raw = db.query(func.coalesce(func.sum(DealerLedgerEntry.debit), 0)).filter(
        DealerLedgerEntry.dealer_id == did,
        DealerLedgerEntry.entry_type == "payout",
    ).scalar()
    total_payouts = total_payouts_raw or Decimal("0")

    current_month_comm_raw = db.query(func.coalesce(func.sum(DealerLedgerEntry.credit), 0)).filter(
        DealerLedgerEntry.dealer_id == did,
        DealerLedgerEntry.entry_type == "commission",
        DealerLedgerEntry.entry_date >= first_of_month,
    ).scalar()
    current_month_commission = current_month_comm_raw or Decimal("0")

    current_month_lead_raw = db.query(func.coalesce(func.sum(DealerLedgerEntry.debit), 0)).filter(
        DealerLedgerEntry.dealer_id == did,
        DealerLedgerEntry.entry_type == "lead_cost",
        DealerLedgerEntry.entry_date >= first_of_month,
    ).scalar()
    current_month_lead_cost = current_month_lead_raw or Decimal("0")

    net_balance = total_commission_earned - total_lead_cost - total_payouts
    amount_payable = net_balance if net_balance > 0 else Decimal("0")
    amount_receivable = abs(net_balance) if net_balance < 0 else Decimal("0")

    financial_summary = FinancialSummary(
        total_commission_earned=total_commission_earned,
        total_lead_cost=total_lead_cost,
        net_balance=net_balance,
        amount_payable_to_dealer=amount_payable,
        amount_receivable_from_dealer=amount_receivable,
        payments_received=total_payouts,
        pending_balance=current_balance,
        current_month_commission=current_month_commission,
        current_month_lead_cost=current_month_lead_cost,
    )

    # ── Lead stats ─────────────────────────────────────────────────────────
    all_leads = db.query(Lead).filter(Lead.assigned_dealer_id == did).all()
    total_leads = len(all_leads)
    status_counts: dict[str, int] = {}
    for l in all_leads:
        s = (l.status or "new").lower()
        status_counts[s] = status_counts.get(s, 0) + 1

    won_count = status_counts.get("won", 0)
    lost_count = status_counts.get("lost", 0)
    closed = won_count + lost_count

    lead_stats = LeadStats(
        total_assigned=total_leads,
        new=status_counts.get("new", 0),
        contacted=status_counts.get("contacted", 0),
        follow_up=status_counts.get("follow_up", 0) or status_counts.get("followup", 0),
        negotiation=status_counts.get("negotiation", 0),
        site_visit=status_counts.get("site_visit", 0) or status_counts.get("sitevisit", 0),
        booked=status_counts.get("booked", 0),
        won=won_count,
        lost=lost_count,
        cancelled=status_counts.get("cancelled", 0),
        expired=status_counts.get("expired", 0),
        conversion_rate=round((won_count / total_leads * 100) if total_leads > 0 else 0, 2),
        win_rate=round((won_count / closed * 100) if closed > 0 else 0, 2),
        lost_rate=round((lost_count / closed * 100) if closed > 0 else 0, 2),
    )

    # ── Lead cost summary ──────────────────────────────────────────────────
    cost_per_lead = dealer.cost_per_lead or Decimal("0")
    charged_leads_count = db.query(DealerLedgerEntry).filter(
        DealerLedgerEntry.dealer_id == did,
        DealerLedgerEntry.entry_type == "lead_cost",
    ).count()
    won_leads = [l for l in all_leads if l.status and l.status.lower() == "won"]
    closed_deals_count = db.query(Deal).filter(
        Deal.dealer_id == did,
        Deal.status == "won",
    ).count()

    lead_cost_summary = LeadCostSummary(
        cost_per_lead=cost_per_lead,
        total_charged_leads=charged_leads_count,
        total_lead_cost=total_lead_cost,
        avg_cost_per_won_lead=Decimal(str(total_lead_cost / len(won_leads))) if won_leads else Decimal("0"),
        avg_cost_per_closed_deal=Decimal(str(total_lead_cost / closed_deals_count)) if closed_deals_count > 0 else Decimal("0"),
        cost_recovery_pct=round(float(total_commission_earned / total_lead_cost * 100), 2) if total_lead_cost > 0 else 0.0,
    )

    # ── Commission summary ─────────────────────────────────────────────────
    won_deals = db.query(Deal).filter(
        Deal.dealer_id == did,
        Deal.status == "won",
    ).all()
    comm_values = [float(d.commission or 0) for d in won_deals]
    last_month_comm_raw = db.query(func.coalesce(func.sum(DealerLedgerEntry.credit), 0)).filter(
        DealerLedgerEntry.dealer_id == did,
        DealerLedgerEntry.entry_type == "commission",
        DealerLedgerEntry.entry_date >= first_of_last_month,
        DealerLedgerEntry.entry_date < first_of_month,
    ).scalar()

    commission_summary = CommissionSummary(
        total_deals_closed=len(won_deals),
        total_commission=total_commission_earned,
        avg_commission=Decimal(str(sum(comm_values) / len(comm_values))) if comm_values else Decimal("0"),
        highest_commission=Decimal(str(max(comm_values))) if comm_values else Decimal("0"),
        lowest_commission=Decimal(str(min(comm_values))) if comm_values else Decimal("0"),
        commission_this_month=current_month_commission,
        commission_last_month=last_month_comm_raw or Decimal("0"),
    )

    # ── Recent assigned leads (top 10) ─────────────────────────────────────
    recent_leads_data = db.query(Lead).filter(
        Lead.assigned_dealer_id == did,
    ).order_by(Lead.created_at.desc()).limit(10).all()

    recent_leads_out = []
    for l in recent_leads_data:
        prop_name = None
        deal_for_lead = db.query(Deal).filter(Deal.lead_id == l.id).first()
        if deal_for_lead and deal_for_lead.property:
            prop_name = deal_for_lead.property.name
        recent_leads_out.append(RecentAssignedLead(
            id=l.id, lead_id=l.lead_id or "", name=l.name or "",
            phone=l.phone, property_name=prop_name,
            assigned_date=l.created_at, current_stage=l.status or "new",
            lead_cost=l.lead_cost or l.cost_per_lead,
            expected_commission=deal_for_lead.commission if deal_for_lead else None,
            status=l.status or "new",
        ))

    # ── Recent ledger entries (top 10) ─────────────────────────────────────
    recent_entries = (
        db.query(DealerLedgerEntry)
        .filter(DealerLedgerEntry.dealer_id == did)
        .order_by(DealerLedgerEntry.id.desc())
        .limit(10)
        .all()
    )
    entries_out = []
    for e in recent_entries:
        lead_name = None
        if e.lead_id:
            lead = db.query(Lead).filter(Lead.id == e.lead_id).first()
            if lead:
                lead_name = lead.name
        entries_out.append({
            "id": e.id, "tid": e.tid, "dealer_id": e.dealer_id,
            "deal_id": e.deal_id, "lead_id": e.lead_id,
            "entry_date": e.entry_date, "description": e.description,
            "reference_no": e.reference_no, "entry_type": e.entry_type,
            "commission_rate": e.commission_rate, "gross_commission": e.gross_commission,
            "debit": e.debit, "credit": e.credit, "running_balance": e.running_balance,
            "status": e.status, "notes": e.notes, "created_at": e.created_at,
            "lead_name": lead_name, "dealer_name": dealer.name,
        })

    # ── Assigned clients + active deals ────────────────────────────────────
    assigned_clients = (
        db.query(Client).options(joinedload(Client.attachments))
        .filter(Client.dealer_id == did).all()
    )
    active_deals = (
        db.query(Deal).options(joinedload(Deal.attachments), joinedload(Deal.client),
                               joinedload(Deal.dealer), joinedload(Deal.property))
        .filter(Deal.dealer_id == did).order_by(Deal.created_at.desc()).all()
    )

    return DealerDetailOut(
        dealer=DealerOut.model_validate(dealer),
        financial_summary=financial_summary,
        lead_stats=lead_stats,
        lead_cost_summary=lead_cost_summary,
        commission_summary=commission_summary,
        recent_leads=recent_leads_out,
        recent_ledger_entries=entries_out,
        assigned_clients=[ClientOut.model_validate(c) for c in assigned_clients],
        active_deals=[DealOut.model_validate(d) for d in active_deals],
    )


@router.patch("/dealers/{dealer_id}", response_model=DealerOut)
def update_dealer(dealer_id: int, payload: DealerUpdate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    dealer = _load_dealer(db, dealer_id)
    old_data = {k: str(v) for k, v in dealer.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(dealer, k, v)
    db.commit()
    db.refresh(dealer)
    new_data = {k: str(v) for k, v in dealer.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="crm", action="UPDATE",
        record_id=str(dealer_id), record_label=f"Dealer: {dealer.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="crm",
        record_type="dealer", record_id=dealer.dealer_id,
        record_label=f"Dealer {dealer.name}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return _load_dealer(db, dealer_id)


@router.delete("/dealers/{dealer_id}", status_code=204)
def delete_dealer(dealer_id: int, force: bool = Query(False),
                  db: Session = Depends(get_db),
                  current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    dealer = _load_dealer(db, dealer_id)

    assigned_leads = db.query(Lead).filter(Lead.assigned_dealer_id == dealer_id).all()
    assigned_clients = db.query(Client).filter(Client.dealer_id == dealer_id).all()
    assigned_deals = db.query(Deal).filter(Deal.dealer_id == dealer_id).all()
    assigned_properties = db.query(Property).filter(Property.dealer_id == dealer_id).all()
    assigned_bookings = db.query(Booking).filter(Booking.assigned_dealer_id == dealer_id).all()
    assigned_commissions = db.query(Commission).filter(Commission.dealer_id == dealer_id).all()

    if not force and (assigned_leads or assigned_clients or assigned_deals or
                      assigned_properties or assigned_bookings or assigned_commissions):
        raise HTTPException(409, detail={
            "message": "Dealer has assigned records. Unassign them first or use force=true.",
            "leads": [{"id": l.id, "lead_id": l.lead_id, "name": l.name} for l in assigned_leads],
            "clients": [{"id": c.id, "client_id": c.client_id, "name": c.name} for c in assigned_clients],
            "deals": [{"id": d.id, "deal_title": d.deal_title, "status": d.status} for d in assigned_deals],
            "properties": [{"id": p.id, "tid": p.tid, "name": p.name} for p in assigned_properties],
            "bookings": [{"id": b.id, "status": b.status} for b in assigned_bookings],
            "commissions": [{"id": c.id, "type": c.type, "amount": float(c.amount), "payment_status": c.payment_status} for c in assigned_commissions],
        })

    if force:
        for lead in assigned_leads:
            lead.assigned_dealer_id = None
        for client in assigned_clients:
            client.dealer_id = None
        for deal in assigned_deals:
            deal.dealer_id = None
        for prop in assigned_properties:
            prop.dealer_id = None
        for booking in assigned_bookings:
            booking.assigned_dealer_id = None
        for comm in assigned_commissions:
            comm.dealer_id = None
        db.flush()

    old_data = {k: str(v) for k, v in dealer.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="crm", action="DELETE",
        record_id=str(dealer_id), record_label=f"Dealer: {dealer.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data,
    )
    db.delete(dealer)
    db.commit()


@router.post("/dealers/{dealer_id}/attachments", response_model=DealerAttachmentOut)
def upload_dealer_attachment(dealer_id: int, file: UploadFile = File(...),
                              db: Session = Depends(get_db),
                              _=Depends(require_any_permission(*PERM_MANAGE))):
    _load_dealer(db, dealer_id)
    rel, fname = _save_file(file, f"dealers/{dealer_id}")
    att = DealerAttachment(dealer_id=dealer_id, file_path=rel, filename=fname)
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


# ── Dealer Ledger ──────────────────────────────────────────────────────────────

@router.get("/dealers/{dealer_id}/ledger", response_model=list[DealerLedgerEntryOut])
def list_dealer_ledger(
    dealer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
    limit: int = 100,
    offset: int = 0,
):
    _load_dealer(db, dealer_id)
    entries = (
        db.query(DealerLedgerEntry)
        .filter(DealerLedgerEntry.dealer_id == dealer_id)
        .order_by(DealerLedgerEntry.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    result = []
    for e in entries:
        lead_name = None
        if e.lead_id:
            lead = db.query(Lead).filter(Lead.id == e.lead_id).first()
            if lead:
                lead_name = lead.name
        dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
        result.append({
            "id": e.id, "tid": e.tid, "dealer_id": e.dealer_id,
            "deal_id": e.deal_id, "lead_id": e.lead_id,
            "entry_date": e.entry_date, "description": e.description,
            "reference_no": e.reference_no, "entry_type": e.entry_type,
            "commission_rate": e.commission_rate, "gross_commission": e.gross_commission,
            "debit": e.debit, "credit": e.credit, "running_balance": e.running_balance,
            "status": e.status, "notes": e.notes, "created_at": e.created_at,
            "lead_name": lead_name, "dealer_name": dealer.name if dealer else None,
        })
    return result


@router.get("/dealers/{dealer_id}/ledger/balance")
def get_dealer_balance(
    dealer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    _load_dealer(db, dealer_id)
    last = (
        db.query(DealerLedgerEntry.running_balance)
        .filter(DealerLedgerEntry.dealer_id == dealer_id)
        .order_by(DealerLedgerEntry.id.desc())
        .first()
    )
    current_balance = last[0] if last else Decimal("0")
    total_lead_costs_raw = db.query(func.sum(DealerLedgerEntry.debit)).filter(
        DealerLedgerEntry.dealer_id == dealer_id,
        DealerLedgerEntry.entry_type == "lead_cost",
    ).first()
    total_lead_costs = Decimal(str(total_lead_costs_raw[0])) if total_lead_costs_raw and total_lead_costs_raw[0] else Decimal("0")
    total_payouts_raw = db.query(func.sum(DealerLedgerEntry.debit)).filter(
        DealerLedgerEntry.dealer_id == dealer_id,
        DealerLedgerEntry.entry_type == "payout",
    ).first()
    total_payouts = Decimal(str(total_payouts_raw[0])) if total_payouts_raw and total_payouts_raw[0] else Decimal("0")
    total_commission_raw = db.query(func.sum(DealerLedgerEntry.credit)).filter(
        DealerLedgerEntry.dealer_id == dealer_id,
        DealerLedgerEntry.entry_type == "commission",
    ).first()
    total_commission = Decimal(str(total_commission_raw[0])) if total_commission_raw and total_commission_raw[0] else Decimal("0")
    return {
        "current_balance": current_balance,
        "total_lead_costs": total_lead_costs,
        "total_payouts": total_payouts,
        "total_commission_earned": total_commission,
    }


@router.post("/dealers/ledger", response_model=DealerLedgerEntryOut, status_code=201)
def create_dealer_ledger_entry(
    payload: DealerLedgerCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    dealer = _load_dealer(db, payload.dealer_id)
    last_entry = db.query(DealerLedgerEntry.running_balance).filter(
        DealerLedgerEntry.dealer_id == payload.dealer_id
    ).order_by(DealerLedgerEntry.id.desc()).first()
    prev_balance = last_entry[0] if last_entry else Decimal("0")
    count = db.query(func.count(DealerLedgerEntry.id)).scalar() or 0
    entry = DealerLedgerEntry(
        tid=f"DLE-{count + 1:04d}",
        dealer_id=payload.dealer_id,
        entry_date=datetime.utcnow(),
        description=payload.description,
        entry_type=payload.entry_type,
        debit=payload.amount if payload.entry_type in ("payout", "adjustment", "penalty") else Decimal("0"),
        credit=payload.amount if payload.entry_type in ("commission", "bonus") else Decimal("0"),
        running_balance=prev_balance + (payload.amount if payload.entry_type in ("commission", "bonus") else -payload.amount),
        status="posted",
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    db.flush()
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=entry.tid, record_label=f"Ledger: {payload.description}",
        changed_by=current_user.email,
        changed_by_role=getattr(getattr(current_user, "role", None), "name", None),
    )
    db.commit()
    db.refresh(entry)
    return {
        "id": entry.id, "tid": entry.tid, "dealer_id": entry.dealer_id,
        "deal_id": entry.deal_id, "lead_id": entry.lead_id,
        "entry_date": entry.entry_date, "description": entry.description,
        "reference_no": entry.reference_no, "entry_type": entry.entry_type,
        "commission_rate": entry.commission_rate, "gross_commission": entry.gross_commission,
        "debit": entry.debit, "credit": entry.credit, "running_balance": entry.running_balance,
        "status": entry.status, "notes": entry.notes, "created_at": entry.created_at,
        "lead_name": None, "dealer_name": dealer.name,
    }


@router.post("/dealers/payments", response_model=DealerLedgerEntryOut, status_code=201)
def create_dealer_payout(
    payload: DealerPaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    dealer = _load_dealer(db, payload.dealer_id)
    last_entry = db.query(DealerLedgerEntry.running_balance).filter(
        DealerLedgerEntry.dealer_id == payload.dealer_id
    ).order_by(DealerLedgerEntry.id.desc()).first()
    prev_balance = last_entry[0] if last_entry else Decimal("0")
    if payload.amount > prev_balance:
        raise HTTPException(400, f"Payout amount ({payload.amount}) exceeds available balance ({prev_balance})")
    count = db.query(func.count(DealerLedgerEntry.id)).scalar() or 0
    entry = DealerLedgerEntry(
        tid=f"DLE-{count + 1:04d}",
        dealer_id=payload.dealer_id,
        entry_date=datetime.utcnow(),
        description=payload.notes or f"Payout via {payload.payment_method}",
        reference_no=payload.reference_no,
        entry_type="payout",
        debit=payload.amount,
        credit=Decimal("0"),
        running_balance=prev_balance - payload.amount,
        status="posted",
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    db.flush()
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=entry.tid, record_label=f"Dealer payout: {payload.amount}",
        changed_by=current_user.email,
        changed_by_role=getattr(getattr(current_user, "role", None), "name", None),
    )
    db.commit()
    db.refresh(entry)
    return {
        "id": entry.id, "tid": entry.tid, "dealer_id": entry.dealer_id,
        "deal_id": entry.deal_id, "lead_id": entry.lead_id,
        "entry_date": entry.entry_date, "description": entry.description,
        "reference_no": entry.reference_no, "entry_type": entry.entry_type,
        "commission_rate": entry.commission_rate, "gross_commission": entry.gross_commission,
        "debit": entry.debit, "credit": entry.credit, "running_balance": entry.running_balance,
        "status": entry.status, "notes": entry.notes, "created_at": entry.created_at,
        "lead_name": None, "dealer_name": dealer.name,
    }


# ── Installment Types ─────────────────────────────────────────────────────────

@router.get("/installment-types", response_model=list[InstallmentTypeOut])
def list_installment_types(db: Session = Depends(get_db),
                            _=Depends(require_any_permission(*PERM_VIEW))):
    return db.query(InstallmentType).order_by(InstallmentType.name).all()


@router.post("/installment-types", response_model=InstallmentTypeOut)
def create_installment_type(payload: InstallmentTypeCreate, db: Session = Depends(get_db),
                             current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    existing = db.query(InstallmentType).filter(InstallmentType.name == payload.name).first()
    if existing:
        return existing
    it = InstallmentType(name=payload.name)
    db.add(it)
    db.commit()
    db.refresh(it)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(it.id), record_label=f"Installment Type: {it.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={"name": it.name, "id": it.id},
    )
    return it


@router.delete("/installment-types/{type_id}", status_code=204)
def delete_installment_type(type_id: int, db: Session = Depends(get_db),
                             current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    it = db.query(InstallmentType).filter(InstallmentType.id == type_id).first()
    if not it:
        raise HTTPException(404, "Installment type not found")
    log_action(
        db=db, module="crm", action="DELETE",
        record_id=str(type_id), record_label=f"Installment Type: {it.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data={"name": it.name, "id": it.id},
    )
    db.delete(it)
    db.commit()


# ── Deals ─────────────────────────────────────────────────────────────────────

def _load_deal(db: Session, deal_id: str | int) -> Deal:
    def q():
        return db.query(Deal).options(
            joinedload(Deal.client), joinedload(Deal.dealer),
            joinedload(Deal.property).joinedload(Property.floors).joinedload(Floor.units),
            joinedload(Deal.unit), joinedload(Deal.attachments),
        )
    deal = None
    if isinstance(deal_id, str):
        if deal_id.startswith("DEAL-"):
            deal = q().filter(Deal.deal_id == deal_id).first()
        elif deal_id.startswith("TRX-"):
            deal = q().filter(Deal.tracking_id == deal_id).first()
        else:
            try:
                deal = q().filter(Deal.id == int(deal_id)).first()
            except ValueError:
                deal = q().filter(Deal.deal_id == deal_id).first()
    else:
        deal = q().filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(404, "Deal not found")
    return deal


@router.get("/deals", response_model=PaginatedDeals)
def list_deals(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    print("CRM Query Params:", request.query_params)
    query = (
        db.query(Deal)
        .options(joinedload(Deal.client), joinedload(Deal.dealer),
                 joinedload(Deal.property), joinedload(Deal.attachments))
        .order_by(Deal.id.desc())
    )
    query, total = apply_table_filters(
        query=query,
        model=Deal,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Deal.deal_id, Deal.deal_title, Deal.tracking_id],
        date_filter=filter,
        date_field=Deal.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    deals = query.all()
    result = [_deal_out(d) for d in deals]
    return {"items": result, "total": total, "limit": limit, "offset": offset}


@router.post("/deals", response_model=DealOut)
async def create_deal(payload: DealCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    if payload.unit_id is not None:
        try:
            validate_unit_available_for_deal(db, payload.unit_id)
        except UnitNotAvailableError as e:
            raise HTTPException(409, str(e))

    deal = Deal(
        deal_id=_next_deal_id(db),
        tracking_id=client.tracking_id,
        **payload.model_dump(),
    )
    db.add(deal)
    db.flush()

    if payload.unit_id is not None:
        sync_unit_status(db, payload.unit_id)

    db.commit()
    db.refresh(deal)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(deal.id), record_label=f"Deal: {deal.deal_title or deal.id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in deal.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="deal", record_id=deal.deal_id,
        record_label=f"Deal {deal.deal_title or deal.id}",
        new_values={k: str(v) for k, v in deal.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    await ws_manager.broadcast("new_deal", {"deal_id": deal.id})
    await ws_manager.broadcast("dashboard_refresh", {})
    return _deal_out(_load_deal(db, deal.id))


@router.get("/deals/{deal_id}", response_model=DealOut)
def get_deal(deal_id: str, db: Session = Depends(get_db),
             _=Depends(require_any_permission(*PERM_VIEW))):
    return _deal_out(_load_deal(db, deal_id))


@router.get("/deals/{deal_id}/ledger", response_model=DealLedgerOut)
def get_deal_ledger(deal_id: str, db: Session = Depends(get_db),
                    _=Depends(require_any_permission(*PERM_VIEW))):
    deal = _load_deal(db, deal_id)
    deal_out = _deal_out(deal)

    total_value = deal.deal_value or Decimal(0)

    # Amount paid = sum of all installment paid_amounts for this deal
    amount_paid = (
        db.query(func.coalesce(func.sum(Installment.paid_amount), 0))
        .join(InstallmentPlan, Installment.plan_id == InstallmentPlan.id)
        .filter(InstallmentPlan.deal_id == deal.id)
        .scalar()
    )

    # Surcharges/penalties = unpaid portion of overdue installments
    penalties = (
        db.query(func.coalesce(func.sum(Installment.amount - Installment.paid_amount), 0))
        .join(InstallmentPlan, Installment.plan_id == InstallmentPlan.id)
        .filter(
            InstallmentPlan.deal_id == deal.id,
            Installment.status == "overdue",
        )
        .scalar()
    )

    remaining_balance = total_value - amount_paid
    if remaining_balance < 0:
        remaining_balance = Decimal(0)

    return DealLedgerOut(
        deal=deal_out,
        total_value=total_value,
        amount_paid=amount_paid,
        remaining_balance=remaining_balance,
        surcharges_penalties=penalties,
    )


@router.patch("/deals/{deal_id}", response_model=DealOut)
def update_deal(deal_id: int, payload: DealUpdate, db: Session = Depends(get_db),
                current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    deal = _load_deal(db, deal_id)
    old_data = {k: str(v) for k, v in deal.__dict__.items() if not k.startswith('_')}

    # If unit_id is being changed, validate the new unit is available.
    if payload.unit_id is not None and payload.unit_id != deal.unit_id:
        try:
            validate_unit_available_for_deal(db, payload.unit_id, exclude_deal_id=deal.id)
        except UnitNotAvailableError as e:
            raise HTTPException(409, str(e))

    old_unit_id = deal.unit_id
    old_status = deal.status

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(deal, k, v)

    # Sync unit status when deal status or unit_id changes.
    if deal.unit_id is not None:
        if deal.status != old_status or deal.unit_id != old_unit_id:
            sync_unit_status(db, deal.unit_id)
    if old_unit_id is not None and old_unit_id != deal.unit_id:
        sync_unit_status(db, old_unit_id)

    # ── Finance sync: journalize down payment when marked paid ────────────
    if payload.down_payment_status == "paid" and deal.down_payment and float(deal.down_payment) > 0:
        try:
            cash_account = db.query(Account).filter(Account.code == "1100").first()
            revenue_account = None
            if deal.property_id:
                prop = db.query(Property).filter(Property.id == deal.property_id).first()
                if prop and prop.income_gl_account_id:
                    revenue_account = db.query(Account).filter(Account.id == prop.income_gl_account_id).first()
            if not revenue_account:
                revenue_account = db.query(Account).filter(Account.code == "4300").first()
            if cash_account and revenue_account:
                JournalService.create_journal_entry(
                    db=db,
                    entries=[
                        JournalEntryData(
                            account_id=cash_account.id,
                            debit=deal.down_payment,
                            description=f"Deal down payment {deal.deal_id}",
                        ),
                        JournalEntryData(
                            account_id=revenue_account.id,
                            credit=deal.down_payment,
                            description=f"Deal down payment {deal.deal_id} revenue",
                        ),
                    ],
                    reference_type="deal_down_payment",
                    reference_id=str(deal.id),
                    description=f"Deal {deal.deal_id} down payment — {deal.down_payment}",
                )
        except ValueError:
            pass

    # ── Auto-create commission entry when deal status changes to won ──────
    if payload.status == "won" and deal.status != "won" and deal.dealer_id:
        dealer_obj = db.query(Dealer).filter(Dealer.id == deal.dealer_id).first()
        if dealer_obj and dealer_obj.commission_rate:
            commission_amt = Decimal("0")
            if dealer_obj.commission_type == "percentage":
                commission_amt = (deal.deal_value * dealer_obj.commission_rate / Decimal("100")).quantize(Decimal("0.01"))
            else:
                commission_amt = dealer_obj.commission_rate.quantize(Decimal("0.01"))

            if commission_amt > 0:
                last_entry = db.query(DealerLedgerEntry.running_balance).filter(
                    DealerLedgerEntry.dealer_id == deal.dealer_id
                ).order_by(DealerLedgerEntry.id.desc()).first()
                prev_balance = last_entry[0] if last_entry else Decimal("0")

                entry = DealerLedgerEntry(
                    tid=f"DLE-{db.query(func.count(DealerLedgerEntry.id)).scalar() + 1:04d}",
                    dealer_id=deal.dealer_id,
                    deal_id=deal.id,
                    entry_date=datetime.utcnow(),
                    description=f"Commission — {deal.deal_id} ({deal.deal_title or 'Deal'})",
                    entry_type="commission",
                    commission_rate=dealer_obj.commission_rate,
                    gross_commission=commission_amt,
                    debit=Decimal("0"),
                    credit=commission_amt,
                    running_balance=prev_balance + commission_amt,
                    status="posted",
                    created_by_user_id=current_user.id,
                )
                db.add(entry)
                deal.commission = commission_amt

    db.commit()
    db.refresh(deal)
    new_data = {k: str(v) for k, v in deal.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="crm", action="UPDATE",
        record_id=str(deal_id), record_label=f"Deal: {deal.deal_title or deal.id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="crm",
        record_type="deal", record_id=deal.deal_id,
        record_label=f"Deal {deal.deal_title or deal.id}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return _deal_out(_load_deal(db, deal_id))


@router.post("/deals/{deal_id}/attachments", response_model=DealAttachmentOut)
def upload_deal_attachment(deal_id: int, file: UploadFile = File(...),
                            db: Session = Depends(get_db),
                            _=Depends(require_any_permission(*PERM_MANAGE))):
    _load_deal(db, deal_id)
    rel, fname = _save_file(file, f"deals/{deal_id}")
    att = DealAttachment(deal_id=deal_id, file_path=rel, filename=fname)
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


# ── CRM Dashboard ──────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=CrmDashboardData)
def get_crm_dashboard(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    now = datetime.utcnow()

    # Stats
    total_leads = db.query(func.count(Lead.id)).scalar() or 0
    new_leads = db.query(func.count(Lead.id)).filter(Lead.status == "new").scalar() or 0
    active_clients = db.query(func.count(Client.id)).filter(Client.status == "active").scalar() or 0
    total_deals = db.query(func.count(Deal.id)).scalar() or 0
    won_deals = db.query(func.count(Deal.id)).filter(Deal.status == "won").scalar() or 0
    lost_deals = db.query(func.count(Deal.id)).filter(Deal.status == "lost").scalar() or 0
    total_bookings = db.query(func.count(Booking.id)).scalar() or 0

    # Unit availability stats
    total_units = db.query(func.count(Unit.id)).scalar() or 0
    available_units = db.query(func.count(Unit.id)).filter(Unit.status == "available").scalar() or 0
    booked_units = db.query(func.count(Unit.id)).filter(
        Unit.status.in_(["booked", "reserved", "under_verification", "agreement_signed", "installment_running"])
    ).scalar() or 0
    completed_units = db.query(func.count(Unit.id)).filter(
        Unit.status.in_(["completed", "registered", "sold"])
    ).scalar() or 0

    revenue = db.query(func.coalesce(func.sum(Payment.amount), 0)).scalar() or Decimal("0")
    # pending revenue = remaining amount in all installment plans
    pending_revenue = db.query(func.coalesce(func.sum(InstallmentPlan.remaining_amount), 0)).scalar() or Decimal("0")
    overdue_installments = db.query(func.count(Installment.id)).filter(Installment.status == "overdue").scalar() or 0
    total_followups_pending = db.query(func.count(FollowUp.id)).filter(FollowUp.fu_status == "pending").scalar() or 0
    total_visits_scheduled = db.query(func.count(SiteVisit.id)).filter(SiteVisit.sv_status == "scheduled").scalar() or 0

    # Lead source distribution (include null/empty as "Not set")
    source_rows = db.query(Lead.source, func.count(Lead.id)).group_by(Lead.source).all()
    lead_source_distribution = []
    for source, count in source_rows:
        if source:
            lead_source_distribution.append({"source": source, "count": count})
        else:
            lead_source_distribution.append({"source": "Not set", "count": count})

    # Monthly sales
    month_col = date_format(db, Deal.created_at, "YYYY-MM")
    monthly_rows = db.query(
        month_col,
        func.sum(Deal.deal_value),
        func.count(Deal.id),
    ).filter(Deal.status == "won").group_by(month_col).order_by(month_col.desc()).limit(12).all()
    monthly_sales = [{"month": r[0], "value": r[1] or Decimal("0"), "count": r[2]} for r in monthly_rows]

    # Conversion funnel
    funnel_stages = ["new", "contacted", "interested", "site_visit_completed", "negotiation", "converted"]
    conversion_funnel = []
    for stage in funnel_stages:
        if stage == "converted":
            count = db.query(func.count(Lead.id)).filter(
                exists().where(Client.lead_id == Lead.id)
            ).scalar() or 0
        else:
            count = db.query(func.count(Lead.id)).filter(Lead.status == stage).scalar() or 0
        conversion_funnel.append({"stage": stage.replace("_", " ").title(), "count": count})

    # Avg lead age (days from lead created to converted)
    avg_lead_age = 0.0
    lead_age_result = db.query(
        func.avg(date_diff_days(db, Client.created_at, Lead.created_at))
    ).select_from(Lead).join(Client, Client.lead_id == Lead.id).scalar()
    if lead_age_result is not None:
        avg_lead_age = round(float(lead_age_result), 1)

    # Dealer performance
    dealers = db.query(Dealer).all()
    dealer_performance = []
    for dealer in dealers:
        dl = db.query(func.count(Deal.id)).filter(Deal.dealer_id == dealer.id).scalar() or 0
        dc = db.query(func.count(Deal.id)).filter(Deal.dealer_id == dealer.id, Deal.status == "won").scalar() or 0
        ds = db.query(func.coalesce(func.sum(Deal.deal_value), 0)).filter(Deal.dealer_id == dealer.id, Deal.status == "won").scalar() or Decimal("0")
        dealer_performance.append({
            "dealer_id": dealer.id,
            "dealer_name": dealer.name,
            "total_leads": dl,
            "converted_leads": dc,
            "total_sales": ds,
            "commission_earned": ds * (dealer.commission_rate or 0) / 100 if dealer.commission_type == "percentage" else (dealer.commission_rate or 0),
            "won_deals": dc,
            "monthly_target": dealer.monthly_target,
            "avg_deal_value": ds / dc if dc > 0 else Decimal("0"),
        })

    # Booking trends
    book_month_col = date_format(db, Booking.created_at, "YYYY-MM")
    booking_rows = db.query(
        book_month_col,
        func.count(Booking.id),
        func.sum(Booking.property_price),
    ).group_by(book_month_col).order_by(book_month_col.desc()).limit(12).all()
    booking_trends = [{"month": r[0], "count": r[1], "value": r[2] or Decimal("0")} for r in booking_rows]

    # Recent activities
    recent = db.query(CrmTimelineEntry).order_by(CrmTimelineEntry.created_at.desc()).limit(20).all()

    return CrmDashboardData(
        stats=CrmDashboardStats(
            total_leads=total_leads,
            new_leads=new_leads,
            active_clients=active_clients,
            total_deals=total_deals,
            won_deals=won_deals,
            lost_deals=lost_deals,
            total_bookings=total_bookings,
            revenue=revenue,
            pending_revenue=pending_revenue,
            overdue_installments=overdue_installments,
            total_followups_pending=total_followups_pending,
            total_visits_scheduled=total_visits_scheduled,
            avg_lead_age=avg_lead_age,
            total_units=total_units,
            available_units=available_units,
            booked_units=booked_units,
            completed_units=completed_units,
        ),
        lead_source_distribution=lead_source_distribution,
        monthly_sales=monthly_sales,
        conversion_funnel=conversion_funnel,
        dealer_performance=dealer_performance,
        booking_trends=booking_trends,
        recent_activities=[
            RecentActivity(
                id=e.id, action=e.action, description=e.description,
                entity_type=e.entity_type, entity_id=e.entity_id,
                performed_by_name=e.performed_by.full_name if e.performed_by else None,
                created_at=e.created_at,
            ) for e in recent
        ],
    )


# ── FollowUps ─────────────────────────────────────────────────────────────────

@router.get("/followups", response_model=PaginatedFollowUps)
def list_followups(
    request: Request, response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None, offset: int | None = None,
    lead_id: int | None = None,
    fu_status: str | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = db.query(FollowUp).options(
        joinedload(FollowUp.lead), joinedload(FollowUp.assigned_user),
    ).order_by(FollowUp.created_at.desc())
    if lead_id:
        query = query.filter(FollowUp.lead_id == lead_id)
    if fu_status:
        query = query.filter(FollowUp.fu_status == fu_status)
    total = query.count()
    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)
    items = query.all()
    result = []
    for fu in items:
        d = FollowUpOut.model_validate(fu).model_dump()
        d["lead_name"] = fu.lead.name if fu.lead else None
        d["lead_phone"] = fu.lead.phone if fu.lead else None
        d["assigned_user_name"] = fu.assigned_user.full_name if fu.assigned_user else None
        result.append(d)
    response.headers["X-Total-Count"] = str(total)
    return {"items": result, "total": total, "limit": limit, "offset": offset}


@router.get("/followups/{fu_id}", response_model=dict)
def get_followup(
    fu_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single follow-up by fu_id."""
    fu = db.query(FollowUp).filter(FollowUp.fu_id == fu_id).first()
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    db.refresh(fu)
    return _followup_out(fu)


def _followup_out(fu: FollowUp) -> dict:
    d = FollowUpOut.model_validate(fu).model_dump()
    d["lead_name"] = fu.lead.name if fu.lead else None
    d["lead_phone"] = fu.lead.phone if fu.lead else None
    d["assigned_user_name"] = fu.assigned_user.full_name if fu.assigned_user else None
    return d


@router.patch("/followups/{fu_id}", response_model=FollowUpOut)
def update_followup(
    fu_id: int, payload: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    fu = db.query(FollowUp).options(
        joinedload(FollowUp.lead), joinedload(FollowUp.assigned_user),
    ).filter(FollowUp.id == fu_id).first()
    if not fu:
        raise HTTPException(404, "Follow-up not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(fu, k, v)
    db.commit()
    db.refresh(fu)
    return _followup_out(fu)


@router.post("/followups", response_model=FollowUpOut, status_code=201)
def create_followup(
    payload: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    fu = FollowUp(
        fu_id=_next_followup_id(db),
        lead_id=payload.lead_id,
        assigned_user_id=payload.assigned_user_id or current_user.id,
        date=payload.date,
        time=payload.time,
        fu_type=payload.fu_type,
        fu_status=payload.fu_status or "pending",
        notes=payload.notes,
    )
    db.add(fu)
    _add_timeline_entry(
        db, entity_type="lead", entity_id=payload.lead_id,
        action="followup_created",
        description=f"Follow-up ({fu.fu_type}) scheduled for {fu.date}",
        performed_by_id=current_user.id,
    )
    db.commit()
    db.refresh(fu)
    return _followup_out(fu)


@router.post("/followups/{fu_id}/complete")
def complete_followup(
    fu_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    fu = db.query(FollowUp).filter(FollowUp.id == fu_id).first()
    if not fu:
        raise HTTPException(404, "Follow-up not found")
    fu.fu_status = "completed"
    _add_timeline_entry(
        db, entity_type="lead", entity_id=fu.lead_id,
        action="followup_completed",
        description=f"Follow-up ({fu.fu_type}) completed",
        performed_by_id=current_user.id,
    )
    db.commit()
    return {"ok": True}


# ── Site Visits ────────────────────────────────────────────────────────────────

@router.get("/site-visits", response_model=PaginatedSiteVisits)
def list_site_visits(
    request: Request, response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None, offset: int | None = None,
    lead_id: int | None = None,
    sv_status: str | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = db.query(SiteVisit).options(
        joinedload(SiteVisit.lead), joinedload(SiteVisit.property),
        joinedload(SiteVisit.dealer),
    ).order_by(SiteVisit.created_at.desc())
    if lead_id:
        query = query.filter(SiteVisit.lead_id == lead_id)
    if sv_status:
        query = query.filter(SiteVisit.sv_status == sv_status)
    total = query.count()
    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)
    items = query.all()
    result = []
    for sv in items:
        d = SiteVisitOut.model_validate(sv).model_dump()
        d["lead_name"] = sv.lead.name if sv.lead else None
        d["lead_phone"] = sv.lead.phone if sv.lead else None
        d["property_name"] = sv.property.name if sv.property else None
        d["dealer_name"] = sv.dealer.name if sv.dealer else None
        result.append(d)
    response.headers["X-Total-Count"] = str(total)
    return {"items": result, "total": total, "limit": limit, "offset": offset}


@router.post("/site-visits", response_model=SiteVisitOut)
def create_site_visit(
    payload: SiteVisitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    lead = db.query(Lead).filter(Lead.id == payload.lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    sv = SiteVisit(visit_id=_next_visit_id(db), **payload.model_dump())
    db.add(sv)
    db.flush()
    _add_timeline_entry(
        db, entity_type="lead", entity_id=payload.lead_id,
        action="visit_scheduled",
        description=f"Site visit scheduled for {payload.date}",
        performed_by_id=current_user.id,
    )
    db.commit()
    db.refresh(sv)
    return _site_visit_out(sv)


def _site_visit_out(sv: SiteVisit) -> dict:
    d = SiteVisitOut.model_validate(sv).model_dump()
    d["lead_name"] = sv.lead.name if sv.lead else None
    d["lead_phone"] = sv.lead.phone if sv.lead else None
    d["property_name"] = sv.property.name if sv.property else None
    d["dealer_name"] = sv.dealer.name if sv.dealer else None
    return d


@router.patch("/site-visits/{visit_id}", response_model=SiteVisitOut)
def update_site_visit(
    visit_id: int, payload: SiteVisitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    sv = db.query(SiteVisit).options(
        joinedload(SiteVisit.lead), joinedload(SiteVisit.property),
        joinedload(SiteVisit.dealer),
    ).filter(SiteVisit.id == visit_id).first()
    if not sv:
        raise HTTPException(404, "Site visit not found")
    old_status = sv.sv_status
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(sv, k, v)
    if payload.sv_status and payload.sv_status != old_status:
        _add_timeline_entry(
            db, entity_type="lead", entity_id=sv.lead_id,
            action="visit_status_changed",
            description=f"Visit status changed from {old_status} to {payload.sv_status}",
            old_value=old_status, new_value=payload.sv_status,
            performed_by_id=current_user.id,
        )
    db.commit()
    db.refresh(sv)
    return _site_visit_out(sv)


# ── Payments (standalone) ──────────────────────────────────────────────────────

@router.get("/payments", response_model=PaginatedPayments)
def list_payments(
    request: Request, response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None, offset: int | None = None,
    client_id: int | None = None,
    deal_id: int | None = None,
    booking_id: int | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = db.query(Payment).options(
        joinedload(Payment.client), joinedload(Payment.deal),
    ).order_by(Payment.created_at.desc())
    if client_id:
        query = query.filter(Payment.client_id == client_id)
    if deal_id:
        query = query.filter(Payment.deal_id == deal_id)
    if booking_id:
        query = query.filter(Payment.booking_id == booking_id)
    total = query.count()
    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)
    items = query.all()
    result = []
    for p in items:
        d = PaymentOut.model_validate(p).model_dump()
        d["client_name"] = p.client.name if p.client else None
        d["deal_title"] = p.deal.deal_title if p.deal else None
        result.append(d)
    response.headers["X-Total-Count"] = str(total)
    return {"items": result, "total": total, "limit": limit, "offset": offset}


@router.post("/payments", response_model=PaymentOut)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    pm = Payment(payment_id=_next_payment_id(db), **payload.model_dump())
    db.add(pm)
    db.flush()

    # ── Finance sync: post journal entry ──────────────────────────────────
    cash_code = "1010" if payload.payment_method == "cash" else "1100"
    cash_account = db.query(Account).filter(Account.code == cash_code).first()

    # Resolve property revenue account
    revenue_account = None
    if payload.deal_id:
        deal = db.query(Deal).options(joinedload(Deal.property)).filter(Deal.id == payload.deal_id).first()
        if deal and deal.property and deal.property.income_gl_account_id:
            revenue_account = db.query(Account).filter(Account.id == deal.property.income_gl_account_id).first()
    if not revenue_account:
        revenue_account = db.query(Account).filter(Account.code == "4300").first()

    if cash_account and revenue_account:
        try:
            journal = JournalService.create_journal_entry(
                db=db,
                entries=[
                    JournalEntryData(account_id=cash_account.id, debit=payload.amount,
                                     description=f"CRM payment {pm.payment_id} — {client.name}"),
                    JournalEntryData(account_id=revenue_account.id, credit=payload.amount,
                                     description=f"CRM payment {pm.payment_id} — {client.name}"),
                ],
                reference_type="crm_payment",
                reference_id=str(pm.id),
                description=f"CRM payment {pm.payment_id} from {client.name} — {payload.amount}",
                date=payload.payment_date or datetime.utcnow(),
            )
            pm.journal_id = journal.id
        except ValueError:
            pass  # journal creation failed silently — payment still recorded

    _add_timeline_entry(
        db, entity_type="client", entity_id=payload.client_id,
        action="payment_received",
        description=f"Payment of {payload.amount} received from {client.name}",
        performed_by_id=current_user.id,
    )
    db.commit()
    db.refresh(pm)
    d = PaymentOut.model_validate(pm).model_dump()
    d["client_name"] = client.name
    return d


@router.get("/payments/ledger", response_model=PaginatedPaymentLedger)
def payment_ledger(
    request: Request, response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None, offset: int | None = None,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    """Unified payment ledger across all CRM payment sources."""
    from app.models.booking import Booking
    from app.models.finance import Journal

    entries: list[dict] = []

    # 1. CRM standalone payments
    crm_pmts = db.query(Payment).options(
        joinedload(Payment.client),
        joinedload(Payment.deal),
        joinedload(Payment.journal),
    ).order_by(Payment.payment_date.desc()).all()
    for p in crm_pmts:
        entries.append({
            "id": p.id,
            "pay_id": p.payment_id,
            "date": p.payment_date,
            "client_name": p.client.name if p.client else None,
            "reference": p.reference,
            "payment_type": "Payment",
            "amount": p.amount,
            "method": p.payment_method,
            "received_by": None,
            "receipt": p.receipt_number,
            "finance_posted": p.journal_id is not None,
            "status": "completed" if p.journal_id else "pending",
            "notes": p.notes,
        })

    # 2. Installment payments
    inst_pmts = (
        db.query(InstallmentPayment)
        .options(
            joinedload(InstallmentPayment.installment)
            .joinedload(Installment.plan),
            joinedload(InstallmentPayment.journal),
        )
        .order_by(InstallmentPayment.date.desc())
        .all()
    )
    for ip in inst_pmts:
        client_name = None
        deal_ref = None
        inst = ip.installment
        if inst and inst.plan:
            if inst.plan.deal_id:
                deal = db.query(Deal).options(joinedload(Deal.client)).filter(Deal.id == inst.plan.deal_id).first()
                if deal:
                    deal_ref = deal.deal_id
                    if deal.client:
                        client_name = deal.client.name
            elif inst.plan.booking_id:
                booking = db.query(Booking).options(joinedload(Booking.client)).filter(Booking.id == inst.plan.booking_id).first()
                if booking:
                    deal_ref = booking.booking_id
                    if booking.client:
                        client_name = booking.client.name
        entries.append({
            "id": ip.id,
            "pay_id": f"INS-PMT-{ip.id}",
            "date": ip.date,
            "client_name": client_name,
            "reference": ip.reference_number or deal_ref,
            "payment_type": "Instalment",
            "amount": ip.amount,
            "method": ip.method,
            "received_by": None,
            "receipt": None,
            "finance_posted": ip.journal_id is not None,
            "status": "completed" if ip.journal_id else "pending",
            "notes": None,
        })

    # 3. Booking down payments / tokens
    bookings = db.query(Booking).options(
        joinedload(Booking.client),
    ).filter(Booking.down_payment > 0).order_by(Booking.created_at.desc()).all()
    for b in bookings:
        entries.append({
            "id": b.id,
            "pay_id": b.booking_id,
            "date": b.created_at,
            "client_name": b.client.name if b.client else None,
            "reference": b.booking_id,
            "payment_type": "Down Payment",
            "amount": b.down_payment,
            "method": "bank_transfer",
            "received_by": None,
            "receipt": None,
            "finance_posted": False,
            "status": "completed",
            "notes": f"Booking token — {b.booking_id}",
        })

    # Sort by date descending
    entries.sort(key=lambda e: e["date"], reverse=True)

    total = len(entries)
    if offset:
        entries = entries[offset:]
    if limit:
        entries = entries[:limit]

    response.headers["X-Total-Count"] = str(total)
    return {"items": entries, "total": total, "limit": limit, "offset": offset}


# ── Timeline ───────────────────────────────────────────────────────────────────

@router.get("/timeline", response_model=list[TimelineEntryOut])
def list_timeline(
    entity_type: str | None = None,
    entity_id: int | None = None,
    db: Session = Depends(get_db),
    limit: int = 50,
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = db.query(CrmTimelineEntry).options(
        joinedload(CrmTimelineEntry.performed_by),
    ).order_by(CrmTimelineEntry.created_at.desc())
    if entity_type:
        query = query.filter(CrmTimelineEntry.entity_type == entity_type)
    if entity_id:
        query = query.filter(CrmTimelineEntry.entity_id == entity_id)
    query = query.limit(limit)
    items = query.all()
    result = []
    for e in items:
        d = TimelineEntryOut.model_validate(e).model_dump()
        d["performed_by_name"] = e.performed_by.full_name if e.performed_by else None
        result.append(d)
    return result


# ── Automation Rules ───────────────────────────────────────────────────────────

@router.get("/automation-rules", response_model=list[AutomationRuleOut])
def list_automation_rules(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return db.query(AutomationRule).order_by(AutomationRule.created_at.desc()).all()


@router.post("/automation-rules", response_model=AutomationRuleOut)
def create_automation_rule(
    payload: AutomationRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    rule = AutomationRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/automation-rules/{rule_id}", response_model=AutomationRuleOut)
def toggle_automation_rule(
    rule_id: int,
    enabled: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.enabled = enabled
    db.commit()
    db.refresh(rule)
    return rule


# ── Installment Plans ─────────────────────────────────────────────────────────

def _generate_schedule(rules, start_offset: int = 0) -> list[dict]:
    """
    Generate installment records from a list of rules.
    Each rule: {type, amount, count, start_date}
    Intervals: monthly=1m, quarterly=3m, yearly=12m, custom=0 (single entry)
    """
    INTERVALS = {"monthly": 1, "quarterly": 3, "yearly": 12, "custom": 0}
    records = []
    for rule in rules:
        interval = INTERVALS.get(rule.type, 0)
        for i in range(rule.count):
            if interval > 0:
                due = rule.start_date + relativedelta(months=interval * i)
            else:
                due = rule.start_date  # custom: all on same date (user sets manually)
            records.append({"due_date": due, "amount": rule.amount, "type": rule.type})
    # sort by due_date
    records.sort(key=lambda r: r["due_date"])
    return records


@router.get("/deals/{deal_id}/installment-plan", response_model=InstallmentPlanOut)
def get_installment_plan(deal_id: int, db: Session = Depends(get_db),
                          _=Depends(require_any_permission(*PERM_VIEW))):
    plan = (
        db.query(InstallmentPlan)
        .options(joinedload(InstallmentPlan.installments))
        .filter(InstallmentPlan.deal_id == deal_id)
        .first()
    )
    if not plan:
        raise HTTPException(404, "No installment plan for this deal")
    return plan


@router.get("/installments", response_model=list)
def list_installments(deal_id: int | None = None, db: Session = Depends(get_db),
                       _=Depends(require_any_permission(*PERM_VIEW))):
    """Return all installments with enriched client/deal/property info."""
    query = db.query(Installment).options(joinedload(Installment.plan))
    if deal_id:
        plan = db.query(InstallmentPlan).filter(InstallmentPlan.deal_id == deal_id).first()
        if plan:
            query = query.filter(Installment.plan_id == plan.id)
        else:
            return []
    insts = query.order_by(Installment.due_date).all()

    result = []
    for inst in insts:
        plan = inst.plan
        client_name = None
        deal_ref = None
        property_name = None
        unit_number = None

        if plan.deal_id:
            deal = db.query(Deal).options(
                joinedload(Deal.client),
                joinedload(Deal.property),
                joinedload(Deal.unit)
            ).filter(Deal.id == plan.deal_id).first()
            if deal:
                deal_ref = deal.deal_id
                if deal.client:
                    client_name = deal.client.name
                if deal.property:
                    property_name = deal.property.name
                if deal.unit:
                    unit_number = deal.unit.unit_number
        elif plan.booking_id:
            booking = db.query(Booking).options(
                joinedload(Booking.client),
                joinedload(Booking.property),
                joinedload(Booking.unit)
            ).filter(Booking.id == plan.booking_id).first()
            if booking:
                deal_ref = booking.booking_id
                if booking.client:
                    client_name = booking.client.name
                if booking.property:
                    property_name = booking.property.name
                if booking.unit:
                    unit_number = booking.unit.unit_number

        latest_payment = db.query(InstallmentPayment).filter(
            InstallmentPayment.installment_id == inst.id
        ).order_by(InstallmentPayment.date.desc()).first()

        result.append({
            "id": inst.id,
            "plan_id": inst.plan_id,
            "client_name": client_name,
            "deal_ref": deal_ref,
            "property": property_name,
            "unit": unit_number,
            "due_date": str(inst.due_date),
            "amount": float(inst.amount),
            "paid_amount": float(inst.paid_amount),
            "paid_date": str(latest_payment.date.date()) if latest_payment else None,
            "type": inst.type,
            "status": inst.status,
        })

    return result


@router.get("/installments/{deal_id}", response_model=list, include_in_schema=False)
def get_installments_for_deal(deal_id: int, db: Session = Depends(get_db),
                               _=Depends(require_any_permission(*PERM_VIEW))):
    """Schedule view endpoint — returns flat list of installments for a deal."""
    plan = db.query(InstallmentPlan).filter(InstallmentPlan.deal_id == deal_id).first()
    if not plan:
        return []
    insts = (
        db.query(Installment)
        .filter(Installment.plan_id == plan.id)
        .order_by(Installment.due_date)
        .all()
    )
    return [
        {
            "id": i.id,
            "plan_id": i.plan_id,
            "due_date": str(i.due_date),
            "amount": float(i.amount),
            "paid_amount": float(i.paid_amount),
            "type": i.type,
            "status": i.status,
        }
        for i in insts
    ]


@router.post("/deals/{deal_id}/installment-plan", response_model=InstallmentPlanOut)
def create_installment_plan(deal_id: int, payload: InstallmentPlanCreate,
                             db: Session = Depends(get_db),
                             current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(404, "Deal not found")
    if db.query(InstallmentPlan).filter(InstallmentPlan.deal_id == deal_id).first():
        raise HTTPException(400, "Installment plan already exists for this deal")

    remaining = payload.total_amount - payload.down_payment
    if remaining < 0:
        raise HTTPException(400, "down_payment cannot exceed total_amount")

    # Generate schedule from rules or use manual installments
    if payload.rules:
        schedule = _generate_schedule(payload.rules)
        # Validate: sum of generated installments == remaining_amount
        total_inst = sum(Decimal(str(r["amount"])) for r in schedule)
        if total_inst != remaining:
            raise HTTPException(
                400,
                f"Installment total ({total_inst}) must equal remaining amount ({remaining}). "
                "Adjust rule amounts/counts."
            )
    elif payload.installments:
        schedule = [i.model_dump() for i in payload.installments]
        total_inst = sum(Decimal(str(r["amount"])) for r in schedule)
        if total_inst != remaining:
            raise HTTPException(
                400,
                f"Installment total ({total_inst}) must equal remaining amount ({remaining})."
            )
    else:
        schedule = []

    plan = InstallmentPlan(
        deal_id=deal_id,
        type_id=payload.type_id,
        total_amount=payload.total_amount,
        down_payment=payload.down_payment,
        remaining_amount=remaining,
        down_payment_status="pending",
        total_count=len(schedule),
        frequency=payload.rules[0].type if payload.rules else None,
        amount_per=payload.rules[0].amount if payload.rules and len(payload.rules) == 1 else None,
    )
    db.add(plan)
    db.flush()

    for rec in schedule:
        db.add(Installment(
            plan_id=plan.id,
            due_date=rec["due_date"],
            amount=rec["amount"],
            type=rec.get("type", "custom"),
        ))

    db.commit()
    db.refresh(plan)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(plan.id), record_label=f"Installment Plan: Deal {deal_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in plan.__dict__.items() if not k.startswith('_')},
    )
    return (
        db.query(InstallmentPlan)
        .options(joinedload(InstallmentPlan.installments))
        .filter(InstallmentPlan.id == plan.id)
        .first()
    )


@router.patch("/installments/{inst_id}", response_model=None)
def update_installment(inst_id: int, payload: InstallmentUpdate,
                        db: Session = Depends(get_db),
                        current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    """Update installment status or reschedule due_date."""
    inst = db.query(Installment).filter(Installment.id == inst_id).first()
    if not inst:
        raise HTTPException(404, "Installment not found")
    old_data = {k: str(v) for k, v in inst.__dict__.items() if not k.startswith('_')}
    if payload.status is not None:
        inst.status = payload.status
    if payload.paid_amount is not None:
        inst.paid_amount = payload.paid_amount
    if payload.due_date is not None:
        inst.due_date = payload.due_date
    db.commit()
    log_action(
        db=db, module="crm", action="UPDATE",
        record_id=str(inst_id), record_label=f"Installment: {inst_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data={k: str(v) for k, v in inst.__dict__.items() if not k.startswith('_')},
    )
    return {"ok": True}


@router.post("/installments/{inst_id}/pay", response_model=InstallmentPaymentOut)
def pay_installment(inst_id: int, payload: InstallmentPaymentCreate,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    """
    Record payment against an installment.
    - Updates paid_amount + status (partial/paid)
    - Creates double-entry journal: Debit Cash/Bank, Credit Property Revenue
    """
    inst = db.query(Installment).options(
        joinedload(Installment.plan)
    ).filter(Installment.id == inst_id).first()
    if not inst:
        raise HTTPException(404, "Installment not found")

    if payload.installment_id != inst_id:
        raise HTTPException(400, "installment_id mismatch")

    new_paid = Decimal(str(inst.paid_amount)) + Decimal(str(payload.amount))
    if new_paid > Decimal(str(inst.amount)):
        raise HTTPException(400, "Payment would exceed installment amount (overpayment not allowed)")

    # Resolve accounts
    cash_code = "1010" if payload.method == "cash" else "1100"
    cash_account = db.query(Account).filter(Account.code == cash_code).first()

    # Resolve property revenue account from linked deal/booking
    revenue_account = None
    plan = inst.plan
    if plan:
        if plan.deal_id:
            deal = db.query(Deal).options(joinedload(Deal.property)).filter(Deal.id == plan.deal_id).first()
            if deal and deal.property and deal.property.income_gl_account_id:
                revenue_account = db.query(Account).filter(Account.id == deal.property.income_gl_account_id).first()
        elif plan.booking_id:
            from app.models.booking import Booking
            booking = db.query(Booking).options(joinedload(Booking.property)).filter(Booking.id == plan.booking_id).first()
            if booking and booking.property and booking.property.income_gl_account_id:
                revenue_account = db.query(Account).filter(Account.id == booking.property.income_gl_account_id).first()
    if not revenue_account:
        revenue_account = db.query(Account).filter(Account.code == "4300").first()

    if not cash_account or not revenue_account:
        raise HTTPException(400, "Required accounts (Cash/Bank + Revenue) not found. Run default COA setup.")

    try:
        journal = JournalService.create_journal_entry(
            db=db,
            entries=[
                JournalEntryData(
                    account_id=cash_account.id,
                    debit=payload.amount,
                    description=f"Installment #{inst_id} payment",
                ),
                JournalEntryData(
                    account_id=revenue_account.id,
                    credit=payload.amount,
                    description=f"Installment #{inst_id} revenue",
                ),
            ],
            reference_type="installment_payment",
            reference_id=str(inst_id),
            description=f"Installment #{inst_id} payment via {payload.method}",
            date=payload.date or datetime.utcnow(),
        )

        payment = InstallmentPayment(
            installment_id=inst_id,
            method=payload.method,
            amount=payload.amount,
            date=payload.date or datetime.utcnow(),
            reference_number=payload.reference_number,
            journal_id=journal.id,
        )
        db.add(payment)

        # Update installment status
        inst.paid_amount = new_paid
        if new_paid >= Decimal(str(inst.amount)):
            inst.status = "paid"
        else:
            inst.status = "partial"

        db.commit()
        db.refresh(payment)
        log_action(
            db=db, module="crm", action="CREATE",
            record_id=str(payment.id), record_label=f"Installment Payment: {inst_id}",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
            new_data={k: str(v) for k, v in payment.__dict__.items() if not k.startswith('_')},
        )
        return payment
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


# ── Communications ────────────────────────────────────────────────────────────

@router.get("/communications", response_model=list[CommunicationOut])
def list_communications(tracking_id: str | None = None, db: Session = Depends(get_db),
                         _=Depends(require_any_permission(*PERM_VIEW))):
    q = db.query(Communication).order_by(Communication.created_at.desc())
    if tracking_id:
        q = q.filter(Communication.tracking_id == tracking_id)
    return q.all()


@router.post("/communications", response_model=CommunicationOut)
def create_communication(payload: CommunicationCreate, db: Session = Depends(get_db),
                          current_user: User = Depends(require_any_permission(*PERM_MANAGE))):
    client = db.query(Client).filter(Client.tracking_id == payload.tracking_id).first()
    if not client:
        raise HTTPException(404, "No client found with this tracking_id")
    comm = Communication(**payload.model_dump())
    db.add(comm)
    db.commit()
    db.refresh(comm)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(comm.id), record_label=f"Communication: {comm.type}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in comm.__dict__.items() if not k.startswith('_')},
    )
    return comm


@router.post("/communications/{comm_id}/attachment", response_model=CommunicationOut)
def upload_comm_attachment(comm_id: int, file: UploadFile = File(...),
                            db: Session = Depends(get_db),
                            _=Depends(require_any_permission(*PERM_MANAGE))):
    comm = db.query(Communication).filter(Communication.id == comm_id).first()
    if not comm:
        raise HTTPException(404, "Communication not found")
    rel, _ = _save_file(file, "communications")
    comm.attachment = rel
    db.commit()
    db.refresh(comm)
    return comm


# ── Global Search ─────────────────────────────────────────────────────────────

@router.get("/search", response_model=GlobalSearchResult)
def global_search(q: str, db: Session = Depends(get_db),
                  _=Depends(require_any_permission(*PERM_VIEW))):
    """Search by tracking_id, name, CNIC, or phone."""
    query_str = q.strip()
    client = None

    # Try exact tracking_id first
    client = db.query(Client).options(
        joinedload(Client.lead), joinedload(Client.assigned_dealer),
        joinedload(Client.attachments),
    ).filter(Client.tracking_id == query_str.upper()).first()

    # Fallback: search by name, CNIC, or phone
    if not client:
        like = f"%{query_str}%"
        client = db.query(Client).options(
            joinedload(Client.lead), joinedload(Client.assigned_dealer),
            joinedload(Client.attachments),
        ).filter(
            db.query(Client).filter(
                Client.name.ilike(like) |
                Client.cnic.ilike(like) |
                Client.phone.ilike(like) |
                Client.client_id.ilike(like)
            ).exists()
        ).order_by(Client.created_at.desc()).first()

    if not client:
        raise HTTPException(404, f"No records found for: {query_str}")

    deals = (
        db.query(Deal)
        .options(joinedload(Deal.client), joinedload(Deal.dealer),
                 joinedload(Deal.property), joinedload(Deal.attachments))
        .filter(Deal.client_id == client.id)
        .all()
    )
    comms = (
        db.query(Communication)
        .filter(Communication.tracking_id == client.tracking_id)
        .order_by(Communication.created_at.desc())
        .all()
    )
    lead_out = None
    if client.lead:
        d = LeadOut.model_validate(client.lead).model_dump()
        d["is_converted"] = True
        lead_out = d
    return GlobalSearchResult(
        tracking_id=client.tracking_id,
        client=_client_out(client),
        lead=lead_out,
        deals=[_deal_out(d) for d in deals],
        communications=[CommunicationOut.model_validate(c) for c in comms],
    )


@router.get("/clients/search", response_model=list[dict])
def client_search(
    q: str | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    """Lightweight client search by name/CNIC/phone for global search bar."""
    if not q or not q.strip():
        return []
    like = f"%{q.strip()}%"
    clients = db.query(Client).filter(
        Client.name.ilike(like) |
        Client.cnic.ilike(like) |
        Client.phone.ilike(like) |
        Client.client_id.ilike(like) |
        Client.tracking_id.ilike(like)
    ).order_by(Client.created_at.desc()).limit(limit).all()
    return [
        {
            "id": c.id,
            "client_id": c.client_id,
            "tracking_id": c.tracking_id,
            "name": c.name,
            "phone": c.phone,
            "cnic": c.cnic,
            "status": c.status,
        }
        for c in clients
    ]


# ── Activities (Quick Actions) ────────────────────────────────────────────────

@router.get("/activities", response_model=list[ActivityOut])
def list_activities(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    """Return all activities for a lead or client, newest first."""
    return (
        db.query(LeadActivity)
        .filter(
            LeadActivity.entity_type == entity_type,
            LeadActivity.entity_id == entity_id,
        )
        .order_by(LeadActivity.created_at.desc())
        .all()
    )


@router.post("/activities", response_model=ActivityOut, status_code=201)
def create_activity(
    body: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    """Log a new activity (call, whatsapp, followup, note, email)."""
    activity = LeadActivity(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        type=body.type,
        message=body.message,
        scheduled_at=body.scheduled_at,
        status=body.status,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    log_action(
        db=db, module="crm", action="CREATE",
        record_id=str(activity.id), record_label=f"Activity: {activity.type}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in activity.__dict__.items() if not k.startswith('_')},
    )
    return activity


@router.get("/activities/due-followups", response_model=list[ActivityOut])
def due_followups(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    """Return pending follow-ups whose scheduled_at is in the past (overdue).

    NOTE: This route MUST be declared before /activities/{activity_id} so FastAPI
    does not treat the literal string 'due-followups' as a path parameter.
    """
    now = datetime.utcnow()
    return (
        db.query(LeadActivity)
        .filter(
            LeadActivity.type == "followup",
            LeadActivity.status == "pending",
            LeadActivity.scheduled_at <= now,
        )
        .order_by(LeadActivity.scheduled_at.asc())
        .all()
    )


@router.patch("/activities/{activity_id}", response_model=ActivityOut)
def update_activity(
    activity_id: int,
    body: ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    """Update activity status (e.g. mark call completed/missed, follow-up done)."""
    activity = db.query(LeadActivity).filter(LeadActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(404, "Activity not found")
    old_data = {k: str(v) for k, v in activity.__dict__.items() if not k.startswith('_')}
    if body.status is not None:
        activity.status = body.status
    if body.message is not None:
        activity.message = body.message
    if body.scheduled_at is not None:
        activity.scheduled_at = body.scheduled_at
    activity.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(activity)
    log_action(
        db=db, module="crm", action="UPDATE",
        record_id=str(activity_id), record_label=f"Activity: {activity.type}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data={k: str(v) for k, v in activity.__dict__.items() if not k.startswith('_')},
    )
    return activity


@router.delete("/activities/{activity_id}", status_code=204)
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    activity = db.query(LeadActivity).filter(LeadActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(404, "Activity not found")
    old_data = {k: str(v) for k, v in activity.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="crm", action="DELETE",
        record_id=str(activity_id), record_label=f"Activity: {activity.type}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data,
    )
    db.delete(activity)
    db.commit()
