"""Client Pipeline Routes — Contract, ReceiptVoucher, Transfer, Handover, AfterSales.
All endpoints live under /crm/pipeline prefix.
"""
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_any_permission
from app.core.database import get_db
from app.core.activity_logger import log_activity
from app.models.auth import User
from app.models.booking import Booking
from app.models.client_pipeline import (
    AfterSalesTicket, Contract, Handover, ReceiptVoucher, Transfer,
)
from app.models.crm import Client, Installment, InstallmentPlan
from app.schemas.crm import (
    AfterSalesTicketCreate, AfterSalesTicketOut,
    ContractCreate, ContractOut, ContractUpdate,
    HandoverCreate, HandoverOut,
    ReceiptVoucherCreate, ReceiptVoucherOut,
    TransferCreate, TransferOut,
)
from app.services.finance_posting_service import (
    post_chargeable_service, post_contract_signing,
    post_installment_payment, post_token_receipt,
    post_transfer_fee, post_booking_fee,
)

router = APIRouter(prefix="/crm/pipeline", tags=["client-pipeline"])

PERM_VIEW = ("crm:manage", "crm:view")
PERM_MANAGE = ("crm:manage",)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _next_contract_id(db) -> str:
    count = db.query(Contract).count() + 1
    return f"CTR-{count:04d}"


def _next_transfer_id(db) -> str:
    count = db.query(Transfer).count() + 1
    return f"TRF-{count:04d}"


def _next_handover_id(db) -> str:
    count = db.query(Handover).count() + 1
    return f"HND-{count:04d}"


def _next_ticket_id(db) -> str:
    count = db.query(AfterSalesTicket).count() + 1
    return f"AST-{count:04d}"


# ── Contracts ──────────────────────────────────────────────────────────────────

@router.get("/contracts", response_model=list[ContractOut])
def list_contracts(
    booking_id: int | None = None,
    client_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    q = db.query(Contract)
    if booking_id:
        q = q.filter(Contract.booking_id == booking_id)
    if client_id:
        q = q.filter(Contract.client_id == client_id)
    return q.order_by(Contract.created_at.desc()).all()


@router.post("/contracts", response_model=ContractOut)
def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    contract = Contract(
        contract_id=_next_contract_id(db),
        **payload.model_dump(),
        status="draft",
    )
    db.add(contract)
    db.flush()

    # Auto-post accounting entries if signed
    if payload.signed_date:
        booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
        if booking:
            post_contract_signing(db, booking, payload.total_amount, user=current_user)
            contract.status = "signed"

    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="contract", record_id=contract.contract_id,
        record_label=f"Contract {contract.contract_id}",
        new_values={"booking_id": payload.booking_id, "total_amount": str(payload.total_amount)},
    )
    db.commit()
    db.refresh(contract)
    return contract


@router.get("/contracts/{contract_id}", response_model=ContractOut)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    return contract


@router.patch("/contracts/{contract_id}", response_model=ContractOut)
def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(404, "Contract not found")

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(contract, k, v)

    # Auto-post accounting on signing
    if payload.status == "signed" and contract.status != "signed" and not contract.signed_date:
        contract.signed_date = datetime.utcnow()
        booking = db.query(Booking).filter(Booking.id == contract.booking_id).first()
        if booking:
            post_contract_signing(db, booking, contract.total_amount, user=current_user)

    db.commit()
    db.refresh(contract)
    return contract


# ── Receipt Vouchers ───────────────────────────────────────────────────────────

@router.get("/receipts", response_model=list[ReceiptVoucherOut])
def list_receipts(
    client_id: int | None = None,
    booking_id: int | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    q = db.query(ReceiptVoucher)
    if client_id:
        q = q.filter(ReceiptVoucher.client_id == client_id)
    if booking_id:
        q = q.filter(ReceiptVoucher.booking_id == booking_id)
    return q.order_by(ReceiptVoucher.created_at.desc()).limit(limit).all()


@router.get("/receipts/{voucher_id}", response_model=ReceiptVoucherOut)
def get_receipt(
    voucher_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    voucher = db.query(ReceiptVoucher).filter(ReceiptVoucher.id == voucher_id).first()
    if not voucher:
        raise HTTPException(404, "Receipt voucher not found")
    return voucher


# ── Booking Installment Payment (auto-posting) ────────────────────────────────

@router.post("/bookings/{booking_id}/installments/{installment_id}/pay",
             response_model=ReceiptVoucherOut)
def pay_installment(
    booking_id: int,
    installment_id: int,
    payload: ReceiptVoucherCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    installment = db.query(Installment).filter(
        Installment.id == installment_id,
    ).first()
    if not installment:
        raise HTTPException(404, "Installment not found")

    voucher = post_installment_payment(
        db=db, installment=installment,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        reference_no=payload.reference_no,
        user=current_user,
    )

    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="payment", record_id=voucher.voucher_no,
        record_label=f"Installment payment {voucher.voucher_no}",
        new_values={"installment_id": str(installment_id), "amount": str(payload.amount)},
    )
    db.commit()
    db.refresh(voucher)
    return voucher


# ── Transfers ──────────────────────────────────────────────────────────────────

@router.get("/transfers", response_model=list[TransferOut])
def list_transfers(
    booking_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    q = db.query(Transfer)
    if booking_id:
        q = q.filter(Transfer.booking_id == booking_id)
    return q.order_by(Transfer.created_at.desc()).all()


@router.post("/transfers", response_model=TransferOut)
def create_transfer(
    payload: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    transfer = Transfer(
        transfer_id=_next_transfer_id(db),
        **payload.model_dump(),
    )
    db.add(transfer)
    db.flush()

    # Auto-post transfer fee if > 0
    if payload.transfer_fee > 0:
        post_transfer_fee(
            db=db, client_id=payload.from_client_id,
            fee_amount=payload.transfer_fee,
            booking_id=payload.booking_id,
            user=current_user,
        )

    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="transfer", record_id=transfer.transfer_id,
        record_label=f"Transfer {transfer.transfer_id}",
        new_values={"booking_id": str(payload.booking_id), "fee": str(payload.transfer_fee)},
    )
    db.commit()
    db.refresh(transfer)
    return transfer


@router.patch("/transfers/{transfer_id}", response_model=TransferOut)
def update_transfer(
    transfer_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(404, "Transfer not found")
    for k, v in payload.items():
        if hasattr(transfer, k):
            setattr(transfer, k, v)
    db.commit()
    db.refresh(transfer)
    return transfer


# ── Handovers ──────────────────────────────────────────────────────────────────

@router.get("/handovers", response_model=list[HandoverOut])
def list_handovers(
    booking_id: int | None = None,
    client_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    q = db.query(Handover)
    if booking_id:
        q = q.filter(Handover.booking_id == booking_id)
    if client_id:
        q = q.filter(Handover.client_id == client_id)
    return q.order_by(Handover.created_at.desc()).all()


@router.post("/handovers", response_model=HandoverOut)
def create_handover(
    payload: HandoverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    handover = Handover(
        handover_id=_next_handover_id(db),
        **payload.model_dump(),
    )
    db.add(handover)
    db.flush()

    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="handover", record_id=handover.handover_id,
        record_label=f"Handover {handover.handover_id}",
        new_values={"booking_id": str(payload.booking_id), "date": str(payload.possession_date)},
    )
    db.commit()
    db.refresh(handover)
    return handover


@router.patch("/handovers/{handover_id}", response_model=HandoverOut)
def update_handover(
    handover_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    handover = db.query(Handover).filter(Handover.id == handover_id).first()
    if not handover:
        raise HTTPException(404, "Handover not found")
    old_status = handover.status
    for k, v in payload.items():
        if hasattr(handover, k):
            setattr(handover, k, v)
    if handover.status == "completed" and old_status != "completed":
        handover.completed_at = datetime.utcnow()
        # Mark booking as completed
        booking = db.query(Booking).filter(Booking.id == handover.booking_id).first()
        if booking:
            booking.status = "completed"
            booking.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(handover)
    return handover


# ── After-Sales Tickets ────────────────────────────────────────────────────────

@router.get("/tickets", response_model=list[AfterSalesTicketOut])
def list_tickets(
    client_id: int | None = None,
    unit_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    q = db.query(AfterSalesTicket)
    if client_id:
        q = q.filter(AfterSalesTicket.client_id == client_id)
    if unit_id:
        q = q.filter(AfterSalesTicket.unit_id == unit_id)
    if status:
        q = q.filter(AfterSalesTicket.status == status)
    return q.order_by(AfterSalesTicket.created_at.desc()).all()


@router.post("/tickets", response_model=AfterSalesTicketOut)
def create_ticket(
    payload: AfterSalesTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    ticket = AfterSalesTicket(
        ticket_id=_next_ticket_id(db),
        **payload.model_dump(),
    )
    db.add(ticket)
    db.flush()

    # Auto-post if chargeable service
    if payload.chargeable and payload.charge_amount and payload.charge_amount > 0:
        post_chargeable_service(
            db=db, client_id=payload.client_id,
            amount=payload.charge_amount,
            description=f"Chargeable service: {payload.ticket_type}",
            booking_id=payload.booking_id,
            user=current_user,
        )

    log_activity(
        db=db, user=current_user, action="create", module="crm",
        record_type="ticket", record_id=ticket.ticket_id,
        record_label=f"After-sales ticket {ticket.ticket_id}",
        new_values={"type": payload.ticket_type, "priority": payload.priority},
    )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.patch("/tickets/{ticket_id}", response_model=AfterSalesTicketOut)
def update_ticket(
    ticket_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    ticket = db.query(AfterSalesTicket).filter(AfterSalesTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    for k, v in payload.items():
        if hasattr(ticket, k):
            setattr(ticket, k, v)
    if payload.get("status") == "resolved":
        ticket.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    return ticket


# ── Client Full Pipeline Summary ───────────────────────────────────────────────

@router.get("/clients/{client_id}/summary")
def get_client_pipeline_summary(
    client_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    """Return all pipeline entities for a client in one call."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    bookings = db.query(Booking).filter(Booking.client_id == client_id).all()
    contracts = db.query(Contract).filter(Contract.client_id == client_id).all()
    receipts = db.query(ReceiptVoucher).filter(
        ReceiptVoucher.client_id == client_id
    ).order_by(ReceiptVoucher.created_at.desc()).limit(50).all()
    transfers = db.query(Transfer).filter(
        (Transfer.from_client_id == client_id) | (Transfer.to_client_id == client_id)
    ).all()
    handovers = db.query(Handover).filter(Handover.client_id == client_id).all()
    tickets = db.query(AfterSalesTicket).filter(
        AfterSalesTicket.client_id == client_id
    ).order_by(AfterSalesTicket.created_at.desc()).all()

    return {
        "client_id": client_id,
        "bookings": bookings,
        "contracts": contracts,
        "receipts": receipts,
        "transfers": transfers,
        "handovers": handovers,
        "tickets": tickets,
    }
