"""Construction Management Module — Complete ERP SQLAlchemy Models"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float,
    ForeignKey, Integer, Numeric, String, Table, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Lookup / Reference Tables ──────────────────────────────────────────────

class ConstructionResourceType(Base):
    __tablename__ = "con_resource_types"
    id   = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)  # Engineer, Excavator, Cement, etc.
    category = Column(String(30), nullable=False)  # human | equipment | material


class ConstructionUnit(Base):
    __tablename__ = "con_units"
    id   = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)  # kg, ton, piece, hour, day


# ── Construction Project ───────────────────────────────────────────────────

class ConstructionProject(Base):
    __tablename__ = "construction_projects"

    id              = Column(Integer, primary_key=True)
    name            = Column(String(255), nullable=False)
    project_code    = Column(String(50), unique=True, nullable=True, index=True)
    location        = Column(String(500), nullable=False)
    description     = Column(Text, nullable=True)

    # Workflow stage
    # planning | budget_approval | resource_planning | procurement |
    # execution | finance | quality_inspection | documents | reporting | completion | completed
    current_phase   = Column(String(50), nullable=False, default="planning", index=True)
    status          = Column(String(30), nullable=False, default="planning", index=True)

    start_date      = Column(Date, nullable=False)
    expected_end    = Column(Date, nullable=True)
    actual_end      = Column(Date, nullable=True)

    total_budget    = Column(Numeric(14, 2), nullable=False, default=0)

    town_id         = Column(Integer, ForeignKey("towns.id"), nullable=True, index=True)
    block_id        = Column(Integer, ForeignKey("blocks.id"), nullable=True, index=True)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    is_deleted      = Column(Boolean, nullable=False, default=False)
    deleted_at      = Column(DateTime, nullable=True)

    creator      = relationship("User", foreign_keys=[created_by])
    town         = relationship("Town", foreign_keys=[town_id])
    block        = relationship("Block", foreign_keys=[block_id])

    phases       = relationship("ProjectPhase",        back_populates="project", cascade="all, delete-orphan")
    budget       = relationship("ProjectBudget",       back_populates="project", uselist=False, cascade="all, delete-orphan")
    contractors  = relationship("ProjectContractor",   back_populates="project", cascade="all, delete-orphan")
    procurements = relationship("Procurement",         back_populates="project", cascade="all, delete-orphan")
    progress     = relationship("DailyProgress",       back_populates="project", cascade="all, delete-orphan")
    expenses     = relationship("ConstructionExpense", back_populates="project", cascade="all, delete-orphan")
    documents    = relationship("ConstructionDocument", back_populates="project", cascade="all, delete-orphan")
    tasks        = relationship("ConstructionTask",    back_populates="project", cascade="all, delete-orphan")
    inspections  = relationship("QualityInspection",   back_populates="project", cascade="all, delete-orphan")
    safety_items = relationship("SafetyIncident",      back_populates="project", cascade="all, delete-orphan")
    milestones   = relationship("ProjectMilestone",    back_populates="project", cascade="all, delete-orphan")
    notifications = relationship("ConstructionNotification", back_populates="project", cascade="all, delete-orphan")
    resource_allocations = relationship("ResourceAllocation", back_populates="project", cascade="all, delete-orphan")
    purchase_requests   = relationship("PurchaseRequest", back_populates="project", cascade="all, delete-orphan")
    purchase_orders     = relationship("PurchaseOrder",   back_populates="project", cascade="all, delete-orphan")
    goods_receipts      = relationship("GoodsReceiptNote", back_populates="project", cascade="all, delete-orphan")


# ── Project Phases & Tasks ─────────────────────────────────────────────────

class ProjectPhase(Base):
    __tablename__ = "construction_phases"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=True)
    status      = Column(String(30), nullable=False, default="pending")  # pending | in_progress | completed | delayed
    order_index = Column(Integer, nullable=False, default=0)
    progress_pct = Column(Float, nullable=False, default=0.0)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="phases")
    tasks   = relationship("ConstructionTask", back_populates="phase", cascade="all, delete-orphan")


class ConstructionTask(Base):
    __tablename__ = "construction_tasks"

    id                = Column(Integer, primary_key=True)
    project_id        = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    phase_id          = Column(Integer, ForeignKey("construction_phases.id"), nullable=False, index=True)
    task_number       = Column(String(50), nullable=True)
    name              = Column(String(255), nullable=False)
    description       = Column(Text, nullable=True)
    priority          = Column(String(20), nullable=False, default="medium")  # low | medium | high | critical
    status            = Column(String(30), nullable=False, default="pending")  # pending | in_progress | completed | delayed | paused

    estimated_cost    = Column(Numeric(14, 2), nullable=True)
    estimated_duration = Column(Integer, nullable=True)  # days
    start_date        = Column(Date, nullable=True)
    end_date          = Column(Date, nullable=True)
    actual_start_date = Column(Date, nullable=True)
    actual_end_date   = Column(Date, nullable=True)

    assigned_engineer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    risk_level        = Column(String(20), nullable=True)  # low | medium | high
    remarks           = Column(Text, nullable=True)
    progress_pct      = Column(Float, nullable=False, default=0.0)
    is_delayed        = Column(Boolean, nullable=False, default=False)
    delay_reason      = Column(Text, nullable=True)

    created_by        = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="tasks")
    phase   = relationship("ProjectPhase", back_populates="tasks")
    dependencies = relationship("TaskDependency", foreign_keys="TaskDependency.task_id", back_populates="task", cascade="all, delete-orphan")
    materials     = relationship("TaskMaterial",  back_populates="task", cascade="all, delete-orphan")

    assigned_engineer  = relationship("User", foreign_keys=[assigned_engineer_id])
    assigned_supervisor = relationship("User", foreign_keys=[assigned_supervisor_id])


class TaskDependency(Base):
    __tablename__ = "construction_task_dependencies"

    id              = Column(Integer, primary_key=True)
    task_id         = Column(Integer, ForeignKey("construction_tasks.id"), nullable=False, index=True)
    depends_on_task_id = Column(Integer, ForeignKey("construction_tasks.id"), nullable=False)
    dependency_type = Column(String(20), nullable=False, default="finish_to_start")  # finish_to_start | start_to_start | finish_to_finish

    task       = relationship("ConstructionTask", foreign_keys=[task_id], back_populates="dependencies")
    depends_on = relationship("ConstructionTask", foreign_keys=[depends_on_task_id])


class TaskMaterial(Base):
    __tablename__ = "construction_task_materials"

    id          = Column(Integer, primary_key=True)
    task_id     = Column(Integer, ForeignKey("construction_tasks.id"), nullable=False, index=True)
    material_id = Column(Integer, ForeignKey("con_resource_items.id"), nullable=True)
    name        = Column(String(255), nullable=False)
    quantity    = Column(Numeric(12, 2), nullable=False)
    unit        = Column(String(30), nullable=True)

    task     = relationship("ConstructionTask", back_populates="materials")
    material = relationship("ConResourceItem", foreign_keys=[material_id])


# ── Budget ─────────────────────────────────────────────────────────────────

class ProjectBudget(Base):
    __tablename__ = "construction_budgets"

    id               = Column(Integer, primary_key=True)
    project_id       = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, unique=True, index=True)
    status           = Column(String(30), nullable=False, default="draft")  # draft | submitted | approved | locked

    material_cost    = Column(Numeric(14, 2), nullable=False, default=0)
    labor_cost       = Column(Numeric(14, 2), nullable=False, default=0)
    equipment_cost   = Column(Numeric(14, 2), nullable=False, default=0)
    machinery_cost   = Column(Numeric(14, 2), nullable=False, default=0)
    contractor_cost  = Column(Numeric(14, 2), nullable=False, default=0)
    utility_cost     = Column(Numeric(14, 2), nullable=False, default=0)
    transport_cost   = Column(Numeric(14, 2), nullable=False, default=0)
    permit_fees      = Column(Numeric(14, 2), nullable=False, default=0)
    govt_charges     = Column(Numeric(14, 2), nullable=False, default=0)
    misc_cost        = Column(Numeric(14, 2), nullable=False, default=0)
    total_cost       = Column(Numeric(14, 2), nullable=False, default=0)

    approved_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at      = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="budget")


# ── Resources ──────────────────────────────────────────────────────────────

class ConResourceItem(Base):
    """Master list of all resources: humans, equipment, materials."""
    __tablename__ = "con_resource_items"

    id              = Column(Integer, primary_key=True)
    type            = Column(String(30), nullable=False)  # human | equipment | material
    name            = Column(String(255), nullable=False)
    code            = Column(String(50), nullable=True)
    description     = Column(Text, nullable=True)
    unit            = Column(String(30), nullable=True)  # for materials: kg, ton, piece
    unit_cost       = Column(Numeric(12, 2), nullable=True)
    category        = Column(String(100), nullable=True)  # e.g. Engineer, Excavator, Cement

    # Availability
    availability    = Column(String(30), nullable=False, default="available")
    # available | allocated | under_maintenance | reserved | unavailable

    min_stock_level = Column(Numeric(12, 2), nullable=True)  # for materials
    current_stock   = Column(Numeric(12, 2), nullable=True, default=0)
    reorder_point   = Column(Numeric(12, 2), nullable=True)

    is_active       = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    allocations     = relationship("ResourceAllocation", back_populates="resource")


class ResourceAllocation(Base):
    __tablename__ = "con_resource_allocations"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("con_resource_items.id"), nullable=False)
    task_id     = Column(Integer, ForeignKey("construction_tasks.id"), nullable=True)
    quantity    = Column(Numeric(12, 2), nullable=False, default=1)
    start_date  = Column(Date, nullable=True)
    end_date    = Column(Date, nullable=True)
    status      = Column(String(30), nullable=False, default="allocated")
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    project  = relationship("ConstructionProject", back_populates="resource_allocations")
    resource = relationship("ConResourceItem", back_populates="allocations")
    task     = relationship("ConstructionTask")


class ResourceUsageLog(Base):
    """Daily log of resource usage on site."""
    __tablename__ = "con_resource_usage_logs"

    id                 = Column(Integer, primary_key=True)
    project_id         = Column(Integer, ForeignKey("construction_projects.id"), nullable=False)
    resource_id        = Column(Integer, ForeignKey("con_resource_items.id"), nullable=False)
    date               = Column(Date, nullable=False)
    quantity_used      = Column(Numeric(12, 2), nullable=False, default=0)
    quantity_consumed  = Column(Numeric(12, 2), nullable=True)  # for materials
    notes              = Column(Text, nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── Procurement / Purchasing ───────────────────────────────────────────────

class PurchaseRequest(Base):
    __tablename__ = "con_purchase_requests"

    id           = Column(Integer, primary_key=True)
    project_id   = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    pr_number    = Column(String(50), unique=True, nullable=True)
    title        = Column(String(255), nullable=False)
    description  = Column(Text, nullable=True)
    status       = Column(String(30), nullable=False, default="draft")  # draft | submitted | approved | rejected | ordered
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    approved_at  = Column(DateTime, nullable=True)
    notes        = Column(Text, nullable=True)
    total_amount = Column(Numeric(14, 2), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    project   = relationship("ConstructionProject", back_populates="purchase_requests")
    requester = relationship("User", foreign_keys=[requested_by])
    approver  = relationship("User", foreign_keys=[approved_by])
    items     = relationship("PurchaseRequestItem", back_populates="request", cascade="all, delete-orphan")


class PurchaseRequestItem(Base):
    __tablename__ = "con_purchase_request_items"

    id          = Column(Integer, primary_key=True)
    request_id  = Column(Integer, ForeignKey("con_purchase_requests.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("con_resource_items.id"), nullable=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    quantity    = Column(Numeric(12, 2), nullable=False)
    unit        = Column(String(30), nullable=True)
    estimated_cost = Column(Numeric(12, 2), nullable=True)
    total_cost  = Column(Numeric(14, 2), nullable=True)

    request  = relationship("PurchaseRequest", back_populates="items")
    material = relationship("ConResourceItem", foreign_keys=[material_id])


class PurchaseOrder(Base):
    __tablename__ = "con_purchase_orders"

    id              = Column(Integer, primary_key=True)
    project_id      = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    po_number       = Column(String(50), unique=True, nullable=True)
    request_id      = Column(Integer, ForeignKey("con_purchase_requests.id"), nullable=True)
    vendor_id       = Column(Integer, ForeignKey("con_vendors.id"), nullable=True)
    vendor_name     = Column(String(255), nullable=True)
    title           = Column(String(255), nullable=False)
    status          = Column(String(30), nullable=False, default="draft")  # draft | sent | confirmed | delivered | cancelled
    order_date      = Column(Date, nullable=True)
    delivery_date   = Column(Date, nullable=True)
    delivery_address = Column(Text, nullable=True)
    terms           = Column(Text, nullable=True)
    subtotal        = Column(Numeric(14, 2), nullable=True)
    tax_amount      = Column(Numeric(14, 2), nullable=True)
    total_amount    = Column(Numeric(14, 2), nullable=True)
    notes           = Column(Text, nullable=True)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    project     = relationship("ConstructionProject", back_populates="purchase_orders")
    request     = relationship("PurchaseRequest")
    vendor      = relationship("ConVendor", foreign_keys=[vendor_id])
    items       = relationship("PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")
    goods_receipts = relationship("GoodsReceiptNote", back_populates="purchase_order")


class PurchaseOrderItem(Base):
    __tablename__ = "con_purchase_order_items"

    id           = Column(Integer, primary_key=True)
    order_id     = Column(Integer, ForeignKey("con_purchase_orders.id"), nullable=False)
    material_id  = Column(Integer, ForeignKey("con_resource_items.id"), nullable=True)
    name         = Column(String(255), nullable=False)
    quantity     = Column(Numeric(12, 2), nullable=False)
    unit         = Column(String(30), nullable=True)
    unit_price   = Column(Numeric(12, 2), nullable=True)
    total_price  = Column(Numeric(14, 2), nullable=True)
    received_qty = Column(Numeric(12, 2), nullable=True, default=0)

    order    = relationship("PurchaseOrder", back_populates="items")
    material = relationship("ConResourceItem", foreign_keys=[material_id])


class GoodsReceiptNote(Base):
    __tablename__ = "con_goods_receipt_notes"

    id               = Column(Integer, primary_key=True)
    project_id       = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    grn_number       = Column(String(50), unique=True, nullable=True)
    po_id            = Column(Integer, ForeignKey("con_purchase_orders.id"), nullable=True)
    received_date    = Column(Date, nullable=False)
    received_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    vendor_name      = Column(String(255), nullable=True)
    notes            = Column(Text, nullable=True)
    status           = Column(String(30), nullable=False, default="received")  # received | partially_received | rejected
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)

    project        = relationship("ConstructionProject", back_populates="goods_receipts")
    purchase_order = relationship("PurchaseOrder", back_populates="goods_receipts")
    items          = relationship("GRNItem", back_populates="grn", cascade="all, delete-orphan")


class GRNItem(Base):
    __tablename__ = "con_grn_items"

    id          = Column(Integer, primary_key=True)
    grn_id      = Column(Integer, ForeignKey("con_goods_receipt_notes.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("con_resource_items.id"), nullable=True)
    name        = Column(String(255), nullable=False)
    quantity    = Column(Numeric(12, 2), nullable=False)
    unit        = Column(String(30), nullable=True)
    unit_price  = Column(Numeric(12, 2), nullable=True)
    total_price = Column(Numeric(14, 2), nullable=True)
    condition   = Column(String(50), nullable=True)  # good | damaged | partial

    grn      = relationship("GoodsReceiptNote", back_populates="items")
    material = relationship("ConResourceItem", foreign_keys=[material_id])


# ── Vendors / Suppliers ────────────────────────────────────────────────────

class ConVendor(Base):
    __tablename__ = "con_vendors"

    id               = Column(Integer, primary_key=True)
    name             = Column(String(255), nullable=False)
    contact_person   = Column(String(255), nullable=True)
    phone            = Column(String(50), nullable=True)
    email            = Column(String(255), nullable=True)
    address          = Column(Text, nullable=True)
    payment_terms    = Column(String(255), nullable=True)
    performance_rating = Column(Integer, nullable=True)  # 1-5
    is_active        = Column(Boolean, nullable=False, default=True)
    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── Contractors ────────────────────────────────────────────────────────────

class Contractor(Base):
    __tablename__ = "construction_contractors"

    id             = Column(Integer, primary_key=True)
    name           = Column(String(255), nullable=False)
    phone          = Column(String(50), nullable=True)
    email          = Column(String(255), nullable=True)
    company        = Column(String(255), nullable=True)
    contract_type  = Column(String(50), nullable=False)
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
    status         = Column(String(30), nullable=False, default="active")
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)

    project    = relationship("ConstructionProject", back_populates="contractors")
    contractor = relationship("Contractor", back_populates="assignments")


# ── Legacy Procurement (keep for backward compatibility) ───────────────────

class Procurement(Base):
    __tablename__ = "construction_procurements"

    id           = Column(Integer, primary_key=True)
    project_id   = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    item_name    = Column(String(255), nullable=False)
    description  = Column(Text, nullable=True)
    quantity     = Column(Numeric(10, 2), nullable=False, default=1)
    unit         = Column(String(50), nullable=True)
    unit_cost    = Column(Numeric(12, 2), nullable=False, default=0)
    cost         = Column(Numeric(14, 2), nullable=False, default=0)
    vendor       = Column(String(255), nullable=True)
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


# ── Execution / Daily Progress ─────────────────────────────────────────────

class DailyProgress(Base):
    __tablename__ = "construction_daily_progress"

    id                  = Column(Integer, primary_key=True)
    project_id          = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    phase_id            = Column(Integer, ForeignKey("construction_phases.id"), nullable=True)
    task_id             = Column(Integer, ForeignKey("construction_tasks.id"), nullable=True)
    date                = Column(Date, nullable=False, index=True)
    work_done           = Column(Text, nullable=False)
    progress_percentage = Column(Float, nullable=False, default=0)
    workers_count       = Column(Integer, nullable=True)
    weather             = Column(String(100), nullable=True)
    issues              = Column(Text, nullable=True)
    accidents           = Column(Text, nullable=True)
    delay_reasons       = Column(Text, nullable=True)
    site_notes          = Column(Text, nullable=True)
    reported_by         = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)

    project  = relationship("ConstructionProject", back_populates="progress")
    phase    = relationship("ProjectPhase")
    reporter = relationship("User", foreign_keys=[reported_by])


# ── Expenses / Finance ─────────────────────────────────────────────────────

class ConstructionExpense(Base):
    __tablename__ = "construction_expenses"

    id           = Column(Integer, primary_key=True)
    project_id   = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    expense_id   = Column(Integer, ForeignKey("expenses.id"), nullable=True)
    amount       = Column(Numeric(14, 2), nullable=False)
    expense_type = Column(String(50), nullable=False)
    # material | labor | equipment | machinery | contractor | utility | transport | permit | govt | misc
    description  = Column(String(500), nullable=False)
    reference_id = Column(String(100), nullable=True)
    date         = Column(Date, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    project         = relationship("ConstructionProject", back_populates="expenses")
    finance_expense = relationship("Expense", foreign_keys=[expense_id])


class VendorPayment(Base):
    __tablename__ = "con_vendor_payments"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False)
    vendor_id   = Column(Integer, ForeignKey("con_vendors.id"), nullable=True)
    vendor_name = Column(String(255), nullable=True)
    amount      = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(String(30), nullable=True)
    reference   = Column(String(100), nullable=True)
    notes       = Column(Text, nullable=True)
    status      = Column(String(30), nullable=False, default="pending")  # pending | paid | cancelled
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── Quality Inspection ─────────────────────────────────────────────────────

class QualityInspection(Base):
    __tablename__ = "con_quality_inspections"

    id            = Column(Integer, primary_key=True)
    project_id    = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    phase_id      = Column(Integer, ForeignKey("construction_phases.id"), nullable=True)
    task_id       = Column(Integer, ForeignKey("construction_tasks.id"), nullable=True)
    inspection_type = Column(String(100), nullable=False)
    # Foundation | Concrete | Steel | Electrical | Plumbing | Final
    inspector_name = Column(String(255), nullable=True)
    inspector_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    inspection_date = Column(Date, nullable=False)
    checklist      = Column(Text, nullable=True)
    result         = Column(String(30), nullable=False, default="pending")
    # passed | failed | rework_required | pending
    remarks        = Column(Text, nullable=True)
    photos         = Column(Text, nullable=True)  # JSON array of URLs
    status         = Column(String(30), nullable=False, default="pending")
    # pending | in_progress | completed
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="inspections")
    phase   = relationship("ProjectPhase")
    task    = relationship("ConstructionTask")


class InspectionChecklistItem(Base):
    __tablename__ = "con_inspection_checklist_items"

    id             = Column(Integer, primary_key=True)
    inspection_id  = Column(Integer, ForeignKey("con_quality_inspections.id"), nullable=False)
    item_name      = Column(String(255), nullable=False)
    is_checked     = Column(Boolean, nullable=False, default=False)
    remarks        = Column(Text, nullable=True)


# ── Safety ─────────────────────────────────────────────────────────────────

class SafetyIncident(Base):
    __tablename__ = "con_safety_incidents"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    incident_type = Column(String(50), nullable=False)
    # safety_meeting | incident | near_miss | accident | violation | ppe_compliance
    title       = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    incident_date = Column(Date, nullable=False)
    severity    = Column(String(20), nullable=True)  # low | medium | high | critical
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    location    = Column(String(255), nullable=True)
    affected_persons = Column(Integer, nullable=True)
    corrective_action = Column(Text, nullable=True)
    status      = Column(String(30), nullable=False, default="open")  # open | investigating | resolved | closed
    closed_at   = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="safety_items")


# ── Documents ──────────────────────────────────────────────────────────────

class ConstructionDocument(Base):
    __tablename__ = "construction_documents"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    folder      = Column(String(100), nullable=True)
    # Legal | Engineering | Architecture | Structural | Electrical
    # Plumbing | Contracts | Invoices | Government | Certificates | Inspection | Photos | Videos | Blueprints | Other
    name        = Column(String(255), nullable=False)
    file_url    = Column(String(1000), nullable=False)
    doc_type    = Column(String(100), nullable=False)
    file_size   = Column(Integer, nullable=True)
    version     = Column(Integer, nullable=False, default=1)
    tags        = Column(Text, nullable=True)  # JSON array
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    project  = relationship("ConstructionProject", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by])


# ── Milestones / Timeline ──────────────────────────────────────────────────

class ProjectMilestone(Base):
    __tablename__ = "con_project_milestones"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    milestone_type = Column(String(50), nullable=False)
    # planning | budget | procurement | execution | inspection | completion
    target_date = Column(Date, nullable=True)
    completed_date = Column(Date, nullable=True)
    status      = Column(String(30), nullable=False, default="upcoming")
    # upcoming | in_progress | completed | delayed
    order_index = Column(Integer, nullable=False, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="milestones")


# ── Notifications ──────────────────────────────────────────────────────────

class ConstructionNotification(Base):
    __tablename__ = "con_notifications"

    id          = Column(Integer, primary_key=True)
    project_id  = Column(Integer, ForeignKey("construction_projects.id"), nullable=False, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    title       = Column(String(255), nullable=False)
    message     = Column(Text, nullable=True)
    notification_type = Column(String(50), nullable=False)
    # task_assigned | task_completed | task_delayed | budget_exceeded |
    # purchase_approval | material_delivered | inspection_failed |
    # payment_due | project_completed | milestone_reached
    reference_type = Column(String(50), nullable=True)
    reference_id   = Column(Integer, nullable=True)
    is_read     = Column(Boolean, nullable=False, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("ConstructionProject", back_populates="notifications")


# ── Activity Log (extends existing ActivityLog table) ─────────────────────
# Using the existing ActivityLog model from app.models.rbac
