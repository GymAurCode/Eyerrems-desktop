"""HR Management Module

Revision ID: 0016_hr_module
Revises: 0015_reminder_module
Create Date: 2026-04-29
"""
from alembic import op
import sqlalchemy as sa

revision = "0016_hr_module"
down_revision = "0015_reminder_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Departments table — manager_id FK to employees added after employees table is created
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("manager_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_departments_code", "departments", ["code"], unique=True)
    op.create_index("ix_departments_name", "departments", ["name"], unique=True)
    op.create_index("ix_departments_parent_id", "departments", ["parent_id"])

    # Positions table
    op.create_table(
        "positions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("grade", sa.String(10), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("min_salary", sa.Numeric(14, 2), nullable=True),
        sa.Column("max_salary", sa.Numeric(14, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_positions_code", "positions", ["code"], unique=True)
    op.create_index("ix_positions_title", "positions", ["title"], unique=True)

    # Branches table
    op.create_table(
        "branches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_branches_code", "branches", ["code"], unique=True)
    op.create_index("ix_branches_name", "branches", ["name"], unique=True)

    # Employees table
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.String(50), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("middle_name", sa.String(100), nullable=True),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("full_name", sa.String(300), nullable=False),
        
        # Personal details
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("marital_status", sa.String(20), nullable=True),
        sa.Column("nationality", sa.String(100), nullable=True),
        
        # Contact details
        sa.Column("personal_email", sa.String(255), nullable=True),
        sa.Column("work_email", sa.String(255), nullable=True),
        sa.Column("personal_phone", sa.String(50), nullable=True),
        sa.Column("work_phone", sa.String(50), nullable=True),
        sa.Column("emergency_contact_name", sa.String(200), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(50), nullable=True),
        sa.Column("emergency_contact_relation", sa.String(50), nullable=True),
        
        # Address
        sa.Column("address_line1", sa.Text(), nullable=True),
        sa.Column("address_line2", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        
        # Employment details
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("position_id", sa.Integer(), sa.ForeignKey("positions.id"), nullable=True),
        sa.Column("branch_id", sa.Integer(), sa.ForeignKey("branches.id"), nullable=True),
        sa.Column("manager_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=True),
        
        sa.Column("joining_date", sa.Date(), nullable=False),
        sa.Column("confirmation_date", sa.Date(), nullable=True),
        sa.Column("employment_type", sa.String(30), nullable=False, server_default="Permanent"),
        sa.Column("employment_status", sa.String(30), nullable=False, server_default="Active"),
        sa.Column("resignation_date", sa.Date(), nullable=True),
        sa.Column("termination_date", sa.Date(), nullable=True),
        sa.Column("termination_reason", sa.Text(), nullable=True),
        
        # System fields
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_employees_employee_id", "employees", ["employee_id"], unique=True)
    op.create_index("ix_employees_department_id", "employees", ["department_id"])
    op.create_index("ix_employees_position_id", "employees", ["position_id"])
    op.create_index("ix_employees_branch_id", "employees", ["branch_id"])
    op.create_index("ix_employees_manager_id", "employees", ["manager_id"])
    op.create_index("ix_employees_user_id", "employees", ["user_id"])
    op.create_index("ix_employees_employment_status", "employees", ["employment_status"])

    # Now that employees table exists, add the deferred FK on departments.manager_id
    op.create_foreign_key(
        "fk_departments_manager_id", "departments", "employees", ["manager_id"], ["id"]
    )
    op.create_index("ix_departments_manager_id", "departments", ["manager_id"])

    # Salary structures table
    op.create_table(
        "salary_structures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False),
        
        # Basic components
        sa.Column("basic_salary", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("house_rent_allowance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("conveyance_allowance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("medical_allowance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("special_allowance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("other_allowances", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Deductions
        sa.Column("provident_fund", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("professional_tax", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("income_tax", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("other_deductions", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Totals
        sa.Column("gross_salary", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_deductions", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("net_salary", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Overtime rates
        sa.Column("overtime_hourly_rate", sa.Numeric(10, 2), nullable=False, server_default="0"),
        
        # Effective dates
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_salary_structures_employee_id", "salary_structures", ["employee_id"], unique=True)

    # Allowance types table
    op.create_table(
        "allowance_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_taxable", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_allowance_types_code", "allowance_types", ["code"], unique=True)
    op.create_index("ix_allowance_types_name", "allowance_types", ["name"], unique=True)

    # Deduction types table
    op.create_table(
        "deduction_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_statutory", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_deduction_types_code", "deduction_types", ["code"], unique=True)
    op.create_index("ix_deduction_types_name", "deduction_types", ["name"], unique=True)

    # Attendance table
    op.create_table(
        "attendances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        
        # Check-in/out times
        sa.Column("check_in_time", sa.DateTime(), nullable=True),
        sa.Column("check_out_time", sa.DateTime(), nullable=True),
        
        # Calculated values
        sa.Column("total_hours", sa.Numeric(5, 2), nullable=True),
        sa.Column("overtime_hours", sa.Numeric(5, 2), nullable=True, server_default="0"),
        sa.Column("late_minutes", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("early_leave_minutes", sa.Integer(), nullable=True, server_default="0"),
        
        # Status
        sa.Column("attendance_status", sa.String(30), nullable=False, server_default="Present"),
        sa.Column("is_approved", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        
        # Manual correction
        sa.Column("is_manual_correction", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("correction_reason", sa.Text(), nullable=True),
        sa.Column("corrected_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_attendances_employee_id", "attendances", ["employee_id"])
    op.create_index("ix_attendances_attendance_date", "attendances", ["attendance_date"])
    op.create_index("ix_attendances_employee_date", "attendances", ["employee_id", "attendance_date"], unique=True)

    # Leave types table
    op.create_table(
        "leave_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("days_per_year", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("carry_forward", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("max_carry_forward", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_leave_types_code", "leave_types", ["code"], unique=True)
    op.create_index("ix_leave_types_name", "leave_types", ["name"], unique=True)

    # Leaves table
    op.create_table(
        "leaves",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("leave_type_id", sa.Integer(), sa.ForeignKey("leave_types.id"), nullable=False),
        
        # Leave period
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("total_days", sa.Integer(), nullable=False),
        
        # Status and workflow
        sa.Column("status", sa.String(30), nullable=False, server_default="Pending"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("medical_certificate", sa.String(500), nullable=True),
        
        # Approval chain
        sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("rejected_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        
        sa.Column("approval_date", sa.DateTime(), nullable=True),
        sa.Column("rejection_date", sa.DateTime(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        
        # Balance tracking
        sa.Column("balance_before", sa.Integer(), nullable=True),
        sa.Column("balance_after", sa.Integer(), nullable=True),
        
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_leaves_employee_id", "leaves", ["employee_id"])
    op.create_index("ix_leaves_leave_type_id", "leaves", ["leave_type_id"])
    op.create_index("ix_leaves_status", "leaves", ["status"])
    op.create_index("ix_leaves_start_date", "leaves", ["start_date"])

    # Payroll table
    op.create_table(
        "payrolls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("payroll_period", sa.String(20), nullable=False),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False),
        
        # Salary components
        sa.Column("basic_salary", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("house_rent_allowance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("conveyance_allowance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("medical_allowance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("special_allowance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("other_allowances", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Overtime
        sa.Column("overtime_hours", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("overtime_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Deductions
        sa.Column("provident_fund", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("professional_tax", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("income_tax", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("other_deductions", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Late penalties
        sa.Column("late_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("late_penalty", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Leave adjustments
        sa.Column("unpaid_leave_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unpaid_leave_deduction", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Totals
        sa.Column("gross_salary", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_deductions", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("net_salary", sa.Numeric(14, 2), nullable=False, server_default="0"),
        
        # Payment info
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("bank_account", sa.String(100), nullable=True),
        sa.Column("transaction_reference", sa.String(100), nullable=True),
        
        # Accounting integration
        sa.Column("journal_id", sa.Integer(), sa.ForeignKey("journals.id"), nullable=True),
        
        # Status
        sa.Column("status", sa.String(30), nullable=False, server_default="Draft"),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_payrolls_payroll_period", "payrolls", ["payroll_period"])
    op.create_index("ix_payrolls_employee_id", "payrolls", ["employee_id"])
    op.create_index("ix_payrolls_status", "payrolls", ["status"])
    op.create_index("ix_payrolls_period_employee", "payrolls", ["payroll_period", "employee_id"], unique=True)

    # Leave balances table
    op.create_table(
        "leave_balances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("leave_type_id", sa.Integer(), sa.ForeignKey("leave_types.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        
        # Balance tracking
        sa.Column("opening_balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("adjusted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("closing_balance", sa.Integer(), nullable=False, server_default="0"),
        
        # Carry forward
        sa.Column("carried_forward", sa.Integer(), nullable=True),
        sa.Column("carried_to", sa.Integer(), nullable=True),
        
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_leave_balances_employee_id", "leave_balances", ["employee_id"])
    op.create_index("ix_leave_balances_leave_type_id", "leave_balances", ["leave_type_id"])
    op.create_index("ix_leave_balances_year", "leave_balances", ["year"])
    op.create_index("ix_leave_balances_employee_type_year", "leave_balances", ["employee_id", "leave_type_id", "year"], unique=True)

    # Holidays table
    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_holidays_holiday_date", "holidays", ["holiday_date"], unique=True)


def downgrade() -> None:
    op.drop_constraint("fk_departments_manager_id", "departments", type_="foreignkey")
    op.drop_index("ix_departments_manager_id", "departments")
    op.drop_table("holidays")
    op.drop_table("leave_balances")
    op.drop_table("payrolls")
    op.drop_table("leaves")
    op.drop_table("leave_types")
    op.drop_table("attendances")
    op.drop_table("deduction_types")
    op.drop_table("allowance_types")
    op.drop_table("salary_structures")
    op.drop_table("employees")
    op.drop_table("branches")
    op.drop_table("positions")
    op.drop_table("departments")