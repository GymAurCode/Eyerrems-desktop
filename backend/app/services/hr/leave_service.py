"""
Leave Service - Leave request workflow and balance management
"""
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.hr import Attendance, Employee, Holiday, Leave, LeaveBalance, LeaveType


class LeaveService:

    @staticmethod
    def _count_working_days(
        db: Session,
        start: date,
        end: date,
    ) -> int:
        """Count working days between two dates, excluding weekends and holidays."""
        holidays = {
            h.holiday_date
            for h in db.query(Holiday).filter(
                Holiday.holiday_date >= start,
                Holiday.holiday_date <= end,
                Holiday.is_active.is_(True),
            ).all()
        }

        count = 0
        current = start
        while current <= end:
            # Skip weekends (5=Saturday, 6=Sunday)
            if current.weekday() < 5 and current not in holidays:
                count += 1
            current += timedelta(days=1)
        return count

    @staticmethod
    def get_or_create_balance(
        db: Session,
        employee_id: int,
        leave_type_id: int,
        year: int,
    ) -> LeaveBalance:
        """Get or create leave balance record for employee/type/year."""
        balance = db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.year == year,
        ).first()

        if not balance:
            leave_type = db.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
            now = datetime.utcnow()
            balance = LeaveBalance(
                employee_id=employee_id,
                leave_type_id=leave_type_id,
                year=year,
                opening_balance=leave_type.days_per_year if leave_type else 0,
                earned=leave_type.days_per_year if leave_type else 0,
                used=0,
                adjusted=0,
                closing_balance=leave_type.days_per_year if leave_type else 0,
                created_at=now,
                updated_at=now,
            )
            db.add(balance)
            db.commit()
            db.refresh(balance)

        return balance

    @staticmethod
    def request_leave(
        db: Session,
        employee_id: int,
        leave_type_id: int,
        start_date: date,
        end_date: date,
        reason: str,
        requested_by: int,
        medical_certificate: Optional[str] = None,
    ) -> Leave:
        """Submit a leave request."""
        leave_type = db.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
        if not leave_type or not leave_type.is_active:
            raise ValueError("Invalid or inactive leave type")

        # Check for overlapping approved/pending leaves
        overlap = db.query(Leave).filter(
            Leave.employee_id == employee_id,
            Leave.status.in_(["Pending", "Approved"]),
            Leave.is_active.is_(True),
            Leave.start_date <= end_date,
            Leave.end_date >= start_date,
        ).first()
        if overlap:
            raise ValueError("Overlapping leave request already exists")

        total_days = LeaveService._count_working_days(db, start_date, end_date)
        if total_days <= 0:
            raise ValueError("No working days in the selected date range")

        # Check balance
        year = start_date.year
        balance = LeaveService.get_or_create_balance(db, employee_id, leave_type_id, year)
        if leave_type.days_per_year > 0 and balance.closing_balance < total_days:
            raise ValueError(
                f"Insufficient leave balance. Available: {balance.closing_balance}, Requested: {total_days}"
            )

        now = datetime.utcnow()
        leave = Leave(
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            start_date=start_date,
            end_date=end_date,
            total_days=total_days,
            reason=reason,
            medical_certificate=medical_certificate,
            status="Pending" if leave_type.requires_approval else "Approved",
            requested_by=requested_by,
            balance_before=balance.closing_balance,
            balance_after=balance.closing_balance - total_days,
            created_at=now,
            updated_at=now,
        )
        db.add(leave)

        # If auto-approved, deduct balance and mark attendance
        if not leave_type.requires_approval:
            leave.approved_by = requested_by
            leave.approval_date = now
            LeaveService._deduct_balance(db, balance, total_days)
            LeaveService._mark_attendance_as_leave(db, employee_id, start_date, end_date)

        db.commit()
        db.refresh(leave)
        return leave

    @staticmethod
    def approve_leave(
        db: Session,
        leave_id: int,
        approved_by: int,
    ) -> Leave:
        """Approve a pending leave request."""
        leave = db.query(Leave).filter(Leave.id == leave_id).first()
        if not leave:
            raise ValueError(f"Leave {leave_id} not found")
        if leave.status != "Pending":
            raise ValueError(f"Leave is not in Pending status (current: {leave.status})")

        balance = LeaveService.get_or_create_balance(
            db, leave.employee_id, leave.leave_type_id, leave.start_date.year
        )

        now = datetime.utcnow()
        leave.status = "Approved"
        leave.approved_by = approved_by
        leave.approval_date = now
        leave.updated_at = now

        LeaveService._deduct_balance(db, balance, leave.total_days)
        LeaveService._mark_attendance_as_leave(db, leave.employee_id, leave.start_date, leave.end_date)

        db.commit()
        db.refresh(leave)
        return leave

    @staticmethod
    def reject_leave(
        db: Session,
        leave_id: int,
        rejected_by: int,
        rejection_reason: str,
    ) -> Leave:
        """Reject a pending leave request."""
        leave = db.query(Leave).filter(Leave.id == leave_id).first()
        if not leave:
            raise ValueError(f"Leave {leave_id} not found")
        if leave.status != "Pending":
            raise ValueError(f"Leave is not in Pending status (current: {leave.status})")

        now = datetime.utcnow()
        leave.status = "Rejected"
        leave.rejected_by = rejected_by
        leave.rejection_date = now
        leave.rejection_reason = rejection_reason
        leave.updated_at = now

        db.commit()
        db.refresh(leave)
        return leave

    @staticmethod
    def cancel_leave(
        db: Session,
        leave_id: int,
        cancelled_by: int,
    ) -> Leave:
        """Cancel an approved or pending leave and restore balance."""
        leave = db.query(Leave).filter(Leave.id == leave_id).first()
        if not leave:
            raise ValueError(f"Leave {leave_id} not found")
        if leave.status not in ["Pending", "Approved"]:
            raise ValueError(f"Cannot cancel leave in status: {leave.status}")

        was_approved = leave.status == "Approved"
        leave.status = "Cancelled"
        leave.is_active = False
        leave.updated_at = datetime.utcnow()

        if was_approved:
            balance = LeaveService.get_or_create_balance(
                db, leave.employee_id, leave.leave_type_id, leave.start_date.year
            )
            LeaveService._restore_balance(db, balance, leave.total_days)

        db.commit()
        db.refresh(leave)
        return leave

    @staticmethod
    def get_employee_balances(
        db: Session,
        employee_id: int,
        year: int,
    ) -> List[Dict]:
        """Get all leave balances for an employee for a given year."""
        leave_types = db.query(LeaveType).filter(LeaveType.is_active.is_(True)).all()
        result = []
        for lt in leave_types:
            balance = LeaveService.get_or_create_balance(db, employee_id, lt.id, year)
            result.append({
                "leave_type_id": lt.id,
                "leave_type_name": lt.name,
                "leave_type_code": lt.code,
                "is_paid": lt.is_paid,
                "days_per_year": lt.days_per_year,
                "opening_balance": balance.opening_balance,
                "earned": balance.earned,
                "used": balance.used,
                "adjusted": balance.adjusted,
                "closing_balance": balance.closing_balance,
            })
        return result

    # ── private helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _deduct_balance(db: Session, balance: LeaveBalance, days: int) -> None:
        balance.used += days
        balance.closing_balance = balance.opening_balance + balance.earned - balance.used + balance.adjusted
        balance.updated_at = datetime.utcnow()
        db.flush()

    @staticmethod
    def _restore_balance(db: Session, balance: LeaveBalance, days: int) -> None:
        balance.used = max(0, balance.used - days)
        balance.closing_balance = balance.opening_balance + balance.earned - balance.used + balance.adjusted
        balance.updated_at = datetime.utcnow()
        db.flush()

    @staticmethod
    def _mark_attendance_as_leave(
        db: Session,
        employee_id: int,
        start_date: date,
        end_date: date,
    ) -> None:
        """Create/update attendance records as Leave for the approved period."""
        current = start_date
        now = datetime.utcnow()
        while current <= end_date:
            if current.weekday() < 5:  # Skip weekends
                existing = db.query(Attendance).filter(
                    Attendance.employee_id == employee_id,
                    Attendance.attendance_date == current,
                ).first()
                if existing:
                    existing.attendance_status = "Leave"
                    existing.updated_at = now
                else:
                    db.add(Attendance(
                        employee_id=employee_id,
                        attendance_date=current,
                        attendance_status="Leave",
                        is_approved=True,
                        created_at=now,
                        updated_at=now,
                    ))
            current += timedelta(days=1)
        db.flush()
