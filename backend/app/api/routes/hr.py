"""HR Management Routes — Employees, Attendance, Leave, Payroll"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload
from app.core.table_query import apply_table_filters

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.tid import next_tid
from app.models.auth import User
from app.models.hr import (
    AllowanceType, Attendance, Branch, DeductionType, Department,
    Employee, Holiday, Leave, LeaveBalance, LeaveType, Payroll,
    Position, SalaryStructure,
)
from app.schemas.hr import (
    AllowanceTypeCreate, AllowanceTypeResponse,
    AttendanceCreate, AttendanceResponse, AttendanceUpdate,
    BranchCreate, BranchResponse, BranchUpdate,
    DeductionTypeCreate, DeductionTypeResponse,
    DepartmentCreate, DepartmentResponse, DepartmentUpdate,
    EmployeeCreate, EmployeeDetail, EmployeeResponse, EmployeeUpdate,
    HolidayCreate, HolidayResponse,
    LeaveCreate, LeaveDetail, LeaveResponse, LeaveUpdate,
    LeaveTypeCreate, LeaveTypeResponse,
    PayrollResponse, PayrollUpdate,
    PositionCreate, PositionResponse, PositionUpdate,
    SalaryStructureCreate, SalaryStructureResponse, SalaryStructureUpdate,
)
from app.services.hr import AttendanceService, LeaveService, PayrollService

router = APIRouter()


# ==================== DEPARTMENTS ====================

@router.get("/departments", response_model=List[DepartmentResponse])
def list_departments(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
):
    q = db.query(Department)
    if active_only:
        q = q.filter(Department.is_active.is_(True))
    return q.order_by(Department.name).all()


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    if db.query(Department).filter(Department.code == payload.code).first():
        raise HTTPException(400, "Department code already exists")
    now = datetime.utcnow()
    dept = Department(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/departments/{dept_id}", response_model=DepartmentResponse)
def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(dept, k, v)
    dept.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/departments/{dept_id}", status_code=204)
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    if db.query(Employee).filter(Employee.department_id == dept_id, Employee.is_active.is_(True)).count():
        raise HTTPException(400, "Cannot delete department with active employees")
    dept.is_active = False
    dept.updated_at = datetime.utcnow()
    db.commit()


# ==================== POSITIONS ====================

@router.get("/positions", response_model=List[PositionResponse])
def list_positions(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
):
    q = db.query(Position)
    if active_only:
        q = q.filter(Position.is_active.is_(True))
    return q.order_by(Position.title).all()


@router.post("/positions", response_model=PositionResponse, status_code=201)
def create_position(
    payload: PositionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    if db.query(Position).filter(Position.code == payload.code).first():
        raise HTTPException(400, "Position code already exists")
    now = datetime.utcnow()
    pos = Position(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return pos


@router.put("/positions/{pos_id}", response_model=PositionResponse)
def update_position(
    pos_id: int,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    pos = db.query(Position).filter(Position.id == pos_id).first()
    if not pos:
        raise HTTPException(404, "Position not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(pos, k, v)
    pos.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pos)
    return pos


# ==================== BRANCHES ====================

@router.get("/branches", response_model=List[BranchResponse])
def list_branches(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
):
    q = db.query(Branch)
    if active_only:
        q = q.filter(Branch.is_active.is_(True))
    return q.order_by(Branch.name).all()


@router.post("/branches", response_model=BranchResponse, status_code=201)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    if db.query(Branch).filter(Branch.code == payload.code).first():
        raise HTTPException(400, "Branch code already exists")
    now = datetime.utcnow()
    branch = Branch(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.put("/branches/{branch_id}", response_model=BranchResponse)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
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
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
):
    query = db.query(Employee).filter(Employee.is_active.is_(True))
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
        search_fields=[Employee.full_name, Employee.employee_id, Employee.personal_email, Employee.work_email, Employee.personal_phone, Employee.cnic],
        date_filter=filter,
        date_field=Employee.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    return query.order_by(Employee.full_name).all()


@router.post("/employees", response_model=EmployeeResponse, status_code=201)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Admin", "Manager")),
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
        created_by=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.get("/employees/{emp_id}", response_model=EmployeeDetail)
def get_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
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
    _: User = Depends(require_roles("Admin", "Manager")),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
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
    return emp


@router.delete("/employees/{emp_id}", status_code=204)
def deactivate_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    emp.is_active = False
    emp.employment_status = "Inactive"
    emp.updated_at = datetime.utcnow()
    db.commit()


# ==================== SALARY STRUCTURE ====================

@router.get("/employees/{emp_id}/salary", response_model=SalaryStructureResponse)
def get_salary_structure(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager")),
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
    _: User = Depends(require_roles("Admin")),
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
        for k, v in payload.model_dump(exclude={"employee_id"}).items():
            setattr(existing, k, v)
        existing.gross_salary = gross
        existing.total_deductions = total_ded
        existing.net_salary = gross - total_ded
        existing.is_active = True
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
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
    return salary


@router.put("/employees/{emp_id}/salary", response_model=SalaryStructureResponse)
def update_salary_structure(
    emp_id: int,
    payload: SalaryStructureUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    salary = db.query(SalaryStructure).filter(
        SalaryStructure.employee_id == emp_id,
    ).first()
    if not salary:
        raise HTTPException(404, "Salary structure not found")
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
    return salary


# ==================== ATTENDANCE ====================

@router.get("/attendance", response_model=List[AttendanceResponse])
def list_attendance(
    employee_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
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
    user: User = Depends(require_roles("Admin", "Manager", "Staff")),
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
        corrected_by=user.id if payload.is_manual_correction else None,
    )
    return record


@router.put("/attendance/{att_id}", response_model=AttendanceResponse)
def update_attendance(
    att_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Admin", "Manager")),
):
    record = db.query(Attendance).filter(Attendance.id == att_id).first()
    if not record:
        raise HTTPException(404, "Attendance record not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(record, k, v)
    record.is_manual_correction = True
    record.corrected_by = user.id
    record.is_approved = False  # Requires re-approval after correction
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return record


@router.post("/attendance/{att_id}/approve", response_model=AttendanceResponse)
def approve_attendance_correction(
    att_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Admin", "Manager")),
):
    return AttendanceService.approve_correction(db, att_id, user.id)


@router.get("/attendance/report/daily")
def daily_attendance_report(
    report_date: date = Query(default=None),
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
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
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
):
    return AttendanceService.get_monthly_summary(db, employee_id, year, month)


# ==================== LEAVE TYPES ====================

@router.get("/leave-types", response_model=List[LeaveTypeResponse])
def list_leave_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
):
    return db.query(LeaveType).filter(LeaveType.is_active.is_(True)).order_by(LeaveType.name).all()


@router.post("/leave-types", response_model=LeaveTypeResponse, status_code=201)
def create_leave_type(
    payload: LeaveTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    if db.query(LeaveType).filter(LeaveType.code == payload.code).first():
        raise HTTPException(400, "Leave type code already exists")
    now = datetime.utcnow()
    lt = LeaveType(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return lt


# ==================== LEAVES ====================

@router.get("/leaves", response_model=List[LeaveResponse])
def list_leaves(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
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
    user: User = Depends(require_roles("Admin", "Manager", "Staff")),
):
    try:
        leave = LeaveService.request_leave(
            db=db,
            employee_id=payload.employee_id,
            leave_type_id=payload.leave_type_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            reason=payload.reason,
            requested_by=user.id,
            medical_certificate=payload.medical_certificate,
        )
        return leave
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/leaves/{leave_id}", response_model=LeaveDetail)
def get_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
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
    user: User = Depends(require_roles("Admin", "Manager")),
):
    try:
        return LeaveService.approve_leave(db, leave_id, user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/leaves/{leave_id}/reject", response_model=LeaveResponse)
def reject_leave(
    leave_id: int,
    rejection_reason: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Admin", "Manager")),
):
    try:
        return LeaveService.reject_leave(db, leave_id, user.id, rejection_reason)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/leaves/{leave_id}/cancel", response_model=LeaveResponse)
def cancel_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Admin", "Manager", "Staff")),
):
    try:
        return LeaveService.cancel_leave(db, leave_id, user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/leaves/balance/{employee_id}")
def get_leave_balance(
    employee_id: int,
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
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
    _: User = Depends(require_roles("Admin", "Manager")),
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
    user: User = Depends(require_roles("Admin", "Manager")),
):
    # Check for duplicate
    existing = db.query(Payroll).filter(
        Payroll.employee_id == employee_id,
        Payroll.payroll_period == payroll_period,
    ).first()
    if existing:
        raise HTTPException(400, f"Payroll already exists for this employee and period (id={existing.id})")
    try:
        return PayrollService.calculate_payroll(db, employee_id, payroll_period, user)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/payroll/calculate-all", response_model=List[PayrollResponse])
def calculate_all_payroll(
    payroll_period: str,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Admin")),
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
            p = PayrollService.calculate_payroll(db, emp.id, payroll_period, user)
            results.append(p)
        except ValueError as e:
            errors.append({"employee_id": emp.id, "error": str(e)})

    return results


@router.get("/payroll/{payroll_id}", response_model=PayrollResponse)
def get_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager")),
):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(404, "Payroll record not found")
    return p


@router.post("/payroll/{payroll_id}/approve", response_model=PayrollResponse)
def approve_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Admin")),
):
    try:
        return PayrollService.approve_payroll(db, payroll_id, user)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/payroll/{payroll_id}/post-accounting")
def post_payroll_to_accounting(
    payroll_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Admin")),
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
    _: User = Depends(require_roles("Admin")),
):
    if not payload.payment_date or not payload.payment_method:
        raise HTTPException(400, "payment_date and payment_method are required")
    try:
        return PayrollService.mark_as_paid(
            db,
            payroll_id,
            payload.payment_date,
            payload.payment_method,
            payload.transaction_reference,
            payload.bank_account,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/payroll/{payroll_id}/payslip")
def get_payslip_data(
    payroll_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager")),
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
    _: User = Depends(require_roles("Admin", "Manager")),
):
    return PayrollService.generate_payroll_summary(db, payroll_period, department_id, branch_id)


# ==================== HOLIDAYS ====================

@router.get("/holidays", response_model=List[HolidayResponse])
def list_holidays(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),
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
    _: User = Depends(require_roles("Admin")),
):
    if db.query(Holiday).filter(Holiday.holiday_date == payload.holiday_date).first():
        raise HTTPException(400, "Holiday already exists for this date")
    now = datetime.utcnow()
    h = Holiday(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/holidays/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    h = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(404, "Holiday not found")
    h.is_active = False
    h.updated_at = datetime.utcnow()
    db.commit()


# ==================== ALLOWANCE / DEDUCTION TYPES ====================

@router.get("/allowance-types", response_model=List[AllowanceTypeResponse])
def list_allowance_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager")),
):
    return db.query(AllowanceType).filter(AllowanceType.is_active.is_(True)).all()


@router.post("/allowance-types", response_model=AllowanceTypeResponse, status_code=201)
def create_allowance_type(
    payload: AllowanceTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    now = datetime.utcnow()
    at = AllowanceType(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(at)
    db.commit()
    db.refresh(at)
    return at


@router.get("/deduction-types", response_model=List[DeductionTypeResponse])
def list_deduction_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager")),
):
    return db.query(DeductionType).filter(DeductionType.is_active.is_(True)).all()


@router.post("/deduction-types", response_model=DeductionTypeResponse, status_code=201)
def create_deduction_type(
    payload: DeductionTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    now = datetime.utcnow()
    dt = DeductionType(**payload.model_dump(), created_at=now, updated_at=now)
    db.add(dt)
    db.commit()
    db.refresh(dt)
    return dt
