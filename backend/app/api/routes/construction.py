"""Construction Module — API Routes"""
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.audit import log_action
from app.core.activity_logger import log_activity
from app.core.config import settings
from app.core.database import get_db
from app.models.auth import User
from app.models.construction import ConstructionDocument
from app.schemas.construction import (
    BudgetCreate, BudgetResponse, BudgetUpdate,
    ContractorCreate, ContractorResponse, ContractorUpdate,
    ConstructionExpenseCreate, ConstructionExpenseResponse,
    DailyProgressCreate, DailyProgressResponse, DailyProgressUpdate,
    DocumentResponse,
    PhaseCreate, PhaseResponse, PhaseUpdate,
    ProcurementCreate, ProcurementResponse, ProcurementStatusUpdate, ProcurementUpdate,
    ProjectContractorCreate, ProjectContractorResponse,
    ProjectCreate, ProjectReportResponse, ProjectResponse, ProjectSummary, ProjectUpdate,
)
from app.services.construction.budget_service import BudgetService
from app.services.construction.contractor_service import ContractorService
from app.services.construction.execution_service import ExecutionService
from app.services.construction.procurement_service import ProcurementService
from app.services.construction.project_service import ProjectService
from app.services.construction.report_service import ReportService

router = APIRouter()

# Role helpers
_admin_manager = require_roles("Admin", "Manager")
_all_staff      = require_roles("Admin", "Manager", "Staff", "Accountant", "Dealer")


# ══════════════════════════════════════════════════════════════════════════════
# PROJECTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User  = Depends(_admin_manager),
):
    result = ProjectService.create(db, payload, user.id)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(result.id), record_label=f"Project: {result.name}",
        changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in result.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=user, action="create", module="construction",
        record_type="project", record_id=result.id, record_label=f"Project: {result.name}",
        new_values={k: str(v) for k, v in result.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return result


@router.get("/projects", response_model=list[ProjectSummary])
def list_projects(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User     = Depends(_all_staff),
):
    from decimal import Decimal
    projects = ProjectService.get_all(db, status)
    result = []
    for p in projects:
        result.append(ProjectSummary(
            **{c.name: getattr(p, c.name) for c in p.__table__.columns},
            actual_cost         = ProjectService.actual_cost(db, p.id),
            progress_percentage = ProjectService.latest_progress(db, p.id),
            phase_count         = len(p.phases),
            contractor_count    = len(p.contractors),
        ))
    return result


@router.get("/projects/{project_id}", response_model=ProjectSummary)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(_all_staff),
):
    p = ProjectService.get_by_id(db, project_id)
    return ProjectSummary(
        **{c.name: getattr(p, c.name) for c in p.__table__.columns},
        actual_cost         = ProjectService.actual_cost(db, p.id),
        progress_percentage = ProjectService.latest_progress(db, p.id),
        phase_count         = len(p.phases),
        contractor_count    = len(p.contractors),
    )


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = ProjectService.update(db, project_id, payload)
    log_action(
        db=db, module="construction", action="UPDATE",
        record_id=str(project_id), record_label=f"Project: {project_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="construction",
        record_type="project", record_id=project_id, record_label=f"Project: {project_id}",
    )
    db.commit()
    return result


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin")),
):
    log_action(
        db=db, module="construction", action="DELETE",
        record_id=str(project_id), record_label=f"Project: {project_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="delete", module="construction",
        record_type="project", record_id=project_id, record_label=f"Project: {project_id}",
        old_values={"id": str(project_id)},
    )
    db.commit()
    ProjectService.delete(db, project_id)


# ══════════════════════════════════════════════════════════════════════════════
# PHASES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/phases", response_model=PhaseResponse, status_code=201)
def create_phase(
    payload: PhaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = ProjectService.create_phase(db, payload)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(result.id), record_label=f"Phase: {result.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in result.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="construction",
        record_type="phase", record_id=result.id, record_label=f"Phase: {result.name}",
        new_values={k: str(v) for k, v in result.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return result


@router.put("/phases/{phase_id}", response_model=PhaseResponse)
def update_phase(
    phase_id: int,
    payload: PhaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = ProjectService.update_phase(db, phase_id, payload)
    log_action(
        db=db, module="construction", action="UPDATE",
        record_id=str(phase_id), record_label=f"Phase: {phase_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="construction",
        record_type="phase", record_id=phase_id, record_label=f"Phase: {phase_id}",
    )
    db.commit()
    return result


@router.delete("/phases/{phase_id}", status_code=204)
def delete_phase(
    phase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    log_action(
        db=db, module="construction", action="DELETE",
        record_id=str(phase_id), record_label=f"Phase: {phase_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="delete", module="construction",
        record_type="phase", record_id=phase_id, record_label=f"Phase: {phase_id}",
        old_values={"id": str(phase_id)},
    )
    db.commit()
    ProjectService.delete_phase(db, phase_id)


# ══════════════════════════════════════════════════════════════════════════════
# BUDGET
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/budget", response_model=BudgetResponse, status_code=201)
def upsert_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = BudgetService.upsert(db, payload)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(result.project_id), record_label=f"Budget: Project {result.project_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="create", module="construction",
        record_type="budget", record_id=result.project_id, record_label=f"Budget: Project {result.project_id}",
    )
    db.commit()
    return result


@router.patch("/budget/{project_id}", response_model=BudgetResponse)
def patch_budget(
    project_id: int,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = BudgetService.patch(db, project_id, payload)
    log_action(
        db=db, module="construction", action="UPDATE",
        record_id=str(project_id), record_label=f"Budget: Project {project_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="construction",
        record_type="budget", record_id=project_id, record_label=f"Budget: Project {project_id}",
    )
    db.commit()
    return result


# ══════════════════════════════════════════════════════════════════════════════
# CONTRACTORS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/contractors", response_model=ContractorResponse, status_code=201)
def create_contractor(
    payload: ContractorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = ContractorService.create(db, payload)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(result.id), record_label=f"Contractor: {result.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in result.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="construction",
        record_type="contractor", record_id=result.id, record_label=f"Contractor: {result.name}",
        new_values={k: str(v) for k, v in result.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return result


@router.put("/contractors/{contractor_id}", response_model=ContractorResponse)
def update_contractor(
    contractor_id: int,
    payload: ContractorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = ContractorService.update(db, contractor_id, payload)
    log_action(
        db=db, module="construction", action="UPDATE",
        record_id=str(contractor_id), record_label=f"Contractor: {contractor_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="construction",
        record_type="contractor", record_id=contractor_id, record_label=f"Contractor: {contractor_id}",
    )
    db.commit()
    return result


@router.delete("/contractors/{contractor_id}", status_code=204)
def delete_contractor(
    contractor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin")),
):
    log_action(
        db=db, module="construction", action="DELETE",
        record_id=str(contractor_id), record_label=f"Contractor: {contractor_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="delete", module="construction",
        record_type="contractor", record_id=contractor_id, record_label=f"Contractor: {contractor_id}",
        old_values={"id": str(contractor_id)},
    )
    db.commit()
    ContractorService.delete(db, contractor_id)


@router.post("/contractors/assign", response_model=ProjectContractorResponse, status_code=201)
def assign_contractor(
    payload: ProjectContractorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = ContractorService.assign(db, payload)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(result.id), record_label=f"Contractor Assignment: {result.id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="create", module="construction",
        record_type="contractor_assignment", record_id=result.id, record_label=f"Contractor Assignment: {result.id}",
    )
    db.commit()
    return result


@router.delete("/contractors/assign/{assignment_id}", status_code=204)
def remove_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    log_action(
        db=db, module="construction", action="DELETE",
        record_id=str(assignment_id), record_label=f"Contractor Assignment: {assignment_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="delete", module="construction",
        record_type="contractor_assignment", record_id=assignment_id, record_label=f"Contractor Assignment: {assignment_id}",
        old_values={"id": str(assignment_id)},
    )
    db.commit()
    ContractorService.remove_assignment(db, assignment_id)


# ══════════════════════════════════════════════════════════════════════════════
# PROCUREMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/procurement", response_model=ProcurementResponse, status_code=201)
def create_procurement(
    payload: ProcurementCreate,
    db: Session = Depends(get_db),
    user: User  = Depends(_all_staff),
):
    result = ProcurementService.create(db, payload, user.id)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(result.id), record_label=f"Procurement: {result.id}",
        changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in result.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=user, action="create", module="construction",
        record_type="procurement", record_id=result.id, record_label=f"Procurement: {result.id}",
        new_values={k: str(v) for k, v in result.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return result


@router.put("/procurement/{procurement_id}", response_model=ProcurementResponse)
def update_procurement(
    procurement_id: int,
    payload: ProcurementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    result = ProcurementService.update(db, procurement_id, payload)
    log_action(
        db=db, module="construction", action="UPDATE",
        record_id=str(procurement_id), record_label=f"Procurement: {procurement_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="construction",
        record_type="procurement", record_id=procurement_id, record_label=f"Procurement: {procurement_id}",
    )
    db.commit()
    return result


@router.patch("/procurement/{procurement_id}/status", response_model=ProcurementResponse)
def update_procurement_status(
    procurement_id: int,
    payload: ProcurementStatusUpdate,
    db: Session = Depends(get_db),
    user: User  = Depends(_admin_manager),
):
    result = ProcurementService.update_status(db, procurement_id, payload, user.id)
    log_action(
        db=db, module="construction", action="UPDATE",
        record_id=str(procurement_id), record_label=f"Procurement status: {procurement_id}",
        changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=user, action="update", module="construction",
        record_type="procurement", record_id=procurement_id, record_label=f"Procurement status: {procurement_id}",
    )
    db.commit()
    return result


@router.delete("/procurement/{procurement_id}", status_code=204)
def delete_procurement(
    procurement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    log_action(
        db=db, module="construction", action="DELETE",
        record_id=str(procurement_id), record_label=f"Procurement: {procurement_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="delete", module="construction",
        record_type="procurement", record_id=procurement_id, record_label=f"Procurement: {procurement_id}",
        old_values={"id": str(procurement_id)},
    )
    db.commit()
    ProcurementService.delete(db, procurement_id)


# ══════════════════════════════════════════════════════════════════════════════
# EXECUTION — Daily Progress
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/progress", response_model=DailyProgressResponse, status_code=201)
def log_progress(
    payload: DailyProgressCreate,
    db: Session = Depends(get_db),
    user: User  = Depends(_all_staff),
):
    result = ExecutionService.log_progress(db, payload, user.id)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(result.id), record_label=f"Progress: Project {payload.project_id}",
        changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=user, action="create", module="construction",
        record_type="progress", record_id=result.id, record_label=f"Progress: Project {payload.project_id}",
    )
    db.commit()
    return result


@router.put("/progress/{progress_id}", response_model=DailyProgressResponse)
def update_progress(
    progress_id: int,
    payload: DailyProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_all_staff),
):
    result = ExecutionService.update_progress(db, progress_id, payload)
    log_action(
        db=db, module="construction", action="UPDATE",
        record_id=str(progress_id), record_label=f"Progress: {progress_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="construction",
        record_type="progress", record_id=progress_id, record_label=f"Progress: {progress_id}",
    )
    db.commit()
    return result


@router.delete("/progress/{progress_id}", status_code=204)
def delete_progress(
    progress_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    log_action(
        db=db, module="construction", action="DELETE",
        record_id=str(progress_id), record_label=f"Progress: {progress_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="delete", module="construction",
        record_type="progress", record_id=progress_id, record_label=f"Progress: {progress_id}",
        old_values={"id": str(progress_id)},
    )
    db.commit()
    ExecutionService.delete_progress(db, progress_id)


# ══════════════════════════════════════════════════════════════════════════════
# EXPENSES (Finance Integration)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/expenses", response_model=ConstructionExpenseResponse, status_code=201)
def add_expense(
    payload: ConstructionExpenseCreate,
    db: Session = Depends(get_db),
    user: User  = Depends(_admin_manager),
):
    result = ExecutionService.add_expense(db, payload, user.id)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(result.id), record_label=f"Expense: {result.description}",
        changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=user, action="create", module="construction",
        record_type="expense", record_id=result.id, record_label=f"Expense: {result.description}",
    )
    db.commit()
    return result


@router.get("/expenses/{project_id}", response_model=list[ConstructionExpenseResponse])
def list_expenses(
    project_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(_all_staff),
):
    return ExecutionService.get_expenses(db, project_id)


# ══════════════════════════════════════════════════════════════════════════════
# DOCUMENTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/documents/{project_id}", response_model=DocumentResponse, status_code=201)
async def upload_document(
    project_id: int,
    doc_type: str = Query(default="other"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User  = Depends(_all_staff),
):
    # Validate project exists
    ProjectService.get_by_id(db, project_id)

    allowed_types = {"blueprint", "contract", "permit", "report", "photo", "other"}
    if doc_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"doc_type must be one of {allowed_types}")

    # Save file
    upload_dir = Path(settings.upload_dir) / "construction" / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext      = Path(file.filename).suffix if file.filename else ""
    filename = f"{uuid.uuid4().hex}{ext}"
    dest     = upload_dir / filename
    content  = await file.read()
    dest.write_bytes(content)

    doc = ConstructionDocument(
        project_id  = project_id,
        name        = file.filename or filename,
        file_url    = f"/uploads/construction/{project_id}/{filename}",
        doc_type    = doc_type,
        file_size   = len(content),
        uploaded_by = user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    log_action(
        db=db, module="construction", action="CREATE",
        record_id=str(doc.id), record_label=f"Document: {doc.name}",
        changed_by=user.email, changed_by_role=getattr(getattr(user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in doc.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=user, action="create", module="construction",
        record_type="document", record_id=doc.id, record_label=f"Document: {doc.name}",
        new_values={k: str(v) for k, v in doc.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return doc


@router.get("/documents/{project_id}", response_model=list[DocumentResponse])
def list_documents(
    project_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(_all_staff),
):
    return (
        db.query(ConstructionDocument)
        .filter(ConstructionDocument.project_id == project_id)
        .order_by(ConstructionDocument.created_at.desc())
        .all()
    )


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_manager),
):
    doc = db.query(ConstructionDocument).filter(ConstructionDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Remove file from disk
    try:
        file_path = Path(settings.upload_dir).parent / doc.file_url.lstrip("/")
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass
    log_action(
        db=db, module="construction", action="DELETE",
        record_id=str(document_id), record_label=f"Document: {doc.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data={k: str(v) for k, v in doc.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="delete", module="construction",
        record_type="document", record_id=document_id, record_label=f"Document: {doc.name}",
        old_values={k: str(v) for k, v in doc.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    db.delete(doc)
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# REPORTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/report/{project_id}", response_model=ProjectReportResponse)
def project_report(
    project_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(_all_staff),
):
    return ReportService.project_report(db, project_id)


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD STATS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    _: User     = Depends(_all_staff),
):
    from decimal import Decimal
    from app.models.construction import ConstructionProject, ConstructionExpense

    projects = db.query(ConstructionProject).all()
    total    = len(projects)
    active   = sum(1 for p in projects if p.status == "active")
    completed = sum(1 for p in projects if p.status == "completed")

    total_budget = sum((p.total_budget for p in projects), Decimal("0"))
    total_actual = sum(
        (ProjectService.actual_cost(db, p.id) for p in projects), Decimal("0")
    )
    avg_progress = (
        sum(ProjectService.latest_progress(db, p.id) for p in projects) / total
        if total else 0.0
    )

    return {
        "total_projects":    total,
        "active_projects":   active,
        "completed_projects": completed,
        "total_budget":      float(total_budget),
        "total_actual_cost": float(total_actual),
        "budget_variance":   float(total_budget - total_actual),
        "avg_progress_pct":  round(avg_progress, 1),
    }
