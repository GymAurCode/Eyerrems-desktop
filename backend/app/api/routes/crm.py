"""CRM routes — full ERP-grade implementation."""
import shutil
import uuid
from datetime import datetime, date, timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_any_permission
from app.core.config import settings
from app.core.database import get_db
from app.core.table_query import apply_table_filters
from app.core.journal_service import JournalService, JournalEntryData
from app.core.websocket_manager import ws_manager
from app.models.crm import (
    Client, ClientAttachment, Communication, Deal, DealAttachment,
    Dealer, DealerAttachment, Installment, InstallmentPayment, InstallmentPlan,
    InstallmentType, Lead, LeadActivity,
)
from app.models.finance import Account
from app.models.property import Floor, Property, Unit
from app.schemas.crm import (
    ActivityCreate, ActivityOut, ActivityUpdate,
    ClientCreate, ClientAttachmentOut, ClientOut, ClientUpdate,
    CommunicationCreate, CommunicationOut,
    ConvertLeadToClient,
    DealCreate, DealAttachmentOut, DealOut, DealUpdate,
    DealerCreate, DealerAttachmentOut, DealerOut, DealerUpdate,
    GlobalSearchResult,
    InstallmentPlanCreate, InstallmentPlanOut,
    InstallmentPaymentCreate, InstallmentPaymentOut,
    InstallmentTypeCreate, InstallmentTypeOut,
    InstallmentUpdate,
    LeadCreate, LeadOut, LeadUpdate,
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


def _save_file(file: UploadFile, sub: str) -> tuple[str, str]:
    base = Path(settings.upload_dir) / sub
    base.mkdir(parents=True, exist_ok=True)
    ext  = Path(file.filename or "file").suffix or ".bin"
    name = f"{uuid.uuid4().hex}{ext}"
    dest = base / name
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return f"{sub}/{name}", file.filename or name


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

@router.get("/leads", response_model=list[LeadOut])
def list_leads(
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
    query = db.query(Lead).options(joinedload(Lead.client))
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
    leads = query.order_by(Lead.id.desc()).all()
    result = []
    for lead in leads:
        d = LeadOut.model_validate(lead).model_dump()
        d["is_converted"] = lead.client is not None
        result.append(d)
    return result


@router.post("/leads", response_model=LeadOut)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db),
                _=Depends(require_any_permission(*PERM_MANAGE))):
    lead = Lead(lead_id=_next_lead_id(db), **payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    d = LeadOut.model_validate(lead).model_dump()
    d["is_converted"] = False
    return d


@router.get("/leads/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: int, db: Session = Depends(get_db),
             _=Depends(require_any_permission(*PERM_VIEW))):
    lead = db.query(Lead).options(joinedload(Lead.client)).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    d = LeadOut.model_validate(lead).model_dump()
    d["is_converted"] = lead.client is not None
    return d


@router.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db),
                _=Depends(require_any_permission(*PERM_MANAGE))):
    lead = db.query(Lead).options(joinedload(Lead.client)).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(lead, k, v)
    db.commit()
    db.refresh(lead)
    d = LeadOut.model_validate(lead).model_dump()
    d["is_converted"] = lead.client is not None
    return d


@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db),
                _=Depends(require_any_permission(*PERM_MANAGE))):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.client:
        raise HTTPException(400, "Cannot delete a converted lead")
    db.delete(lead)
    db.commit()


# ── Clients ───────────────────────────────────────────────────────────────────

def _load_client(db: Session, client_id: int) -> Client:
    c = (
        db.query(Client)
        .options(
            joinedload(Client.lead),
            joinedload(Client.assigned_dealer),
            joinedload(Client.attachments),
        )
        .filter(Client.id == client_id)
        .first()
    )
    if not c:
        raise HTTPException(404, "Client not found")
    return c


@router.get("/clients", response_model=list[ClientOut])
def list_clients(
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
    query = (
        db.query(Client)
        .options(joinedload(Client.lead), joinedload(Client.assigned_dealer),
                 joinedload(Client.attachments))
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
    clients = query.order_by(Client.id.desc()).all()
    return [_client_out(c) for c in clients]


@router.post("/clients", response_model=ClientOut)
def create_client(payload: ClientCreate, db: Session = Depends(get_db),
                  _=Depends(require_any_permission(*PERM_MANAGE))):
    client = Client(
        client_id=_next_client_id(db, converted=False),
        tracking_id=_next_tracking_id(db),
        **payload.model_dump(),
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return _client_out(_load_client(db, client.id))


@router.post("/leads/{lead_id}/convert", response_model=ClientOut)
def convert_lead_to_client(lead_id: int, payload: ConvertLeadToClient,
                            db: Session = Depends(get_db),
                            _=Depends(require_any_permission(*PERM_MANAGE))):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    if lead.client:
        raise HTTPException(400, "Lead already converted")
    data = payload.model_dump(exclude={"lead_id"})
    client = Client(
        client_id=_next_client_id(db, converted=True),
        tracking_id=_next_tracking_id(db),
        lead_id=lead.id,
        **data,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return _client_out(_load_client(db, client.id))


@router.get("/clients/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db),
               _=Depends(require_any_permission(*PERM_VIEW))):
    return _client_out(_load_client(db, client_id))


@router.patch("/clients/{client_id}", response_model=ClientOut)
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db),
                  _=Depends(require_any_permission(*PERM_MANAGE))):
    client = _load_client(db, client_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(client, k, v)
    db.commit()
    db.refresh(client)
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

def _load_dealer(db: Session, dealer_id: int) -> Dealer:
    d = (
        db.query(Dealer)
        .options(joinedload(Dealer.attachments))
        .filter(Dealer.id == dealer_id)
        .first()
    )
    if not d:
        raise HTTPException(404, "Dealer not found")
    return d


@router.get("/dealers", response_model=list[DealerOut])
def list_dealers(
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
    query = db.query(Dealer).options(joinedload(Dealer.attachments))
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
    dealers = query.order_by(Dealer.id.desc()).all()
    return dealers


@router.post("/dealers", response_model=DealerOut)
def create_dealer(payload: DealerCreate, db: Session = Depends(get_db),
                  _=Depends(require_any_permission(*PERM_MANAGE))):
    dealer = Dealer(dealer_id=_next_dealer_id(db), **payload.model_dump())
    db.add(dealer)
    db.commit()
    db.refresh(dealer)
    return _load_dealer(db, dealer.id)


@router.get("/dealers/{dealer_id}", response_model=DealerOut)
def get_dealer(dealer_id: int, db: Session = Depends(get_db),
               _=Depends(require_any_permission(*PERM_VIEW))):
    return _load_dealer(db, dealer_id)


@router.patch("/dealers/{dealer_id}", response_model=DealerOut)
def update_dealer(dealer_id: int, payload: DealerUpdate, db: Session = Depends(get_db),
                  _=Depends(require_any_permission(*PERM_MANAGE))):
    dealer = _load_dealer(db, dealer_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(dealer, k, v)
    db.commit()
    db.refresh(dealer)
    return _load_dealer(db, dealer_id)


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


# ── Installment Types ─────────────────────────────────────────────────────────

@router.get("/installment-types", response_model=list[InstallmentTypeOut])
def list_installment_types(db: Session = Depends(get_db),
                            _=Depends(require_any_permission(*PERM_VIEW))):
    return db.query(InstallmentType).order_by(InstallmentType.name).all()


@router.post("/installment-types", response_model=InstallmentTypeOut)
def create_installment_type(payload: InstallmentTypeCreate, db: Session = Depends(get_db),
                             _=Depends(require_any_permission(*PERM_MANAGE))):
    existing = db.query(InstallmentType).filter(InstallmentType.name == payload.name).first()
    if existing:
        return existing
    it = InstallmentType(name=payload.name)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


@router.delete("/installment-types/{type_id}", status_code=204)
def delete_installment_type(type_id: int, db: Session = Depends(get_db),
                             _=Depends(require_any_permission(*PERM_MANAGE))):
    it = db.query(InstallmentType).filter(InstallmentType.id == type_id).first()
    if not it:
        raise HTTPException(404, "Installment type not found")
    db.delete(it)
    db.commit()


# ── Deals ─────────────────────────────────────────────────────────────────────

def _load_deal(db: Session, deal_id: int) -> Deal:
    deal = (
        db.query(Deal)
        .options(
            joinedload(Deal.client),
            joinedload(Deal.dealer),
            joinedload(Deal.property).joinedload(Property.floors).joinedload(Floor.units),
            joinedload(Deal.unit),
            joinedload(Deal.attachments),
            joinedload(Deal.installment_plan).joinedload(InstallmentPlan.installments),
        )
        .filter(Deal.id == deal_id)
        .first()
    )
    if not deal:
        raise HTTPException(404, "Deal not found")
    return deal


@router.get("/deals", response_model=list[DealOut])
def list_deals(
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
    query = (
        db.query(Deal)
        .options(joinedload(Deal.client), joinedload(Deal.dealer),
                 joinedload(Deal.property), joinedload(Deal.attachments))
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
    deals = query.order_by(Deal.id.desc()).all()
    return [_deal_out(d) for d in deals]


@router.post("/deals", response_model=DealOut)
async def create_deal(payload: DealCreate, db: Session = Depends(get_db),
                      _=Depends(require_any_permission(*PERM_MANAGE))):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    deal = Deal(
        deal_id=_next_deal_id(db),
        tracking_id=client.tracking_id,
        **payload.model_dump(),
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    await ws_manager.broadcast("new_deal", {"deal_id": deal.id})
    await ws_manager.broadcast("dashboard_refresh", {})
    return _deal_out(_load_deal(db, deal.id))


@router.get("/deals/{deal_id}", response_model=DealOut)
def get_deal(deal_id: int, db: Session = Depends(get_db),
             _=Depends(require_any_permission(*PERM_VIEW))):
    return _deal_out(_load_deal(db, deal_id))


@router.patch("/deals/{deal_id}", response_model=DealOut)
def update_deal(deal_id: int, payload: DealUpdate, db: Session = Depends(get_db),
                _=Depends(require_any_permission(*PERM_MANAGE))):
    deal = _load_deal(db, deal_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(deal, k, v)
    db.commit()
    db.refresh(deal)
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


@router.get("/installments/{deal_id}", response_model=list)
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
                             _=Depends(require_any_permission(*PERM_MANAGE))):
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
    return (
        db.query(InstallmentPlan)
        .options(joinedload(InstallmentPlan.installments))
        .filter(InstallmentPlan.id == plan.id)
        .first()
    )


@router.patch("/installments/{inst_id}", response_model=None)
def update_installment(inst_id: int, payload: InstallmentUpdate,
                        db: Session = Depends(get_db),
                        _=Depends(require_any_permission(*PERM_MANAGE))):
    """Update installment status or reschedule due_date."""
    inst = db.query(Installment).filter(Installment.id == inst_id).first()
    if not inst:
        raise HTTPException(404, "Installment not found")
    if payload.status is not None:
        inst.status = payload.status
    if payload.paid_amount is not None:
        inst.paid_amount = payload.paid_amount
    if payload.due_date is not None:
        inst.due_date = payload.due_date
    db.commit()
    return {"ok": True}


@router.post("/installments/{inst_id}/pay", response_model=InstallmentPaymentOut)
def pay_installment(inst_id: int, payload: InstallmentPaymentCreate,
                    db: Session = Depends(get_db),
                    _=Depends(require_any_permission(*PERM_MANAGE))):
    """
    Record payment against an installment.
    - Updates paid_amount + status (partial/paid)
    - Creates double-entry journal: Debit Cash/Bank, Credit AR
    """
    inst = db.query(Installment).filter(Installment.id == inst_id).first()
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
    ar_account = db.query(Account).filter(Account.code == "1200").first()
    if not cash_account or not ar_account:
        raise HTTPException(400, "Required accounts (Cash/Bank + AR) not found. Run default COA setup.")

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
                    account_id=ar_account.id,
                    credit=payload.amount,
                    description=f"Installment #{inst_id} AR cleared",
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
                          _=Depends(require_any_permission(*PERM_MANAGE))):
    client = db.query(Client).filter(Client.tracking_id == payload.tracking_id).first()
    if not client:
        raise HTTPException(404, "No client found with this tracking_id")
    comm = Communication(**payload.model_dump())
    db.add(comm)
    db.commit()
    db.refresh(comm)
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
    tracking_id = q.strip().upper()
    client = (
        db.query(Client)
        .options(joinedload(Client.lead), joinedload(Client.assigned_dealer),
                 joinedload(Client.attachments))
        .filter(Client.tracking_id == tracking_id)
        .first()
    )
    if not client:
        raise HTTPException(404, f"No records found for: {tracking_id}")
    deals = (
        db.query(Deal)
        .options(joinedload(Deal.client), joinedload(Deal.dealer),
                 joinedload(Deal.property), joinedload(Deal.attachments))
        .filter(Deal.tracking_id == tracking_id)
        .all()
    )
    comms = (
        db.query(Communication)
        .filter(Communication.tracking_id == tracking_id)
        .order_by(Communication.created_at.desc())
        .all()
    )
    lead_out = None
    if client.lead:
        d = LeadOut.model_validate(client.lead).model_dump()
        d["is_converted"] = True
        lead_out = d
    return GlobalSearchResult(
        tracking_id=tracking_id,
        client=_client_out(client),
        lead=lead_out,
        deals=[_deal_out(d) for d in deals],
        communications=[CommunicationOut.model_validate(c) for c in comms],
    )


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
    _=Depends(require_any_permission(*PERM_MANAGE)),
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
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    """Update activity status (e.g. mark call completed/missed, follow-up done)."""
    activity = db.query(LeadActivity).filter(LeadActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(404, "Activity not found")
    if body.status is not None:
        activity.status = body.status
    if body.message is not None:
        activity.message = body.message
    if body.scheduled_at is not None:
        activity.scheduled_at = body.scheduled_at
    activity.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/activities/{activity_id}", status_code=204)
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    activity = db.query(LeadActivity).filter(LeadActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(404, "Activity not found")
    db.delete(activity)
    db.commit()
