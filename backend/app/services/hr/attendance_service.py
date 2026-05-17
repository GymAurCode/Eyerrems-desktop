"""
Attendance Service - Attendance tracking and calculation engine
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.models.hr import Attendance, Employee, Holiday, Leave


# Standard work hours config (could be moved to settings)
WORK_START_HOUR = 9   # 9:00 AM
WORK_END_HOUR = 18    # 6:00 PM
STANDARD_HOURS = Decimal("8")
OVERTIME_THRESHOLD = Decimal("8")  # Hours after which overtime kicks in


class AttendanceService:

    @staticmethod
    def mark_attendance(
        db: Session,
        employee_id: int,
        attendance_date: date,
        check_in_time: Optional[datetime],
        check_out_time: Optional[datetime],
        attendance_status: str = "Present",
        notes: Optional[str] = None,
        is_manual_correction: bool = False,
        correction_reason: Optional[str] = None,
        corrected_by: Optional[int] = None,
    ) -> Attendance:
        """Create or update attendance record with auto-calculation of hours/overtime/late."""
        existing = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date == attendance_date,
        ).first()

        total_hours = None
        overtime_hours = Decimal("0")
        late_minutes = 0
        early_leave_minutes = 0

        if check_in_time and check_out_time:
            delta = check_out_time - check_in_time
            total_hours = Decimal(str(round(delta.total_seconds() / 3600, 2)))
            overtime_hours = max(Decimal("0"), total_hours - OVERTIME_THRESHOLD)

        if check_in_time:
            expected_start = check_in_time.replace(
                hour=WORK_START_HOUR, minute=0, second=0, microsecond=0
            )
            if check_in_time > expected_start:
                late_minutes = int((check_in_time - expected_start).total_seconds() / 60)

        if check_out_time:
            expected_end = check_out_time.replace(
                hour=WORK_END_HOUR, minute=0, second=0, microsecond=0
            )
            if check_out_time < expected_end:
                early_leave_minutes = int((expected_end - check_out_time).total_seconds() / 60)

        now = datetime.utcnow()

        if existing:
            existing.check_in_time = check_in_time
            existing.check_out_time = check_out_time
            existing.total_hours = total_hours
            existing.overtime_hours = overtime_hours
            existing.late_minutes = late_minutes
            existing.early_leave_minutes = early_leave_minutes
            existing.attendance_status = attendance_status
            existing.notes = notes
            existing.is_manual_correction = is_manual_correction
            existing.correction_reason = correction_reason
            existing.corrected_by = corrected_by
            existing.updated_at = now
            db.commit()
            db.refresh(existing)
            return existing

        record = Attendance(
            employee_id=employee_id,
            attendance_date=attendance_date,
            check_in_time=check_in_time,
            check_out_time=check_out_time,
            total_hours=total_hours,
            overtime_hours=overtime_hours,
            late_minutes=late_minutes,
            early_leave_minutes=early_leave_minutes,
            attendance_status=attendance_status,
            is_approved=not is_manual_correction,
            is_manual_correction=is_manual_correction,
            correction_reason=correction_reason,
            corrected_by=corrected_by,
            notes=notes,
            created_at=now,
            updated_at=now,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_monthly_summary(
        db: Session,
        employee_id: int,
        year: int,
        month: int,
    ) -> Dict:
        """Return attendance summary for a given employee/month."""
        period_start = date(year, month, 1)
        if month == 12:
            period_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            period_end = date(year, month + 1, 1) - timedelta(days=1)

        records = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.attendance_date >= period_start,
            Attendance.attendance_date <= period_end,
        ).all()

        total_days = (period_end - period_start).days + 1
        present = sum(1 for r in records if r.attendance_status == "Present")
        absent = sum(1 for r in records if r.attendance_status == "Absent")
        leave = sum(1 for r in records if r.attendance_status == "Leave")
        late = sum(1 for r in records if (r.late_minutes or 0) > 0)
        early = sum(1 for r in records if (r.early_leave_minutes or 0) > 0)
        overtime = sum(r.overtime_hours or Decimal("0") for r in records)

        attendance_pct = (
            Decimal(str(present)) / Decimal(str(total_days)) * 100
            if total_days > 0 else Decimal("0")
        )

        return {
            "employee_id": employee_id,
            "period": f"{year}-{month:02d}",
            "total_days": total_days,
            "present_days": present,
            "absent_days": absent,
            "leave_days": leave,
            "late_days": late,
            "early_leave_days": early,
            "overtime_hours": overtime,
            "attendance_percentage": round(attendance_pct, 2),
        }

    @staticmethod
    def get_department_daily_report(
        db: Session,
        report_date: date,
        department_id: Optional[int] = None,
    ) -> List[Dict]:
        """Return daily attendance status for all employees (optionally filtered by dept)."""
        query = db.query(Employee).filter(
            Employee.is_active.is_(True),
            Employee.employment_status == "Active",
        )
        if department_id:
            query = query.filter(Employee.department_id == department_id)

        employees = query.all()
        result = []

        for emp in employees:
            record = db.query(Attendance).filter(
                Attendance.employee_id == emp.id,
                Attendance.attendance_date == report_date,
            ).first()

            result.append({
                "employee_id": emp.id,
                "employee_code": emp.employee_id,
                "full_name": emp.full_name,
                "department": emp.department.name if emp.department else None,
                "status": record.attendance_status if record else "Not Marked",
                "check_in": record.check_in_time if record else None,
                "check_out": record.check_out_time if record else None,
                "total_hours": record.total_hours if record else None,
                "overtime_hours": record.overtime_hours if record else None,
                "late_minutes": record.late_minutes if record else None,
            })

        return result

    @staticmethod
    def approve_correction(
        db: Session,
        attendance_id: int,
        approved_by: int,
    ) -> Attendance:
        """Approve a manual attendance correction."""
        record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
        if not record:
            raise ValueError(f"Attendance record {attendance_id} not found")
        if not record.is_manual_correction:
            raise ValueError("This record is not a manual correction")

        record.is_approved = True
        record.approved_by = approved_by
        record.approved_at = datetime.utcnow()
        record.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(record)
        return record
