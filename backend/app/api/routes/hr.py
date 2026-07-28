"""HR Management Routes — Employees, Attendance, Leave, Payroll"""
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional

log = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session, joinedload
from app.core.table_query import apply_table_filters

from app.api.deps import get_current_user, require_roles, require_any_permission
from app.core.activity_logger import log_activity
from app.core.audit import log_action
from app.core.database import get_db
from app.core.tid import next_tid
from app.models.auth import User
from app.models.hr import (
    AllowanceType, Attendance, Branch, DeductionType, Department,
    Employee, EmployeeTask, Holiday, Leave, LeaveBalance, LeaveType, Payroll,
    PerformanceReview, Position, SalaryStructure, ShiftTemplate,
)
from app.schemas.hr import (
    AllowanceTypeCreate, AllowanceTypeResponse,
    AttendanceCreate, AttendanceResponse, AttendanceUpdate,
    BranchCreate, BranchResponse, BranchUpdate,
    DeductionTypeCreate, DeductionTypeResponse,
    DepartmentCreate, DepartmentResponse, DepartmentUpdate,
    EmployeeCreate, EmployeeDetail, EmployeeResponse, EmployeeUpdate,
    EmployeeTaskCreate, EmployeeTaskResponse, EmployeeTaskUpdate,
    AttendanceBreakdown, EmployeePerformanceData, HolidayCreate, HolidayResponse,
    MonthlyTaskCount, TaskStats,
    LeaveCreate, LeaveDetail, LeaveResponse, LeaveUpdate,
    LeaveTypeCreate, LeaveTypeResponse,
    PayrollResponse, PayrollUpdate,
    PerformanceReviewCreate, PerformanceReviewResponse, PerformanceReviewUpdate,
    PositionCreate, PositionResponse, PositionUpdate,
    SalaryStructureCreate, SalaryStructureResponse, SalaryStructureUpdate,
    ShiftTemplateCreate, ShiftTemplateResponse, ShiftTemplateUpdate,
)
from app.services.hr import AttendanceService, LeaveService, PayrollService
from app.services.soft_delete_service import SoftDeleteService

router = APIRouter()


# ==================== DEPARTMENTS ====================

@router.get("/departments", response_model=List[DepartmentResponse])
def list_departments(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    q = db.query(Department).filter(Department.is_deleted == False)
    if active_only:
        q = q.filter(Department.is_active.is_(True))
    return q.order_by(Department.name).all()


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    if db.query(Department).filter(Department.code == payload.code).first():
        raise HTTPException(400, "Department code already exists")
    now = datetime.utcnow()
    dept = Department(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(dept.id), record_label=f"Department: {dept.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in dept.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="department", record_id=dept.id,
        record_label=f"Department: {dept.name}",
        new_values={k: str(v) for k, v in dept.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return dept


@router.put("/departments/{dept_id}", response_model=DepartmentResponse)
def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    old_data = {k: str(v) for k, v in dept.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(dept, k, v)
    dept.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dept)
    new_data = {k: str(v) for k, v in dept.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="UPDATE",
        record_id=str(dept_id), record_label=f"Department: {dept.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="department", record_id=dept_id,
        record_label=f"Department: {dept.name}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return dept


@router.delete("/departments/{dept_id}", status_code=204)
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    if db.query(Employee).filter(Employee.department_id == dept_id, Employee.is_active.is_(True)).count():
        raise HTTPException(400, "Cannot delete department with active employees")
    old_data = {k: str(v) for k, v in dept.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="DELETE",
        record_id=str(dept_id), record_label=f"Department: {dept.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data,
    )
    log_activity(
        db=db, user=current_user, action="delete", module="hr",
        record_type="department", record_id=dept_id,
        record_label=f"Department: {dept.name}",
        old_values={"id": str(dept_id)},
    )
    SoftDeleteService.soft_delete(db, dept, current_user, "hr_departments")
    db.commit()


# ==================== POSITIONS ====================

@router.get("/positions", response_model=List[PositionResponse])
def list_positions(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    q = db.query(Position)
    if active_only:
        q = q.filter(Position.is_active.is_(True))
    return q.order_by(Position.title).all()


@router.post("/positions", response_model=PositionResponse, status_code=201)
def create_position(
    payload: PositionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    if db.query(Position).filter(Position.code == payload.code).first():
        raise HTTPException(400, "Position code already exists")
    now = datetime.utcnow()
    pos = Position(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(pos)
    db.commit()
    db.refresh(pos)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(pos.id), record_label=f"Position: {pos.title}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in pos.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="position", record_id=pos.id,
        record_label=f"Position: {pos.title}",
        new_values={k: str(v) for k, v in pos.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return pos


@router.put("/positions/{pos_id}", response_model=PositionResponse)
def update_position(
    pos_id: int,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    pos = db.query(Position).filter(Position.id == pos_id).first()
    if not pos:
        raise HTTPException(404, "Position not found")
    old_data = {k: str(v) for k, v in pos.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(pos, k, v)
    pos.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pos)
    new_data = {k: str(v) for k, v in pos.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="UPDATE",
        record_id=str(pos_id), record_label=f"Position: {pos.title}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="position", record_id=pos_id,
        record_label=f"Position: {pos.title}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return pos


# ==================== BRANCHES ====================

@router.get("/branches", response_model=List[BranchResponse])
def list_branches(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    q = db.query(Branch)
    if active_only:
        q = q.filter(Branch.is_active.is_(True))
    return q.order_by(Branch.name).all()


@router.post("/branches", response_model=BranchResponse, status_code=201)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    if db.query(Branch).filter(Branch.code == payload.code).first():
        raise HTTPException(400, "Branch code already exists")
    now = datetime.utcnow()
    branch = Branch(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(branch.id), record_label=f"Branch: {branch.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in branch.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="branch", record_id=branch.id,
        record_label=f"Branch: {branch.name}",
        new_values={k: str(v) for k, v in branch.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return branch

@router.put("/branches/{branch_id}", response_model=BranchResponse)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")
    old_data = {k: str(v) for k, v in branch.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(branch, k, v)
    branch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(branch)
    new_data = {k: str(v) for k, v in branch.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="UPDATE",
        record_id=str(branch_id), record_label=f"Branch: {branch.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="branch", record_id=branch_id,
        record_label=f"Branch: {branch.name}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return branch


@router.put("/branches/{branch_id}", response_model=BranchResponse)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:manage")),
):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(branch, k, v)
    branch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(branch)
    return branch


# ==================== SHIFT TEMPLATES ====================

@router.get("/shift-templates", response_model=List[ShiftTemplateResponse])
def list_shift_templates(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    q = db.query(ShiftTemplate)
    if active_only:
        q = q.filter(ShiftTemplate.is_active.is_(True))
    return q.order_by(ShiftTemplate.shift_name).all()


@router.post("/shift-templates", response_model=ShiftTemplateResponse, status_code=201)
def create_shift_template(
    payload: ShiftTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    if db.query(ShiftTemplate).filter(ShiftTemplate.shift_name == payload.shift_name).first():
        raise HTTPException(400, "Shift template name already exists")
    now = datetime.utcnow()
    st = ShiftTemplate(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(st)
    db.commit()
    db.refresh(st)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(st.id), record_label=f"Shift Template: {st.shift_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in st.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="shift_template", record_id=st.id,
        record_label=f"Shift Template: {st.shift_name}",
        new_values={k: str(v) for k, v in st.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return st


@router.put("/shift-templates/{shift_id}", response_model=ShiftTemplateResponse)
def update_shift_template(
    shift_id: int,
    payload: ShiftTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    st = db.query(ShiftTemplate).filter(ShiftTemplate.id == shift_id).first()
    if not st:
        raise HTTPException(404, "Shift template not found")
    old_data = {k: str(v) for k, v in st.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(st, k, v)
    st.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(st)
    new_data = {k: str(v) for k, v in st.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="UPDATE",
        record_id=str(shift_id), record_label=f"Shift Template: {st.shift_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="shift_template", record_id=shift_id,
        record_label=f"Shift Template: {st.shift_name}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return st


@router.delete("/shift-templates/{shift_id}", status_code=204)
def delete_shift_template(
    shift_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    st = db.query(ShiftTemplate).filter(ShiftTemplate.id == shift_id).first()
    if not st:
        raise HTTPException(404, "Shift template not found")
    SoftDeleteService.soft_delete(db, st, current_user, "hr_shift_templates", request=request)
    db.commit()


# ==================== EMPLOYEES ====================

@router.get("/employees", response_model=List[EmployeeResponse])
def list_employees(
    response: Response,
    department_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    filter: Optional[str] = None,
    startDate: Optional[date] = None,
    endDate: Optional[date] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    query = db.query(Employee).filter(Employee.is_active.is_(True), Employee.is_deleted == False).order_by(Employee.full_name)
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    if branch_id:
        query = query.filter(Employee.branch_id == branch_id)
    if status:
        query = query.filter(Employee.employment_status == status)

    query, total = apply_table_filters(
        query=query,
        model=Employee,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Employee.full_name, Employee.employee_id, Employee.personal_email, Employee.work_email, Employee.personal_phone],
        date_filter=filter,
        date_field=Employee.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    return query.all()


@router.post("/employees", response_model=EmployeeResponse, status_code=201)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    now = datetime.utcnow()
    parts = [payload.first_name]
    if payload.middle_name:
        parts.append(payload.middle_name)
    parts.append(payload.last_name)
    full_name = " ".join(parts)

    emp = Employee(
        **payload.model_dump(),
        employee_id=next_tid(db, Employee, "EMP"),
        full_name=full_name,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(emp.id), record_label=f"Employee: {emp.full_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in emp.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="employee", record_id=emp.id,
        record_label=f"Employee: {emp.full_name}",
        new_values={k: str(v) for k, v in emp.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return emp


# ── Employee Search (MUST be before /employees/{emp_id} dynamic route) ─────────

@router.get("/employees/search")
def employee_search(
    q: str = "",
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    """Lightweight employee search by name, code, phone, or email for dropdowns."""
    if not q or not q.strip():
        return []
    like = f"%{q.strip()}%"
    employees = (
        db.query(Employee)
        .options(joinedload(Employee.department))
        .filter(
            Employee.first_name.ilike(like) |
            Employee.last_name.ilike(like) |
            Employee.employee_code.ilike(like) |
            Employee.phone.ilike(like) |
            Employee.email.ilike(like)
        )
        .order_by(Employee.first_name.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "employee_code": e.employee_code or str(e.id),
            "name": f"{e.first_name} {e.last_name}",
            "full_name": f"{e.first_name} {e.last_name}",
            "phone": e.phone,
            "email": e.email,
            "department": e.department.name if e.department else None,
            "status": e.status,
        }
        for e in employees
    ]


@router.get("/employees/{emp_id}", response_model=EmployeeDetail)
def get_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    emp = (
        db.query(Employee)
        .options(
            joinedload(Employee.department),
            joinedload(Employee.position),
            joinedload(Employee.branch),
            joinedload(Employee.manager),
            joinedload(Employee.salary_structure),
        )
        .filter(Employee.id == emp_id)
        .first()
    )
    if not emp:
        raise HTTPException(404, "Employee not found")
    return emp


@router.put("/employees/{emp_id}", response_model=EmployeeResponse)
def update_employee(
    emp_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    old_data = {k: str(v) for k, v in emp.__dict__.items() if not k.startswith('_')}
    data = payload.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(emp, k, v)
    # Recompute full_name if name fields changed
    if any(k in data for k in ("first_name", "middle_name", "last_name")):
        parts = [emp.first_name]
        if emp.middle_name:
            parts.append(emp.middle_name)
        parts.append(emp.last_name)
        emp.full_name = " ".join(parts)
    emp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(emp)
    new_data = {k: str(v) for k, v in emp.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="UPDATE",
        record_id=str(emp_id), record_label=f"Employee: {emp.full_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="employee", record_id=emp_id,
        record_label=f"Employee: {emp.full_name}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return emp


@router.delete("/employees/{emp_id}", status_code=204)
def deactivate_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    old_data = {k: str(v) for k, v in emp.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="DELETE",
        record_id=str(emp_id), record_label=f"Employee: {emp.full_name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data,
    )
    log_activity(
        db=db, user=current_user, action="delete", module="hr",
        record_type="employee", record_id=emp_id,
        record_label=f"Employee: {emp.full_name}",
        old_values={"id": str(emp_id)},
    )
    SoftDeleteService.soft_delete(db, emp, current_user, "hr_employees")
    db.commit()


# ==================== SALARY STRUCTURE ====================

@router.get("/employees/{emp_id}/salary", response_model=SalaryStructureResponse)
def get_salary_structure(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    salary = db.query(SalaryStructure).filter(
        SalaryStructure.employee_id == emp_id,
    ).first()
    if not salary:
        raise HTTPException(404, "Salary structure not found")
    return salary


@router.post("/employees/{emp_id}/salary", response_model=SalaryStructureResponse, status_code=201)
def create_salary_structure(
    emp_id: int,
    payload: SalaryStructureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    if not db.query(Employee).filter(Employee.id == emp_id).first():
        raise HTTPException(404, "Employee not found")

    gross = (
        payload.basic_salary + payload.house_rent_allowance + payload.conveyance_allowance
        + payload.medical_allowance + payload.special_allowance + payload.other_allowances
    )
    total_ded = (
        payload.provident_fund + payload.professional_tax
        + payload.income_tax + payload.other_deductions
    )
    now = datetime.utcnow()

    # Upsert: update existing row if present (unique constraint on employee_id)
    existing = db.query(SalaryStructure).filter(
        SalaryStructure.employee_id == emp_id,
    ).first()
    if existing:
        old_data = {k: str(v) for k, v in existing.__dict__.items() if not k.startswith('_')}
        for k, v in payload.model_dump(exclude={"employee_id"}).items():
            setattr(existing, k, v)
        existing.gross_salary = gross
        existing.total_deductions = total_ded
        existing.net_salary = gross - total_ded
        existing.is_active = True
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        log_action(
            db=db, module="hr", action="UPDATE",
            record_id=str(emp_id), record_label=f"Salary: Employee {emp_id}",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
            old_data=old_data, new_data={k: str(v) for k, v in existing.__dict__.items() if not k.startswith('_')},
        )
        log_activity(
            db=db, user=current_user, action="update", module="hr",
            record_type="salary_structure", record_id=emp_id,
            record_label=f"Salary: Employee {emp_id}",
            old_values=old_data, new_values={k: str(v) for k, v in existing.__dict__.items() if not k.startswith('_')},
        )
        db.commit()
        return existing

    salary = SalaryStructure(
        **payload.model_dump(),
        employee_id=emp_id,
        gross_salary=gross,
        total_deductions=total_ded,
        net_salary=gross - total_ded,
        created_at=now,
        updated_at=now,
    )
    db.add(salary)
    db.commit()
    db.refresh(salary)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(emp_id), record_label=f"Salary: Employee {emp_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in salary.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="salary_structure", record_id=emp_id,
        record_label=f"Salary: Employee {emp_id}",
        new_values={k: str(v) for k, v in salary.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return salary


@router.put("/employees/{emp_id}/salary", response_model=SalaryStructureResponse)
def update_salary_structure(
    emp_id: int,
    payload: SalaryStructureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    salary = db.query(SalaryStructure).filter(
        SalaryStructure.employee_id == emp_id,
    ).first()
    if not salary:
        raise HTTPException(404, "Salary structure not found")
    old_data = {k: str(v) for k, v in salary.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(salary, k, v)
    # Recompute totals
    salary.gross_salary = (
        salary.basic_salary + salary.house_rent_allowance + salary.conveyance_allowance
        + salary.medical_allowance + salary.special_allowance + salary.other_allowances
    )
    salary.total_deductions = (
        salary.provident_fund + salary.professional_tax
        + salary.income_tax + salary.other_deductions
    )
    salary.net_salary = salary.gross_salary - salary.total_deductions
    salary.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(salary)
    new_data = {k: str(v) for k, v in salary.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="UPDATE",
        record_id=str(emp_id), record_label=f"Salary: Employee {emp_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="salary_structure", record_id=emp_id,
        record_label=f"Salary: Employee {emp_id}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return salary


# ==================== ATTENDANCE ====================

@router.get("/attendance", response_model=List[AttendanceResponse])
def list_attendance(
    employee_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    q = db.query(Attendance)
    if employee_id:
        q = q.filter(Attendance.employee_id == employee_id)
    if from_date:
        q = q.filter(Attendance.attendance_date >= from_date)
    if to_date:
        q = q.filter(Attendance.attendance_date <= to_date)
    return q.order_by(Attendance.attendance_date.desc()).all()


@router.post("/attendance", response_model=AttendanceResponse, status_code=201)
def mark_attendance(
    payload: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:view")),
):
    if not db.query(Employee).filter(Employee.id == payload.employee_id, Employee.is_active.is_(True)).first():
        raise HTTPException(404, "Employee not found")
    record = AttendanceService.mark_attendance(
        db=db,
        employee_id=payload.employee_id,
        attendance_date=payload.attendance_date,
        check_in_time=payload.check_in_time,
        check_out_time=payload.check_out_time,
        attendance_status=payload.attendance_status,
        notes=payload.notes,
        is_manual_correction=payload.is_manual_correction,
        correction_reason=payload.correction_reason,
        corrected_by=current_user.id if payload.is_manual_correction else None,
    )
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(record.id) if record else payload.employee_id,
        record_label=f"Attendance: Employee {payload.employee_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={"employee_id": payload.employee_id, "date": str(payload.attendance_date)},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="attendance", record_id=record.id if record else payload.employee_id,
        record_label=f"Attendance: Employee {payload.employee_id}",
        new_values={"employee_id": str(payload.employee_id), "date": str(payload.attendance_date)},
    )
    db.commit()
    return record

@router.put("/attendance/{att_id}", response_model=AttendanceResponse)
def update_attendance(
    att_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    record = db.query(Attendance).filter(Attendance.id == att_id).first()
    if not record:
        raise HTTPException(404, "Attendance record not found")
    old_data = {k: str(v) for k, v in record.__dict__.items() if not k.startswith('_')}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(record, k, v)
    record.is_manual_correction = True
    record.corrected_by = current_user.id
    record.is_approved = False  # Requires re-approval after correction
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    new_data = {k: str(v) for k, v in record.__dict__.items() if not k.startswith('_')}
    log_action(
        db=db, module="hr", action="UPDATE",
        record_id=str(att_id), record_label=f"Attendance: {att_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        old_data=old_data, new_data=new_data,
    )
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="attendance", record_id=att_id,
        record_label=f"Attendance: {att_id}",
        old_values=old_data, new_values=new_data,
    )
    db.commit()
    return record

@router.post("/attendance/{att_id}/approve", response_model=AttendanceResponse)
def approve_attendance_correction(
    att_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    result = AttendanceService.approve_correction(db, att_id, current_user.id)
    log_action(
        db=db, module="hr", action="UPDATE",
        record_id=str(att_id), record_label=f"Attendance approved: {att_id}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
    )
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="attendance", record_id=att_id,
        record_label=f"Attendance approved: {att_id}",
    )
    db.commit()
    return result


@router.get("/attendance/report/daily")
def daily_attendance_report(
    report_date: date = Query(default=None),
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    if not report_date:
        report_date = date.today()
    return AttendanceService.get_department_daily_report(db, report_date, department_id)


@router.get("/attendance/report/monthly")
def monthly_attendance_report(
    employee_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    return AttendanceService.get_monthly_summary(db, employee_id, year, month)


# ==================== LEAVE TYPES ====================

@router.get("/leave-types", response_model=List[LeaveTypeResponse])
def list_leave_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    return db.query(LeaveType).filter(LeaveType.is_active.is_(True)).order_by(LeaveType.name).all()


@router.post("/leave-types", response_model=LeaveTypeResponse, status_code=201)
def create_leave_type(
    payload: LeaveTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    if db.query(LeaveType).filter(LeaveType.code == payload.code).first():
        raise HTTPException(400, "Leave type code already exists")
    now = datetime.utcnow()
    lt = LeaveType(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(lt)
    db.commit()
    db.refresh(lt)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(lt.id), record_label=f"Leave Type: {lt.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in lt.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="leave_type", record_id=lt.id,
        record_label=f"Leave Type: {lt.name}",
        new_values={k: str(v) for k, v in lt.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return lt


# ==================== LEAVES ====================

@router.get("/leaves", response_model=List[LeaveResponse])
def list_leaves(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    q = db.query(Leave).filter(Leave.is_active.is_(True))
    if employee_id:
        q = q.filter(Leave.employee_id == employee_id)
    if status:
        q = q.filter(Leave.status == status)
    if from_date:
        q = q.filter(Leave.start_date >= from_date)
    if to_date:
        q = q.filter(Leave.end_date <= to_date)
    return q.order_by(Leave.created_at.desc()).all()


@router.post("/leaves", response_model=LeaveResponse, status_code=201)
def request_leave(
    payload: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:view")),
):
    try:
        leave = LeaveService.request_leave(
            db=db,
            employee_id=payload.employee_id,
            leave_type_id=payload.leave_type_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            reason=payload.reason,
            requested_by=current_user.id,
            medical_certificate=payload.medical_certificate,
        )
        log_action(
            db=db, module="hr", action="CREATE",
            record_id=str(leave.id) if leave else "",
            record_label=f"Leave: Employee {payload.employee_id}",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
            new_data={"employee_id": payload.employee_id, "start": str(payload.start_date), "end": str(payload.end_date)},
        )
        log_activity(
            db=db, user=current_user, action="create", module="hr",
            record_type="leave", record_id=leave.id if leave else "",
            record_label=f"Leave: Employee {payload.employee_id}",
            new_values={"employee_id": str(payload.employee_id), "start": str(payload.start_date), "end": str(payload.end_date)},
        )
        db.commit()
        return leave
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/leaves/{leave_id}", response_model=LeaveDetail)
def get_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    leave = (
        db.query(Leave)
        .options(joinedload(Leave.employee), joinedload(Leave.leave_type))
        .filter(Leave.id == leave_id)
        .first()
    )
    if not leave:
        raise HTTPException(404, "Leave not found")
    return leave


@router.post("/leaves/{leave_id}/approve", response_model=LeaveResponse)
def approve_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    try:
        result = LeaveService.approve_leave(db, leave_id, current_user.id)
        log_action(
            db=db, module="hr", action="UPDATE",
            record_id=str(leave_id), record_label=f"Leave approved: {leave_id}",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        )
        log_activity(
            db=db, user=current_user, action="update", module="hr",
            record_type="leave", record_id=leave_id,
            record_label=f"Leave approved: {leave_id}",
        )
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/leaves/{leave_id}/reject", response_model=LeaveResponse)
def reject_leave(
    leave_id: int,
    rejection_reason: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    try:
        result = LeaveService.reject_leave(db, leave_id, current_user.id, rejection_reason)
        log_action(
            db=db, module="hr", action="UPDATE",
            record_id=str(leave_id), record_label=f"Leave rejected: {leave_id}",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        )
        log_activity(
            db=db, user=current_user, action="update", module="hr",
            record_type="leave", record_id=leave_id,
            record_label=f"Leave rejected: {leave_id}",
        )
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/leaves/{leave_id}/cancel", response_model=LeaveResponse)
def cancel_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:view")),
):
    try:
        result = LeaveService.cancel_leave(db, leave_id, current_user.id)
        log_action(
            db=db, module="hr", action="UPDATE",
            record_id=str(leave_id), record_label=f"Leave cancelled: {leave_id}",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        )
        log_activity(
            db=db, user=current_user, action="update", module="hr",
            record_type="leave", record_id=leave_id,
            record_label=f"Leave cancelled: {leave_id}",
        )
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/leaves/balance/{employee_id}")
def get_leave_balance(
    employee_id: int,
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    if not year:
        year = date.today().year
    return LeaveService.get_employee_balances(db, employee_id, year)


# ==================== PAYROLL ====================

@router.get("/payroll", response_model=List[PayrollResponse])
def list_payroll(
    payroll_period: Optional[str] = None,
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    q = db.query(Payroll)
    if payroll_period:
        q = q.filter(Payroll.payroll_period == payroll_period)
    if employee_id:
        q = q.filter(Payroll.employee_id == employee_id)
    if status:
        q = q.filter(Payroll.status == status)
    return q.order_by(Payroll.payroll_period.desc(), Payroll.employee_id).all()


@router.post("/payroll/calculate", response_model=PayrollResponse, status_code=201)
def calculate_payroll(
    employee_id: int,
    payroll_period: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    # Check for duplicate
    existing = db.query(Payroll).filter(
        Payroll.employee_id == employee_id,
        Payroll.payroll_period == payroll_period,
    ).first()
    if existing:
        raise HTTPException(400, f"Payroll already exists for this employee and period (id={existing.id})")
    try:
        result = PayrollService.calculate_payroll(db, employee_id, payroll_period, current_user)
        log_action(
            db=db, module="hr", action="CREATE",
            record_id=str(result.id) if result else "",
            record_label=f"Payroll: Employee {employee_id} ({payroll_period})",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
            new_data={"employee_id": employee_id, "period": payroll_period},
        )
        log_activity(
            db=db, user=current_user, action="create", module="hr",
            record_type="payroll", record_id=result.id,
            record_label=f"Payroll: Employee {employee_id} ({payroll_period})",
            new_values={"employee_id": str(employee_id), "period": payroll_period},
        )
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/payroll/calculate-all", response_model=List[PayrollResponse])
def calculate_all_payroll(
    payroll_period: str,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    """Bulk calculate payroll for all active employees in a period."""
    q = db.query(Employee).filter(
        Employee.is_active.is_(True),
        Employee.employment_status == "Active",
    )
    if department_id:
        q = q.filter(Employee.department_id == department_id)
    employees = q.all()

    results = []
    errors = []
    for emp in employees:
        existing = db.query(Payroll).filter(
            Payroll.employee_id == emp.id,
            Payroll.payroll_period == payroll_period,
        ).first()
        if existing:
            results.append(existing)
            continue
        try:
            p = PayrollService.calculate_payroll(db, emp.id, payroll_period, current_user)
            results.append(p)
        except ValueError as e:
            errors.append({"employee_id": emp.id, "error": str(e)})

    log_action(
        db=db, module="hr", action="CREATE",
        record_id=f"bulk-{payroll_period}", record_label=f"Payroll bulk: {payroll_period}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={"period": payroll_period, "count": len(results), "department_id": department_id},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="payroll", record_id=f"bulk-{payroll_period}",
        record_label=f"Payroll bulk: {payroll_period}",
        new_values={"period": payroll_period, "count": str(len(results)), "department_id": str(department_id)},
    )
    db.commit()
    return results


@router.get("/payroll/{payroll_id}", response_model=PayrollResponse)
def get_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(404, "Payroll record not found")
    return p


@router.post("/payroll/{payroll_id}/approve", response_model=PayrollResponse)
def approve_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    try:
        result = PayrollService.approve_payroll(db, payroll_id, current_user)
        log_action(
            db=db, module="hr", action="UPDATE",
            record_id=str(payroll_id), record_label=f"Payroll approved: {payroll_id}",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        )
        log_activity(
            db=db, user=current_user, action="update", module="hr",
            record_type="payroll", record_id=payroll_id,
            record_label=f"Payroll approved: {payroll_id}",
        )
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/payroll/{payroll_id}/post-accounting")
def post_payroll_to_accounting(
    payroll_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("hr:manage")),
):
    try:
        PayrollService.post_payroll_to_accounting(db, payroll_id, user)
        return {"message": "Payroll posted to accounting successfully"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/payroll/{payroll_id}/mark-paid", response_model=PayrollResponse)
def mark_payroll_paid(
    payroll_id: int,
    payload: PayrollUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    if not payload.payment_date or not payload.payment_method:
        raise HTTPException(400, "payment_date and payment_method are required")
    try:
        result = PayrollService.mark_as_paid(
            db,
            payroll_id,
            payload.payment_date,
            payload.payment_method,
            payload.transaction_reference,
            payload.bank_account,
        )
        log_action(
            db=db, module="hr", action="UPDATE",
            record_id=str(payroll_id), record_label=f"Payroll paid: {payroll_id}",
            changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        )
        log_activity(
            db=db, user=current_user, action="update", module="hr",
            record_type="payroll", record_id=payroll_id,
            record_label=f"Payroll paid: {payroll_id}",
        )
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/payroll/{payroll_id}/payslip")
def get_payslip_data(
    payroll_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    payroll = db.query(Payroll).options(joinedload(Payroll.employee)).filter(Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(404, "Payroll not found")
    return PayrollService.generate_payslip_data(payroll, payroll.employee)


@router.get("/payroll/report/summary")
def payroll_summary_report(
    payroll_period: str,
    department_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    return PayrollService.generate_payroll_summary(db, payroll_period, department_id, branch_id)


# ==================== HOLIDAYS ====================

@router.get("/holidays", response_model=List[HolidayResponse])
def list_holidays(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    q = db.query(Holiday).filter(Holiday.is_active.is_(True))
    if year:
        from sqlalchemy import extract
        q = q.filter(extract("year", Holiday.holiday_date) == year)
    return q.order_by(Holiday.holiday_date).all()


@router.post("/holidays", response_model=HolidayResponse, status_code=201)
def create_holiday(
    payload: HolidayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    if db.query(Holiday).filter(Holiday.holiday_date == payload.holiday_date).first():
        raise HTTPException(400, "Holiday already exists for this date")
    now = datetime.utcnow()
    h = Holiday(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(h)
    db.commit()
    db.refresh(h)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(h.id), record_label=f"Holiday: {h.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in h.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="holiday", record_id=h.id,
        record_label=f"Holiday: {h.name}",
        new_values={k: str(v) for k, v in h.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return h


@router.delete("/holidays/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    h = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(404, "Holiday not found")
    SoftDeleteService.soft_delete(db, h, current_user, "hr_holidays", request=request)
    db.commit()


# ==================== ALLOWANCE / DEDUCTION TYPES ====================

@router.get("/allowance-types", response_model=List[AllowanceTypeResponse])
def list_allowance_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    return db.query(AllowanceType).filter(AllowanceType.is_active.is_(True)).all()


@router.post("/allowance-types", response_model=AllowanceTypeResponse, status_code=201)
def create_allowance_type(
    payload: AllowanceTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    now = datetime.utcnow()
    at = AllowanceType(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(at)
    db.commit()
    db.refresh(at)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(at.id), record_label=f"Allowance Type: {at.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in at.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="allowance_type", record_id=at.id,
        record_label=f"Allowance Type: {at.name}",
        new_values={k: str(v) for k, v in at.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return at


@router.get("/deduction-types", response_model=list[DeductionTypeResponse])
def list_deduction_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:create", "hr:update", "hr:manage")),
):
    return db.query(DeductionType).filter(DeductionType.is_active.is_(True)).all()


@router.post("/deduction-types", response_model=DeductionTypeResponse, status_code=201)
def create_deduction_type(
    payload: DeductionTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    now = datetime.utcnow()
    dt = DeductionType(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(dt)
    db.commit()
    db.refresh(dt)
    log_action(
        db=db, module="hr", action="CREATE",
        record_id=str(dt.id), record_label=f"Deduction Type: {dt.name}",
        changed_by=current_user.email, changed_by_role=getattr(getattr(current_user, 'role', None), 'name', None),
        new_data={k: str(v) for k, v in dt.__dict__.items() if not k.startswith('_')},
    )
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="deduction_type", record_id=dt.id,
        record_label=f"Deduction Type: {dt.name}",
        new_values={k: str(v) for k, v in dt.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return dt


@router.get("/stats")
def hr_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:manage")),
):
    total_employees = db.query(Employee).filter(
        Employee.is_active.is_(True)
    ).count()
    return {"total": total_employees}


# ==================== EMPLOYEE TASKS ====================

@router.get("/tasks", response_model=List[EmployeeTaskResponse])
def list_tasks(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    query = db.query(EmployeeTask).filter(EmployeeTask.is_active.is_(True))
    if employee_id:
        query = query.filter(EmployeeTask.employee_id == employee_id)
    if status:
        query = query.filter(EmployeeTask.status == status)
    return query.order_by(EmployeeTask.created_at.desc()).all()


@router.post("/tasks", response_model=EmployeeTaskResponse, status_code=201)
def create_task(
    payload: EmployeeTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    task = EmployeeTask(
        employee_id=payload.employee_id,
        assigned_by=current_user.id,
        title=payload.title,
        description=payload.description,
        deadline=payload.deadline,
        priority=payload.priority,
        status=payload.status,
        assigned_date=datetime.utcnow(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    log_activity(
        db=db, user=current_user, action="create", module="hr",
        record_type="task", record_id=task.id,
        record_label=f"Task: {task.title}",
        new_values={k: str(v) for k, v in task.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return task


@router.patch("/tasks/{task_id}", response_model=EmployeeTaskResponse)
def update_task(
    task_id: int,
    payload: EmployeeTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    task = db.query(EmployeeTask).filter(EmployeeTask.id == task_id, EmployeeTask.is_active.is_(True)).first()
    if not task:
        raise HTTPException(404, "Task not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    if payload.status == "completed" and not task.completed_date:
        task.completed_date = datetime.utcnow()
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="task", record_id=task.id,
        record_label=f"Task: {task.title}",
        new_values={k: str(v) for k, v in task.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    task = db.query(EmployeeTask).filter(EmployeeTask.id == task_id, EmployeeTask.is_active.is_(True)).first()
    if not task:
        raise HTTPException(404, "Task not found")
    SoftDeleteService.soft_delete(db, task, current_user, "hr_tasks", request=Request)
    db.commit()


# ==================== PERFORMANCE REVIEWS ====================

@router.get("/performance/employee/{employee_id}", response_model=EmployeePerformanceData)
def get_employee_performance(
    employee_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    try:
        employee = db.query(Employee).filter(Employee.id == employee_id, Employee.is_active.is_(True)).first()
        if not employee:
            raise HTTPException(404, "Employee not found")

        now = datetime.utcnow()
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Task stats
        tasks = db.query(EmployeeTask).filter(
            EmployeeTask.employee_id == employee_id,
            EmployeeTask.is_active.is_(True),
        ).all()
        total_tasks = len(tasks)
        pending = sum(1 for t in tasks if t.status == "pending")
        in_progress = sum(1 for t in tasks if t.status == "in_progress")
        completed = sum(1 for t in tasks if t.status == "completed")
        overdue = sum(1 for t in tasks if t.status == "overdue")
        not_fulfilled = sum(1 for t in tasks if t.status == "not_fulfilled")
        completion_rate = (completed / total_tasks * 100) if total_tasks > 0 else 0

        # Monthly task trend (last 6 months)
        monthly_trend = []
        for i in range(5, -1, -1):
            try:
                if current_month_start.month > i:
                    ms = current_month_start.replace(month=current_month_start.month - i)
                else:
                    ms = current_month_start.replace(year=current_month_start.year - 1, month=12 + current_month_start.month - i)
                month_start = ms
                if i == 0:
                    month_end = now
                else:
                    nm = i - 1
                    if current_month_start.month > nm:
                        me = current_month_start.replace(month=current_month_start.month - nm)
                    else:
                        me = current_month_start.replace(year=current_month_start.year - 1, month=12 + current_month_start.month - nm)
                    month_end = me
                month_label = month_start.strftime("%Y-%m")
                assigned_count = sum(1 for t in tasks if t.assigned_date and month_start <= t.assigned_date < month_end)
                completed_count = sum(1 for t in tasks if t.completed_date and month_start <= t.completed_date < month_end)
                monthly_trend.append(MonthlyTaskCount(month=month_label, assigned=assigned_count, completed=completed_count))
            except Exception as e:
                log.warning("Monthly trend calculation error for month index %d: %s", i, e)
                monthly_trend.append(MonthlyTaskCount(month=current_month_start.strftime("%Y-%m"), assigned=0, completed=0))

        # Attendance rate (last 90 days)
        ninety_days_ago = now - timedelta(days=90)
        attendances = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date >= ninety_days_ago.date(),
            Attendance.attendance_date <= now.date(),
        ).all()
        total_days = len(attendances)
        present_days = sum(1 for a in attendances if a.attendance_status.lower() in ("present", "late", "half_day"))
        attendance_rate = (present_days / total_days * 100) if total_days > 0 else 100
        attendance_breakdown = AttendanceBreakdown(
            total_days=total_days,
            present=sum(1 for a in attendances if a.attendance_status.lower() == "present"),
            absent=sum(1 for a in attendances if a.attendance_status.lower() == "absent"),
            late=sum(1 for a in attendances if a.attendance_status.lower() == "late"),
            half_day=sum(1 for a in attendances if a.attendance_status.lower() == "half_day"),
            on_leave=sum(1 for a in attendances if a.attendance_status.lower() == "on_leave"),
        )

        # Latest review
        latest_review = db.query(PerformanceReview).filter(
            PerformanceReview.employee_id == employee_id,
            PerformanceReview.is_active.is_(True),
        ).order_by(PerformanceReview.review_date.desc()).first()

        review_history = db.query(PerformanceReview).filter(
            PerformanceReview.employee_id == employee_id,
            PerformanceReview.is_active.is_(True),
        ).order_by(PerformanceReview.review_date.desc()).all()

        # Overall score: 40% tasks + 30% attendance + 30% manual
        manual = float(latest_review.manual_score) if latest_review and latest_review.manual_score is not None else 0
        overall = (completion_rate * 0.4) + (attendance_rate * 0.3) + (manual * 0.3)

        # Rank in department
        dept_id = employee.department_id
        dept_employees = db.query(Employee).filter(
            Employee.department_id == dept_id,
            Employee.is_active.is_(True),
        ).all() if dept_id else []
        dept_scores = []
        for de in dept_employees:
            if de.id == employee_id:
                dept_scores.append(overall)
                continue
            de_tasks = db.query(EmployeeTask).filter(
                EmployeeTask.employee_id == de.id,
                EmployeeTask.is_active.is_(True),
            ).all()
            de_total = len(de_tasks)
            de_completed = sum(1 for t in de_tasks if t.status == "completed")
            de_rate = (de_completed / de_total * 100) if de_total > 0 else 0
            de_att = db.query(Attendance).filter(
                Attendance.employee_id == de.id,
                Attendance.attendance_date >= ninety_days_ago.date(),
            ).all()
            de_present = sum(1 for a in de_att if a.attendance_status.lower() in ("present", "late", "half_day"))
            de_att_rate = (de_present / len(de_att) * 100) if de_att else 100
            de_review = db.query(PerformanceReview).filter(
                PerformanceReview.employee_id == de.id,
                PerformanceReview.is_active.is_(True),
            ).order_by(PerformanceReview.review_date.desc()).first()
            de_manual = float(de_review.manual_score) if de_review and de_review.manual_score is not None else 0
            de_overall = (de_rate * 0.4) + (de_att_rate * 0.3) + (de_manual * 0.3)
            dept_scores.append(de_overall)
        dept_scores.sort(reverse=True)
        rank = next((i + 1 for i, s in enumerate(dept_scores) if s <= overall), len(dept_scores))
        total_in_dept = len(dept_employees)

        return EmployeePerformanceData(
            employee_id=employee.id,
            employee_name=employee.full_name or f"{employee.first_name} {employee.last_name}",
            department=employee.department.name if employee.department else None,
            designation=employee.position.title if employee.position else None,
            photo=None,
            employment_status=employee.employment_status,
            joining_date=employee.joining_date,
            task_stats=TaskStats(
                total=total_tasks, pending=pending, in_progress=in_progress,
                completed=completed, overdue=overdue, not_fulfilled=not_fulfilled,
                completion_rate=round(completion_rate, 1),
            ),
            tasks=tasks,
            attendance_rate=round(attendance_rate, 1),
            attendance_breakdown=attendance_breakdown,
            task_monthly_trend=monthly_trend,
            current_review=latest_review,
            review_history=review_history,
            overall_score=round(overall, 1),
            rank_in_dept=rank,
            total_in_dept=total_in_dept,
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error("Performance data error for employee %d: %s", employee_id, e, exc_info=True)
        raise HTTPException(500, f"Failed to load performance data: {type(e).__name__}: {e}")


@router.get("/performance/rankings")
def get_performance_rankings(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    try:
        query = db.query(Employee).filter(Employee.is_active.is_(True))
        if department_id:
            query = query.filter(Employee.department_id == department_id)
        employees = query.all()

        now = datetime.utcnow()
        ninety_days_ago = now - timedelta(days=90)
        rankings = []

        for emp in employees:
            try:
                tasks = db.query(EmployeeTask).filter(
                    EmployeeTask.employee_id == emp.id,
                    EmployeeTask.is_active.is_(True),
                ).all()
                total = len(tasks)
                completed = sum(1 for t in tasks if t.status == "completed")
                task_rate = (completed / total * 100) if total > 0 else 0

                att = db.query(Attendance).filter(
                    Attendance.employee_id == emp.id,
                    Attendance.attendance_date >= ninety_days_ago.date(),
                ).all()
                present = sum(1 for a in att if a.attendance_status.lower() in ("present", "late", "half_day"))
                att_rate = (present / len(att) * 100) if att else 100

                review = db.query(PerformanceReview).filter(
                    PerformanceReview.employee_id == emp.id,
                    PerformanceReview.is_active.is_(True),
                ).order_by(PerformanceReview.review_date.desc()).first()
                manual = float(review.manual_score) if review and review.manual_score is not None else 0

                score = (task_rate * 0.4) + (att_rate * 0.3) + (manual * 0.3)
                rankings.append({
                    "employee_id": emp.id,
                    "employee_name": emp.full_name or f"{emp.first_name} {emp.last_name}",
                    "department": emp.department.name if emp.department else None,
                    "designation": emp.position.title if emp.position else None,
                    "score": round(score, 1),
                })
            except Exception as e:
                log.warning("Ranking calculation skipped employee %d: %s", emp.id, e)
                continue

        rankings.sort(key=lambda r: r["score"], reverse=True)
        return rankings
    except HTTPException:
        raise
    except Exception as e:
        log.error("Performance rankings error: %s", e, exc_info=True)
        raise HTTPException(500, f"Failed to load performance rankings: {type(e).__name__}: {e}")


@router.post("/performance/reviews", response_model=PerformanceReviewResponse, status_code=201)
def create_performance_review(
    payload: PerformanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    employee = db.query(Employee).filter(Employee.id == payload.employee_id, Employee.is_active.is_(True)).first()
    if not employee:
        raise HTTPException(404, "Employee not found")

    # Calculate task score for the review period
    task_query = db.query(EmployeeTask).filter(
        EmployeeTask.employee_id == payload.employee_id,
        EmployeeTask.is_active.is_(True),
    )
    if payload.period_start:
        task_query = task_query.filter(EmployeeTask.assigned_date >= payload.period_start)
    if payload.period_end:
        task_query = task_query.filter(EmployeeTask.assigned_date <= payload.period_end)
    tasks = task_query.all()
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == "completed")
    task_score = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

    # Attendance score
    att_query = db.query(Attendance).filter(Attendance.employee_id == payload.employee_id)
    if payload.period_start:
        att_query = att_query.filter(Attendance.attendance_date >= payload.period_start)
    if payload.period_end:
        att_query = att_query.filter(Attendance.attendance_date <= payload.period_end)
    attendances = att_query.all()
    total_days = len(attendances)
    present_days = sum(1 for a in attendances if a.attendance_status.lower() in ("present", "late", "half_day"))
    attendance_score = (present_days / total_days * 100) if total_days > 0 else 100

    manual = payload.manual_score or 0
    overall = (task_score * 0.4) + (attendance_score * 0.3) + (manual * 0.3)

    review = PerformanceReview(
        employee_id=payload.employee_id,
        reviewer_id=current_user.id,
        period_start=payload.period_start,
        period_end=payload.period_end,
        task_score=round(task_score, 2),
        attendance_score=round(attendance_score, 2),
        manual_score=manual,
        overall_rating=round(overall, 2),
        remarks=payload.remarks,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.patch("/performance/reviews/{review_id}", response_model=PerformanceReviewResponse)
def update_performance_review(
    review_id: int,
    payload: PerformanceReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr:manage")),
):
    review = db.query(PerformanceReview).filter(
        PerformanceReview.id == review_id,
        PerformanceReview.is_active.is_(True),
    ).first()
    if not review:
        raise HTTPException(404, "Performance review not found")

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(review, k, v)

    # Recalculate overall
    task_score = float(review.task_score) if review.task_score else 0
    att_score = float(review.attendance_score) if review.attendance_score else 0
    manual = float(review.manual_score) if review.manual_score else 0
    review.overall_rating = round((task_score * 0.4) + (att_score * 0.3) + (manual * 0.3), 2)
    review.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(review)
    log_activity(
        db=db, user=current_user, action="update", module="hr",
        record_type="performance_review", record_id=review.id,
        record_label=f"Review: {review.employee_id}",
        new_values={k: str(v) for k, v in review.__dict__.items() if not k.startswith('_')},
    )
    db.commit()
    return review


@router.get("/performance/report-data/{employee_id}")
def get_performance_report_data(
    employee_id: int,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("hr:view")),
):
    """Returns aggregate data for PDF report generation"""
    try:
        employee = db.query(Employee).filter(Employee.id == employee_id, Employee.is_active.is_(True)).first()
        if not employee:
            raise HTTPException(404, "Employee not found")

        try:
            start = datetime.strptime(period_start, "%Y-%m-%d") if period_start else datetime.utcnow() - timedelta(days=365)
            end = datetime.strptime(period_end, "%Y-%m-%d") if period_end else datetime.utcnow()
        except (ValueError, TypeError):
            start = datetime.utcnow() - timedelta(days=365)
            end = datetime.utcnow()

        # Tasks
        tasks = db.query(EmployeeTask).filter(
            EmployeeTask.employee_id == employee_id,
            EmployeeTask.is_active.is_(True),
            EmployeeTask.assigned_date >= start,
            EmployeeTask.assigned_date <= end,
        ).all()

        # Attendance
        attendance = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date >= start.date(),
            Attendance.attendance_date <= end.date(),
        ).all()

        # Leave
        leaves = db.query(Leave).filter(
            Leave.employee_id == employee_id,
            Leave.start_date >= start.date(),
            Leave.end_date <= end.date(),
            Leave.is_active.is_(True),
        ).all()

        # Payroll
        payroll = db.query(Payroll).filter(
            Payroll.employee_id == employee_id,
            Payroll.created_at >= start,
            Payroll.created_at <= end,
        ).order_by(Payroll.created_at.desc()).all()

        # Reviews
        reviews = db.query(PerformanceReview).filter(
            PerformanceReview.employee_id == employee_id,
            PerformanceReview.is_active.is_(True),
        ).order_by(PerformanceReview.review_date.desc()).all()

        return {
            "employee": {
                "id": employee.id,
            "name": employee.full_name or f"{employee.first_name} {employee.last_name}",
            "employee_id": employee.employee_id,
            "department": employee.department.name if employee.department else None,
            "designation": employee.position.title if employee.position else None,
            "employment_status": employee.employment_status,
            "joining_date": str(employee.joining_date) if employee.joining_date else None,
            "work_email": employee.work_email,
            "work_phone": employee.work_phone,
        },
        "tasks": [
            {
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "deadline": str(t.deadline) if t.deadline else None,
                "assigned_date": str(t.assigned_date) if t.assigned_date else None,
                "completed_date": str(t.completed_date) if t.completed_date else None,
                "remark": t.remark,
            }
            for t in tasks
        ],
        "attendance": {
            "total_days": len(attendance),
            "present": sum(1 for a in attendance if a.attendance_status.lower() == "present"),
            "absent": sum(1 for a in attendance if a.attendance_status.lower() == "absent"),
            "late": sum(1 for a in attendance if a.attendance_status.lower() == "late"),
            "half_day": sum(1 for a in attendance if a.attendance_status.lower() == "half_day"),
            "on_leave": sum(1 for a in attendance if a.attendance_status.lower() == "on_leave"),
        },
        "leaves": [
            {
                "type": lt.name,
                "start_date": str(l.start_date),
                "end_date": str(l.end_date),
                "total_days": l.total_days,
                "status": l.status,
            }
            for l in leaves
            for lt in [db.query(LeaveType).filter(LeaveType.id == l.leave_type_id).first()]
        ],
        "payroll": [
            {
                "period": p.payroll_period,
                "gross": float(p.gross_salary) if p.gross_salary else 0,
                "deductions": float(p.total_deductions) if p.total_deductions else 0,
                "net": float(p.net_salary) if p.net_salary else 0,
                "status": p.status,
            }
            for p in payroll
        ],
        "reviews": [
            {
                "period_start": str(r.period_start) if r.period_start else None,
                "period_end": str(r.period_end) if r.period_end else None,
                "task_score": float(r.task_score) if r.task_score else 0,
                "attendance_score": float(r.attendance_score) if r.attendance_score else 0,
                "manual_score": float(r.manual_score) if r.manual_score else 0,
                "overall_rating": float(r.overall_rating) if r.overall_rating else 0,
                "remarks": r.remarks,
                "review_date": str(r.review_date) if r.review_date else None,
            }
            for r in reviews
        ],
    }
    except HTTPException:
        raise
    except Exception as e:
        log.error("Performance report-data error for employee %d: %s", employee_id, e, exc_info=True)
        raise HTTPException(500, f"Failed to load report data: {type(e).__name__}: {e}")




