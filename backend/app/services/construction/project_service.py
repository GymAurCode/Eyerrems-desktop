"""Project & Phase CRUD service"""
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.construction import (
    ConstructionExpense, ConstructionProject, DailyProgress, ProjectPhase,
)
from app.schemas.construction import PhaseCreate, PhaseUpdate, ProjectCreate, ProjectUpdate


class ProjectService:

    # ── Project ───────────────────────────────────────────────────────────────

    @staticmethod
    def create(db: Session, payload: ProjectCreate, user_id: int) -> ConstructionProject:
        project = ConstructionProject(**payload.model_dump(), created_by=user_id)
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def get_all(db: Session, status: Optional[str] = None) -> list[ConstructionProject]:
        q = db.query(ConstructionProject)
        if status:
            q = q.filter(ConstructionProject.status == status)
        return q.order_by(ConstructionProject.created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, project_id: int) -> ConstructionProject:
        obj = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Project not found")
        return obj

    @staticmethod
    def update(db: Session, project_id: int, payload: ProjectUpdate) -> ConstructionProject:
        obj = ProjectService.get_by_id(db, project_id)
        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def delete(db: Session, project_id: int) -> None:
        obj = ProjectService.get_by_id(db, project_id)
        db.delete(obj)
        db.commit()

    @staticmethod
    def actual_cost(db: Session, project_id: int) -> Decimal:
        rows = db.query(ConstructionExpense).filter(
            ConstructionExpense.project_id == project_id
        ).all()
        return sum((r.amount for r in rows), Decimal("0"))

    @staticmethod
    def latest_progress(db: Session, project_id: int) -> float:
        row = (
            db.query(DailyProgress)
            .filter(DailyProgress.project_id == project_id)
            .order_by(DailyProgress.date.desc())
            .first()
        )
        return row.progress_percentage if row else 0.0

    # ── Phase ─────────────────────────────────────────────────────────────────

    @staticmethod
    def create_phase(db: Session, payload: PhaseCreate) -> ProjectPhase:
        ProjectService.get_by_id(db, payload.project_id)
        phase = ProjectPhase(**payload.model_dump())
        db.add(phase)
        db.commit()
        db.refresh(phase)
        return phase

    @staticmethod
    def get_phases(db: Session, project_id: int) -> list[ProjectPhase]:
        return (
            db.query(ProjectPhase)
            .filter(ProjectPhase.project_id == project_id)
            .order_by(ProjectPhase.order_index)
            .all()
        )

    @staticmethod
    def update_phase(db: Session, phase_id: int, payload: PhaseUpdate) -> ProjectPhase:
        obj = db.query(ProjectPhase).filter(ProjectPhase.id == phase_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Phase not found")
        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def delete_phase(db: Session, phase_id: int) -> None:
        obj = db.query(ProjectPhase).filter(ProjectPhase.id == phase_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Phase not found")
        db.delete(obj)
        db.commit()
