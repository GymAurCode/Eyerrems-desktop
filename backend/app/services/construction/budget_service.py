"""Budget service — create/update project budget, compute totals"""
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.construction import ProjectBudget
from app.schemas.construction import BudgetCreate, BudgetUpdate


class BudgetService:

    @staticmethod
    def _total(m, l, e, misc) -> Decimal:
        return Decimal(str(m)) + Decimal(str(l)) + Decimal(str(e)) + Decimal(str(misc))

    @staticmethod
    def upsert(db: Session, payload: BudgetCreate) -> ProjectBudget:
        obj = db.query(ProjectBudget).filter(ProjectBudget.project_id == payload.project_id).first()
        total = BudgetService._total(
            payload.material_cost, payload.labor_cost,
            payload.equipment_cost, payload.misc_cost,
        )
        if obj:
            obj.material_cost  = payload.material_cost
            obj.labor_cost     = payload.labor_cost
            obj.equipment_cost = payload.equipment_cost
            obj.misc_cost      = payload.misc_cost
            obj.total_cost     = total
        else:
            obj = ProjectBudget(
                project_id     = payload.project_id,
                material_cost  = payload.material_cost,
                labor_cost     = payload.labor_cost,
                equipment_cost = payload.equipment_cost,
                misc_cost      = payload.misc_cost,
                total_cost     = total,
            )
            db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get(db: Session, project_id: int) -> ProjectBudget:
        obj = db.query(ProjectBudget).filter(ProjectBudget.project_id == project_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Budget not found for this project")
        return obj

    @staticmethod
    def patch(db: Session, project_id: int, payload: BudgetUpdate) -> ProjectBudget:
        obj = BudgetService.get(db, project_id)
        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        obj.total_cost = BudgetService._total(
            obj.material_cost, obj.labor_cost, obj.equipment_cost, obj.misc_cost
        )
        db.commit()
        db.refresh(obj)
        return obj
