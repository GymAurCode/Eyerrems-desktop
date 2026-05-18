"""Town / Block / Plot API routes.

Hierarchy: Town → Block → Plot
All routes are tenant-isolated via company_id.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_any_permission
from app.core.database import get_db
from app.core.tid import next_tid
from app.models.auth import User
from app.models.town import Block, Plot, Town
from app.schemas.town import (
    BlockCreate, BlockOut, BlockUpdate, BlockWithPlots,
    PlotCreate, PlotOut, PlotUpdate,
    TownCreate, TownFull, TownOut, TownUpdate,
)

router = APIRouter()

PERM_VIEW   = ("towns:view",   "towns:manage", "properties:view",   "properties:manage")
PERM_MANAGE = ("towns:manage", "properties:manage")


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_company_id(current_user: User) -> int | None:
    return None if current_user.is_super_admin else current_user.company_id


def _town_query(db: Session, company_id: int | None):
    q = db.query(Town)
    if company_id is not None:
        q = q.filter(Town.company_id == company_id)
    return q


def _block_query(db: Session, company_id: int | None):
    q = db.query(Block)
    if company_id is not None:
        q = q.filter(Block.company_id == company_id)
    return q


def _plot_query(db: Session, company_id: int | None):
    q = db.query(Plot)
    if company_id is not None:
        q = q.filter(Plot.company_id == company_id)
    return q


def _enrich_town(town: Town) -> dict:
    """Add computed counts to a town dict."""
    d = TownOut.model_validate(town).model_dump()
    d["block_count"] = len(town.blocks)
    d["plot_count"]  = sum(len(b.plots) for b in town.blocks)
    return d


def _enrich_block(block: Block) -> dict:
    """Add computed plot counts to a block dict."""
    d = BlockOut.model_validate(block).model_dump()
    plots = block.plots
    d["plot_count"]      = len(plots)
    d["available_plots"] = sum(1 for p in plots if p.status == "available")
    d["sold_plots"]      = sum(1 for p in plots if p.status == "sold")
    d["booked_plots"]    = sum(1 for p in plots if p.status == "booked")
    return d


def _enrich_plot(plot: Plot) -> dict:
    d = PlotOut.model_validate(plot).model_dump()
    d["block_name"] = plot.block.name if plot.block else None
    d["town_name"]  = plot.block.town.name if plot.block and plot.block.town else None
    return d


# ═══════════════════════════════════════════════════════════════════════════════
# TOWNS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=list[TownOut])
def list_towns(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    towns = (
        _town_query(db, company_id)
        .options(joinedload(Town.blocks).joinedload(Block.plots))
        .order_by(Town.name)
        .all()
    )
    return [_enrich_town(t) for t in towns]


@router.post("/", response_model=TownOut)
def create_town(
    payload: TownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    tid  = next_tid(db, Town, "TWN")
    town = Town(tid=tid, company_id=company_id, **payload.model_dump())
    db.add(town)
    db.commit()
    db.refresh(town)
    # reload with relationships for counts
    town = (
        db.query(Town)
        .options(joinedload(Town.blocks).joinedload(Block.plots))
        .filter(Town.id == town.id)
        .first()
    )
    return _enrich_town(town)


@router.get("/{town_id}", response_model=TownOut)
def get_town(
    town_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    town = (
        _town_query(db, company_id)
        .options(joinedload(Town.blocks).joinedload(Block.plots))
        .filter(Town.id == town_id)
        .first()
    )
    if not town:
        raise HTTPException(404, "Town not found")
    return _enrich_town(town)


@router.get("/{town_id}/full", response_model=TownFull)
def get_town_full(
    town_id: int,
    status: str | None = Query(None, description="Filter plots by status: available/sold/booked/reserved"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    """Return full hierarchy: Town + Blocks + Plots (with optional plot status filter)."""
    company_id = _get_company_id(current_user)
    town = (
        _town_query(db, company_id)
        .options(joinedload(Town.blocks).joinedload(Block.plots))
        .filter(Town.id == town_id)
        .first()
    )
    if not town:
        raise HTTPException(404, "Town not found")

    result = TownOut.model_validate(town).model_dump()
    result["block_count"] = len(town.blocks)
    result["plot_count"]  = sum(len(b.plots) for b in town.blocks)
    result["blocks"] = []

    for block in sorted(town.blocks, key=lambda b: b.name):
        plots = block.plots
        if status:
            plots = [p for p in plots if p.status == status.lower()]

        block_dict = _enrich_block(block)
        block_dict["plots"] = [_enrich_plot(p) for p in sorted(plots, key=lambda p: p.plot_number)]
        result["blocks"].append(block_dict)

    return result


@router.patch("/{town_id}", response_model=TownOut)
def update_town(
    town_id: int,
    payload: TownUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    town = (
        _town_query(db, company_id)
        .options(joinedload(Town.blocks).joinedload(Block.plots))
        .filter(Town.id == town_id)
        .first()
    )
    if not town:
        raise HTTPException(404, "Town not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(town, k, v)
    db.commit()
    db.refresh(town)
    town = (
        db.query(Town)
        .options(joinedload(Town.blocks).joinedload(Block.plots))
        .filter(Town.id == town_id)
        .first()
    )
    return _enrich_town(town)


@router.delete("/{town_id}", status_code=204)
def delete_town(
    town_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    town = _town_query(db, company_id).filter(Town.id == town_id).first()
    if not town:
        raise HTTPException(404, "Town not found")
    db.delete(town)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# BLOCKS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/blocks/all", response_model=list[BlockOut])
def list_blocks(
    town_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    q = _block_query(db, company_id).options(joinedload(Block.plots))
    if town_id:
        q = q.filter(Block.town_id == town_id)
    blocks = q.order_by(Block.name).all()
    return [_enrich_block(b) for b in blocks]


@router.post("/blocks", response_model=BlockOut)
def create_block(
    payload: BlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    # Verify town belongs to same company
    town = _town_query(db, company_id).filter(Town.id == payload.town_id).first()
    if not town:
        raise HTTPException(404, "Town not found")
    tid   = next_tid(db, Block, "BLK")
    block = Block(tid=tid, company_id=company_id, **payload.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    block = (
        db.query(Block)
        .options(joinedload(Block.plots))
        .filter(Block.id == block.id)
        .first()
    )
    return _enrich_block(block)


@router.get("/blocks/{block_id}", response_model=BlockWithPlots)
def get_block(
    block_id: int,
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    block = (
        _block_query(db, company_id)
        .options(joinedload(Block.plots))
        .filter(Block.id == block_id)
        .first()
    )
    if not block:
        raise HTTPException(404, "Block not found")

    plots = block.plots
    if status:
        plots = [p for p in plots if p.status == status.lower()]

    result = _enrich_block(block)
    result["plots"] = [_enrich_plot(p) for p in sorted(plots, key=lambda p: p.plot_number)]
    return result


@router.patch("/blocks/{block_id}", response_model=BlockOut)
def update_block(
    block_id: int,
    payload: BlockUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    block = (
        _block_query(db, company_id)
        .options(joinedload(Block.plots))
        .filter(Block.id == block_id)
        .first()
    )
    if not block:
        raise HTTPException(404, "Block not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(block, k, v)
    db.commit()
    db.refresh(block)
    block = (
        db.query(Block)
        .options(joinedload(Block.plots))
        .filter(Block.id == block_id)
        .first()
    )
    return _enrich_block(block)


@router.delete("/blocks/{block_id}", status_code=204)
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    block = _block_query(db, company_id).filter(Block.id == block_id).first()
    if not block:
        raise HTTPException(404, "Block not found")
    db.delete(block)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# PLOTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/plots/all", response_model=list[PlotOut])
def list_plots(
    block_id: int | None = Query(None),
    town_id: int | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    q = (
        _plot_query(db, company_id)
        .options(joinedload(Plot.block).joinedload(Block.town))
    )
    if block_id:
        q = q.filter(Plot.block_id == block_id)
    if town_id:
        q = q.join(Block).filter(Block.town_id == town_id)
    if status:
        q = q.filter(Plot.status == status.lower())
    plots = q.order_by(Plot.plot_number).all()
    return [_enrich_plot(p) for p in plots]


@router.post("/plots", response_model=PlotOut)
def create_plot(
    payload: PlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    # Verify block belongs to same company
    block = _block_query(db, company_id).filter(Block.id == payload.block_id).first()
    if not block:
        raise HTTPException(404, "Block not found")
    tid  = next_tid(db, Plot, "PLT")
    plot = Plot(tid=tid, company_id=company_id, **payload.model_dump())
    db.add(plot)
    db.commit()
    db.refresh(plot)
    plot = (
        db.query(Plot)
        .options(joinedload(Plot.block).joinedload(Block.town))
        .filter(Plot.id == plot.id)
        .first()
    )
    return _enrich_plot(plot)


@router.get("/plots/{plot_id}", response_model=PlotOut)
def get_plot(
    plot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    plot = (
        _plot_query(db, company_id)
        .options(joinedload(Plot.block).joinedload(Block.town))
        .filter(Plot.id == plot_id)
        .first()
    )
    if not plot:
        raise HTTPException(404, "Plot not found")
    return _enrich_plot(plot)


@router.patch("/plots/{plot_id}", response_model=PlotOut)
def update_plot(
    plot_id: int,
    payload: PlotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    plot = (
        _plot_query(db, company_id)
        .options(joinedload(Plot.block).joinedload(Block.town))
        .filter(Plot.id == plot_id)
        .first()
    )
    if not plot:
        raise HTTPException(404, "Plot not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(plot, k, v)
    db.commit()
    db.refresh(plot)
    plot = (
        db.query(Plot)
        .options(joinedload(Plot.block).joinedload(Block.town))
        .filter(Plot.id == plot_id)
        .first()
    )
    return _enrich_plot(plot)


@router.delete("/plots/{plot_id}", status_code=204)
def delete_plot(
    plot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    plot = _plot_query(db, company_id).filter(Plot.id == plot_id).first()
    if not plot:
        raise HTTPException(404, "Plot not found")
    db.delete(plot)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# TOWN UNITS  (upgraded multi-type property units)
# ═══════════════════════════════════════════════════════════════════════════════

from app.models.town import TownUnit, TownTransaction
from app.schemas.town import (
    TownUnitCreate, TownUnitOut, TownUnitUpdate,
    TownTransactionCreate, TownTransactionOut,
    TownFinanceSummary,
)
from app.core.journal_service import JournalService, JournalEntryData
from decimal import Decimal
from sqlalchemy import func


def _unit_query(db: Session, company_id: int | None):
    q = db.query(TownUnit)
    if company_id is not None:
        q = q.filter(TownUnit.company_id == company_id)
    return q


def _txn_query(db: Session, company_id: int | None):
    q = db.query(TownTransaction)
    if company_id is not None:
        q = q.filter(TownTransaction.company_id == company_id)
    return q


def _enrich_unit(unit: TownUnit) -> dict:
    d = TownUnitOut.model_validate(unit).model_dump()
    d["block_name"] = unit.block.name if unit.block else None
    d["town_name"]  = unit.town.name  if unit.town  else None
    return d


def _enrich_txn(txn: TownTransaction) -> dict:
    d = TownTransactionOut.model_validate(txn).model_dump()
    d["unit_number"] = txn.unit.unit_number if txn.unit else None
    d["town_name"]   = txn.unit.town.name   if txn.unit and txn.unit.town else None
    d["block_name"]  = txn.unit.block.name  if txn.unit and txn.unit.block else None
    return d


# ── List units ────────────────────────────────────────────────────────────────

@router.get("/units/all", response_model=list[TownUnitOut])
def list_units(
    town_id:   int | None = Query(None),
    block_id:  int | None = Query(None),
    status:    str | None = Query(None),
    unit_type: str | None = Query(None),
    category:  str | None = Query(None),
    search:    str | None = Query(None),
    skip:      int = Query(0, ge=0),
    limit:     int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    q = (
        _unit_query(db, company_id)
        .options(
            joinedload(TownUnit.block),
            joinedload(TownUnit.town),
        )
    )
    if town_id:
        q = q.filter(TownUnit.town_id == town_id)
    if block_id:
        q = q.filter(TownUnit.block_id == block_id)
    if status:
        q = q.filter(TownUnit.status == status.lower())
    if unit_type:
        q = q.filter(TownUnit.unit_type == unit_type.lower())
    if category:
        q = q.filter(TownUnit.category == category.lower())
    if search:
        s = f"%{search}%"
        from sqlalchemy import or_
        q = q.filter(or_(
            TownUnit.unit_number.ilike(s),
            TownUnit.title.ilike(s),
            TownUnit.owner_name.ilike(s),
            TownUnit.buyer_name.ilike(s),
        ))
    units = q.order_by(TownUnit.unit_number).offset(skip).limit(limit).all()
    return [_enrich_unit(u) for u in units]


@router.get("/units/count")
def count_units(
    town_id:   int | None = Query(None),
    block_id:  int | None = Query(None),
    status:    str | None = Query(None),
    unit_type: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    q = _unit_query(db, company_id)
    if town_id:   q = q.filter(TownUnit.town_id   == town_id)
    if block_id:  q = q.filter(TownUnit.block_id  == block_id)
    if status:    q = q.filter(TownUnit.status     == status.lower())
    if unit_type: q = q.filter(TownUnit.unit_type  == unit_type.lower())
    return {"count": q.count()}


@router.post("/units", response_model=TownUnitOut)
def create_unit(
    payload: TownUnitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    # Verify block belongs to same company
    block = _block_query(db, company_id).filter(Block.id == payload.block_id).first()
    if not block:
        raise HTTPException(404, "Block not found")
    # Verify town
    town = _town_query(db, company_id).filter(Town.id == payload.town_id).first()
    if not town:
        raise HTTPException(404, "Town not found")

    # Auto-compute remaining_balance if not provided
    data = payload.model_dump()
    if data.get("remaining_balance") is None and data.get("total_price") is not None:
        data["remaining_balance"] = (
            Decimal(str(data["total_price"])) - Decimal(str(data.get("received_amount") or 0))
        )

    tid  = next_tid(db, TownUnit, "TUN")
    unit = TownUnit(tid=tid, company_id=company_id, **data)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    unit = (
        db.query(TownUnit)
        .options(joinedload(TownUnit.block), joinedload(TownUnit.town))
        .filter(TownUnit.id == unit.id)
        .first()
    )
    return _enrich_unit(unit)


@router.get("/units/{unit_id}", response_model=TownUnitOut)
def get_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    unit = (
        _unit_query(db, company_id)
        .options(joinedload(TownUnit.block), joinedload(TownUnit.town))
        .filter(TownUnit.id == unit_id)
        .first()
    )
    if not unit:
        raise HTTPException(404, "Unit not found")
    return _enrich_unit(unit)


@router.patch("/units/{unit_id}", response_model=TownUnitOut)
def update_unit(
    unit_id: int,
    payload: TownUnitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    unit = (
        _unit_query(db, company_id)
        .options(joinedload(TownUnit.block), joinedload(TownUnit.town))
        .filter(TownUnit.id == unit_id)
        .first()
    )
    if not unit:
        raise HTTPException(404, "Unit not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(unit, k, v)
    # Recompute remaining balance if financial fields changed
    if unit.total_price is not None:
        unit.remaining_balance = unit.total_price - (unit.received_amount or Decimal("0"))
    db.commit()
    db.refresh(unit)
    unit = (
        db.query(TownUnit)
        .options(joinedload(TownUnit.block), joinedload(TownUnit.town))
        .filter(TownUnit.id == unit.id)
        .first()
    )
    return _enrich_unit(unit)


@router.delete("/units/{unit_id}", status_code=204)
def delete_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    company_id = _get_company_id(current_user)
    unit = _unit_query(db, company_id).filter(TownUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(404, "Unit not found")
    db.delete(unit)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# TOWN TRANSACTIONS  (finance integration)
# ═══════════════════════════════════════════════════════════════════════════════

# Account code mapping for auto-journal creation
_TXN_ACCOUNT_MAP = {
    "booking":     ("4510", "2500"),   # DR: Cash/Bank → CR: Booking Income + Advance Deposit
    "installment": ("4520", "1250"),   # DR: Cash/Bank → CR: Installment Income
    "sale":        ("4500", "1250"),   # DR: Cash/Bank → CR: Property Sales Income
    "rent":        ("4530", "1210"),   # DR: Cash/Bank → CR: Rental Income
    "refund":      ("2500", "1100"),   # DR: Advance Deposit → CR: Bank (refund out)
    "transfer":    ("1100", "1100"),   # Internal transfer
    "adjustment":  ("1100", "1100"),   # Manual adjustment
}


def _get_account_by_code(db: Session, code: str):
    from app.models.finance import Account as FinAccount
    return db.query(FinAccount).filter(FinAccount.code == code).first()


@router.get("/transactions/all", response_model=list[TownTransactionOut])
def list_transactions(
    town_id:          int | None = Query(None),
    town_unit_id:     int | None = Query(None),
    transaction_type: str | None = Query(None),
    skip:  int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    company_id = _get_company_id(current_user)
    q = (
        _txn_query(db, company_id)
        .options(
            joinedload(TownTransaction.unit)
            .joinedload(TownUnit.block),
            joinedload(TownTransaction.unit)
            .joinedload(TownUnit.town),
        )
    )
    if town_id:          q = q.filter(TownTransaction.town_id      == town_id)
    if town_unit_id:     q = q.filter(TownTransaction.town_unit_id == town_unit_id)
    if transaction_type: q = q.filter(TownTransaction.transaction_type == transaction_type.lower())
    txns = q.order_by(TownTransaction.transaction_date.desc()).offset(skip).limit(limit).all()
    return [_enrich_txn(t) for t in txns]


@router.post("/transactions", response_model=TownTransactionOut)
def create_transaction(
    payload: TownTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_MANAGE)),
):
    """
    Record a financial transaction against a town unit.
    Automatically creates a double-entry journal entry in the Finance module.
    Updates the unit's received_amount and remaining_balance.
    """
    company_id = _get_company_id(current_user)

    unit = None
    if payload.town_unit_id:
        unit = _unit_query(db, company_id).filter(TownUnit.id == payload.town_unit_id).first()
        if not unit:
            raise HTTPException(404, "Town unit not found")

    # ── Auto-create double-entry journal ──────────────────────────────────────
    journal = None
    try:
        txn_type = payload.transaction_type
        # Determine debit/credit accounts
        # For most types: DR Cash/Bank (1010 or 1100), CR Income account
        # For refund: DR Liability, CR Cash/Bank
        cash_account  = _get_account_by_code(db, "1010")  # Cash on Hand
        bank_account  = _get_account_by_code(db, "1100")  # Main Bank Account

        # Choose debit account based on payment method
        method = (payload.payment_method or "cash").lower()
        debit_account = bank_account if method in ("bank", "cheque", "online") else cash_account

        # Choose credit account based on transaction type
        credit_code_map = {
            "booking":     "4510",
            "installment": "4520",
            "sale":        "4500",
            "rent":        "4530",
            "refund":      "1100",   # refund goes out of bank
            "transfer":    "1100",
            "adjustment":  "1100",
        }
        credit_code = credit_code_map.get(txn_type, "4300")  # fallback: Other Income
        credit_account = _get_account_by_code(db, credit_code)

        if debit_account and credit_account and txn_type != "refund":
            entries = [
                JournalEntryData(account_id=debit_account.id,  debit=payload.amount),
                JournalEntryData(account_id=credit_account.id, credit=payload.amount),
            ]
        elif debit_account and credit_account and txn_type == "refund":
            # Refund: DR Advance Deposit, CR Bank
            advance_acc = _get_account_by_code(db, "2500")
            if advance_acc:
                entries = [
                    JournalEntryData(account_id=advance_acc.id,   debit=payload.amount),
                    JournalEntryData(account_id=debit_account.id, credit=payload.amount),
                ]
            else:
                entries = None
        else:
            entries = None

        if entries:
            unit_ref = f"TUN-{unit.tid}" if unit else "TOWN"
            journal = JournalService.create_journal_entry(
                db=db,
                entries=entries,
                reference_type=f"town_{txn_type}",
                reference_id=unit_ref,
                description=payload.description or f"Town {txn_type} — {unit_ref}",
                date=payload.transaction_date,
                user=current_user,
            )
    except Exception as e:
        # Journal creation failure should not block the transaction record
        import logging
        logging.getLogger("rems.towns").warning("Journal creation failed for town txn: %s", e)
        journal = None

    # ── Create transaction record ─────────────────────────────────────────────
    tid = next_tid(db, TownTransaction, "TTX")
    txn = TownTransaction(
        tid=tid,
        company_id=company_id,
        journal_id=journal.id if journal else None,
        created_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(txn)

    # ── Update unit financials ────────────────────────────────────────────────
    if unit and payload.transaction_type != "refund":
        unit.received_amount = (unit.received_amount or Decimal("0")) + payload.amount
        if unit.total_price:
            unit.remaining_balance = unit.total_price - unit.received_amount
        # Auto-update status
        if payload.transaction_type == "sale":
            unit.status = "sold"
        elif payload.transaction_type == "booking" and unit.status == "available":
            unit.status = "booked"
        elif payload.transaction_type == "rent":
            unit.status = "rented"
    elif unit and payload.transaction_type == "refund":
        unit.received_amount = max(Decimal("0"), (unit.received_amount or Decimal("0")) - payload.amount)
        if unit.total_price:
            unit.remaining_balance = unit.total_price - unit.received_amount
        unit.status = "available"

    db.commit()
    if journal:
        db.refresh(journal)
    db.refresh(txn)

    txn = (
        db.query(TownTransaction)
        .options(
            joinedload(TownTransaction.unit).joinedload(TownUnit.block),
            joinedload(TownTransaction.unit).joinedload(TownUnit.town),
        )
        .filter(TownTransaction.id == txn.id)
        .first()
    )
    return _enrich_txn(txn)


@router.get("/transactions/summary", response_model=TownFinanceSummary)
def get_finance_summary(
    town_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*PERM_VIEW)),
):
    """Return aggregated financial summary for a town or all towns."""
    company_id = _get_company_id(current_user)
    q = _txn_query(db, company_id)
    if town_id:
        q = q.filter(TownTransaction.town_id == town_id)

    txns = q.all()

    def _sum(type_: str) -> Decimal:
        return sum((t.amount for t in txns if t.transaction_type == type_), Decimal("0"))

    # Outstanding balance = sum of remaining_balance across all units
    uq = _unit_query(db, company_id)
    if town_id:
        uq = uq.filter(TownUnit.town_id == town_id)
    outstanding = sum(
        (u.remaining_balance or Decimal("0"))
        for u in uq.all()
        if u.status not in ("sold", "inactive")
    )

    return TownFinanceSummary(
        total_revenue       = _sum("booking") + _sum("installment") + _sum("sale") + _sum("rent"),
        booking_revenue     = _sum("booking"),
        installment_revenue = _sum("installment"),
        sale_revenue        = _sum("sale"),
        rental_revenue      = _sum("rent"),
        total_refunds       = _sum("refund"),
        outstanding_balance = outstanding,
        transaction_count   = len(txns),
    )
