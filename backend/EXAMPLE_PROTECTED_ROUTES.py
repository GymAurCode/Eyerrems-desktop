"""
Example: How to protect existing routes with RBAC permissions

This file shows before/after examples of adding permission checks to routes.
"""

# ============================================================================
# BEFORE - Using role-based access (old way)
# ============================================================================

from app.api.deps import require_roles

@router.get("/employees")
def list_employees_OLD(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager", "Staff")),  # ❌ Too broad
):
    return db.query(Employee).all()


@router.post("/employees")
def create_employee_OLD(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Manager")),  # ❌ Role-based
):
    employee = Employee(**payload.dict())
    db.add(employee)
    db.commit()
    return employee


# ============================================================================
# AFTER - Using permission-based access (new way)
# ============================================================================

from fastapi import Request
from app.api.deps import require_permissions, get_current_user
from app.core.audit import log_create, log_update, log_delete

@router.get("/employees", response_model=List[EmployeeResponse])
def list_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.view"))  # ✅ Specific permission
):
    """List all employees - requires hr.view permission"""
    return db.query(Employee).all()


@router.post("/employees", response_model=EmployeeResponse, status_code=201)
def create_employee(
    payload: EmployeeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.create"))  # ✅ Specific permission
):
    """Create new employee - requires hr.create permission"""
    employee = Employee(**payload.dict())
    db.add(employee)
    db.flush()
    
    # ✅ Add audit logging
    log_create(
        db,
        user_id=current_user.id,
        entity_type="employee",
        entity_id=employee.id,
        module="HR",
        description=f"Created employee {employee.full_name}",
        details={
            "employee_id": employee.id,
            "name": employee.full_name,
            "department": employee.department_id
        },
        request=request
    )
    
    db.commit()
    db.refresh(employee)
    return employee


@router.get("/employees/{employee_id}", response_model=EmployeeDetail)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.view"))
):
    """Get employee details - requires hr.view permission"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.update"))  # ✅ Update permission
):
    """Update employee - requires hr.update permission"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Track changes for audit
    changes = {}
    for field, value in payload.dict(exclude_unset=True).items():
        old_value = getattr(employee, field)
        if old_value != value:
            changes[field] = {"old": old_value, "new": value}
            setattr(employee, field, value)
    
    # ✅ Add audit logging
    log_update(
        db,
        user_id=current_user.id,
        entity_type="employee",
        entity_id=employee.id,
        module="HR",
        description=f"Updated employee {employee.full_name}",
        details={"changes": changes},
        request=request
    )
    
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/employees/{employee_id}", status_code=204)
def delete_employee(
    employee_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.delete"))  # ✅ Delete permission
):
    """Delete employee - requires hr.delete permission"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee_name = employee.full_name
    
    # ✅ Add audit logging BEFORE deletion
    log_delete(
        db,
        user_id=current_user.id,
        entity_type="employee",
        entity_id=employee.id,
        module="HR",
        description=f"Deleted employee {employee_name}",
        details={"name": employee_name, "department_id": employee.department_id},
        request=request
    )
    
    db.delete(employee)
    db.commit()


# ============================================================================
# ADVANCED EXAMPLES
# ============================================================================

@router.post("/employees/{employee_id}/terminate")
def terminate_employee(
    employee_id: int,
    payload: TerminationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.manage", "hr.update"))  # ✅ Multiple permissions
):
    """
    Terminate employee - requires BOTH hr.manage AND hr.update permissions
    This is a sensitive action that needs elevated permissions
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee.status = "terminated"
    employee.termination_date = payload.termination_date
    employee.termination_reason = payload.reason
    
    # ✅ Log sensitive action
    log_user_action(
        db,
        user_id=current_user.id,
        action="TERMINATE",
        module="HR",
        entity_type="employee",
        entity_id=employee.id,
        description=f"Terminated employee {employee.full_name}",
        details={
            "reason": payload.reason,
            "termination_date": str(payload.termination_date)
        },
        request=request
    )
    
    db.commit()
    return {"message": "Employee terminated"}


@router.get("/employees/{employee_id}/salary")
def get_employee_salary(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # ✅ Manual check
):
    """
    Get employee salary - requires hr.view OR being the employee themselves
    This shows manual permission checking for complex logic
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if user has permission OR is viewing their own salary
    if not current_user.has_permission("hr.view") and employee.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own salary or need hr.view permission"
        )
    
    return {
        "employee_id": employee.id,
        "salary": employee.salary,
        "currency": "USD"
    }


from app.api.deps import require_any_permission

@router.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("hr.view", "finance.view", "crm.view"))  # ✅ OR logic
):
    """
    Get dashboard statistics - requires ANY of: hr.view, finance.view, or crm.view
    User needs access to at least one module
    """
    stats = {}
    
    # Only include stats for modules user has access to
    if current_user.has_permission("hr.view"):
        stats["employees"] = db.query(Employee).count()
    
    if current_user.has_permission("finance.view"):
        stats["revenue"] = db.query(Invoice).filter(Invoice.status == "paid").count()
    
    if current_user.has_permission("crm.view"):
        stats["leads"] = db.query(Lead).count()
    
    return stats


@router.post("/payroll/{payroll_id}/approve")
def approve_payroll(
    payroll_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("hr.manage", "finance.approve"))  # ✅ Cross-module
):
    """
    Approve payroll - requires BOTH hr.manage AND finance.approve
    This is a cross-module action requiring permissions from both HR and Finance
    """
    payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    if payroll.status == "approved":
        raise HTTPException(status_code=400, detail="Payroll already approved")
    
    payroll.status = "approved"
    payroll.approved_by = current_user.id
    payroll.approved_at = datetime.utcnow()
    
    # ✅ Log approval
    log_user_action(
        db,
        user_id=current_user.id,
        action="APPROVE",
        module="HR",
        entity_type="payroll",
        entity_id=payroll.id,
        description=f"Approved payroll for period {payroll.period}",
        details={"period": payroll.period, "amount": float(payroll.total_amount)},
        request=request
    )
    
    db.commit()
    return {"message": "Payroll approved"}


# ============================================================================
# MIGRATION GUIDE FOR EXISTING ROUTES
# ============================================================================

"""
Step-by-step guide to update existing routes:

1. Replace require_roles() with require_permissions()
   BEFORE: _: User = Depends(require_roles("Admin", "Manager"))
   AFTER:  current_user: User = Depends(require_permissions("hr.create"))

2. Add Request parameter for audit logging
   BEFORE: def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db))
   AFTER:  def create_employee(payload: EmployeeCreate, request: Request, db: Session = Depends(get_db))

3. Add audit logging for CREATE operations
   log_create(db, current_user.id, "employee", employee.id, "HR", "Created employee", request=request)

4. Add audit logging for UPDATE operations
   log_update(db, current_user.id, "employee", employee.id, "HR", "Updated employee", request=request)

5. Add audit logging for DELETE operations
   log_delete(db, current_user.id, "employee", employee.id, "HR", "Deleted employee", request=request)

6. For sensitive operations, use multiple permissions
   Depends(require_permissions("hr.manage", "hr.delete"))

7. For OR logic, use require_any_permission
   Depends(require_any_permission("hr.view", "finance.view"))

8. For complex logic, use manual checks
   if not current_user.has_permission("hr.view"):
       raise HTTPException(403, "Permission denied")

9. Test the route with different user roles
   - Test with user who has permission (should work)
   - Test with user who lacks permission (should get 403)
   - Test with unauthenticated user (should get 401)

10. Update API documentation
    Add permission requirements to docstrings
"""
