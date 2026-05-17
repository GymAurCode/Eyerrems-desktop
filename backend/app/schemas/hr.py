"""
HR Management Schemas
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


# ==================== DEPARTMENT SCHEMAS ====================

class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    manager_id: Optional[int] = None
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    manager_id: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class DepartmentTree(DepartmentResponse):
    sub_departments: List["DepartmentTree"] = []
    employee_count: Optional[int] = None


# ==================== POSITION SCHEMAS ====================

class PositionBase(BaseModel):
    title: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    grade: Optional[str] = Field(None, max_length=10)
    description: Optional[str] = None
    min_salary: Optional[Decimal] = None
    max_salary: Optional[Decimal] = None
    is_active: bool = True


class PositionCreate(PositionBase):
    pass


class PositionUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    grade: Optional[str] = Field(None, max_length=10)
    description: Optional[str] = None
    min_salary: Optional[Decimal] = None
    max_salary: Optional[Decimal] = None
    is_active: Optional[bool] = None


class PositionResponse(PositionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==================== BRANCH SCHEMAS ====================

class BranchBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    is_active: bool = True


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class BranchResponse(BranchBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==================== EMPLOYEE SCHEMAS ====================

class EmployeeBase(BaseModel):
    first_name: str = Field(..., max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    last_name: str = Field(..., max_length=100)
    
    # Personal details
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=20)
    marital_status: Optional[str] = Field(None, max_length=20)
    nationality: Optional[str] = Field(None, max_length=100)
    
    # Contact details
    personal_email: Optional[str] = Field(None, max_length=255)
    work_email: Optional[str] = Field(None, max_length=255)
    personal_phone: Optional[str] = Field(None, max_length=50)
    work_phone: Optional[str] = Field(None, max_length=50)
    emergency_contact_name: Optional[str] = Field(None, max_length=200)
    emergency_contact_phone: Optional[str] = Field(None, max_length=50)
    emergency_contact_relation: Optional[str] = Field(None, max_length=50)
    
    # Address
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    
    # Employment details
    department_id: Optional[int] = None
    position_id: Optional[int] = None
    branch_id: Optional[int] = None
    manager_id: Optional[int] = None
    
    joining_date: date
    confirmation_date: Optional[date] = None
    employment_type: str = Field("Permanent", max_length=30)
    employment_status: str = Field("Active", max_length=30)
    resignation_date: Optional[date] = None
    termination_date: Optional[date] = None
    termination_reason: Optional[str] = None
    
    # System fields
    user_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool = True


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    
    # Personal details
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=20)
    marital_status: Optional[str] = Field(None, max_length=20)
    nationality: Optional[str] = Field(None, max_length=100)
    
    # Contact details
    personal_email: Optional[str] = Field(None, max_length=255)
    work_email: Optional[str] = Field(None, max_length=255)
    personal_phone: Optional[str] = Field(None, max_length=50)
    work_phone: Optional[str] = Field(None, max_length=50)
    emergency_contact_name: Optional[str] = Field(None, max_length=200)
    emergency_contact_phone: Optional[str] = Field(None, max_length=50)
    emergency_contact_relation: Optional[str] = Field(None, max_length=50)
    
    # Address
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    
    # Employment details
    department_id: Optional[int] = None
    position_id: Optional[int] = None
    branch_id: Optional[int] = None
    manager_id: Optional[int] = None
    
    joining_date: Optional[date] = None
    confirmation_date: Optional[date] = None
    employment_type: Optional[str] = Field(None, max_length=30)
    employment_status: Optional[str] = Field(None, max_length=30)
    resignation_date: Optional[date] = None
    termination_date: Optional[date] = None
    termination_reason: Optional[str] = None
    
    # System fields
    user_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class EmployeeResponse(EmployeeBase):
    id: int
    employee_id: str
    full_name: str
    created_by: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class EmployeeDetail(EmployeeResponse):
    department: Optional[DepartmentResponse] = None
    position: Optional[PositionResponse] = None
    branch: Optional[BranchResponse] = None
    manager: Optional["EmployeeResponse"] = None
    salary_structure: Optional["SalaryStructureResponse"] = None
    subordinates_count: Optional[int] = None
    attendance_summary: Optional["AttendanceSummary"] = None
    leave_summary: Optional["LeaveSummary"] = None


# ==================== SALARY STRUCTURE SCHEMAS ====================

class SalaryStructureBase(BaseModel):
    # Basic components
    basic_salary: Decimal = Field(..., ge=0)
    house_rent_allowance: Decimal = Field(0, ge=0)
    conveyance_allowance: Decimal = Field(0, ge=0)
    medical_allowance: Decimal = Field(0, ge=0)
    special_allowance: Decimal = Field(0, ge=0)
    other_allowances: Decimal = Field(0, ge=0)
    
    # Deductions
    provident_fund: Decimal = Field(0, ge=0)
    professional_tax: Decimal = Field(0, ge=0)
    income_tax: Decimal = Field(0, ge=0)
    other_deductions: Decimal = Field(0, ge=0)
    
    # Overtime rates
    overtime_hourly_rate: Decimal = Field(0, ge=0)
    
    # Effective dates
    effective_from: date
    effective_to: Optional[date] = None
    
    is_active: bool = True


class SalaryStructureCreate(SalaryStructureBase):
    employee_id: int


class SalaryStructureUpdate(BaseModel):
    basic_salary: Optional[Decimal] = Field(None, ge=0)
    house_rent_allowance: Optional[Decimal] = Field(None, ge=0)
    conveyance_allowance: Optional[Decimal] = Field(None, ge=0)
    medical_allowance: Optional[Decimal] = Field(None, ge=0)
    special_allowance: Optional[Decimal] = Field(None, ge=0)
    other_allowances: Optional[Decimal] = Field(None, ge=0)
    
    provident_fund: Optional[Decimal] = Field(None, ge=0)
    professional_tax: Optional[Decimal] = Field(None, ge=0)
    income_tax: Optional[Decimal] = Field(None, ge=0)
    other_deductions: Optional[Decimal] = Field(None, ge=0)
    
    overtime_hourly_rate: Optional[Decimal] = Field(None, ge=0)
    
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    
    is_active: Optional[bool] = None


class SalaryStructureResponse(SalaryStructureBase):
    id: int
    employee_id: int
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==================== ALLOWANCE/DEDUCTION TYPE SCHEMAS ====================

class AllowanceTypeBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    description: Optional[str] = None
    is_taxable: bool = True
    is_active: bool = True


class AllowanceTypeCreate(AllowanceTypeBase):
    pass


class AllowanceTypeResponse(AllowanceTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class DeductionTypeBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    description: Optional[str] = None
    is_statutory: bool = False
    is_active: bool = True


class DeductionTypeCreate(DeductionTypeBase):
    pass


class DeductionTypeResponse(DeductionTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==================== ATTENDANCE SCHEMAS ====================

class AttendanceBase(BaseModel):
    employee_id: int
    attendance_date: date
    
    # Check-in/out times
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    
    # Calculated values
    total_hours: Optional[Decimal] = None
    overtime_hours: Optional[Decimal] = Field(0, ge=0)
    late_minutes: Optional[int] = Field(0, ge=0)
    early_leave_minutes: Optional[int] = Field(0, ge=0)
    
    # Status
    attendance_status: str = Field("Present", max_length=30)
    is_approved: bool = True
    
    # Manual correction
    is_manual_correction: bool = False
    correction_reason: Optional[str] = None
    
    notes: Optional[str] = None


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceUpdate(BaseModel):
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    total_hours: Optional[Decimal] = None
    overtime_hours: Optional[Decimal] = Field(None, ge=0)
    late_minutes: Optional[int] = Field(None, ge=0)
    early_leave_minutes: Optional[int] = Field(None, ge=0)
    attendance_status: Optional[str] = Field(None, max_length=30)
    is_approved: Optional[bool] = None
    is_manual_correction: Optional[bool] = None
    correction_reason: Optional[str] = None
    notes: Optional[str] = None


class AttendanceResponse(AttendanceBase):
    id: int
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    corrected_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class AttendanceSummary(BaseModel):
    employee_id: int
    period: str  # YYYY-MM
    total_days: int
    present_days: int
    absent_days: int
    leave_days: int
    late_days: int
    early_leave_days: int
    overtime_hours: Decimal
    attendance_percentage: Decimal


# ==================== LEAVE TYPE SCHEMAS ====================

class LeaveTypeBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    description: Optional[str] = None
    days_per_year: int = 0
    is_paid: bool = True
    requires_approval: bool = True
    carry_forward: bool = False
    max_carry_forward: Optional[int] = None
    is_active: bool = True


class LeaveTypeCreate(LeaveTypeBase):
    pass


class LeaveTypeResponse(LeaveTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==================== LEAVE SCHEMAS ====================

class LeaveBase(BaseModel):
    employee_id: int
    leave_type_id: int
    
    # Leave period
    start_date: date
    end_date: date
    total_days: int
    
    # Status and workflow
    reason: str
    medical_certificate: Optional[str] = None
    
    # Balance tracking
    balance_before: Optional[int] = None
    balance_after: Optional[int] = None
    
    is_active: bool = True


class LeaveCreate(LeaveBase):
    pass


class LeaveUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_days: Optional[int] = None
    reason: Optional[str] = None
    medical_certificate: Optional[str] = None
    status: Optional[str] = Field(None, max_length=30)
    rejection_reason: Optional[str] = None
    is_active: Optional[bool] = None


class LeaveResponse(LeaveBase):
    id: int
    status: str
    requested_by: int
    approved_by: Optional[int] = None
    rejected_by: Optional[int] = None
    approval_date: Optional[datetime] = None
    rejection_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class LeaveDetail(LeaveResponse):
    employee: Optional[EmployeeResponse] = None
    leave_type: Optional[LeaveTypeResponse] = None


class LeaveSummary(BaseModel):
    employee_id: int
    year: int
    total_leaves_taken: int
    leaves_by_type: dict[str, int]
    balance_by_type: dict[str, int]
    pending_requests: int


# ==================== PAYROLL SCHEMAS ====================

class PayrollBase(BaseModel):
    payroll_period: str = Field(..., max_length=20)  # YYYY-MM
    employee_id: int
    
    # Salary components
    basic_salary: Decimal = Field(..., ge=0)
    house_rent_allowance: Decimal = Field(0, ge=0)
    conveyance_allowance: Decimal = Field(0, ge=0)
    medical_allowance: Decimal = Field(0, ge=0)
    special_allowance: Decimal = Field(0, ge=0)
    other_allowances: Decimal = Field(0, ge=0)
    
    # Overtime
    overtime_hours: Decimal = Field(0, ge=0)
    overtime_amount: Decimal = Field(0, ge=0)
    
    # Deductions
    provident_fund: Decimal = Field(0, ge=0)
    professional_tax: Decimal = Field(0, ge=0)
    income_tax: Decimal = Field(0, ge=0)
    other_deductions: Decimal = Field(0, ge=0)
    
    # Late penalties
    late_days: int = Field(0, ge=0)
    late_penalty: Decimal = Field(0, ge=0)
    
    # Leave adjustments
    unpaid_leave_days: int = Field(0, ge=0)
    unpaid_leave_deduction: Decimal = Field(0, ge=0)
    
    # Payment info
    payment_date: Optional[date] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    bank_account: Optional[str] = Field(None, max_length=100)
    transaction_reference: Optional[str] = Field(None, max_length=100)
    
    # Accounting integration
    journal_id: Optional[int] = None
    
    # Status
    status: str = Field("Draft", max_length=30)
    
    notes: Optional[str] = None


class PayrollCreate(PayrollBase):
    pass


class PayrollUpdate(BaseModel):
    payment_date: Optional[date] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    bank_account: Optional[str] = Field(None, max_length=100)
    transaction_reference: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=30)
    approved_by: Optional[int] = None
    notes: Optional[str] = None


class PayrollResponse(PayrollBase):
    id: int
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PayrollDetail(PayrollResponse):
    employee: Optional[EmployeeResponse] = None
    journal: Optional[dict] = None


class PayrollSummary(BaseModel):
    payroll_period: str
    total_employees: int
    total_gross_salary: Decimal
    total_deductions: Decimal
    total_net_salary: Decimal
    status_counts: dict[str, int]


# ==================== LEAVE BALANCE SCHEMAS ====================

class LeaveBalanceBase(BaseModel):
    employee_id: int
    leave_type_id: int
    year: int
    
    # Balance tracking
    opening_balance: int = 0
    earned: int = 0
    used: int = 0
    adjusted: int = 0
    closing_balance: int = 0
    
    # Carry forward
    carried_forward: Optional[int] = None
    carried_to: Optional[int] = None
    
    is_active: bool = True


class LeaveBalanceResponse(LeaveBalanceBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==================== HOLIDAY SCHEMAS ====================

class HolidayBase(BaseModel):
    name: str = Field(..., max_length=255)
    holiday_date: date
    description: Optional[str] = None
    is_recurring: bool = True
    is_active: bool = True


class HolidayCreate(HolidayBase):
    pass


class HolidayResponse(HolidayBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==================== REPORT SCHEMAS ====================

class AttendanceReport(BaseModel):
    period: str  # YYYY-MM or YYYY-MM-DD
    department_id: Optional[int] = None
    branch_id: Optional[int] = None
    data: List[AttendanceSummary]


class PayrollReport(BaseModel):
    payroll_period: str
    department_id: Optional[int] = None
    branch_id: Optional[int] = None
    data: List[PayrollDetail]
    summary: PayrollSummary


class LeaveReport(BaseModel):
    year: int
    department_id: Optional[int] = None
    branch_id: Optional[int] = None
    data: List[LeaveSummary]


# Update forward references
DepartmentTree.update_forward_refs()
EmployeeDetail.update_forward_refs()