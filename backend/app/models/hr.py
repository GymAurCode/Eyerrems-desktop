"""
HR Management Models
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Department(Base):
    """Department/Division within organization"""
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)  # e.g., "HR", "FIN", "OPS"
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    parent = relationship("Department", remote_side=[id], backref="sub_departments")
    manager = relationship("Employee", foreign_keys="Department.manager_id", backref="managed_departments")
    employees = relationship("Employee", foreign_keys="Employee.department_id", back_populates="department")


class Position(Base):
    """Job position/designation"""
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)  # e.g., "MGR", "EXEC", "ASSOC"
    grade = Column(String(10), nullable=True)  # e.g., "A1", "B2", "C3"
    description = Column(Text, nullable=True)
    min_salary = Column(Numeric(14, 2), nullable=True)
    max_salary = Column(Numeric(14, 2), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    employees = relationship("Employee", back_populates="position")


class Branch(Base):
    """Branch/Office location"""
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)  # e.g., "HQ", "BR1", "BR2"
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    employees = relationship("Employee", back_populates="branch")


class Employee(Base):
    """Employee master record"""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)
    employee_id = Column(String(50), nullable=False, unique=True)  # Auto-generated TID: EMP-0001
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=False)
    full_name = Column(String(300), nullable=False)  # Computed: first + middle + last
    
    # Personal details
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)  # Male, Female, Other
    marital_status = Column(String(20), nullable=True)  # Single, Married, Divorced, Widowed
    nationality = Column(String(100), nullable=True)
    
    # Contact details
    personal_email = Column(String(255), nullable=True)
    work_email = Column(String(255), nullable=True)
    personal_phone = Column(String(50), nullable=True)
    work_phone = Column(String(50), nullable=True)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    emergency_contact_relation = Column(String(50), nullable=True)
    
    # Address
    address_line1 = Column(Text, nullable=True)
    address_line2 = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    
    # Employment details
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)  # Reporting manager
    
    joining_date = Column(Date, nullable=False)
    confirmation_date = Column(Date, nullable=True)
    employment_type = Column(String(30), nullable=False, default="Permanent")  # Permanent, Contract, Probation, Intern
    employment_status = Column(String(30), nullable=False, default="Active")  # Active, Inactive, Resigned, Terminated, Retired
    resignation_date = Column(Date, nullable=True)
    termination_date = Column(Date, nullable=True)
    termination_reason = Column(Text, nullable=True)
    
    # System fields
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Link to auth system
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    department = relationship("Department", foreign_keys=[department_id], back_populates="employees")
    position = relationship("Position", foreign_keys=[position_id], back_populates="employees")
    branch = relationship("Branch", foreign_keys=[branch_id], back_populates="employees")
    manager = relationship(
        "Employee",
        foreign_keys=[manager_id],
        remote_side=[id],
        back_populates="subordinates",
    )
    subordinates = relationship(
        "Employee",
        foreign_keys=[manager_id],
        back_populates="manager",
    )
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
    
    # Related records
    salary_structure = relationship("SalaryStructure", back_populates="employee", uselist=False)
    attendances = relationship("Attendance", back_populates="employee")
    leaves = relationship("Leave", back_populates="employee")
    payroll_records = relationship("Payroll", back_populates="employee")


class SalaryStructure(Base):
    """Employee salary structure with allowances and deductions"""
    __tablename__ = "salary_structures"

    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, unique=True)
    
    # Basic components
    basic_salary = Column(Numeric(14, 2), nullable=False, default=0)
    house_rent_allowance = Column(Numeric(14, 2), nullable=False, default=0)
    conveyance_allowance = Column(Numeric(14, 2), nullable=False, default=0)
    medical_allowance = Column(Numeric(14, 2), nullable=False, default=0)
    special_allowance = Column(Numeric(14, 2), nullable=False, default=0)
    other_allowances = Column(Numeric(14, 2), nullable=False, default=0)
    
    # Deductions
    provident_fund = Column(Numeric(14, 2), nullable=False, default=0)  # PF deduction
    professional_tax = Column(Numeric(14, 2), nullable=False, default=0)
    income_tax = Column(Numeric(14, 2), nullable=False, default=0)
    other_deductions = Column(Numeric(14, 2), nullable=False, default=0)
    
    # Totals (computed)
    gross_salary = Column(Numeric(14, 2), nullable=False, default=0)  # Sum of all allowances + basic
    total_deductions = Column(Numeric(14, 2), nullable=False, default=0)  # Sum of all deductions
    net_salary = Column(Numeric(14, 2), nullable=False, default=0)  # Gross - Deductions
    
    # Overtime rates
    overtime_hourly_rate = Column(Numeric(10, 2), nullable=False, default=0)
    
    # Effective dates
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)  # NULL means current structure
    
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    employee = relationship("Employee", back_populates="salary_structure")


class AllowanceType(Base):
    """Master list of allowance types"""
    __tablename__ = "allowance_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)  # e.g., "HRA", "CA", "MA"
    description = Column(Text, nullable=True)
    is_taxable = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class DeductionType(Base):
    """Master list of deduction types"""
    __tablename__ = "deduction_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)  # e.g., "PF", "PTAX", "ITAX"
    description = Column(Text, nullable=True)
    is_statutory = Column(Boolean, nullable=False, default=False)  # Government mandated
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class Attendance(Base):
    """Daily attendance records"""
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    
    # Check-in/out times
    check_in_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)
    
    # Calculated values
    total_hours = Column(Numeric(5, 2), nullable=True)  # Total hours worked
    overtime_hours = Column(Numeric(5, 2), nullable=True, default=0)
    late_minutes = Column(Integer, nullable=True, default=0)  # Minutes late
    early_leave_minutes = Column(Integer, nullable=True, default=0)  # Minutes left early
    
    # Status
    attendance_status = Column(String(30), nullable=False, default="Present")  # Present, Absent, Half-day, Leave, Holiday
    is_approved = Column(Boolean, nullable=False, default=True)  # For manual corrections
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    # Manual correction
    is_manual_correction = Column(Boolean, nullable=False, default=False)
    correction_reason = Column(Text, nullable=True)
    corrected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    employee = relationship("Employee", back_populates="attendances")
    approver = relationship("User", foreign_keys=[approved_by])
    corrector = relationship("User", foreign_keys=[corrected_by])


class LeaveType(Base):
    """Master leave types"""
    __tablename__ = "leave_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)  # e.g., "AL", "SL", "CL"
    description = Column(Text, nullable=True)
    days_per_year = Column(Integer, nullable=False, default=0)  # 0 = unlimited
    is_paid = Column(Boolean, nullable=False, default=True)
    requires_approval = Column(Boolean, nullable=False, default=True)
    carry_forward = Column(Boolean, nullable=False, default=False)
    max_carry_forward = Column(Integer, nullable=True)  # Max days that can be carried
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class Leave(Base):
    """Leave requests"""
    __tablename__ = "leaves"

    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    
    # Leave period
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Integer, nullable=False)  # Calculated excluding weekends/holidays
    
    # Status and workflow
    status = Column(String(30), nullable=False, default="Pending")  # Pending, Approved, Rejected, Cancelled
    reason = Column(Text, nullable=False)
    medical_certificate = Column(String(500), nullable=True)  # File path if applicable
    
    # Approval chain
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    approval_date = Column(DateTime, nullable=True)
    rejection_date = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Balance tracking
    balance_before = Column(Integer, nullable=True)  # Leave balance before this leave
    balance_after = Column(Integer, nullable=True)  # Leave balance after this leave
    
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    employee = relationship("Employee", back_populates="leaves")
    leave_type = relationship("LeaveType")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    rejector = relationship("User", foreign_keys=[rejected_by])


class Payroll(Base):
    """Monthly payroll records"""
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True)
    payroll_period = Column(String(20), nullable=False)  # Format: YYYY-MM
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Salary components
    basic_salary = Column(Numeric(14, 2), nullable=False, default=0)
    house_rent_allowance = Column(Numeric(14, 2), nullable=False, default=0)
    conveyance_allowance = Column(Numeric(14, 2), nullable=False, default=0)
    medical_allowance = Column(Numeric(14, 2), nullable=False, default=0)
    special_allowance = Column(Numeric(14, 2), nullable=False, default=0)
    other_allowances = Column(Numeric(14, 2), nullable=False, default=0)
    
    # Overtime
    overtime_hours = Column(Numeric(5, 2), nullable=False, default=0)
    overtime_amount = Column(Numeric(14, 2), nullable=False, default=0)
    
    # Deductions
    provident_fund = Column(Numeric(14, 2), nullable=False, default=0)
    professional_tax = Column(Numeric(14, 2), nullable=False, default=0)
    income_tax = Column(Numeric(14, 2), nullable=False, default=0)
    other_deductions = Column(Numeric(14, 2), nullable=False, default=0)
    
    # Late penalties
    late_days = Column(Integer, nullable=False, default=0)
    late_penalty = Column(Numeric(14, 2), nullable=False, default=0)
    
    # Leave adjustments
    unpaid_leave_days = Column(Integer, nullable=False, default=0)
    unpaid_leave_deduction = Column(Numeric(14, 2), nullable=False, default=0)
    
    # Totals
    gross_salary = Column(Numeric(14, 2), nullable=False, default=0)
    total_deductions = Column(Numeric(14, 2), nullable=False, default=0)
    net_salary = Column(Numeric(14, 2), nullable=False, default=0)
    
    # Payment info
    payment_date = Column(Date, nullable=True)
    payment_method = Column(String(50), nullable=True)  # Bank Transfer, Cash, Cheque
    bank_account = Column(String(100), nullable=True)
    transaction_reference = Column(String(100), nullable=True)
    
    # Accounting integration
    journal_id = Column(Integer, ForeignKey("journals.id"), nullable=True)  # Link to accounting entry
    
    # Status
    status = Column(String(30), nullable=False, default="Draft")  # Draft, Calculated, Approved, Paid
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    employee = relationship("Employee", back_populates="payroll_records")
    journal = relationship("Journal")
    approver = relationship("User", foreign_keys=[approved_by])


class LeaveBalance(Base):
    """Employee leave balance tracker"""
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    year = Column(Integer, nullable=False)  # Calendar year
    
    # Balance tracking
    opening_balance = Column(Integer, nullable=False, default=0)
    earned = Column(Integer, nullable=False, default=0)  # Leave earned this year
    used = Column(Integer, nullable=False, default=0)  # Leave used this year
    adjusted = Column(Integer, nullable=False, default=0)  # Manual adjustments
    closing_balance = Column(Integer, nullable=False, default=0)  # Computed: opening + earned - used + adjusted
    
    # Carry forward
    carried_forward = Column(Integer, nullable=True)  # From previous year
    carried_to = Column(Integer, nullable=True)  # To next year
    
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    employee = relationship("Employee")
    leave_type = relationship("LeaveType")


class Holiday(Base):
    """Company holidays"""
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    holiday_date = Column(Date, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_recurring = Column(Boolean, nullable=False, default=True)  # Repeats yearly
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())