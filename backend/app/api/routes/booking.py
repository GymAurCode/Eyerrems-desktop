"""Booking routes — official financial commitment and payment workflow.

Architecture:
  Deal (negotiation) → POST /bookings/from-deal  → Booking
  Booking            → POST /bookings/{id}/installment-plan → InstallmentPlan
  InstallmentPlan    → POST /bookings/{id}/installments/{inst_id}/pay → Payment
"""
import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_any_permission
from app.core.config import settings
from app.core.database import get_db
from app.models.auth import User
from app.models.booking import Booking, BookingAttachment, BookingLog
from app.models.crm import Client, Installment, InstallmentPlan, InstallmentPayment
from app.models.property import Property, Unit
from app.schemas.booking import (
    BookingAssignment,
    BookingAttachmentOut,
    BookingCreate,
    BookingExtension,
    BookingFromDeal,
    BookingListOut,
    BookingOut,
    BookingStats,
    BookingStatusUpdate,
    BookingUpdate,
    InstallmentOut,
    InstallmentPaymentCreate,
    InstallmentPlanCreate,
    InstallmentPlanOut,
)
from app.services.booking_service import (
    BookingService,
    booking_total_payable,
)

from pydantic import BaseModel as _PydanticBase

router = APIRouter()

PERM_VIEW   = ("crm:manage", "crm:view", "booking:view")
PERM_MANAGE = ("crm:manage", "booking:manage")


# ── ID generators ─────────────────────────────────────────────────────────────

def _next_booking_id(db: Session) -> str:
    count = db.query(func.count(Booking.id)).scalar() or 0
    return f"BKG-{count + 1:04d}"


def _save_file(file: UploadFile, sub: str) -> tuple[str, str]:
    base = Path(settings.upload_dir) / sub
    base.mkdir(parents=True, exist_ok=True)
    ext  = Path(file.filename or "file").suffix or ".bin"
    name = f"{uuid.uuid4().hex}{ext}"
    dest = base / name
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return f"{sub}/{name}", file.filename or name


# ── Loader helpers ────────────────────────────────────────────────────────────

def _load_booking(db: Session, booking_id: int) -> Booking:
    booking = (
        db.query(Booking)
        .options(
            joinedload(Booking.client),
            joinedload(Booking.property),
            joinedload(Booking.unit),
            joinedload(Booking.assigned_dealer),
            joinedload(Booking.assigned_staff),
            joinedload(Booking.logs).joinedload(BookingLog.performed_by),
            joinedload(Booking.attachments),
            joinedload(Booking.installment_plan)
                .joinedload(InstallmentPlan.installments)
                .joinedload(Installment.payments),
        )
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(404, "Booking not found")
    return booking


def _enrich_booking(booking: Booking) -> dict:
    data = BookingOut.model_validate(booking).model_dump()
    data["client_name"]    = booking.client.name  if booking.client  else None
    data["client_phone"]   = booking.client.phone if booking.client  else None
    data["property_name"]  = booking.property.name if booking.property else None
    data["unit_number"]    = booking.unit.unit_number if booking.unit else None
    data["dealer_name"]    = booking.assigned_dealer.name if booking.assigned_dealer else None
    data["staff_name"]     = booking.assigned_staff.full_name if booking.assigned_staff else None
    data["is_expired"]     = BookingService.is_booking_expired(booking)
    data["days_remaining"] = BookingService.get_days_remaining(booking)
    data["total_payable"]  = float(booking_total_payable(booking))

    # Enrich logs
    for i, log in enumerate(data.get("logs", [])):
        if i < len(booking.logs) and booking.logs[i].performed_by:
            log["performed_by_name"] = booking.logs[i].performed_by.full_name

    # Enrich installment plan
    if booking.installment_plan:
        plan = booking.installment_plan
        plan_data = InstallmentPlanOut.model_validate(plan).model_dump()
        insts = []
        for inst in plan.installments:
            d = InstallmentOut.model_validate(inst).model_dump()
            d["remaining"] = float(
                float(inst.amount) - float(inst.paid_amount)
            )
            d["payments"] = [
                {
                    "id": p.id,
                    "method": p.method,
                    "amount": float(p.amount),
                    "date": p.date.isoformat(),
                    "reference_number": p.reference_number,
                    "journal_id": p.journal_id,
                }
                for p in inst.payments
            ]
            insts.append(d)
        plan_data["installments"] = insts
        data["installment_plan"] = plan_data

    return data


def _enrich_list(booking: Booking) -> dict:
    return {
        "id":             booking.id,
        "booking_id":     booking.booking_id,
        "deal_id":        booking.deal_id,
        "client_id":      booking.client_id,
        "client_name":    booking.client.name if booking.client else None,
        "property_name":  booking.property.name if booking.property else None,
        "unit_number":    booking.unit.unit_number if booking.unit else None,
        "property_price": booking.property_price,
        "final_price":    booking.final_price,
        "booking_amount": booking.booking_amount,
        "down_payment":   booking.down_payment,
        "booking_date":   booking.booking_date,
        "expiry_date":    booking.expiry_date,
        "status":         booking.status,
        "is_expired":     BookingService.is_booking_expired(booking),
        "days_remaining": BookingService.get_days_remaining(booking),
        "dealer_name":    booking.assigned_dealer.name if booking.assigned_dealer else None,
        "staff_name":     booking.assigned_staff.full_name if booking.assigned_staff else None,
        "has_plan":       booking.installment_plan is not None,
    }


# ── Booking CRUD ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[BookingListOut])
def list_bookings(
    status:        str | None = Query(None),
    client_id:     int | None = Query(None),
    property_id:   int | None = Query(None),
    unit_id:       int | None = Query(None),
    dealer_id:     int | None = Query(None),
    deal_id:       int | None = Query(None),
    expiring_soon: bool       = Query(False),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    query = (
        db.query(Booking)
        .options(
            joinedload(Booking.client),
            joinedload(Booking.property),
            joinedload(Booking.unit),
            joinedload(Booking.assigned_dealer),
            joinedload(Booking.assigned_staff),
            joinedload(Booking.installment_plan),
        )
        .order_by(Booking.created_at.desc())
    )
    if status:      query = query.filter(Booking.status == status)
    if client_id:   query = query.filter(Booking.client_id == client_id)
    if property_id: query = query.filter(Booking.property_id == property_id)
    if unit_id:     query = query.filter(Booking.unit_id == unit_id)
    if dealer_id:   query = query.filter(Booking.assigned_dealer_id == dealer_id)
    if deal_id:     query = query.filter(Booking.deal_id == deal_id)

    bookings = query.all()
    if expiring_soon:
        bookings = BookingService.get_expiring_soon(db, hours=24)

    return [_enrich_list(b) for b in bookings]


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    """Create a booking directly (without a deal)."""
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    if not BookingService.check_unit_availability(
        db=db,
        unit_id=payload.unit_id,
        property_id=payload.property_id if not payload.unit_id else None,
    ):
        raise HTTPException(400, "This unit/property is already booked")

    now = datetime.utcnow()
    custom_json = (
        json.dumps([c.model_dump() for c in payload.custom_charges])
        if payload.custom_charges else None
    )

    booking = Booking(
        booking_id=_next_booking_id(db),
        deal_id=payload.deal_id,
        client_id=payload.client_id,
        property_id=payload.property_id,
        unit_id=payload.unit_id,
        project_id=payload.project_id,
        assigned_dealer_id=payload.assigned_dealer_id,
        assigned_staff_id=payload.assigned_staff_id,
        nominee_name=payload.nominee_name,
        nominee_phone=payload.nominee_phone,
        nominee_cnic=payload.nominee_cnic,
        property_price=payload.property_price,
        final_price=payload.final_price or payload.property_price,
        discount=payload.discount,
        booking_amount=payload.booking_amount,
        down_payment=payload.down_payment,
        processing_fee=payload.processing_fee,
        possession_charges=payload.possession_charges,
        development_charges=payload.development_charges,
        custom_charges=custom_json,
        booking_date=now,
        expiry_date=BookingService.calculate_expiry_date(now, payload.holding_days),
        holding_days=payload.holding_days,
        status="pending",
        notes=payload.notes,
    )
    db.add(booking)
    db.flush()

    BookingService.create_log(
        db=db, booking_id=booking.id, action="created",
        new_value="pending", performed_by_id=current_user.id,
        notes="Booking created",
    )

    db.commit()
    db.refresh(booking)
    return _enrich_booking(_load_booking(db, booking.id))


@router.post("/from-deal", response_model=BookingOut, status_code=201)
def create_booking_from_deal(
    payload: BookingFromDeal,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    """Convert a WON deal into a Booking (official financial commitment)."""
    deal = db.query(Deal).filter(Deal.id == payload.deal_id).first()
    if not deal:
        raise HTTPException(404, "Deal not found")

    # Check no booking already exists for this deal
    existing = db.query(Booking).filter(Booking.deal_id == deal.id).first()
    if existing:
        raise HTTPException(400, f"A booking already exists for this deal: {existing.booking_id}")

    custom_json = (
        json.dumps([c.model_dump() for c in payload.custom_charges])
        if payload.custom_charges else None
    )

    booking = BookingService.create_booking_from_deal(
        db=db,
        deal=deal,
        booking_id_str=_next_booking_id(db),
        final_price=payload.final_price,
        booking_amount=payload.booking_amount,
        down_payment=payload.down_payment,
        holding_days=payload.holding_days,
        performed_by_id=current_user.id,
        discount=payload.discount,
        processing_fee=payload.processing_fee,
        possession_charges=payload.possession_charges,
        development_charges=payload.development_charges,
        custom_charges=custom_json,
        assigned_dealer_id=payload.assigned_dealer_id,
        nominee_name=payload.nominee_name,
        nominee_phone=payload.nominee_phone,
        nominee_cnic=payload.nominee_cnic,
        notes=payload.notes,
    )

    db.commit()
    db.refresh(booking)
    return _enrich_booking(_load_booking(db, booking.id))


@router.get("/stats/summary", response_model=BookingStats)
def get_booking_stats(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return BookingStats(**BookingService.get_booking_stats(db))


@router.get("/expiring-soon/list", response_model=list[BookingListOut])
def get_expiring_soon(
    hours: int = Query(24),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    bookings = BookingService.get_expiring_soon(db, hours=hours)
    return [_enrich_list(b) for b in bookings]


@router.get("/check-availability")
def check_availability(
    unit_id:     int | None = Query(None),
    property_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    if not unit_id and not property_id:
        raise HTTPException(400, "Either unit_id or property_id must be provided")
    available = BookingService.check_unit_availability(
        db=db, unit_id=unit_id, property_id=property_id
    )
    return {"available": available, "unit_id": unit_id, "property_id": property_id}


@router.post("/expire-old/cron")
def expire_old_bookings(
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    count = BookingService.expire_old_bookings(db)
    return {"message": f"Expired {count} booking(s)", "count": count}


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    return _enrich_booking(_load_booking(db, booking_id))


@router.patch("/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    booking = _load_booking(db, booking_id)
    if booking.status in ("completed", "cancelled", "expired", "refunded"):
        raise HTTPException(400, "Cannot update a terminal booking")

    update_data = payload.model_dump(exclude_none=True)
    if "custom_charges" in update_data:
        update_data["custom_charges"] = json.dumps(
            [c.model_dump() for c in payload.custom_charges]
        )
    for k, v in update_data.items():
        setattr(booking, k, v)

    booking.updated_at = datetime.utcnow()
    BookingService.create_log(
        db=db, booking_id=booking.id, action="updated",
        performed_by_id=current_user.id, notes="Booking details updated",
    )
    db.commit()
    db.refresh(booking)
    return _enrich_booking(_load_booking(db, booking_id))


@router.delete("/{booking_id}", status_code=204)
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    booking = _load_booking(db, booking_id)
    if booking.status in ("completed", "active"):
        raise HTTPException(400, "Cannot delete an active or completed booking")
    if booking.status not in ("cancelled", "expired"):
        BookingService.update_booking_status(
            db=db, booking=booking, new_status="cancelled",
            performed_by_id=current_user.id, notes="Deleted by user",
        )
        db.commit()


# ── Status management ─────────────────────────────────────────────────────────

@router.patch("/{booking_id}/status", response_model=BookingOut)
def update_booking_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    booking = _load_booking(db, booking_id)
    BookingService.update_booking_status(
        db=db, booking=booking, new_status=payload.status,
        performed_by_id=current_user.id,
        notes=payload.notes,
        cancellation_reason=payload.cancellation_reason,
    )
    db.commit()
    db.refresh(booking)
    return _enrich_booking(_load_booking(db, booking_id))


@router.post("/{booking_id}/extend", response_model=BookingOut)
def extend_booking(
    booking_id: int,
    payload: BookingExtension,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    booking = _load_booking(db, booking_id)
    BookingService.extend_booking(
        db=db, booking=booking,
        additional_days=payload.additional_days,
        performed_by_id=current_user.id,
        notes=payload.notes,
    )
    db.commit()
    db.refresh(booking)
    return _enrich_booking(_load_booking(db, booking_id))


@router.post("/{booking_id}/assign", response_model=BookingOut)
def assign_booking(
    booking_id: int,
    payload: BookingAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    booking = _load_booking(db, booking_id)
    if payload.assigned_dealer_id is not None:
        booking.assigned_dealer_id = payload.assigned_dealer_id
    if payload.assigned_staff_id is not None:
        booking.assigned_staff_id = payload.assigned_staff_id
    BookingService.create_log(
        db=db, booking_id=booking.id, action="assigned",
        performed_by_id=current_user.id, notes=payload.notes,
    )
    db.commit()
    db.refresh(booking)
    return _enrich_booking(_load_booking(db, booking_id))


# ── Installment plan ──────────────────────────────────────────────────────────

@router.post("/{booking_id}/installment-plan", response_model=InstallmentPlanOut)
def create_installment_plan(
    booking_id: int,
    payload: InstallmentPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    """
    Auto-generate an installment schedule for a booking.
    Booking must be in confirmed or active status.
    """
    booking = _load_booking(db, booking_id)
    if booking.status not in ("confirmed", "active", "reserved", "pending"):
        raise HTTPException(
            400,
            f"Cannot create installment plan for booking in '{booking.status}' status",
        )

    plan = BookingService.create_installment_plan(
        db=db,
        booking=booking,
        frequency=payload.frequency,
        count=payload.count,
        start_date=payload.start_date,
        due_day=payload.due_day,
        grace_days=payload.grace_days,
        type_id=payload.type_id,
        performed_by_id=current_user.id,
    )
    db.commit()
    db.refresh(plan)

    return (
        db.query(InstallmentPlan)
        .options(joinedload(InstallmentPlan.installments))
        .filter(InstallmentPlan.id == plan.id)
        .first()
    )


@router.get("/{booking_id}/installment-plan", response_model=InstallmentPlanOut)
def get_installment_plan(
    booking_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    plan = (
        db.query(InstallmentPlan)
        .options(
            joinedload(InstallmentPlan.installments)
            .joinedload(Installment.payments)
        )
        .filter(InstallmentPlan.booking_id == booking_id)
        .first()
    )
    if not plan:
        raise HTTPException(404, "No installment plan for this booking")
    return plan


# ── Payments ──────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/installments/{installment_id}/pay")
def pay_installment(
    booking_id:     int,
    installment_id: int,
    payload: InstallmentPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    """
    Record a payment against an installment.
    Supports partial payments. Creates double-entry journal automatically.
    """
    # Verify installment belongs to this booking
    plan = db.query(InstallmentPlan).filter(
        InstallmentPlan.booking_id == booking_id
    ).first()
    if not plan:
        raise HTTPException(404, "No installment plan for this booking")

    inst = db.query(Installment).filter(
        Installment.id == installment_id,
        Installment.plan_id == plan.id,
    ).first()
    if not inst:
        raise HTTPException(404, "Installment not found for this booking")

    payment = BookingService.record_payment(
        db=db,
        installment=inst,
        method=payload.method,
        amount=payload.amount,
        reference_number=payload.reference_number,
        payment_date=payload.payment_date,
        notes=payload.notes,
    )

    # Log on booking
    BookingService.create_log(
        db=db,
        booking_id=booking_id,
        action="payment_recorded",
        new_value=f"{payload.method}:{payload.amount}",
        performed_by_id=current_user.id,
        notes=payload.notes,
    )

    db.commit()
    db.refresh(payment)

    return {
        "id":               payment.id,
        "installment_id":   payment.installment_id,
        "method":           payment.method,
        "amount":           float(payment.amount),
        "date":             payment.date.isoformat(),
        "reference_number": payment.reference_number,
        "journal_id":       payment.journal_id,
        "installment_status": inst.status,
        "installment_paid":   float(inst.paid_amount),
        "installment_remaining": float(
            float(inst.amount) - float(inst.paid_amount)
        ),
    }


@router.get("/{booking_id}/installments/{installment_id}/payments")
def get_installment_payments(
    booking_id:     int,
    installment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_VIEW)),
):
    """Full payment history for a single installment."""
    plan = db.query(InstallmentPlan).filter(
        InstallmentPlan.booking_id == booking_id
    ).first()
    if not plan:
        raise HTTPException(404, "No installment plan for this booking")

    payments = (
        db.query(InstallmentPayment)
        .filter(InstallmentPayment.installment_id == installment_id)
        .order_by(InstallmentPayment.date.desc())
        .all()
    )
    return [
        {
            "id":               p.id,
            "method":           p.method,
            "amount":           float(p.amount),
            "date":             p.date.isoformat(),
            "reference_number": p.reference_number,
            "journal_id":       p.journal_id,
            "created_at":       p.created_at.isoformat(),
        }
        for p in payments
    ]


# ── Down payment ──────────────────────────────────────────────────────────────

@router.patch("/{booking_id}/down-payment-status", response_model=BookingOut)
def update_down_payment_status(
    booking_id: int,
    status: str = Query(..., description="pending | paid"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    if status not in ("pending", "paid"):
        raise HTTPException(400, "status must be 'pending' or 'paid'")
    booking = _load_booking(db, booking_id)
    old = booking.down_payment_status
    booking.down_payment_status = status
    BookingService.create_log(
        db=db, booking_id=booking.id, action="down_payment_updated",
        old_value=old, new_value=status, performed_by_id=current_user.id,
    )
    db.commit()
    db.refresh(booking)
    return _enrich_booking(_load_booking(db, booking_id))


# ── Attachments ───────────────────────────────────────────────────────────────

@router.post("/{booking_id}/attachments", response_model=BookingAttachmentOut)
def upload_attachment(
    booking_id: int,
    file: UploadFile = File(...),
    file_type: str = Query("other"),
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    _load_booking(db, booking_id)
    rel_path, filename = _save_file(file, f"bookings/{booking_id}")
    att = BookingAttachment(
        booking_id=booking_id,
        file_path=rel_path,
        filename=filename,
        file_type=file_type,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.delete("/{booking_id}/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    booking_id:    int,
    attachment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    att = (
        db.query(BookingAttachment)
        .filter(
            BookingAttachment.id == attachment_id,
            BookingAttachment.booking_id == booking_id,
        )
        .first()
    )
    if not att:
        raise HTTPException(404, "Attachment not found")
    fp = Path(settings.upload_dir) / att.file_path
    if fp.exists():
        fp.unlink()
    db.delete(att)
    db.commit()


# ── Convert to Sale ───────────────────────────────────────────────────────────

@router.post("/{booking_id}/convert-to-sale")
def convert_booking_to_sale(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_any_permission(*PERM_MANAGE)),
):
    """
    Convert a confirmed/active booking into a completed sale.

    Business rules:
    - Booking must be in 'confirmed' or 'active' status
    - A booking can only be converted once (idempotency guard)
    - Marks booking.status = 'completed'
    - Marks unit.status = 'sold'
    - Does NOT create a Deal — financial data already lives on the Booking
    - Returns the booking with full financial summary for the sale dashboard
    """
    booking = _load_booking(db, booking_id)

    # ── Guard: already converted ──────────────────────────────────────────────
    if booking.status == "completed" and booking.converted_at:
        # Idempotent — return success without re-processing
        return {
            "message":        "Booking already converted to sale",
            "booking_id":     booking.booking_id,
            "booking_db_id":  booking.id,
            "booking_status": "completed",
            "converted_at":   booking.converted_at.isoformat(),
            "has_plan":       booking.installment_plan is not None,
            "already_done":   True,
        }

    # ── Guard: wrong status ───────────────────────────────────────────────────
    if booking.status not in ("confirmed", "active"):
        raise HTTPException(
            400,
            f"Booking must be 'confirmed' or 'active' to convert to sale. "
            f"Current status: '{booking.status}'. "
            f"Please confirm the booking first.",
        )

    now = datetime.utcnow()

    # ── 1. Complete the booking ───────────────────────────────────────────────
    old_status = booking.status
    booking.status       = "completed"
    booking.completed_at = now
    booking.converted_at = now

    # ── 2. Lock unit/property as sold ─────────────────────────────────────────
    if booking.unit_id:
        unit = db.query(Unit).filter(Unit.id == booking.unit_id).first()
        if unit:
            unit.status = "sold"
    elif booking.property_id:
        prop = db.query(Property).filter(Property.id == booking.property_id).first()
        if prop:
            prop.status = "sold"

    # ── 3. Audit log ──────────────────────────────────────────────────────────
    BookingService.create_log(
        db=db,
        booking_id=booking.id,
        action="converted_to_sale",
        old_value=old_status,
        new_value="completed",
        performed_by_id=current_user.id,
        notes="Booking converted to sale. Unit locked as sold.",
    )

    db.commit()

    return {
        "message":        "Booking converted to sale successfully",
        "booking_id":     booking.booking_id,
        "booking_db_id":  booking.id,
        "booking_status": "completed",
        "converted_at":   now.isoformat(),
        "has_plan":       booking.installment_plan is not None,
        "already_done":   False,
    }
