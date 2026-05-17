"""Procurement service — create, update status, list by project"""
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.construction import Procurement
from app.schemas.construction import ProcurementCreate, ProcurementStatusUpdate, ProcurementUpdate


class ProcurementService:

    @staticmethod
    def create(db: Session, payload: ProcurementCreate, user_id: int) -> Procurement:
        cost = Decimal(str(payload.quantity)) * Decimal(str(payload.unit_cost))
        obj = Procurement(
            **payload.model_dump(),
            cost=cost,
            requested_by=user_id,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get_all(db: Session, project_id: int) -> list[Procurement]:
        return (
            db.query(Procurement)
            .filter(Procurement.project_id == project_id)
            .order_by(Procurement.requested_at.desc())
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, procurement_id: int) -> Procurement:
        obj = db.query(Procurement).filter(Procurement.id == procurement_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Procurement not found")
        return obj

    @staticmethod
    def update(db: Session, procurement_id: int, payload: ProcurementUpdate) -> Procurement:
        obj = ProcurementService.get_by_id(db, procurement_id)
        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        # recalc cost if quantity or unit_cost changed
        obj.cost = Decimal(str(obj.quantity)) * Decimal(str(obj.unit_cost))
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def update_status(
        db: Session, procurement_id: int, payload: ProcurementStatusUpdate, user_id: int
    ) -> Procurement:
        obj = ProcurementService.get_by_id(db, procurement_id)
        obj.status = payload.status
        if payload.status == "approved" and not obj.approved_at:
            obj.approved_at = datetime.utcnow()
            obj.approved_by = user_id
        elif payload.status == "received" and not obj.received_at:
            obj.received_at = datetime.utcnow()
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def delete(db: Session, procurement_id: int) -> None:
        obj = ProcurementService.get_by_id(db, procurement_id)
        db.delete(obj)
        db.commit()
