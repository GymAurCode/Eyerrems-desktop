"""Construction Management Module — SQLAlchemy Models"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float,
    ForeignKey, Integer, Numeric, String, Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class ConstructionProject(Base):
    __tablename__ = "construction_projects"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(255), nullable=False)
    location    = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=True)
    # planning | active | on_hold | completed | cancelled
    status       = Column(String(30), nullable=False, default="planning", index=True)
    total_budget = Column(Numeric(14, 2), nullable=False, default=0)
    # Town hierarchy links (optional — track construction at town/block level)
    town_id      = Column(Integer, ForeignKey("towns.id"), nullable=True, index=True)
    block_id     = Column(Integer, ForeignKey("blocks.id"), nullable=True, index=True)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    creator      = relationship("User", foreign_keys=[created_by])
    town         = relationship("Town", foreign_keys=[town_id])
    block        = relationship("Block", foreign_keys=[block_id])
    phases       = relationship("ProjectPhase",        back_populates="project", cascade="all, delete-orphan")
    budget       = relationship("ProjectBudget",       back_populates="project", uselist=False, cascade="all, delete-orphan")
    contractors  = relationship("ProjectContractor",   back_populates="project", cascade="all, delete-orphan")
    procurements = relationship("Procurement",         back_populates="project", cascade="all, delete-orphan")
    progress     = relationship("DailyProgress",       back_populates="project", cascade="all, delete-orphan")
    expenses     = relationship("ConstructionExpense", back_populates="project", cascade="all, delete-orphan")
    documents    = relationship("ConstructionDocument",back_populates="project", cascade="all, delete-orphan")


class ProjectPhase(Base):
    __tablename__ = "construction_phases"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=True)
    # pending | in_progress | completed
    status      = Column(String(30), nullable=False, default="pending")
    order_index = Column(Integer, nullable=False, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="phases")


class ProjectBudget(Base):
    __tablename__ = "construction_budgets"

    id             = Column(Integer, primary_key=True)
    project_id     = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, unique=True, index=True)
    material_cost  = Column(Numeric(14, 2), nullable=False, default=0)
    labor_cost     = Column(Numeric(14, 2), nullable=False, default=0)
    equipment_cost = Column(Numeric(14, 2), nullable=False, default=0)
    misc_cost      = Column(Numeric(14, 2), nullable=False, default=0)
    total_cost     = Column(Numeric(14, 2), nullable=False, default=0)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="budget")


class Contractor(Base):
    __tablename__ = "construction_contractors"

    id             = Column(Integer, primary_key=True)
    name           = Column(String(255), nullable=False)
    phone          = Column(String(50),  nullable=True)
    email          = Column(String(255), nullable=True)
    company        = Column(String(255), nullable=True)
    # fixed | hourly | per_unit | lump_sum
    contract_type  = Column(String(50),  nullable=False)
    rate           = Column(Numeric(12, 2), nullable=False, default=0)
    specialization = Column(String(255), nullable=True)
    is_active      = Column(Boolean, nullable=False, default=True)
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)

    assignments = relationship("ProjectContractor", back_populates="contractor")


class ProjectContractor(Base):
    __tablename__ = "construction_project_contractors"

    id             = Column(Integer, primary_key=True)
    project_id     = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    contractor_id  = Column(Integer, ForeignKey("construction_contractors.id"), nullable=False, index=True)
    role           = Column(String(255), nullable=True)
    start_date     = Column(Date, nullable=True)
    end_date       = Column(Date, nullable=True)
    contract_value = Column(Numeric(14, 2), nullable=True)
    # active | completed | terminated
    status     = Column(String(30), nullable=False, default="active")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project    = relationship("ConstructionProject", back_populates="contractors")
    contractor = relationship("Contractor", back_populates="assignments")


class Procurement(Base):
    __tablename__ = "construction_procurements"

    id           = Column(Integer, primary_key=True)
    project_id   = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    item_name    = Column(String(255), nullable=False)
    description  = Column(Text, nullable=True)
    quantity     = Column(Numeric(10, 2), nullable=False, default=1)
    unit         = Column(String(50),  nullable=True)
    unit_cost    = Column(Numeric(12, 2), nullable=False, default=0)
    cost         = Column(Numeric(14, 2), nullable=False, default=0)   # quantity * unit_cost
    vendor       = Column(String(255), nullable=True)
    # requested | approved | ordered | received | cancelled
    status       = Column(String(30), nullable=False, default="requested", index=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    approved_at  = Column(DateTime, nullable=True)
    received_at  = Column(DateTime, nullable=True)
    notes        = Column(Text, nullable=True)

    project   = relationship("ConstructionProject", back_populates="procurements")
    requester = relationship("User", foreign_keys=[requested_by])
    approver  = relationship("User", foreign_keys=[approved_by])


class DailyProgress(Base):
    __tablename__ = "construction_daily_progress"

    id                  = Column(Integer, primary_key=True)
    project_id          = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    phase_id            = Column(Integer, ForeignKey("construction_phases.id"), nullable=True)
    date                = Column(Date, nullable=False, index=True)
    work_done           = Column(Text, nullable=False)
    progress_percentage = Column(Float, nullable=False, default=0)
    workers_count       = Column(Integer, nullable=True)
    weather             = Column(String(100), nullable=True)
    issues              = Column(Text, nullable=True)
    reported_by         = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)

    project  = relationship("ConstructionProject", back_populates="progress")
    phase    = relationship("ProjectPhase")
    reporter = relationship("User", foreign_keys=[reported_by])


class ConstructionExpense(Base):
    """Links a construction cost to the finance module's Expense record (optional)."""
    __tablename__ = "construction_expenses"

    id           = Column(Integer, primary_key=True)
    project_id   = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    expense_id   = Column(Integer, ForeignKey("expenses.id"), nullable=True)   # finance link
    amount       = Column(Numeric(14, 2), nullable=False)
    # material | labor | equipment | procurement | misc
    expense_type = Column(String(50), nullable=False)
    description  = Column(String(500), nullable=False)
    reference_id = Column(String(100), nullable=True)
    date         = Column(Date, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    project         = relationship("ConstructionProject", back_populates="expenses")
    finance_expense = relationship("Expense", foreign_keys=[expense_id])


class ConstructionDocument(Base):
    __tablename__ = "construction_documents"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    file_url    = Column(String(1000), nullable=False)
    # blueprint | contract | permit | report | photo | other
    doc_type    = Column(String(100), nullable=False)
    file_size   = Column(Integer, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    project  = relationship("ConstructionProject", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by])
