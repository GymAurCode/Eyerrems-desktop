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
