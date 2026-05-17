"""
Multi-Tenant Route Pattern — Reference Implementation
═════════════════════════════════════════════════════
Copy this pattern into any route file to get automatic tenant isolation.

RULE: Every query MUST filter by company_id.  No exception.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    require_feature,
    require_permissions,
    get_db,
)
from app.models.auth import User

router = APIRouter()


# ── Pattern 1: Basic tenant-scoped GET ───────────────────────────────────────

@router.get("/employees")
def list_employees(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.view")),
    _feature=Depends(require_feature("hr_module")),   # blocks if module disabled
):
    company_id = request.state.company_id  # always set by TenantMiddleware + get_current_user

    # ✅ CORRECT — always filter by company_id
    from app.models.hr import Employee
    employees = db.query(Employee).filter(Employee.company_id == company_id).all()
    return employees


# ── Pattern 2: Create with automatic company_id injection ────────────────────

@router.post("/employees")
def create_employee(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.create")),
    _feature=Depends(require_feature("hr_module")),
):
    company_id = request.state.company_id

    from app.models.hr import Employee
    emp = Employee(**payload, company_id=company_id)   # inject company_id
    db.add(emp)
    db.commit()
    return emp


# ── Pattern 3: Get single record — verify ownership ──────────────────────────

@router.get("/employees/{emp_id}")
def get_employee(
    emp_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.view")),
):
    company_id = request.state.company_id

    from app.models.hr import Employee
    emp = (
        db.query(Employee)
        .filter(
            Employee.id == emp_id,
            Employee.company_id == company_id,   # ← CRITICAL: ownership check
        )
        .first()
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


# ── Pattern 4: Super-admin cross-tenant access ───────────────────────────────

@router.get("/admin/all-employees")
def all_employees_across_tenants(
    target_company_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super-admin only")

    from app.models.hr import Employee
    query = db.query(Employee)
    if target_company_id:
        query = query.filter(Employee.company_id == target_company_id)
    return query.all()
