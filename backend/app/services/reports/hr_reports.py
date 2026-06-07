"""HR Reports — Employee, Salary, Attendance reports."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.hr import Employee
from app.services.reports.report_engine import (
    BaseReportService, ReportColumn, ReportFilter, ReportResult, ReportSummary,
)


class EmployeeListReportService(BaseReportService):
    """List of all employees with department and position."""

    REPORT_KEY = "employees_list"
    REPORT_NAME = "Employees List Report"
    REPORT_CATEGORY = "HR"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = self.db.query(Employee).options(
            joinedload(Employee.department),
            joinedload(Employee.position),
        )

        if filters.department:
            query = query.filter(Employee.department_id == filters.department)
        if filters.search:
            query = query.filter(
                or_(
                    Employee.first_name.ilike(f"%{filters.search}%"),
                    Employee.last_name.ilike(f"%{filters.search}%"),
                    Employee.employee_code.ilike(f"%{filters.search}%"),
                )
            )
        if filters.status:
            query = query.filter(Employee.status == filters.status)

        total_count = query.count()
        query = self._apply_pagination(query, filters)
        employees = query.all()

        rows = []
        for emp in employees:
            rows.append({
                "emp_id": emp.employee_code or str(emp.id),
                "name": f"{emp.first_name} {emp.last_name}",
                "department": emp.department.name if emp.department else "N/A",
                "position": emp.position.title if emp.position else "N/A",
                "phone": emp.phone or "N/A",
                "email": emp.email or "N/A",
                "status": emp.status.upper() if emp.status else "ACTIVE",
            })

        columns = [
            ReportColumn(key="emp_id", label="Emp ID", width="12%"),
            ReportColumn(key="name", label="Name", width="20%"),
            ReportColumn(key="department", label="Department", width="18%"),
            ReportColumn(key="position", label="Position", width="18%"),
            ReportColumn(key="phone", label="Phone", width="15%"),
            ReportColumn(key="email", label="Email", width="17%"),
        ]

        summary = [
            ReportSummary(label="Total Employees", value=total_count, format="number", color="blue"),
        ]

        meta = self._make_meta(
            title="Employees List",
            filters=filters,
            total_records=total_count,
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


class SalaryReportService(BaseReportService):
    """Payroll summary with allowances & deductions."""

    REPORT_KEY = "salary_report"
    REPORT_NAME = "Salary Report"
    REPORT_CATEGORY = "HR"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = self.db.query(Employee).options(
            joinedload(Employee.department),
            joinedload(Employee.position),
            joinedload(Employee.salary_structures),
        )

        if filters.department:
            query = query.filter(Employee.department_id == filters.department)
        if filters.search:
            query = query.filter(
                or_(
                    Employee.first_name.ilike(f"%{filters.search}%"),
                    Employee.last_name.ilike(f"%{filters.search}%"),
                )
            )

        total_count = query.count()
        query = self._apply_pagination(query, filters)
        employees = query.all()

        rows = []
        total_basic = 0.0
        total_allowances = 0.0
        total_deductions = 0.0
        total_net = 0.0

        for emp in employees:
            basic = self._safe_float(emp.basic_salary)
            allowances = 0.0
            deductions = 0.0

            if emp.salary_structures:
                for ss in emp.salary_structures:
                    allowances += self._safe_float(ss.total_allowances)
                    deductions += self._safe_float(ss.total_deductions)

            net = basic + allowances - deductions
            total_basic += basic
            total_allowances += allowances
            total_deductions += deductions
            total_net += net

            rows.append({
                "emp_id": emp.employee_code or str(emp.id),
                "name": f"{emp.first_name} {emp.last_name}",
                "department": emp.department.name if emp.department else "N/A",
                "basic_salary": basic,
                "allowances": allowances,
                "deductions": deductions,
                "net_salary": net,
                "status": emp.status.upper() if emp.status else "ACTIVE",
            })

        columns = [
            ReportColumn(key="emp_id", label="Emp ID", width="10%"),
            ReportColumn(key="name", label="Employee", width="18%"),
            ReportColumn(key="department", label="Department", width="15%"),
            ReportColumn(key="basic_salary", label="Basic (PKR)", data_type="currency", align="right", width="14%"),
            ReportColumn(key="allowances", label="Allowances (PKR)", data_type="currency", align="right", width="15%"),
            ReportColumn(key="deductions", label="Deductions (PKR)", data_type="currency", align="right", width="15%"),
            ReportColumn(key="net_salary", label="Net (PKR)", data_type="currency", align="right", width="13%"),
        ]

        summary = [
            ReportSummary(label="Total Basic", value=total_basic, format="currency", color="blue"),
            ReportSummary(label="Total Allowances", value=total_allowances, format="currency", color="green"),
            ReportSummary(label="Total Deductions", value=total_deductions, format="currency", color="red"),
            ReportSummary(label="Total Payroll", value=total_net, format="currency", color="purple"),
        ]

        meta = self._make_meta(
            title="Salary Report",
            filters=filters,
            total_records=total_count,
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


class AttendanceReportService(BaseReportService):
    """Daily attendance records by employee."""

    REPORT_KEY = "attendance_report"
    REPORT_NAME = "Attendance Report"
    REPORT_CATEGORY = "HR"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        from app.models.hr import Attendance
        start = self._start_timer()

        query = (
            self.db.query(Attendance, Employee)
            .join(Employee, Attendance.employee_id == Employee.id)
        )

        if filters.date_from:
            query = query.filter(Attendance.date >= filters.date_from)
        if filters.date_to:
            query = query.filter(Attendance.date <= filters.date_to)
        if filters.employee_id:
            query = query.filter(Employee.id == filters.employee_id)
        if filters.status:
            query = query.filter(Attendance.status == filters.status)

        total_count = query.count()
        query = query.order_by(Attendance.date.desc())
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        present_count = 0
        absent_count = 0
        late_count = 0

        for att, emp in results:
            status = (att.status or "present").upper()
            if status == "PRESENT":
                present_count += 1
            elif status == "ABSENT":
                absent_count += 1
            else:
                late_count += 1

            rows.append({
                "date": self._format_date(att.date),
                "emp_id": emp.employee_code or str(emp.id),
                "name": f"{emp.first_name} {emp.last_name}",
                "check_in": str(att.check_in or "—"),
                "check_out": str(att.check_out or "—"),
                "status": status,
            })

        columns = [
            ReportColumn(key="date", label="Date", data_type="date", width="15%"),
            ReportColumn(key="emp_id", label="Emp ID", width="12%"),
            ReportColumn(key="name", label="Employee", width="20%"),
            ReportColumn(key="check_in", label="Check In", width="15%"),
            ReportColumn(key="check_out", label="Check Out", width="15%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="13%"),
        ]

        summary = [
            ReportSummary(label="Present", value=present_count, format="number", color="green"),
            ReportSummary(label="Absent", value=absent_count, format="number", color="red"),
            ReportSummary(label="Late", value=late_count, format="number", color="yellow"),
        ]

        meta = self._make_meta(
            title="Attendance Report",
            filters=filters,
            total_records=total_count,
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )
