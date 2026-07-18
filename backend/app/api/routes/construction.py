"""Construction Module — Complete ERP API Routes"""
import os
import uuid
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Optional

from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func as safunc
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.core.audit import log_action
from app.core.activity_logger import log_activity
from app.core.config import settings
from app.core.database import get_db
from app.models.auth import User
from app.models.rbac import ActivityLog
from app.models.construction import (
    ConResourceItem, ConstructionDocument, ConstructionExpense, ConstructionNotification,
    ConstructionProject, ConstructionTask, Contractor, DailyProgress, GoodsReceiptNote,
    GRNItem, Procurement, ProjectBudget, ProjectContractor, ProjectMilestone,
    ProjectPhase, PurchaseOrder, PurchaseOrderItem, PurchaseRequest, PurchaseRequestItem,
    QualityInspection, ResourceAllocation, ResourceUsageLog, SafetyIncident,
    TaskDependency, TaskMaterial, ConVendor, VendorPayment,
)
from app.schemas.construction import (
    BudgetCreate, BudgetResponse, BudgetStatusUpdate, BudgetUpdate,
    BudgetVsActual, ContractorCreate, ContractorResponse, ContractorUpdate,
    ConstructionExpenseCreate, ConstructionExpenseResponse, ConstructionExpenseUpdate,
    DailyProgressCreate, DailyProgressResponse, DailyProgressUpdate,
    DashboardStatsResponse, DocumentResponse,
    GoodsReceiptCreate, GoodsReceiptResponse, GRNItemCreate,
    MilestoneCreate, MilestoneResponse, MilestoneUpdate,
    NotificationResponse,
    PhaseCreate, PhaseResponse, PhaseUpdate,
    ProcurementCreate, ProcurementResponse, ProcurementStatusUpdate, ProcurementUpdate,
    ProjectCompletionCheck, ProjectContractorCreate, ProjectContractorResponse,
    ProjectCreate, ProjectReportResponse, ProjectResponse, ProjectSummary, ProjectUpdate,
    PropertyConversionRequest,
    PurchaseOrderCreate, PurchaseOrderResponse,
    PurchaseRequestCreate, PurchaseRequestResponse,
    QualityInspectionCreate, QualityInspectionResponse, QualityInspectionUpdate,
    ResourceAllocationCreate, ResourceAllocationResponse,
    ResourceItemCreate, ResourceItemResponse, ResourceItemUpdate,
    SafetyIncidentCreate, SafetyIncidentResponse, SafetyIncidentUpdate,
    TaskCreate, TaskDependencyCreate, TaskDependencyResponse,
    TaskDetailResponse, TaskResponse, TaskUpdate,
    VendorCreate, VendorResponse,
    VendorPaymentCreate, VendorPaymentResponse,
)

router = APIRouter()

_admin_manager = require_roles("Admin", "Manager")
_all_staff = require_roles("Admin", "Manager", "Staff", "Accountant", "Dealer")


# ════════════════════════════════════════════════════════════════════════════
# HELPER
# ════════════════════════════════════════════════════════════════════════════

def _log_construction(db, user, action, record_type, record_id, record_label, old_values=None, new_values=None):
    log_action(db=db, module="construction", action=action, record_id=str(record_id),
               record_label=record_label, changed_by=user.email,
               changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
               old_data=old_values, new_data=new_values)
    log_activity(db=db, user=user, action=action.lower(), module="construction",
                 record_type=record_type, record_id=record_id, record_label=record_label,
                 old_values=old_values, new_values=new_values)


def _create_notification(db, project_id, user_id, title, message, ntype, ref_type=None, ref_id=None):
    n = ConstructionNotification(project_id=project_id, user_id=user_id, title=title,
                                  message=message, notification_type=ntype,
                                  reference_type=ref_type, reference_id=ref_id)
    db.add(n)
    db.flush()
    return n


def _calc_task_progress(db, project_id):
    tasks = db.query(ConstructionTask).filter(ConstructionTask.project_id == project_id).all()
    if not tasks:
        return 0.0
    return sum(t.progress_pct for t in tasks) / len(tasks)


def _calc_phase_progress(db, project_id):
    phases = db.query(ProjectPhase).filter(ProjectPhase.project_id == project_id).all()
    if not phases:
        return 0.0
    return sum(p.progress_pct for p in phases) / len(phases)


def _calc_project_progress(db, project_id):
    task_avg = _calc_task_progress(db, project_id)
    phase_avg = _calc_phase_progress(db, project_id)
    return (task_avg * 0.6) + (phase_avg * 0.4)


def _check_dependencies_met(db, task_id):
    deps = db.query(TaskDependency).filter(TaskDependency.task_id == task_id).all()
    for dep in deps:
        t = db.query(ConstructionTask).filter(ConstructionTask.id == dep.depends_on_task_id).first()
        if t and t.status != "completed":
            return False
    return True


# ════════════════════════════════════════════════════════════════════════════
# PROJECTS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(_admin_manager)):
    if not payload.project_code:
        count = db.query(ConstructionProject).count()
        payload.project_code = f"PRJ-{count + 1:04d}"
    project = ConstructionProject(**payload.model_dump(), created_by=user.id)
    db.add(project)
    db.flush()
    ms = ProjectMilestone(project_id=project.id, name="Planning Phase", milestone_type="planning",
                           status="in_progress", order_index=0)
    db.add(ms)
    for i, (mtype, mname) in enumerate([("planning", "Planning"), ("budget", "Budget Approval"),
                                         ("procurement", "Procurement"), ("execution", "Execution"),
                                         ("inspection", "Quality Inspection"), ("completion", "Completion")], 1):
        db.add(ProjectMilestone(project_id=project.id, name=f"{mname} Phase", milestone_type=mtype, status="upcoming", order_index=i))
    db.commit()
    db.refresh(project)
    _log_construction(db, user, "CREATE", "project", project.id, f"Project: {project.name}", new_values={"name": project.name})
    return project


@router.get("/projects", response_model=list[ProjectSummary])
def list_projects(status: Optional[str] = Query(None), current_phase: Optional[str] = Query(None),
                  db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    q = db.query(ConstructionProject).filter(ConstructionProject.is_deleted == False)
    if status:
        q = q.filter(ConstructionProject.status == status)
    if current_phase:
        q = q.filter(ConstructionProject.current_phase == current_phase)
    projects = q.order_by(ConstructionProject.created_at.desc()).all()
    result = []
    for p in projects:
        tasks = db.query(ConstructionTask).filter(ConstructionTask.project_id == p.id).all()
        task_count = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == "completed")
        delayed_tasks = sum(1 for t in tasks if t.is_delayed)
        actual = sum((e.amount for e in db.query(ConstructionExpense).filter(ConstructionExpense.project_id == p.id).all()), Decimal("0"))
        latest_prog = _calc_project_progress(db, p.id)
        result.append(ProjectSummary(
            **{c.name: getattr(p, c.name) for c in p.__table__.columns},
            actual_cost=actual, progress_percentage=latest_prog,
            phase_count=len(p.phases), contractor_count=len(p.contractors),
            task_count=task_count, completed_tasks=completed_tasks,
            delayed_tasks=delayed_tasks,
        ))
    return result


@router.get("/projects/{project_id}", response_model=ProjectSummary)
def get_project(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    p = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = db.query(ConstructionTask).filter(ConstructionTask.project_id == p.id).all()
    actual = sum((e.amount for e in db.query(ConstructionExpense).filter(ConstructionExpense.project_id == p.id).all()), Decimal("0"))
    latest_prog = _calc_project_progress(db, p.id)
    return ProjectSummary(
        **{c.name: getattr(p, c.name) for c in p.__table__.columns},
        actual_cost=actual, progress_percentage=latest_prog,
        phase_count=len(p.phases), contractor_count=len(p.contractors),
        task_count=len(tasks), completed_tasks=sum(1 for t in tasks if t.status == "completed"),
        delayed_tasks=sum(1 for t in tasks if t.is_delayed),
    )


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db),
                   current_user: User = Depends(_admin_manager)):
    p = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    old = {c.name: str(getattr(p, c.name)) for c in p.__table__.columns}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    new = {c.name: str(getattr(p, c.name)) for c in p.__table__.columns}
    _log_construction(db, current_user, "UPDATE", "project", project_id, f"Project: {p.name}", old, new)
    return p


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("Admin"))):
    p = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    p.is_deleted = True
    p.deleted_at = datetime.utcnow()
    db.commit()
    _log_construction(db, current_user, "DELETE", "project", project_id, f"Project: {p.name}")


# ── Project child resources ────────────────────────────────────────────────

@router.get("/projects/{project_id}/phases", response_model=list[PhaseResponse])
def list_project_phases(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(ProjectPhase).filter(ProjectPhase.project_id == project_id).order_by(ProjectPhase.order_index).all()


@router.get("/projects/{project_id}/tasks", response_model=list[TaskDetailResponse])
def list_project_tasks(project_id: int, phase_id: Optional[int] = Query(None),
                       db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    q = db.query(ConstructionTask).filter(ConstructionTask.project_id == project_id)
    if phase_id:
        q = q.filter(ConstructionTask.phase_id == phase_id)
    tasks = q.order_by(ConstructionTask.created_at.desc()).all()
    result = []
    for t in tasks:
        deps = db.query(TaskDependency).filter(TaskDependency.task_id == t.id).all()
        deps_data = [{"id": d.id, "depends_on_task_id": d.depends_on_task_id, "dependency_type": d.dependency_type} for d in deps]
        phase = db.query(ProjectPhase).filter(ProjectPhase.id == t.phase_id).first()
        phase_name = phase.name if phase else None
        r = TaskDetailResponse(**{c.name: getattr(t, c.name) for c in t.__table__.columns},
                                phase_name=phase_name, dependencies=deps_data)
        result.append(r)
    return result


@router.get("/projects/{project_id}/budget", response_model=BudgetResponse)
def get_project_budget(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    b = db.query(ProjectBudget).filter(ProjectBudget.project_id == project_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    return b


@router.get("/projects/{project_id}/contractors", response_model=list[ProjectContractorResponse])
def list_project_contractors(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(ProjectContractor).options(joinedload(ProjectContractor.contractor)).filter(
        ProjectContractor.project_id == project_id).all()


@router.get("/projects/{project_id}/procurement", response_model=list[ProcurementResponse])
def list_project_procurement(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(Procurement).filter(Procurement.project_id == project_id).order_by(Procurement.requested_at.desc()).all()


@router.get("/projects/{project_id}/progress", response_model=list[DailyProgressResponse])
def list_project_progress(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(DailyProgress).filter(DailyProgress.project_id == project_id).order_by(DailyProgress.date.desc()).all()


@router.get("/projects/{project_id}/expenses", response_model=list[ConstructionExpenseResponse])
def list_project_expenses(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(ConstructionExpense).filter(ConstructionExpense.project_id == project_id).order_by(ConstructionExpense.date.desc()).all()


@router.get("/projects/{project_id}/documents", response_model=list[DocumentResponse])
def list_project_documents(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(ConstructionDocument).filter(ConstructionDocument.project_id == project_id).order_by(ConstructionDocument.created_at.desc()).all()


@router.get("/projects/{project_id}/inspections", response_model=list[QualityInspectionResponse])
def list_project_inspections(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(QualityInspection).filter(QualityInspection.project_id == project_id).order_by(QualityInspection.inspection_date.desc()).all()


@router.get("/projects/{project_id}/safety", response_model=list[SafetyIncidentResponse])
def list_project_safety(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(SafetyIncident).filter(SafetyIncident.project_id == project_id).order_by(SafetyIncident.incident_date.desc()).all()


@router.get("/projects/{project_id}/milestones", response_model=list[MilestoneResponse])
def list_project_milestones(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project_id).order_by(ProjectMilestone.order_index).all()


@router.get("/projects/{project_id}/notifications", response_model=list[NotificationResponse])
def list_project_notifications(project_id: int, unread_only: bool = Query(False),
                                db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    q = db.query(ConstructionNotification).filter(ConstructionNotification.project_id == project_id)
    if unread_only:
        q = q.filter(ConstructionNotification.is_read == False)
    return q.order_by(ConstructionNotification.created_at.desc()).all()


@router.get("/projects/{project_id}/resources", response_model=list[ResourceAllocationResponse])
def list_project_resources(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(ResourceAllocation).filter(ResourceAllocation.project_id == project_id).all()


@router.get("/projects/{project_id}/purchase-requests", response_model=list[PurchaseRequestResponse])
def list_purchase_requests(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(PurchaseRequest).filter(PurchaseRequest.project_id == project_id).order_by(PurchaseRequest.created_at.desc()).all()


@router.get("/projects/{project_id}/purchase-orders", response_model=list[PurchaseOrderResponse])
def list_purchase_orders(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(PurchaseOrder).filter(PurchaseOrder.project_id == project_id).order_by(PurchaseOrder.created_at.desc()).all()


@router.get("/projects/{project_id}/goods-receipts", response_model=list[GoodsReceiptResponse])
def list_goods_receipts(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(GoodsReceiptNote).filter(GoodsReceiptNote.project_id == project_id).order_by(GoodsReceiptNote.created_at.desc()).all()


@router.get("/projects/{project_id}/vendor-payments", response_model=list[VendorPaymentResponse])
def list_vendor_payments(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(VendorPayment).filter(VendorPayment.project_id == project_id).order_by(VendorPayment.payment_date.desc()).all()


@router.get("/projects/{project_id}/report", response_model=ProjectReportResponse)
def get_project_report(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    p = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    budget = db.query(ProjectBudget).filter(ProjectBudget.project_id == project_id).first()
    b_mat = b_lab = b_eqp = b_mch = b_con = b_utl = b_trn = b_prm = b_gov = b_misc = Decimal("0")
    if budget:
        b_mat = budget.material_cost; b_lab = budget.labor_cost; b_eqp = budget.equipment_cost
        b_mch = budget.machinery_cost; b_con = budget.contractor_cost; b_utl = budget.utility_cost
        b_trn = budget.transport_cost; b_prm = budget.permit_fees; b_gov = budget.govt_charges; b_misc = budget.misc_cost
    expenses = db.query(ConstructionExpense).filter(ConstructionExpense.project_id == project_id).all()
    a_mat = sum((e.amount for e in expenses if e.expense_type == "material"), Decimal("0"))
    a_lab = sum((e.amount for e in expenses if e.expense_type == "labor"), Decimal("0"))
    a_eqp = sum((e.amount for e in expenses if e.expense_type == "equipment"), Decimal("0"))
    a_mch = sum((e.amount for e in expenses if e.expense_type == "machinery"), Decimal("0"))
    a_con = sum((e.amount for e in expenses if e.expense_type == "contractor"), Decimal("0"))
    a_utl = sum((e.amount for e in expenses if e.expense_type == "utility"), Decimal("0"))
    a_trn = sum((e.amount for e in expenses if e.expense_type == "transport"), Decimal("0"))
    a_prm = sum((e.amount for e in expenses if e.expense_type == "permit"), Decimal("0"))
    a_gov = sum((e.amount for e in expenses if e.expense_type == "govt"), Decimal("0"))
    a_misc = sum((e.amount for e in expenses if e.expense_type in ("misc", "procurement")), Decimal("0"))
    actual_total = sum((e.amount for e in expenses), Decimal("0"))
    total_budget = Decimal(str(p.total_budget))
    variance = total_budget - actual_total
    variance_pct = float(variance / total_budget * 100) if total_budget else 0.0
    procurements = db.query(Procurement).filter(Procurement.project_id == project_id).all()
    proc_total = sum((pr.cost for pr in procurements), Decimal("0"))
    proc_received = sum((pr.cost for pr in procurements if pr.status == "received"), Decimal("0"))
    proc_by_status = {}
    for pr in procurements:
        proc_by_status[pr.status] = proc_by_status.get(pr.status, 0) + 1
    latest_progress = _calc_project_progress(db, project_id)
    recent_progress = db.query(DailyProgress).filter(DailyProgress.project_id == project_id).order_by(
        DailyProgress.date.desc()).limit(10).all()
    expense_by_type = {}
    for e in expenses:
        expense_by_type[e.expense_type] = expense_by_type.get(e.expense_type, 0.0) + float(e.amount)
    bva = BudgetVsActual(project_id=project_id, project_name=p.name, total_budget=total_budget,
                          budgeted_material=b_mat, budgeted_labor=b_lab, budgeted_equipment=b_eqp,
                          budgeted_machinery=b_mch, budgeted_contractor=b_con, budgeted_utility=b_utl,
                          budgeted_transport=b_trn, budgeted_permit=b_prm, budgeted_govt=b_gov,
                          budgeted_misc=b_misc, actual_material=a_mat, actual_labor=a_lab,
                          actual_equipment=a_eqp, actual_machinery=a_mch, actual_contractor=a_con,
                          actual_utility=a_utl, actual_transport=a_trn, actual_permit=a_prm,
                          actual_govt=a_gov, actual_misc=a_misc, actual_total=actual_total,
                          variance=variance, variance_pct=variance_pct, latest_progress=latest_progress,
                          procurement_total=proc_total, procurement_received=proc_received)
    phases = db.query(ProjectPhase).filter(ProjectPhase.project_id == project_id).order_by(ProjectPhase.order_index).all()
    tasks = db.query(ConstructionTask).filter(ConstructionTask.project_id == project_id).all()
    contractors = db.query(ProjectContractor).options(joinedload(ProjectContractor.contractor)).filter(
        ProjectContractor.project_id == project_id).all()
    inspections = db.query(QualityInspection).filter(QualityInspection.project_id == project_id).all()
    safety_items = db.query(SafetyIncident).filter(SafetyIncident.project_id == project_id).all()
    milestones = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project_id).order_by(ProjectMilestone.order_index).all()
    return ProjectReportResponse(project=p, budget=budget, budget_vs_actual=bva, phases=phases,
                                  tasks=tasks, contractors=contractors, recent_progress=recent_progress,
                                  procurement_summary={"by_status": proc_by_status, "total": float(proc_total)},
                                  expense_by_type=expense_by_type, inspections=inspections,
                                  safety_items=safety_items, milestones=milestones)


@router.get("/projects/{project_id}/completion-check", response_model=ProjectCompletionCheck)
def check_completion(project_id: int, db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    tasks = db.query(ConstructionTask).filter(ConstructionTask.project_id == project_id).all()
    tasks_completed = len(tasks) > 0 and all(t.status == "completed" for t in tasks)
    inspections = db.query(QualityInspection).filter(QualityInspection.project_id == project_id).all()
    inspections_passed = len(inspections) > 0 and all(i.result == "passed" for i in inspections)
    pending_orders = db.query(PurchaseOrder).filter(PurchaseOrder.project_id == project_id,
                                                     PurchaseOrder.status.notin_(["delivered", "cancelled"])).count()
    pending_payments = db.query(VendorPayment).filter(VendorPayment.project_id == project_id,
                                                       VendorPayment.status == "pending").count()
    quality_issues = db.query(QualityInspection).filter(QualityInspection.project_id == project_id,
                                                        QualityInspection.result.in_(["failed", "rework_required"])).count()
    safety_issues = db.query(SafetyIncident).filter(SafetyIncident.project_id == project_id,
                                                     SafetyIncident.status.in_(["open", "investigating"])).count()
    docs = db.query(ConstructionDocument).filter(ConstructionDocument.project_id == project_id).count()
    project = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
    all_checks = [tasks_completed, inspections_passed, pending_orders == 0, pending_payments == 0,
                  quality_issues == 0, safety_issues == 0, docs > 0, project and project.status == "completed"]
    passed = sum(1 for c in all_checks if c)
    return ProjectCompletionCheck(tasks_completed=tasks_completed, inspections_passed=inspections_passed,
                                   no_pending_orders=pending_orders == 0, no_pending_payments=pending_payments == 0,
                                   no_quality_issues=quality_issues == 0, no_safety_issues=safety_issues == 0,
                                   docs_uploaded=docs > 0, completion_approved=project and project.status == "completed",
                                   all_checks_passed=passed == 8, total_checks=8, passed_checks=passed)


# ════════════════════════════════════════════════════════════════════════════
# PHASES
# ════════════════════════════════════════════════════════════════════════════

@router.post("/phases", response_model=PhaseResponse, status_code=201)
def create_phase(payload: PhaseCreate, db: Session = Depends(get_db), current_user: User = Depends(_admin_manager)):
    phase = ProjectPhase(**payload.model_dump())
    db.add(phase)
    db.commit()
    db.refresh(phase)
    _log_construction(db, current_user, "CREATE", "phase", phase.id, f"Phase: {phase.name}")
    return phase


@router.put("/phases/{phase_id}", response_model=PhaseResponse)
def update_phase(phase_id: int, payload: PhaseUpdate, db: Session = Depends(get_db),
                 current_user: User = Depends(_admin_manager)):
    phase = db.query(ProjectPhase).filter(ProjectPhase.id == phase_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(phase, k, v)
    # update project progress
    _update_project_progress(db, phase.project_id)
    db.commit()
    db.refresh(phase)
    return phase


@router.delete("/phases/{phase_id}", status_code=204)
def delete_phase(phase_id: int, db: Session = Depends(get_db), current_user: User = Depends(_admin_manager)):
    phase = db.query(ProjectPhase).filter(ProjectPhase.id == phase_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")
    db.delete(phase)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# TASKS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/tasks", response_model=TaskResponse, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(_admin_manager)):
    task = ConstructionTask(**payload.model_dump(), created_by=current_user.id)
    db.add(task)
    db.flush()
    # Check dependencies
    if task.status == "in_progress" and not _check_dependencies_met(db, task.id):
        task.status = "pending"
    # Create notification for assigned engineer
    if task.assigned_engineer_id:
        _create_notification(db, task.project_id, task.assigned_engineer_id,
                             f"Task Assigned: {task.name}", f"You have been assigned task '{task.name}'",
                             "task_assigned", "task", task.id)
    db.commit()
    db.refresh(task)
    _log_construction(db, current_user, "CREATE", "task", task.id, f"Task: {task.name}")
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db),
                current_user: User = Depends(_admin_manager)):
    task = db.query(ConstructionTask).filter(ConstructionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    old_status = task.status
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    # Status change validation
    if task.status == "in_progress" and not _check_dependencies_met(db, task.id):
        raise HTTPException(status_code=400, detail="Cannot start task: dependencies not completed")
    if task.status == "completed" and old_status != "completed":
        task.actual_end_date = date.today()
        # Notify
        _create_notification(db, task.project_id, None, f"Task Completed: {task.name}",
                             f"Task '{task.name}' has been completed", "task_completed", "task", task.id)
    if task.status == "in_progress" and old_status != "in_progress":
        task.actual_start_date = date.today()
    # Check delay
    if task.end_date and task.end_date < date.today() and task.status != "completed":
        task.is_delayed = True
        _create_notification(db, task.project_id, None, f"Task Delayed: {task.name}",
                             f"Task '{task.name}' is past due date", "task_delayed", "task", task.id)
    _update_project_progress(db, task.project_id)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(_admin_manager)):
    task = db.query(ConstructionTask).filter(ConstructionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()


@router.post("/tasks/dependencies", response_model=TaskDependencyResponse, status_code=201)
def add_task_dependency(payload: TaskDependencyCreate, db: Session = Depends(get_db),
                         current_user: User = Depends(_admin_manager)):
    dep = TaskDependency(**payload.model_dump())
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


@router.delete("/tasks/dependencies/{dep_id}", status_code=204)
def remove_task_dependency(dep_id: int, db: Session = Depends(get_db), current_user: User = Depends(_admin_manager)):
    dep = db.query(TaskDependency).filter(TaskDependency.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependency not found")
    db.delete(dep)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# BUDGET
# ════════════════════════════════════════════════════════════════════════════

@router.post("/budget", response_model=BudgetResponse, status_code=201)
def upsert_budget(payload: BudgetCreate, db: Session = Depends(get_db), current_user: User = Depends(_admin_manager)):
    obj = db.query(ProjectBudget).filter(ProjectBudget.project_id == payload.project_id).first()
    total = sum([payload.material_cost, payload.labor_cost, payload.equipment_cost,
                  payload.machinery_cost, payload.contractor_cost, payload.utility_cost,
                  payload.transport_cost, payload.permit_fees, payload.govt_charges, payload.misc_cost], Decimal("0"))
    if obj:
        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(obj, k, v)
        obj.total_cost = total
    else:
        obj = ProjectBudget(**payload.model_dump(), total_cost=total)
        db.add(obj)
    db.commit()
    db.refresh(obj)
    _log_construction(db, current_user, "CREATE", "budget", obj.project_id, f"Budget: Project {obj.project_id}")
    return obj


@router.patch("/budget/{project_id}", response_model=BudgetResponse)
def patch_budget(project_id: int, payload: BudgetUpdate, db: Session = Depends(get_db),
                 current_user: User = Depends(_admin_manager)):
    obj = db.query(ProjectBudget).filter(ProjectBudget.project_id == project_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Budget not found")
    if obj.status == "locked":
        # Only users with override permission could edit; for now check admin role
        if not current_user.role or current_user.role.name not in ("Admin",):
            raise HTTPException(status_code=403, detail="Budget is locked. Admin override required.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    obj.total_cost = sum([obj.material_cost, obj.labor_cost, obj.equipment_cost,
                           obj.machinery_cost, obj.contractor_cost, obj.utility_cost,
                           obj.transport_cost, obj.permit_fees, obj.govt_charges, obj.misc_cost], Decimal("0"))
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/budget/{project_id}/status", response_model=BudgetResponse)
def update_budget_status(project_id: int, payload: BudgetStatusUpdate, db: Session = Depends(get_db),
                          current_user: User = Depends(_admin_manager)):
    obj = db.query(ProjectBudget).filter(ProjectBudget.project_id == project_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Budget not found")
    obj.status = payload.status
    if payload.status == "approved":
        obj.approved_by = current_user.id
        obj.approved_at = datetime.utcnow()
        # Advance project phase
        project = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
        if project and project.current_phase == "planning":
            project.current_phase = "budget_approval"
            _update_milestone_status(db, project_id, "budget", "completed")
    db.commit()
    db.refresh(obj)
    return obj


# ════════════════════════════════════════════════════════════════════════════
# RESOURCES
# ════════════════════════════════════════════════════════════════════════════

@router.get("/resources", response_model=list[ResourceItemResponse])
def list_resources(type: Optional[str] = Query(None), category: Optional[str] = Query(None),
                    db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    q = db.query(ConResourceItem).filter(ConResourceItem.is_active == True)
    if type:
        q = q.filter(ConResourceItem.type == type)
    if category:
        q = q.filter(ConResourceItem.category == category)
    return q.order_by(ConResourceItem.name).all()


@router.post("/resources", response_model=ResourceItemResponse, status_code=201)
def create_resource(payload: ResourceItemCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(_admin_manager)):
    r = ConResourceItem(**payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/resources/{resource_id}", response_model=ResourceItemResponse)
def update_resource(resource_id: int, payload: ResourceItemUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(_admin_manager)):
    r = db.query(ConResourceItem).filter(ConResourceItem.id == resource_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.post("/resources/allocate", response_model=ResourceAllocationResponse, status_code=201)
def allocate_resource(payload: ResourceAllocationCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_manager)):
    resource = db.query(ConResourceItem).filter(ConResourceItem.id == payload.resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource.availability not in ("available", "reserved"):
        raise HTTPException(status_code=400, detail=f"Resource '{resource.name}' is not available (status: {resource.availability})")
    alloc = ResourceAllocation(**payload.model_dump())
    db.add(alloc)
    resource.availability = "allocated"
    db.commit()
    db.refresh(alloc)
    return alloc


@router.delete("/resources/allocate/{allocation_id}", status_code=204)
def release_resource(allocation_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(_admin_manager)):
    alloc = db.query(ResourceAllocation).filter(ResourceAllocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    resource = db.query(ConResourceItem).filter(ConResourceItem.id == alloc.resource_id).first()
    if resource:
        resource.availability = "available"
    db.delete(alloc)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# CONTRACTORS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/contractors", response_model=list[ContractorResponse])
def list_contractors(db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(Contractor).order_by(Contractor.name).all()


@router.post("/contractors", response_model=ContractorResponse, status_code=201)
def create_contractor(payload: ContractorCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_manager)):
    c = Contractor(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/contractors/{contractor_id}", response_model=ContractorResponse)
def update_contractor(contractor_id: int, payload: ContractorUpdate, db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_manager)):
    c = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contractor not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/contractors/{contractor_id}", status_code=204)
def delete_contractor(contractor_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles("Admin"))):
    c = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contractor not found")
    db.delete(c)
    db.commit()


@router.post("/contractors/assign", response_model=ProjectContractorResponse, status_code=201)
def assign_contractor(payload: ProjectContractorCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_manager)):
    existing = db.query(ProjectContractor).filter(
        ProjectContractor.project_id == payload.project_id,
        ProjectContractor.contractor_id == payload.contractor_id,
        ProjectContractor.status == "active").first()
    if existing:
        raise HTTPException(status_code=400, detail="Contractor already assigned")
    pc = ProjectContractor(**payload.model_dump())
    db.add(pc)
    db.commit()
    db.refresh(pc)
    return db.query(ProjectContractor).options(joinedload(ProjectContractor.contractor)).filter(
        ProjectContractor.id == pc.id).first()


@router.delete("/contractors/assign/{assignment_id}", status_code=204)
def remove_contractor_assignment(assignment_id: int, db: Session = Depends(get_db),
                                 current_user: User = Depends(_admin_manager)):
    pc = db.query(ProjectContractor).filter(ProjectContractor.id == assignment_id).first()
    if not pc:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(pc)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# PROCUREMENT (Legacy)
# ════════════════════════════════════════════════════════════════════════════

@router.post("/procurement", response_model=ProcurementResponse, status_code=201)
def create_procurement(payload: ProcurementCreate, db: Session = Depends(get_db), user: User = Depends(_all_staff)):
    cost = Decimal(str(payload.quantity)) * Decimal(str(payload.unit_cost))
    pr = Procurement(**payload.model_dump(), cost=cost, requested_by=user.id)
    db.add(pr)
    db.commit()
    db.refresh(pr)
    return pr


@router.put("/procurement/{procurement_id}", response_model=ProcurementResponse)
def update_procurement(procurement_id: int, payload: ProcurementUpdate, db: Session = Depends(get_db),
                       current_user: User = Depends(_admin_manager)):
    pr = db.query(Procurement).filter(Procurement.id == procurement_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Procurement not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(pr, k, v)
    pr.cost = Decimal(str(pr.quantity)) * Decimal(str(pr.unit_cost))
    db.commit()
    db.refresh(pr)
    return pr


@router.patch("/procurement/{procurement_id}/status", response_model=ProcurementResponse)
def update_procurement_status(procurement_id: int, payload: ProcurementStatusUpdate,
                               db: Session = Depends(get_db), user: User = Depends(_admin_manager)):
    pr = db.query(Procurement).filter(Procurement.id == procurement_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Procurement not found")
    pr.status = payload.status
    if payload.status == "approved" and not pr.approved_at:
        pr.approved_at = datetime.utcnow()
        pr.approved_by = user.id
    elif payload.status == "received" and not pr.received_at:
        pr.received_at = datetime.utcnow()
    db.commit()
    db.refresh(pr)
    return pr


@router.delete("/procurement/{procurement_id}", status_code=204)
def delete_procurement(procurement_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(_admin_manager)):
    pr = db.query(Procurement).filter(Procurement.id == procurement_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Procurement not found")
    db.delete(pr)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# VENDORS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/vendors", response_model=list[VendorResponse])
def list_vendors(db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    return db.query(ConVendor).order_by(ConVendor.name).all()


@router.post("/vendors", response_model=VendorResponse, status_code=201)
def create_vendor(payload: VendorCreate, db: Session = Depends(get_db), current_user: User = Depends(_admin_manager)):
    v = ConVendor(**payload.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.put("/vendors/{vendor_id}", response_model=VendorResponse)
def update_vendor(vendor_id: int, payload: VendorCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(_admin_manager)):
    v = db.query(ConVendor).filter(ConVendor.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for k, v_val in payload.model_dump(exclude_none=True).items():
        setattr(v, k, v_val)
    db.commit()
    db.refresh(v)
    return v


# ════════════════════════════════════════════════════════════════════════════
# PURCHASE REQUESTS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/purchase-requests", response_model=PurchaseRequestResponse, status_code=201)
def create_purchase_request(payload: PurchaseRequestCreate, db: Session = Depends(get_db),
                             current_user: User = Depends(_admin_manager)):
    pr_count = db.query(PurchaseRequest).count()
    pr = PurchaseRequest(**payload.model_dump(), pr_number=f"PR-{pr_count + 1:04d}",
                          requested_by=current_user.id)
    db.add(pr)
    db.commit()
    db.refresh(pr)
    _create_notification(db, pr.project_id, None, "Purchase Request Created",
                         f"PR #{pr.pr_number}: {pr.title}", "purchase_approval", "purchase_request", pr.id)
    return pr


@router.patch("/purchase-requests/{pr_id}/status", response_model=PurchaseRequestResponse)
def update_purchase_request_status(pr_id: int, status: str = Query(...), db: Session = Depends(get_db),
                                    current_user: User = Depends(_admin_manager)):
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    pr.status = status
    if status == "approved":
        pr.approved_by = current_user.id
        pr.approved_at = datetime.utcnow()
        # Auto-create purchase order from request
        po = PurchaseOrder(project_id=pr.project_id, request_id=pr.id, title=pr.title,
                            status="draft", created_by=current_user.id)
        db.add(po)
        db.flush()
    db.commit()
    db.refresh(pr)
    return pr


# ════════════════════════════════════════════════════════════════════════════
# PURCHASE ORDERS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=201)
def create_purchase_order(payload: PurchaseOrderCreate, db: Session = Depends(get_db),
                           current_user: User = Depends(_admin_manager)):
    po_count = db.query(PurchaseOrder).count()
    po = PurchaseOrder(**payload.model_dump(), po_number=f"PO-{po_count + 1:04d}",
                        created_by=current_user.id)
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@router.patch("/purchase-orders/{po_id}/status", response_model=PurchaseOrderResponse)
def update_purchase_order_status(po_id: int, status: str = Query(...), db: Session = Depends(get_db),
                                  current_user: User = Depends(_admin_manager)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    old_status = po.status
    po.status = status
    if status == "delivered":
        _create_notification(db, po.project_id, None, "Material Delivered",
                             f"PO #{po.po_number} has been delivered", "material_delivered", "purchase_order", po.id)
    db.commit()
    db.refresh(po)
    return po


# ════════════════════════════════════════════════════════════════════════════
# GOODS RECEIPT NOTES
# ════════════════════════════════════════════════════════════════════════════

@router.post("/goods-receipts", response_model=GoodsReceiptResponse, status_code=201)
def create_goods_receipt(payload: GoodsReceiptCreate, db: Session = Depends(get_db),
                          current_user: User = Depends(_admin_manager)):
    grn_count = db.query(GoodsReceiptNote).count()
    grn = GoodsReceiptNote(**payload.model_dump(), grn_number=f"GRN-{grn_count + 1:04d}",
                            received_by=current_user.id)
    db.add(grn)
    db.commit()
    db.refresh(grn)
    # Update PO status if linked
    if payload.po_id:
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == payload.po_id).first()
        if po:
            po.status = "delivered"
            db.commit()
    return grn


# ════════════════════════════════════════════════════════════════════════════
# EXECUTION — Daily Progress
# ════════════════════════════════════════════════════════════════════════════

@router.post("/progress", response_model=DailyProgressResponse, status_code=201)
def log_progress(payload: DailyProgressCreate, db: Session = Depends(get_db), user: User = Depends(_all_staff)):
    log = DailyProgress(**payload.model_dump(), reported_by=user.id)
    db.add(log)
    db.flush()
    # Update task progress
    if payload.task_id:
        task = db.query(ConstructionTask).filter(ConstructionTask.id == payload.task_id).first()
        if task:
            task.progress_pct = max(task.progress_pct, payload.progress_percentage)
    _update_project_progress(db, payload.project_id)
    db.commit()
    db.refresh(log)
    return log


@router.put("/progress/{progress_id}", response_model=DailyProgressResponse)
def update_progress(progress_id: int, payload: DailyProgressUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(_all_staff)):
    log = db.query(DailyProgress).filter(DailyProgress.id == progress_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Progress record not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(log, k, v)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/progress/{progress_id}", status_code=204)
def delete_progress(progress_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(_admin_manager)):
    log = db.query(DailyProgress).filter(DailyProgress.id == progress_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Progress record not found")
    db.delete(log)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# EXPENSES
# ════════════════════════════════════════════════════════════════════════════

@router.post("/expenses", response_model=ConstructionExpenseResponse, status_code=201)
def add_expense(payload: ConstructionExpenseCreate, db: Session = Depends(get_db), user: User = Depends(_admin_manager)):
    finance_expense_id = None
    if payload.account_id and payload.paid_from:
        from app.models.finance import Account, Expense, Journal, JournalEntry
        account = db.query(Account).filter(Account.id == payload.account_id).first()
        if not account:
            raise HTTPException(status_code=400, detail="Finance account not found")
        cash_code = "1001" if payload.paid_from == "cash" else "1002"
        cash_acc = db.query(Account).filter(Account.code == cash_code).first()
        if not cash_acc:
            raise HTTPException(status_code=400, detail=f"Cash/bank account '{cash_code}' not found")
        fin_expense = Expense(account_id=payload.account_id, paid_from=payload.paid_from,
                               amount=payload.amount, date=datetime.combine(payload.date, datetime.min.time()),
                               description=payload.description, reference=f"CONST-{payload.project_id}")
        db.add(fin_expense)
        db.flush()
        journal = Journal(date=datetime.combine(payload.date, datetime.min.time()),
                           reference_type="construction_expense", reference_id=str(fin_expense.id),
                           description=payload.description, created_by_user_id=user.id)
        db.add(journal)
        db.flush()
        db.add(JournalEntry(journal_id=journal.id, account_id=payload.account_id,
                             debit=payload.amount, credit=Decimal("0"), description=payload.description))
        db.add(JournalEntry(journal_id=journal.id, account_id=cash_acc.id,
                             debit=Decimal("0"), credit=payload.amount, description=payload.description))
        finance_expense_id = fin_expense.id
    # Check budget limit
    budget = db.query(ProjectBudget).filter(ProjectBudget.project_id == payload.project_id).first()
    if budget and budget.status == "locked":
        actual = sum((e.amount for e in db.query(ConstructionExpense).filter(
            ConstructionExpense.project_id == payload.project_id).all()), Decimal("0"))
        if actual + payload.amount > budget.total_cost:
            _create_notification(db, payload.project_id, None, "Budget Exceeded",
                                 f"Expense would exceed approved budget", "budget_exceeded", "expense", None)
    expense = ConstructionExpense(project_id=payload.project_id, expense_id=finance_expense_id,
                                   amount=payload.amount, expense_type=payload.expense_type,
                                   description=payload.description, reference_id=payload.reference_id, date=payload.date)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/expenses/{expense_id}", response_model=ConstructionExpenseResponse)
def update_expense(expense_id: int, payload: ConstructionExpenseUpdate, db: Session = Depends(get_db),
                   user: User = Depends(_admin_manager)):
    expense = db.query(ConstructionExpense).filter(ConstructionExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(expense, k, v)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db), user: User = Depends(_admin_manager)):
    expense = db.query(ConstructionExpense).filter(ConstructionExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# VENDOR PAYMENTS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/vendor-payments", response_model=VendorPaymentResponse, status_code=201)
def create_vendor_payment(payload: VendorPaymentCreate, db: Session = Depends(get_db),
                           current_user: User = Depends(_admin_manager)):
    vp = VendorPayment(**payload.model_dump())
    db.add(vp)
    db.commit()
    db.refresh(vp)
    return vp


@router.patch("/vendor-payments/{payment_id}/status", response_model=VendorPaymentResponse)
def update_vendor_payment_status(payment_id: int, status: str = Query(...), db: Session = Depends(get_db),
                                  current_user: User = Depends(_admin_manager)):
    vp = db.query(VendorPayment).filter(VendorPayment.id == payment_id).first()
    if not vp:
        raise HTTPException(status_code=404, detail="Payment not found")
    vp.status = status
    db.commit()
    db.refresh(vp)
    return vp


# ════════════════════════════════════════════════════════════════════════════
# QUALITY INSPECTIONS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/inspections", response_model=QualityInspectionResponse, status_code=201)
def create_inspection(payload: QualityInspectionCreate, db: Session = Depends(get_db),
                       current_user: User = Depends(_admin_manager)):
    insp = QualityInspection(**payload.model_dump(), inspector_id=current_user.id)
    db.add(insp)
    db.commit()
    db.refresh(insp)
    return insp


@router.put("/inspections/{inspection_id}", response_model=QualityInspectionResponse)
def update_inspection(inspection_id: int, payload: QualityInspectionUpdate, db: Session = Depends(get_db),
                       current_user: User = Depends(_admin_manager)):
    insp = db.query(QualityInspection).filter(QualityInspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(insp, k, v)
    # If failed > notify
    if payload.result == "failed":
        _create_notification(db, insp.project_id, None, "Inspection Failed",
                             f"Inspection '{insp.inspection_type}' failed", "inspection_failed", "inspection", insp.id)
    db.commit()
    db.refresh(insp)
    return insp


@router.delete("/inspections/{inspection_id}", status_code=204)
def delete_inspection(inspection_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(_admin_manager)):
    insp = db.query(QualityInspection).filter(QualityInspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    db.delete(insp)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# SAFETY
# ════════════════════════════════════════════════════════════════════════════

@router.post("/safety", response_model=SafetyIncidentResponse, status_code=201)
def create_safety_incident(payload: SafetyIncidentCreate, db: Session = Depends(get_db),
                            current_user: User = Depends(_admin_manager)):
    si = SafetyIncident(**payload.model_dump(), reported_by=current_user.id)
    db.add(si)
    db.commit()
    db.refresh(si)
    return si


@router.put("/safety/{incident_id}", response_model=SafetyIncidentResponse)
def update_safety_incident(incident_id: int, payload: SafetyIncidentUpdate, db: Session = Depends(get_db),
                            current_user: User = Depends(_admin_manager)):
    si = db.query(SafetyIncident).filter(SafetyIncident.id == incident_id).first()
    if not si:
        raise HTTPException(status_code=404, detail="Safety incident not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(si, k, v)
    if payload.status == "resolved" or payload.status == "closed":
        si.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(si)
    return si


@router.delete("/safety/{incident_id}", status_code=204)
def delete_safety_incident(incident_id: int, db: Session = Depends(get_db),
                            current_user: User = Depends(_admin_manager)):
    si = db.query(SafetyIncident).filter(SafetyIncident.id == incident_id).first()
    if not si:
        raise HTTPException(status_code=404, detail="Safety incident not found")
    db.delete(si)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# DOCUMENTS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/documents/{project_id}", response_model=DocumentResponse, status_code=201)
async def upload_document(project_id: int, folder: str = Query(default="Other"),
                           doc_type: str = Query(default="other"), tags: str = Query(default=""),
                           file: UploadFile = File(...), db: Session = Depends(get_db),
                           user: User = Depends(_all_staff)):
    project = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    upload_dir = Path(settings.upload_dir) / "construction" / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix if file.filename else ""
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = upload_dir / filename
    content = await file.read()
    dest.write_bytes(content)
    latest = db.query(ConstructionDocument).filter(
        ConstructionDocument.project_id == project_id,
        ConstructionDocument.name == (file.filename or filename)).order_by(
        ConstructionDocument.version.desc()).first()
    version = (latest.version + 1) if latest else 1
    doc = ConstructionDocument(project_id=project_id, folder=folder, name=file.filename or filename,
                                file_url=f"/uploads/construction/{project_id}/{filename}", doc_type=doc_type,
                                file_size=len(content), version=version, tags=tags if tags else None,
                                uploaded_by=user.id)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(_admin_manager)):
    doc = db.query(ConstructionDocument).filter(ConstructionDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        file_path = Path(settings.upload_dir).parent / doc.file_url.lstrip("/")
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass
    db.delete(doc)
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# MILESTONES
# ════════════════════════════════════════════════════════════════════════════

@router.post("/milestones", response_model=MilestoneResponse, status_code=201)
def create_milestone(payload: MilestoneCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_manager)):
    ms = ProjectMilestone(**payload.model_dump())
    db.add(ms)
    db.commit()
    db.refresh(ms)
    return ms


@router.put("/milestones/{milestone_id}", response_model=MilestoneResponse)
def update_milestone(milestone_id: int, payload: MilestoneUpdate, db: Session = Depends(get_db),
                      current_user: User = Depends(_admin_manager)):
    ms = db.query(ProjectMilestone).filter(ProjectMilestone.id == milestone_id).first()
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ms, k, v)
    if payload.status == "completed" and not ms.completed_date:
        ms.completed_date = date.today()
    db.commit()
    db.refresh(ms)
    return ms


# ════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ════════════════════════════════════════════════════════════════════════════

@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db),
                            _: User = Depends(_all_staff)):
    n = db.query(ConstructionNotification).filter(ConstructionNotification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    db.refresh(n)
    return n


@router.patch("/notifications/mark-all-read", status_code=204)
def mark_all_notifications_read(project_id: int = Query(...), db: Session = Depends(get_db),
                                 _: User = Depends(_all_staff)):
    db.query(ConstructionNotification).filter(
        ConstructionNotification.project_id == project_id,
        ConstructionNotification.is_read == False).update({"is_read": True})
    db.commit()


# ════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS (list)
# ════════════════════════════════════════════════════════════════════════════

# NOTE: list_project_notifications is already defined above in the project section


# ════════════════════════════════════════════════════════════════════════════
# PROPERTY INTEGRATION
# ════════════════════════════════════════════════════════════════════════════

@router.post("/projects/{project_id}/convert-to-property")
def convert_project_to_property(project_id: int, payload: PropertyConversionRequest,
                                 db: Session = Depends(get_db), current_user: User = Depends(require_roles("Admin"))):
    from app.models.property import Property, Floor, Unit
    from app.core.database import Base
    project = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != "completed":
        raise HTTPException(status_code=400, detail="Project must be completed before conversion")
    # Check all completion criteria
    tasks = db.query(ConstructionTask).filter(ConstructionTask.project_id == project_id).all()
    if tasks and not all(t.status == "completed" for t in tasks):
        raise HTTPException(status_code=400, detail="All tasks must be completed")
    inspections = db.query(QualityInspection).filter(QualityInspection.project_id == project_id).all()
    if inspections and not all(i.result == "passed" for i in inspections):
        raise HTTPException(status_code=400, detail="All inspections must pass")
    # Create property
    prop_count = db.query(Property).count()
    property_name = payload.property_name or f"{project.name} Property"
    property = Property(
        tid=f"PRO-{prop_count + 1:04d}",
        name=property_name,
        address=project.location,
        description=project.description,
        status="available",
        listing_status="available",
        operational_status="active",
        category=payload.property_type or "residential",
    )
    db.add(property)
    db.flush()
    # Generate buildings/floors/units
    for b in range(payload.num_buildings):
        floor_count = db.query(Floor).count()
        floor = Floor(
            tid=f"FLR-{floor_count + 1:04d}",
            property_id=property.id,
            floor_number=b + 1,
        )
        db.add(floor)
        db.flush()
        for f in range(payload.floors_per_building):
            for u in range(payload.units_per_floor):
                unit_count = db.query(Unit).count()
                unit = Unit(
                    tid=f"UNT-{unit_count + 1:04d}",
                    floor_id=floor.id,
                    unit_number=f"{b + 1}-{f + 1}-{u + 1:02d}",
                    status="available",
                    unit_type=payload.unit_type or "apartment",
                    area=Decimal("0"),
                    sale_price=payload.price_per_unit,
                    property_id=property.id,
                    floor_number=b + 1,
                )
                db.add(unit)
    db.commit()
    return {"message": f"Project converted to property '{property_name}' with {payload.num_buildings} building(s)"}


# ════════════════════════════════════════════════════════════════════════════
# PROJECT WORKFLOW
# ════════════════════════════════════════════════════════════════════════════

@router.patch("/projects/{project_id}/advance-phase")
def advance_project_phase(project_id: int, db: Session = Depends(get_db),
                           current_user: User = Depends(_admin_manager)):
    project = db.query(ConstructionProject).filter(ConstructionProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    phase_order = list(VALID_PHASES)
    current_idx = phase_order.index(project.current_phase) if project.current_phase in phase_order else -1
    if current_idx < 0 or current_idx >= len(phase_order) - 1:
        raise HTTPException(status_code=400, detail="Project already at final phase")
    next_phase = phase_order[current_idx + 1]
    project.current_phase = next_phase
    # Update milestones
    if next_phase in ("completion", "completed"):
        project.status = "completed"
        project.actual_end = date.today()
        _create_notification(db, project_id, None, "Project Completed",
                             f"Project '{project.name}' has been completed", "project_completed", "project", project_id)
    # Advance corresponding milestone
    milestone_map = {"planning": "planning", "budget_approval": "budget", "procurement": "procurement",
                      "execution": "execution", "quality_inspection": "inspection", "completion": "completion"}
    if next_phase in milestone_map:
        _update_milestone_status(db, project_id, milestone_map[next_phase], "completed")
    db.commit()
    db.refresh(project)
    return {"current_phase": project.current_phase, "status": project.status}


# ════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/charts")
def dashboard_charts(db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    """Return chart data for the construction dashboard."""
    projects = db.query(ConstructionProject).filter(ConstructionProject.is_deleted == False).all()
    monthly_spending = []
    today = date.today()
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m < 1:
            m += 12
            y -= 1
        month_name = date(y, m, 1).strftime("%b")
        budget_total = Decimal("0")
        actual_total = Decimal("0")
        for p in projects:
            budget_total += (p.total_budget or Decimal("0")) / Decimal("12")
            expenses = db.query(ConstructionExpense).filter(
                ConstructionExpense.project_id == p.id,
                safunc.extract("year", ConstructionExpense.date) == y,
                safunc.extract("month", ConstructionExpense.date) == m,
            ).all()
            actual_total += sum((e.amount for e in expenses), Decimal("0"))
        monthly_spending.append({
            "month": month_name,
            "budget": float(budget_total),
            "actual": float(actual_total),
        })
    return {"monthly_spending": monthly_spending}


@router.get("/dashboard/activity")
def dashboard_activity(limit: int = Query(10, ge=1, le=100),
                       db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    """Return recent construction activity logs."""
    logs = db.query(ActivityLog).filter(
        ActivityLog.module == "construction"
    ).order_by(ActivityLog.timestamp.desc()).limit(limit).all()
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "action": log.action,
            "message": log.record_label or log.action,
            "user_name": log.user_name or "System",
            "user_email": log.user_email,
            "module": log.module,
            "record_type": log.record_type,
            "record_id": log.record_id,
            "created_at": log.timestamp,
        })
    return result


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
def dashboard_stats(db: Session = Depends(get_db), _: User = Depends(_all_staff)):
    projects = db.query(ConstructionProject).filter(ConstructionProject.is_deleted == False).all()
    total = len(projects)
    active = sum(1 for p in projects if p.status == "active")
    completed = sum(1 for p in projects if p.status == "completed")
    delayed = sum(1 for p in projects if p.current_phase in ("execution", "quality_inspection") and
                  p.expected_end and p.expected_end < date.today() and p.status != "completed")
    total_budget = sum((float(p.total_budget) for p in projects), 0.0)
    total_expenses = sum(float(sum((e.amount for e in db.query(ConstructionExpense).filter(
        ConstructionExpense.project_id == p.id).all()), Decimal("0"))) for p in projects)
    avg_progress = sum(_calc_project_progress(db, p.id) for p in projects) / total if total else 0.0
    workers = sum((dp.workers_count or 0) for p in projects
                  for dp in db.query(DailyProgress).filter(
                      DailyProgress.project_id == p.id).order_by(DailyProgress.date.desc()).limit(1).all())
    equipment_active = db.query(ConResourceItem).filter(
        ConResourceItem.type == "equipment", ConResourceItem.availability == "allocated").count()
    po_pending = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_(["draft", "sent", "confirmed"])).count()
    quality_failures = db.query(QualityInspection).filter(
        QualityInspection.result.in_(["failed", "rework_required"])).count()
    safety_open = db.query(SafetyIncident).filter(SafetyIncident.status.in_(["open", "investigating"])).count()
    budget_used_pct = ((total_expenses / total_budget) * 100) if total_budget else 0
    return DashboardStatsResponse(
        total_projects=total, active_projects=active, completed_projects=completed,
        delayed_projects=delayed, total_budget=total_budget, total_expenses=total_expenses,
        remaining_budget=total_budget - total_expenses, workers_on_site=workers,
        equipment_active=equipment_active, purchase_orders_pending=po_pending,
        invoices_pending=po_pending, quality_failures=quality_failures,
        safety_incidents=safety_open, avg_progress_pct=round(avg_progress, 1),
        budget_used_pct=round(budget_used_pct, 1),
        budget_remaining_pct=round(100 - budget_used_pct, 1),
    )


# ════════════════════════════════════════════════════════════════════════════
# INTERNAL HELPERS
# ════════════════════════════════════════════════════════════════════════════

def _update_project_progress(db: Session, project_id: int):
    progress = _calc_project_progress(db, project_id)
    db.query(ConstructionProject).filter(ConstructionProject.id == project_id).update({"updated_at": datetime.utcnow()})


def _update_milestone_status(db: Session, project_id: int, milestone_type: str, status: str):
    ms = db.query(ProjectMilestone).filter(
        ProjectMilestone.project_id == project_id,
        ProjectMilestone.milestone_type == milestone_type).first()
    if ms:
        ms.status = status
        if status == "completed" and not ms.completed_date:
            ms.completed_date = date.today()
