"""
Central business rules for the REMS system.

Validates unit availability, enforces active-deal constraints,
and synchronises unit status automatically when deal/booking status changes.
"""

from typing import Optional
from sqlalchemy.orm import Session

from app.models.crm import Deal
from app.models.property import Unit

# ── Status vocabularies ───────────────────────────────────────────────────────

# Deal statuses that mean "this unit is occupied" and block new deals.
BLOCKING_DEAL_STATUSES = frozenset({
    "pending",
    "active",
    "booked",
    "reserved",
    "under_verification",
    "agreement_signed",
    "installment_running",
    "on_hold",
})

# Deal statuses that are terminal — unit becomes available.
TERMINAL_DEAL_STATUSES = frozenset({"cancelled", "expired"})

# Deal statuses that still hold the unit (completed/resold units can get new deals
# as resale, but the unit is not "available").
COMPLETED_DEAL_STATUSES = frozenset({"completed", "registered", "closed"})

# All blocking + completed = statuses that mean the unit is NOT freely available.
OCCUPIED_STATUSES = BLOCKING_DEAL_STATUSES | COMPLETED_DEAL_STATUSES

# Mapping: deal status → target unit status.
DEAL_STATUS_TO_UNIT_STATUS: dict[str, str] = {
    "pending":               "booked",
    "active":                "booked",
    "booked":                "booked",
    "reserved":              "reserved",
    "under_verification":    "under_verification",
    "agreement_signed":      "agreement_signed",
    "installment_running":   "installment_running",
    "completed":             "completed",
    "registered":            "registered",
    "closed":                "completed",
    "cancelled":             "available",
    "expired":               "available",
    "on_hold":               "on_hold",
}

# Booking statuses that mean the unit is occupied.
BOOKING_OCCUPIED_STATUSES = frozenset({
    "pending", "reserved", "confirmed", "active",
})


# ── Queries ────────────────────────────────────────────────────────────────────

def get_active_deal_for_unit(
    db: Session,
    unit_id: int,
    exclude_deal_id: Optional[int] = None,
) -> Optional[Deal]:
    """Return the first non-terminal deal for *unit_id*, if any."""
    q = db.query(Deal).filter(
        Deal.unit_id == unit_id,
        Deal.status.notin_(TERMINAL_DEAL_STATUSES),
    )
    if exclude_deal_id is not None:
        q = q.filter(Deal.id != exclude_deal_id)
    return q.first()


def has_active_deal_for_unit(
    db: Session,
    unit_id: int,
    exclude_deal_id: Optional[int] = None,
) -> bool:
    """Return True if the unit already has an active (non-terminal) deal."""
    return get_active_deal_for_unit(db, unit_id, exclude_deal_id) is not None


# ── Validation ─────────────────────────────────────────────────────────────────

class UnitNotAvailableError(ValueError):
    """Raised when a unit cannot accept a new deal/booking."""

    def __init__(self, unit_id: int, reason: str, current_deal_ref: Optional[str] = None):
        self.unit_id = unit_id
        self.reason = reason
        self.current_deal_ref = current_deal_ref
        msg = reason
        if current_deal_ref:
            msg += f" (current deal: {current_deal_ref})"
        super().__init__(msg)


def validate_unit_available_for_deal(
    db: Session,
    unit_id: int,
    exclude_deal_id: Optional[int] = None,
) -> None:
    """
    Raise ``UnitNotAvailableError`` if the unit already has a blocking deal.

    This is called *before* creating or updating a deal.
    """
    unit: Optional[Unit] = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise UnitNotAvailableError(unit_id, "Unit not found")

    active = get_active_deal_for_unit(db, unit_id, exclude_deal_id)
    if active is None:
        return

    raise UnitNotAvailableError(
        unit_id=unit_id,
        reason=(
            "This unit already has an active deal and cannot be assigned to "
            "another client until the current deal is completed, cancelled, "
            "or expired."
        ),
        current_deal_ref=active.deal_id,
    )


# ── Unit status sync ──────────────────────────────────────────────────────────

def sync_unit_status(
    db: Session,
    unit_id: int,
) -> str:
    """
    Inspect the latest non-terminal deal for *unit_id* and update
    ``Unit.status`` accordingly.

    If no active deal exists, the unit is set to ``"available"``.

    Returns the new unit status.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        return ""

    deal = get_active_deal_for_unit(db, unit_id)

    if deal is None:
        # Check if there is a terminal deal that left the unit occupied
        # (e.g. completed → unit stays "completed", not "available")
        completed = (
            db.query(Deal)
            .filter(
                Deal.unit_id == unit_id,
                Deal.status.in_(COMPLETED_DEAL_STATUSES),
            )
            .order_by(Deal.id.desc())
            .first()
        )
        if completed:
            new_status = DEAL_STATUS_TO_UNIT_STATUS.get(completed.status, "available")
        else:
            new_status = "available"
    else:
        new_status = DEAL_STATUS_TO_UNIT_STATUS.get(deal.status, "booked")

    if unit.status != new_status:
        old_status = unit.status
        unit.status = new_status
        db.flush()
        from app.core.audit import log_action
        log_action(
            db=db, module="property", action="UNIT_STATUS_CHANGED",
            record_id=str(unit.id),
            record_label=f"Unit {unit.unit_number} — {old_status} → {new_status}",
            changed_by="system",
            changed_by_role=None,
            old_data={"status": old_status},
            new_data={"status": new_status},
        )

    return new_status
