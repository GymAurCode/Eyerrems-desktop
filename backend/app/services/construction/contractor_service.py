"""Contractor & project-contractor assignment service"""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.construction import Contractor, ProjectContractor
from app.schemas.construction import (
    ContractorCreate, ContractorUpdate,
    ProjectContractorCreate,
)


class ContractorService:

    # ── Contractor master ─────────────────────────────────────────────────────

    @staticmethod
    def create(db: Session, payload: ContractorCreate) -> Contractor:
        obj = Contractor(**payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def get_all(db: Session, active_only: bool = False) -> list[Contractor]:
        q = db.query(Contractor)
        if active_only:
            q = q.filter(Contractor.is_active.is_(True))
        return q.order_by(Contractor.name).all()

    @staticmethod
    def get_by_id(db: Session, contractor_id: int) -> Contractor:
        obj = db.query(Contractor).filter(Contractor.id == contractor_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Contractor not found")
        return obj

    @staticmethod
    def update(db: Session, contractor_id: int, payload: ContractorUpdate) -> Contractor:
        obj = ContractorService.get_by_id(db, contractor_id)
        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def delete(db: Session, contractor_id: int) -> None:
        obj = ContractorService.get_by_id(db, contractor_id)
        db.delete(obj)
        db.commit()

    # ── Project assignments ───────────────────────────────────────────────────

    @staticmethod
    def assign(db: Session, payload: ProjectContractorCreate) -> ProjectContractor:
        # prevent duplicate active assignment
        existing = db.query(ProjectContractor).filter(
            ProjectContractor.project_id    == payload.project_id,
            ProjectContractor.contractor_id == payload.contractor_id,
            ProjectContractor.status        == "active",
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Contractor already assigned to this project")
        obj = ProjectContractor(**payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return db.query(ProjectContractor).options(
            joinedload(ProjectContractor.contractor)
        ).filter(ProjectContractor.id == obj.id).first()

    @staticmethod
    def get_project_contractors(db: Session, project_id: int) -> list[ProjectContractor]:
        return (
            db.query(ProjectContractor)
            .options(joinedload(ProjectContractor.contractor))
            .filter(ProjectContractor.project_id == project_id)
            .all()
        )

    @staticmethod
    def remove_assignment(db: Session, assignment_id: int) -> None:
        obj = db.query(ProjectContractor).filter(ProjectContractor.id == assignment_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Assignment not found")
        db.delete(obj)
        db.commit()
