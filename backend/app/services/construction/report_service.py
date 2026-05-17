"""Report service — budget vs actual, progress summary, procurement stats"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.construction import (
    ConstructionExpense, DailyProgress, Procurement,
)
from app.schemas.construction import (
    BudgetVsActual, ProjectReportResponse,
)
from app.services.construction.budget_service import BudgetService
from app.services.construction.contractor_service import ContractorService
from app.services.construction.project_service import ProjectService


class ReportService:

    @staticmethod
    def project_report(db: Session, project_id: int) -> ProjectReportResponse:
        project = ProjectService.get_by_id(db, project_id)

        # Budget
        try:
            budget = BudgetService.get(db, project_id)
            b_mat  = Decimal(str(budget.material_cost))
            b_lab  = Decimal(str(budget.labor_cost))
            b_eqp  = Decimal(str(budget.equipment_cost))
            b_misc = Decimal(str(budget.misc_cost))
        except Exception:
            budget = None
            b_mat = b_lab = b_eqp = b_misc = Decimal("0")

        # Actual expenses by type
        expenses = db.query(ConstructionExpense).filter(
            ConstructionExpense.project_id == project_id
        ).all()

        a_mat  = sum((e.amount for e in expenses if e.expense_type == "material"),  Decimal("0"))
        a_lab  = sum((e.amount for e in expenses if e.expense_type == "labor"),     Decimal("0"))
        a_eqp  = sum((e.amount for e in expenses if e.expense_type == "equipment"), Decimal("0"))
        a_misc = sum(
            (e.amount for e in expenses if e.expense_type in ("misc", "procurement")),
            Decimal("0"),
        )
        actual_total = sum((e.amount for e in expenses), Decimal("0"))

        total_budget = Decimal(str(project.total_budget))
        variance     = total_budget - actual_total
        variance_pct = float(variance / total_budget * 100) if total_budget else 0.0

        # Procurement summary
        procurements = db.query(Procurement).filter(Procurement.project_id == project_id).all()
        proc_total    = sum((p.cost for p in procurements), Decimal("0"))
        proc_received = sum((p.cost for p in procurements if p.status == "received"), Decimal("0"))
        proc_by_status: dict[str, int] = {}
        for p in procurements:
            proc_by_status[p.status] = proc_by_status.get(p.status, 0) + 1

        # Latest progress
        latest_progress = ProjectService.latest_progress(db, project_id)
        recent_progress = (
            db.query(DailyProgress)
            .filter(DailyProgress.project_id == project_id)
            .order_by(DailyProgress.date.desc())
            .limit(10)
            .all()
        )

        # Expense by type dict
        expense_by_type: dict[str, float] = {}
        for e in expenses:
            expense_by_type[e.expense_type] = (
                expense_by_type.get(e.expense_type, 0.0) + float(e.amount)
            )

        bva = BudgetVsActual(
            project_id           = project_id,
            project_name         = project.name,
            total_budget         = total_budget,
            budgeted_material    = b_mat,
            budgeted_labor       = b_lab,
            budgeted_equipment   = b_eqp,
            budgeted_misc        = b_misc,
            actual_material      = a_mat,
            actual_labor         = a_lab,
            actual_equipment     = a_eqp,
            actual_misc          = a_misc,
            actual_total         = actual_total,
            variance             = variance,
            variance_pct         = variance_pct,
            latest_progress      = latest_progress,
            procurement_total    = proc_total,
            procurement_received = proc_received,
        )

        from app.schemas.construction import PhaseResponse, DailyProgressResponse
        phases       = ProjectService.get_phases(db, project_id)
        contractors  = ContractorService.get_project_contractors(db, project_id)

        return ProjectReportResponse(
            project          = project,
            budget           = budget,
            budget_vs_actual = bva,
            phases           = phases,
            contractors      = contractors,
            recent_progress  = recent_progress,
            procurement_summary = {"by_status": proc_by_status, "total": float(proc_total)},
            expense_by_type  = expense_by_type,
        )
