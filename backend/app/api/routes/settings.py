from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permissions
from app.core.database import get_db
from app.models.auth import User
from app.models.master_options import MasterSettingOption
from app.schemas.settings import (
    MasterSettingOptionCreate,
    MasterSettingOptionResponse,
    MasterSettingOptionUpdate,
)

router = APIRouter()


@router.get("/options", response_model=list[MasterSettingOptionResponse])
def list_options(
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MasterSettingOption).filter(MasterSettingOption.is_active.is_(True))
    if category:
        q = q.filter(MasterSettingOption.category == category)
    return q.order_by(MasterSettingOption.sort_order, MasterSettingOption.label).all()


@router.post("/options", response_model=MasterSettingOptionResponse)
def create_option(
    payload: MasterSettingOptionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("settings:manage")),
):
    exists = (
        db.query(MasterSettingOption)
        .filter(
            MasterSettingOption.category == payload.category,
            MasterSettingOption.code == payload.code,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Option already exists for this category")
    row = MasterSettingOption(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/options/{option_id}", response_model=MasterSettingOptionResponse)
def update_option(
    option_id: int,
    payload: MasterSettingOptionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions("settings:manage")),
):
    row = db.query(MasterSettingOption).filter(MasterSettingOption.id == option_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Option not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row
