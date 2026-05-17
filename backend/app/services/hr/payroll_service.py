"""
Payroll Service - Core payroll processing engine
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_

from app.core.journal_service import JournalService, JournalEntryData
from app.core.tid import next_tid
from app.models.auth import User
from app.models.finance import Account
from app.models.hr import (
    Employee, SalaryStructure, Attendance, Leave, Payroll, Department, Branch
)
from app.schemas.hr import PayrollCreate, PayrollUpdate


class PayrollService:
    """Service for payroll processing and accounting integration"""
    
    @staticmethod
    def calculate_payroll(
        db: Session,
        employee_id: int,
        payroll_period: str,  # Format: YYYY-MM
        user: User
    ) -> Payroll:
        """
        Calculate payroll for an employee for a given period.
        
        Steps:
        1. Get employee and salary structure
        2. Calculate attendance (present days, overtime, late penalties)
        3. Calculate leave adjustments (unpaid leave deductions)
        4. Calculate gross salary (basic + allowances)
        5. Calculate deductions (PF, taxes, etc.)
        6. Calculate net salary
        7. Create payroll record
        """
        # Parse period
        year, month = map(int, payroll_period.split('-'))
        period_start = date(year, month, 1)
        if month == 12:
            period_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            period_end = date(year, month + 1, 1) - timedelta(days=1)
        
        # Get employee and salary structure
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise ValueError(f"Employee {employee_id} not found")
        
        salary = db.query(SalaryStructure).filter(
            SalaryStructure.employee_id == employee_id,
            SalaryStructure.is_active.is_(True),
            SalaryStructure.effective_from <= period_end,
            or_(
                SalaryStructure.effective_to.is_(None),
                SalaryStructure.effective_to >= period_start
            )
        ).first()
        
        if not salary:
            raise ValueError(f"No active salary structure found for employee {employee_id}")
        
        # Calculate attendance metrics
        attendance_records = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date >= period_start,
            Attendance.attendance_date <= period_end,
            Attendance.is_approved.is_(True)
        ).all()
        
        present_days = 0
        overtime_hours = Decimal("0")
        late_days = 0
        early_leave_days = 0
        
        for record in attendance_records:
            if record.attendance_status == "Present":
                present_days += 1
            if record.overtime_hours:
                overtime_hours += record.overtime_hours
            if record.late_minutes and record.late_minutes > 0:
                late_days += 1
            if record.early_leave_minutes and record.early_leave_minutes > 0:
                early_leave_days += 1
        
        # Calculate leave adjustments
        leave_records = db.query(Leave).filter(
            Leave.employee_id == employee_id,
            Leave.start_date <= period_end,
            Leave.end_date >= period_start,
            Leave.status == "Approved",
            Leave.is_active.is_(True)
        ).all()
        
        unpaid_leave_days = 0
        for leave_record in leave_records:
            # Calculate overlapping days
            overlap_start = max(leave_record.start_date, period_start)
            overlap_end = min(leave_record.end_date, period_end)
            overlap_days = (overlap_end - overlap_start).days + 1
            
            # Check if leave type is unpaid
            if not leave_record.leave_type.is_paid:
                unpaid_leave_days += overlap_days
        
        # Calculate salary components
        working_days = (period_end - period_start).days + 1
        holidays = 0  # Would need holiday table lookup
        
        # Basic salary prorated for unpaid leave
        daily_basic = salary.basic_salary / Decimal(str(working_days))
        basic_salary = salary.basic_salary - (daily_basic * Decimal(str(unpaid_leave_days)))
        
        # Allowances (prorated for unpaid leave)
        daily_gross = salary.gross_salary / Decimal(str(working_days))
        gross_salary = salary.gross_salary - (daily_gross * Decimal(str(unpaid_leave_days)))
        
        # Overtime calculation
        overtime_amount = overtime_hours * salary.overtime_hourly_rate
        
        # Late penalties (example: 1% of daily basic per late day)
        late_penalty = Decimal("0")
        if late_days > 0:
            daily_penalty = daily_basic * Decimal("0.01")
            late_penalty = daily_penalty * Decimal(str(late_days))
        
        # Deductions (prorated for unpaid leave)
        daily_deductions = salary.total_deductions / Decimal(str(working_days))
        total_deductions = salary.total_deductions - (daily_deductions * Decimal(str(unpaid_leave_days)))
        
        # Add overtime to gross
        gross_salary += overtime_amount
        
        # Add late penalty to deductions
        total_deductions += late_penalty
        
        # Add unpaid leave deduction (if any)
        unpaid_leave_deduction = daily_gross * Decimal(str(unpaid_leave_days))
        total_deductions += unpaid_leave_deduction
        
        # Calculate net salary
        net_salary = gross_salary - total_deductions
        
        # Create payroll record
        payroll = Payroll(
            payroll_period=payroll_period,
            employee_id=employee_id,
            
            # Salary components
            basic_salary=basic_salary,
            house_rent_allowance=salary.house_rent_allowance,
            conveyance_allowance=salary.conveyance_allowance,
            medical_allowance=salary.medical_allowance,
            special_allowance=salary.special_allowance,
            other_allowances=salary.other_allowances,
            
            # Overtime
            overtime_hours=overtime_hours,
            overtime_amount=overtime_amount,
            
            # Deductions
            provident_fund=salary.provident_fund,
            professional_tax=salary.professional_tax,
            income_tax=salary.income_tax,
            other_deductions=salary.other_deductions,
            
            # Late penalties
            late_days=late_days,
            late_penalty=late_penalty,
            
            # Leave adjustments
            unpaid_leave_days=unpaid_leave_days,
            unpaid_leave_deduction=unpaid_leave_deduction,
            
            # Totals
            gross_salary=gross_salary,
            total_deductions=total_deductions,
            net_salary=net_salary,
            
            # Status
            status="Calculated",
            
            # Audit
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(payroll)
        db.commit()
        db.refresh(payroll)
        
        return payroll
    
    @staticmethod
    def post_payroll_to_accounting(
        db: Session,
        payroll_id: int,
        user: User
    ) -> None:
        """
        Post payroll to accounting system (Chart of Accounts).
        
        Creates journal entries for:
        - Salary expense (debit)
        - Various liability accounts (PF payable, tax payable) (credit)
        - Bank/cash account (credit for net salary)
        """
        payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
        if not payroll:
            raise ValueError(f"Payroll {payroll_id} not found")
        
        if payroll.journal_id:
            raise ValueError(f"Payroll {payroll_id} already posted to accounting")
        
        # Get employee
        employee = db.query(Employee).filter(Employee.id == payroll.employee_id).first()
        if not employee:
            raise ValueError(f"Employee {payroll.employee_id} not found")
        
        # Get required accounts
        # Salary Expense account (5300 from default COA)
        salary_expense_account = db.query(Account).filter(
            Account.code == "5300"
        ).first()
        
        if not salary_expense_account:
            # Fallback: find any salary expense account
            salary_expense_account = db.query(Account).filter(
                Account.name.ilike("%salary%"),
                Account.account_type == "Expense"
            ).first()
        
        # Bank account (1100 from default COA)
        bank_account = db.query(Account).filter(
            Account.code == "1100"
        ).first()
        
        if not bank_account:
            # Fallback: find any bank account
            bank_account = db.query(Account).filter(
                Account.name.ilike("%bank%"),
                Account.account_type == "Asset"
            ).first()
        
        # Create journal entries
        entries = []
        
        # 1. Debit Salary Expense (gross salary)
        entries.append(JournalEntryData(
            account_id=salary_expense_account.id,
            debit=payroll.gross_salary,
            description=f"Salary for {employee.full_name} - {payroll.payroll_period}"
        ))
        
        # 2. Credit Bank Account (net salary)
        entries.append(JournalEntryData(
            account_id=bank_account.id,
            credit=payroll.net_salary,
            description=f"Net salary payment to {employee.full_name}"
        ))
        
        # 3. Credit PF Payable (if any)
        if payroll.provident_fund > 0:
            pf_payable_account = db.query(Account).filter(
                Account.name.ilike("%provident%"),
                Account.account_type == "Liability"
            ).first()
            if pf_payable_account:
                entries.append(JournalEntryData(
                    account_id=pf_payable_account.id,
                    credit=payroll.provident_fund,
                    description=f"PF contribution for {employee.full_name}"
                ))
        
        # 4. Credit Tax Payable (if any)
        if payroll.income_tax > 0:
            tax_payable_account = db.query(Account).filter(
                Account.name.ilike("%tax%payable%"),
                Account.account_type == "Liability"
            ).first()
            if tax_payable_account:
                entries.append(JournalEntryData(
                    account_id=tax_payable_account.id,
                    credit=payroll.income_tax,
                    description=f"Income tax for {employee.full_name}"
                ))
        
        # Create journal
        journal = JournalService.create_journal_entry(
            db=db,
            entries=entries,
            reference_type="payroll",
            reference_id=str(payroll.id),
            description=f"Payroll posting for {employee.full_name} - {payroll.payroll_period}",
            date=datetime.utcnow(),
            user=user
        )
        
        # Update payroll with journal reference
        payroll.journal_id = journal.id
        payroll.status = "Posted"
        payroll.updated_at = datetime.utcnow()
        
        db.commit()
    
    @staticmethod
    def approve_payroll(
        db: Session,
        payroll_id: int,
        user: User
    ) -> Payroll:
        """Approve payroll for payment"""
        payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
        if not payroll:
            raise ValueError(f"Payroll {payroll_id} not found")
        
        if payroll.status not in ["Calculated", "Draft"]:
            raise ValueError(f"Payroll {payroll_id} cannot be approved in status {payroll.status}")
        
        payroll.status = "Approved"
        payroll.approved_by = user.id
        payroll.approved_at = datetime.utcnow()
        payroll.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(payroll)
        
        return payroll
    
    @staticmethod
    def mark_as_paid(
        db: Session,
        payroll_id: int,
        payment_date: date,
        payment_method: str,
        transaction_reference: Optional[str] = None,
        bank_account: Optional[str] = None
    ) -> Payroll:
        """Mark payroll as paid"""
        payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
        if not payroll:
            raise ValueError(f"Payroll {payroll_id} not found")
        
        if payroll.status != "Approved":
            raise ValueError(f"Payroll {payroll_id} must be approved before marking as paid")
        
        payroll.status = "Paid"
        payroll.payment_date = payment_date
        payroll.payment_method = payment_method
        payroll.transaction_reference = transaction_reference
        payroll.bank_account = bank_account
        payroll.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(payroll)
        
        return payroll
    
    @staticmethod
    def generate_payroll_summary(
        db: Session,
        payroll_period: str,
        department_id: Optional[int] = None,
        branch_id: Optional[int] = None
    ) -> Dict:
        """Generate payroll summary report"""
        query = db.query(Payroll).filter(Payroll.payroll_period == payroll_period)
        
        if department_id:
            query = query.join(Employee).filter(Employee.department_id == department_id)
        
        if branch_id:
            query = query.join(Employee).filter(Employee.branch_id == branch_id)
        
        payrolls = query.all()
        
        total_employees = len(payrolls)
        total_gross = sum(p.gross_salary for p in payrolls)
        total_deductions = sum(p.total_deductions for p in payrolls)
        total_net = sum(p.net_salary for p in payrolls)
        
        status_counts = {}
        for payroll in payrolls:
            status_counts[payroll.status] = status_counts.get(payroll.status, 0) + 1
        
        return {
            "payroll_period": payroll_period,
            "total_employees": total_employees,
            "total_gross_salary": total_gross,
            "total_deductions": total_deductions,
            "total_net_salary": total_net,
            "status_counts": status_counts,
            "payrolls": payrolls
        }
    
    @staticmethod
    def generate_payslip_data(payroll: Payroll, employee: Employee) -> Dict:
        """Generate data for payslip PDF generation"""
        return {
            "employee": {
                "id": employee.employee_id,
                "name": employee.full_name,
                "department": employee.department.name if employee.department else None,
                "position": employee.position.title if employee.position else None,
                "branch": employee.branch.name if employee.branch else None,
            },
            "payroll": {
                "period": payroll.payroll_period,
                "payment_date": payroll.payment_date,
                "status": payroll.status,
            },
            "earnings": {
                "basic_salary": payroll.basic_salary,
                "house_rent_allowance": payroll.house_rent_allowance,
                "conveyance_allowance": payroll.conveyance_allowance,
                "medical_allowance": payroll.medical_allowance,
                "special_allowance": payroll.special_allowance,
                "other_allowances": payroll.other_allowances,
                "overtime_amount": payroll.overtime_amount,
                "total_earnings": payroll.gross_salary,
            },
            "deductions": {
                "provident_fund": payroll.provident_fund,
                "professional_tax": payroll.professional_tax,
                "income_tax": payroll.income_tax,
                "other_deductions": payroll.other_deductions,
                "late_penalty": payroll.late_penalty,
                "unpaid_leave_deduction": payroll.unpaid_leave_deduction,
                "total_deductions": payroll.total_deductions,
            },
            "summary": {
                "gross_salary": payroll.gross_salary,
                "total_deductions": payroll.total_deductions,
                "net_salary": payroll.net_salary,
                "payment_method": payroll.payment_method,
                "bank_account": payroll.bank_account,
                "transaction_reference": payroll.transaction_reference,
            },
            "attendance": {
                "overtime_hours": payroll.overtime_hours,
                "late_days": payroll.late_days,
                "unpaid_leave_days": payroll.unpaid_leave_days,
            }
        }