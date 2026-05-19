"""Tenant Management Routes.

IMPORTANT: All static paths (/alerts, /payments, /maintenance/*, /dashboard, /wizard)
MUST be registered before dynamic /{tenant_id} routes to avoid FastAPI matching
string slugs as integer path params.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.core.table_query import apply_table_filters

from app.api.deps import get_current_user, require_roles
from app.core.audit import log_create, log_update, log_delete
from app.core.database import get_db
from app.core.journal_service import JournalService, JournalEntryData
from app.core.tid import next_tid
from app.models.auth import User
from app.models.finance import Account
from app.models.hr import Employee
from app.models.ledger import PropertyLedgerEntry
from app.models.property import Property, Unit
from app.models.tenant import (
    Maintenance, MaintenanceActivityLog, RentIncrease, RentRecord,
    Tenant, TenantLease, TenantPayment,
)
from app.schemas.tenant import (
    LeaseOut, MaintenanceActivityLogOut, MaintenanceAnalytics,
    MaintenanceCreate, MaintenanceOut, MaintenanceUpdate,
    PaymentCreate, PaymentOut,
    RentIncreaseCreate, RentIncreaseOut, RentRecordOut,
    TenantAlert, TenantDashboardOut, TenantDetailOut, TenantOut,
    TenantUpdate, TenantWizardCreate,
)

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _generate_rent_records(db: Session, lease: TenantLease) -> None:
    cycle_months = {"monthly": 1, "quarterly": 3, "yearly": 12}
    step = cycle_months.get(lease.rent_cycle, 1)
    periods = 12 // step
    current = lease.lease_start.replace(day=lease.due_day)
    if current < lease.lease_start:
        m = current.month + step
        y = current.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        current = current.replace(year=y, month=m)
    for _ in range(periods):
        if lease.lease_end and current > lease.lease_end:
            break
        exists = db.query(RentRecord).filter(
            RentRecord.lease_id == lease.id,
            RentRecord.due_date == current,
        ).first()
        if not exists:
            db.add(RentRecord(
                tenant_id=lease.tenant_id,
                lease_id=lease.id,
                amount_due=lease.rent_amount,
                amount_paid=Decimal("0"),
                due_date=current,
                status="pending",
            ))
        m = current.month + step
        y = current.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        try:
            current = current.replace(year=y, month=m)
        except ValueError:
            break


def _update_overdue(db: Session, tenant_id: int) -> None:
    today = date.today()
    db.query(RentRecord).filter(
        RentRecord.tenant_id == tenant_id,
        RentRecord.due_date < today,
        RentRecord.status == "pending",
    ).update({"status": "overdue"})
    db.flush()


def _build_detail(db: Session, tenant: Tenant) -> TenantDetailOut:
    _update_overdue(db, tenant.id)
    db.refresh(tenant)
    leases = db.query(TenantLease).options(
        joinedload(TenantLease.property_rel),
        joinedload(TenantLease.unit_rel),
    ).filter(TenantLease.tenant_id == tenant.id).all()
    rent_records = db.query(RentRecord).filter(
        RentRecord.tenant_id == tenant.id
    ).order_by(RentRecord.due_date.desc()).all()
    payments = db.query(TenantPayment).filter(
        TenantPayment.tenant_id == tenant.id
    ).order_by(TenantPayment.payment_date.desc()).all()
    total_paid    = sum(p.amount for p in payments)
    total_pending = sum(r.amount_due - r.amount_paid for r in rent_records if r.status == "pending")
    total_overdue = sum(r.amount_due - r.amount_paid for r in rent_records if r.status == "overdue")
    lease_outs = [LeaseOut.model_validate(l).model_dump() | {
        "property_name": l.property_rel.name if l.property_rel else None,
        "unit_number": l.unit_rel.unit_number if l.unit_rel else None,
    } for l in leases]
    return TenantDetailOut(
        **TenantOut.model_validate(tenant).model_dump(),
        leases=[LeaseOut(**lo) for lo in lease_outs],
        rent_records=[RentRecordOut.model_validate(r) for r in rent_records],
        payments=[PaymentOut.model_validate(p) for p in payments],
        total_paid=total_paid,
        total_pending=total_pending,
        total_overdue=total_overdue,
    )


def _post_finance_income(db: Session, amount: Decimal, description: str, tenant: "Tenant") -> None:
    """Post rent income: Debit Cash (1100), Credit Rent Income (4100)"""
    cash_account = db.query(Account).filter(Account.code == "1010").first()
    income_account = db.query(Account).filter(Account.code == "4100").first()
    if not cash_account or not income_account:
        return  # Accounts not seeded yet — skip journal posting silently
    JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=cash_account.id, debit=amount, description=description),
            JournalEntryData(account_id=income_account.id, credit=amount, description=description),
        ],
        reference_type="tenant_payment",
        reference_id=tenant.tenant_id,
        description=description,
    )


def _post_finance_expense(db: Session, amount: Decimal, description: str, property_id: int) -> None:
    """Post maintenance expense: Debit Maintenance Expense (5010), Credit Cash (1100)"""
    expense_account = db.query(Account).filter(Account.code == "5010").first()
    cash_account = db.query(Account).filter(Account.code == "1010").first()
    if not expense_account or not cash_account:
        return  # Accounts not seeded yet — skip journal posting silently
    JournalService.create_journal_entry(
        db=db,
        entries=[
            JournalEntryData(account_id=expense_account.id, debit=amount, description=description),
            JournalEntryData(account_id=cash_account.id, credit=amount, description=description),
        ],
        reference_type="maintenance",
        reference_id=f"PROP-{property_id}",
        description=description,
    )


def _post_property_ledger(db: Session, record: "Maintenance", amount: Decimal, user_id: int) -> None:
    """Create a PropertyLedgerEntry for a completed maintenance expense."""
    from app.core.tid import next_tid as _next_tid
    # Recalculate running balance
    last = (
        db.query(PropertyLedgerEntry)
        .filter(PropertyLedgerEntry.property_id == record.property_id)
        .order_by(PropertyLedgerEntry.entry_date.desc(), PropertyLedgerEntry.id.desc())
        .first()
    )
    prev_balance = Decimal(str(last.running_balance)) if last else Decimal("0")
    new_balance  = prev_balance + amount   # maintenance is a debit (cost)

    entry = PropertyLedgerEntry(
        tid             = _next_tid(db, PropertyLedgerEntry, "PLE"),
        property_id     = record.property_id,
        entry_date      = datetime.combine(record.completed_date or record.date, datetime.min.time()),
        description     = f"Maintenance ({record.category}): {record.description[:120]}",
        reference_no    = f"MAINT-{record.id}",
        entry_type      = "maintenance",
        debit           = amount,
        credit          = Decimal("0"),
        running_balance = new_balance,
        status          = "posted",
        notes           = record.notes,
        created_by_user_id = user_id,
        created_at      = datetime.utcnow(),
    )
    db.add(entry)
    db.flush()


def _build_maintenance_out(m: "Maintenance", include_logs: bool = False) -> MaintenanceOut:
    """Build a MaintenanceOut response from a Maintenance ORM object."""
    logs: list[MaintenanceActivityLogOut] = []
    if include_logs and m.activity_logs:
        for log in m.activity_logs:
            logs.append(MaintenanceActivityLogOut(
                id         = log.id,
                user_id    = log.user_id,
                action     = log.action,
                old_status = log.old_status,
                new_status = log.new_status,
                note       = log.note,
                created_at = log.created_at,
                user_name  = log.user.full_name if log.user else None,
            ))

    return MaintenanceOut(
        id             = m.id,
        property_id    = m.property_id,
        unit_id        = m.unit_id,
        tenant_id      = m.tenant_id,
        title          = m.title,
        description    = m.description,
        category       = m.category or m.mtype,
        mtype          = m.mtype,
        priority       = m.priority or "normal",
        status         = m.status or "pending",
        estimated_cost = m.estimated_cost,
        actual_cost    = m.actual_cost,
        cost           = m.cost or Decimal("0"),
        date           = m.date,
        completed_date = m.completed_date,
        assigned_to    = m.assigned_to,
        vendor_name    = m.vendor_name,
        vendor_phone   = m.vendor_phone,
        notes          = m.notes,
        expense_posted = m.expense_posted or False,
        ledger_posted  = m.ledger_posted  or False,
        created_by     = m.created_by,
        created_at     = m.created_at,
        updated_at     = m.updated_at,
        property_name  = m.property_rel.name if m.property_rel else None,
        unit_number    = m.unit_rel.unit_number if m.unit_rel else None,
        tenant_name    = m.tenant_rel.name   if m.tenant_rel   else None,
        assigned_name  = m.assigned_emp.first_name + " " + m.assigned_emp.last_name
                         if m.assigned_emp else None,
        activity_logs  = logs,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# STATIC ROUTES — must all come before /{tenant_id}
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=list[TenantOut])
def list_tenants(
    response: Response,
    db: Session = Depends(get_db),
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    filter: str | None = None,
    startDate: date | None = None,
    endDate: date | None = None,
    status: str | None = None,
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    query = db.query(Tenant)
    if status:
        if status.lower() == "active":
            query = query.filter(Tenant.is_active == True)
        elif status.lower() == "ended":
            query = query.filter(Tenant.is_active == False)
    query, total = apply_table_filters(
        query=query,
        model=Tenant,
        limit=limit,
        offset=offset,
        search=search,
        search_fields=[Tenant.name, Tenant.phone, Tenant.email, Tenant.tenant_id, Tenant.cnic],
        date_filter=filter,
        date_field=Tenant.created_at,
        start_date=startDate,
        end_date=endDate,
    )
    response.headers["X-Total-Count"] = str(total)
    return query.order_by(Tenant.id.desc()).all()


@router.get("/dashboard", response_model=TenantDashboardOut)
def tenant_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    tenants  = db.query(Tenant).all()
    payments = db.query(TenantPayment).all()
    records  = db.query(RentRecord).all()
    maint    = db.query(Maintenance).all()
    total_paid    = sum(p.amount for p in payments)
    total_pending = sum(r.amount_due - r.amount_paid for r in records if r.status == "pending")
    total_overdue = sum(r.amount_due - r.amount_paid for r in records if r.status == "overdue")
    maint_cost    = sum(m.cost for m in maint)
    return TenantDashboardOut(
        total_tenants=len(tenants),
        active_tenants=sum(1 for t in tenants if t.is_active),
        total_rent_collected=total_paid,
        total_pending=total_pending,
        total_overdue=total_overdue,
        total_maintenance_cost=maint_cost,
        net_profit=total_paid - maint_cost,
    )


@router.post("/wizard", response_model=TenantDetailOut, status_code=status.HTTP_201_CREATED)
def create_tenant_wizard(
    payload: TenantWizardCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Staff")),
):
    prop = db.query(Property).filter(Property.id == payload.lease.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if payload.lease.unit_id:
        unit = db.query(Unit).filter(Unit.id == payload.lease.unit_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")
    tenant = Tenant(tenant_id=next_tid(db, Tenant, "TEN"), **payload.tenant.model_dump())
    db.add(tenant)
    db.flush()
    lease = TenantLease(tenant_id=tenant.id, **payload.lease.model_dump())
    db.add(lease)
    db.flush()
    _generate_rent_records(db, lease)
    db.commit()
    db.refresh(tenant)
    return _build_detail(db, tenant)


@router.get("/alerts", response_model=list[TenantAlert])
def get_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    today       = date.today()
    soon        = today + timedelta(days=7)
    expiry_warn = today + timedelta(days=30)
    alerts: list[TenantAlert] = []

    for r in db.query(RentRecord).filter(RentRecord.status == "overdue").all():
        t = db.query(Tenant).filter(Tenant.id == r.tenant_id).first()
        if t:
            alerts.append(TenantAlert(
                type="overdue", severity="high",
                tenant_id=t.id, tenant_name=t.name, tenant_ref=t.tenant_id,
                message=f"Rent overdue since {r.due_date} — PKR {r.amount_due - r.amount_paid:,.0f} outstanding",
                due_date=r.due_date,
            ))

    for r in db.query(RentRecord).filter(
        RentRecord.status == "pending",
        RentRecord.due_date >= today,
        RentRecord.due_date <= soon,
    ).all():
        t = db.query(Tenant).filter(Tenant.id == r.tenant_id).first()
        if t:
            alerts.append(TenantAlert(
                type="due_soon", severity="medium",
                tenant_id=t.id, tenant_name=t.name, tenant_ref=t.tenant_id,
                message=f"Rent due on {r.due_date} — PKR {r.amount_due:,.0f}",
                due_date=r.due_date,
            ))

    for l in db.query(TenantLease).filter(
        TenantLease.status == "active",
        TenantLease.lease_end.isnot(None),
        TenantLease.lease_end >= today,
        TenantLease.lease_end <= expiry_warn,
    ).all():
        t = db.query(Tenant).filter(Tenant.id == l.tenant_id).first()
        if t:
            alerts.append(TenantAlert(
                type="lease_expiry", severity="low",
                tenant_id=t.id, tenant_name=t.name, tenant_ref=t.tenant_id,
                message=f"Lease expires on {l.lease_end}",
                due_date=l.lease_end,
            ))

    alerts.sort(key=lambda a: {"high": 0, "medium": 1, "low": 2}.get(a.severity, 3))
    return alerts


@router.post("/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def record_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    tenant = db.query(Tenant).filter(Tenant.id == payload.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    payment = TenantPayment(**payload.model_dump())
    db.add(payment)
    db.flush()
    if payload.rent_record_id:
        record = db.query(RentRecord).filter(RentRecord.id == payload.rent_record_id).first()
        if record:
            record.amount_paid += payload.amount
            record.paid_date    = payload.payment_date
            record.status = "paid" if record.amount_due - record.amount_paid <= 0 else "partial"
    _post_finance_income(db, payload.amount,
                         f"Rent payment from {tenant.name} ({tenant.tenant_id})", tenant)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/maintenance/unit-tenant")
def get_unit_tenant(
    unit_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    """
    Given a unit_id, return the active tenant linked to that unit (if any).
    Used by the maintenance form to auto-detect the tenant when a unit is selected.
    """
    from app.models.property import Unit as UnitModel
    unit = db.query(UnitModel).filter(UnitModel.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    # Find the active lease for this unit
    lease = (
        db.query(TenantLease)
        .options(joinedload(TenantLease.tenant))
        .filter(
            TenantLease.unit_id == unit_id,
            TenantLease.status  == "active",
        )
        .order_by(TenantLease.created_at.desc())
        .first()
    )

    if not lease or not lease.tenant:
        return {
            "unit_id":     unit_id,
            "unit_number": unit.unit_number,
            "tenant":      None,
            "message":     "No active tenant linked to this unit",
        }

    t = lease.tenant
    return {
        "unit_id":     unit_id,
        "unit_number": unit.unit_number,
        "tenant": {
            "id":        t.id,
            "tenant_id": t.tenant_id,
            "name":      t.name,
            "phone":     t.phone,
            "email":     t.email,
            "lease_id":  lease.id,
            "lease_start": str(lease.lease_start),
            "lease_end":   str(lease.lease_end) if lease.lease_end else None,
            "rent_amount": str(lease.rent_amount),
        },
        "message": f"Tenant: {t.name}",
    }


@router.get("/maintenance/all", response_model=list[MaintenanceOut])
def list_maintenance(
    property_id: Optional[int] = Query(None),
    tenant_id:   Optional[int] = Query(None),
    status:      Optional[str] = Query(None),
    priority:    Optional[str] = Query(None),
    category:    Optional[str] = Query(None),
    date_from:   Optional[date] = Query(None),
    date_to:     Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    q = db.query(Maintenance).options(
        joinedload(Maintenance.property_rel),
        joinedload(Maintenance.unit_rel),
        joinedload(Maintenance.tenant_rel),
        joinedload(Maintenance.assigned_emp),
        joinedload(Maintenance.activity_logs),
    )
    if property_id: q = q.filter(Maintenance.property_id == property_id)
    if tenant_id:   q = q.filter(Maintenance.tenant_id   == tenant_id)
    if status:      q = q.filter(Maintenance.status       == status)
    if priority:    q = q.filter(Maintenance.priority     == priority)
    if category:    q = q.filter(Maintenance.category     == category)
    if date_from:   q = q.filter(Maintenance.date         >= date_from)
    if date_to:     q = q.filter(Maintenance.date         <= date_to)
    records = q.order_by(Maintenance.date.desc()).offset(skip).limit(limit).all()
    return [_build_maintenance_out(m) for m in records]


@router.get("/maintenance/analytics", response_model=MaintenanceAnalytics)
def maintenance_analytics(
    date_from: Optional[date] = Query(None),
    date_to:   Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant")),
):
    q = db.query(Maintenance)
    if date_from: q = q.filter(Maintenance.date >= date_from)
    if date_to:   q = q.filter(Maintenance.date <= date_to)
    records = q.all()

    total_cost = sum(float(m.actual_cost or m.cost or 0) for m in records)
    completed  = [m for m in records if m.status == "completed"]

    # By category
    cat_map: dict[str, dict] = {}
    for m in records:
        c = m.category or "other"
        if c not in cat_map:
            cat_map[c] = {"category": c, "count": 0, "total_cost": 0.0}
        cat_map[c]["count"] += 1
        cat_map[c]["total_cost"] += float(m.actual_cost or m.cost or 0)

    # By priority
    pri_map: dict[str, dict] = {}
    for m in records:
        p = m.priority or "normal"
        if p not in pri_map:
            pri_map[p] = {"priority": p, "count": 0}
        pri_map[p]["count"] += 1

    # By property (top 10)
    prop_map: dict[int, dict] = {}
    for m in records:
        pid = m.property_id
        if pid not in prop_map:
            prop_map[pid] = {
                "property_id": pid,
                "property_name": m.property_rel.name if m.property_rel else f"#{pid}",
                "count": 0, "total_cost": 0.0,
            }
        prop_map[pid]["count"] += 1
        prop_map[pid]["total_cost"] += float(m.actual_cost or m.cost or 0)

    # Monthly trend (last 12 months)
    from collections import defaultdict
    monthly: dict[str, dict] = defaultdict(lambda: {"month": "", "count": 0, "total_cost": 0.0})
    for m in records:
        key = m.date.strftime("%Y-%m")
        monthly[key]["month"] = key
        monthly[key]["count"] += 1
        monthly[key]["total_cost"] += float(m.actual_cost or m.cost or 0)

    return MaintenanceAnalytics(
        total_requests = len(records),
        pending        = sum(1 for m in records if m.status == "pending"),
        in_progress    = sum(1 for m in records if m.status == "in_progress"),
        completed      = len(completed),
        cancelled      = sum(1 for m in records if m.status == "cancelled"),
        total_cost     = Decimal(str(round(total_cost, 2))),
        avg_cost       = Decimal(str(round(total_cost / len(records), 2))) if records else Decimal("0"),
        by_category    = sorted(cat_map.values(), key=lambda x: x["count"], reverse=True),
        by_priority    = sorted(pri_map.values(), key=lambda x: x["count"], reverse=True),
        by_property    = sorted(prop_map.values(), key=lambda x: x["total_cost"], reverse=True)[:10],
        monthly_trend  = sorted(monthly.values(), key=lambda x: x["month"]),
    )


@router.get("/maintenance/{record_id}", response_model=MaintenanceOut)
def get_maintenance(
    record_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    m = db.query(Maintenance).options(
        joinedload(Maintenance.property_rel),
        joinedload(Maintenance.unit_rel),
        joinedload(Maintenance.tenant_rel),
        joinedload(Maintenance.assigned_emp),
        joinedload(Maintenance.activity_logs).joinedload(MaintenanceActivityLog.user),
    ).filter(Maintenance.id == record_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return _build_maintenance_out(m, include_logs=True)


@router.post("/maintenance", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED)
def create_maintenance(
    payload: MaintenanceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not any(r.name in ("Admin", "Staff") for r in current_user.roles):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    prop = db.query(Property).filter(Property.id == payload.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    data = payload.model_dump()
    # Sync category → mtype for backward compat
    data["mtype"] = data.get("category", "repair")
    # Sync cost field
    if data.get("estimated_cost") and not data.get("cost"):
        data["cost"] = data["estimated_cost"]

    record = Maintenance(
        **{k: v for k, v in data.items() if k != "status_note"},
        status="pending",
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.flush()

    # Activity log
    db.add(MaintenanceActivityLog(
        maintenance_id=record.id,
        user_id=current_user.id,
        action="CREATED",
        new_status="pending",
        note=f"Request created by {current_user.full_name}",
        created_at=datetime.utcnow(),
    ))

    log_create(db, user_id=current_user.id, entity_type="maintenance",
               entity_id=record.id, module="Maintenance",
               description=f"Maintenance request created: {payload.description[:80]}",
               request=request)

    db.commit()
    db.refresh(record)
    return _build_maintenance_out(record)


@router.patch("/maintenance/{record_id}", response_model=MaintenanceOut)
def update_maintenance(
    record_id: int,
    payload: MaintenanceUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not any(r.name in ("Admin", "Staff") for r in current_user.roles):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    record = db.query(Maintenance).options(
        joinedload(Maintenance.property_rel),
        joinedload(Maintenance.tenant_rel),
        joinedload(Maintenance.assigned_emp),
    ).filter(Maintenance.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    old_status = record.status
    update_data = payload.model_dump(exclude_none=True, exclude={"status_note"})

    for field, value in update_data.items():
        setattr(record, field, value)

    # Sync mtype with category
    if payload.category:
        record.mtype = payload.category

    record.updated_at = datetime.utcnow()

    # Status change → activity log + finance integration
    new_status = payload.status
    if new_status and new_status != old_status:
        db.add(MaintenanceActivityLog(
            maintenance_id=record.id,
            user_id=current_user.id,
            action=f"STATUS_CHANGED",
            old_status=old_status,
            new_status=new_status,
            note=payload.status_note or f"Status changed to {new_status} by {current_user.full_name}",
            created_at=datetime.utcnow(),
        ))

        # On completion: post expense + property ledger entry
        if new_status == "completed":
            if not record.completed_date:
                record.completed_date = date.today()
            final_cost = record.actual_cost or record.cost or Decimal("0")
            if final_cost > 0:
                # Post finance expense (if not already posted)
                if not record.expense_posted:
                    _post_finance_expense(
                        db, final_cost,
                        f"Maintenance ({record.category}): {record.description[:80]}",
                        record.property_id,
                    )
                    record.expense_posted = True

                # Post property ledger entry (if not already posted)
                if not record.ledger_posted:
                    _post_property_ledger(db, record, final_cost, current_user.id)
                    record.ledger_posted = True

    log_update(db, user_id=current_user.id, entity_type="maintenance",
               entity_id=record.id, module="Maintenance",
               description=f"Maintenance #{record_id} updated",
               request=request)

    db.commit()
    db.refresh(record)
    return _build_maintenance_out(record, include_logs=True)


@router.delete("/maintenance/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_maintenance(
    record_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not any(r.name == "Admin" for r in current_user.roles):
        raise HTTPException(status_code=403, detail="Admin role required")

    record = db.query(Maintenance).filter(Maintenance.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    log_delete(db, user_id=current_user.id, entity_type="maintenance",
               entity_id=record_id, module="Maintenance",
               description=f"Maintenance record #{record_id} deleted",
               request=request)

    db.delete(record)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# DYNAMIC ROUTES — /{tenant_id} and nested
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{tenant_id}", response_model=TenantDetailOut)
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _build_detail(db, tenant)


@router.patch("/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Staff")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(tenant, k, v)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin")),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    db.delete(tenant)
    db.commit()


@router.get("/{tenant_id}/leases", response_model=list[LeaseOut])
def get_leases(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    leases = db.query(TenantLease).options(
        joinedload(TenantLease.property_rel),
        joinedload(TenantLease.unit_rel),
    ).filter(TenantLease.tenant_id == tenant_id).all()
    result = []
    for l in leases:
        d = LeaseOut.model_validate(l).model_dump()
        d["property_name"] = l.property_rel.name if l.property_rel else None
        d["unit_number"]   = l.unit_rel.unit_number if l.unit_rel else None
        result.append(LeaseOut(**d))
    return result


@router.post("/{tenant_id}/leases/end", response_model=LeaseOut)
def end_lease(
    tenant_id: int,
    lease_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Staff")),
):
    lease = db.query(TenantLease).filter(
        TenantLease.id == lease_id,
        TenantLease.tenant_id == tenant_id,
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    lease.status    = "ended"
    lease.lease_end = date.today()
    db.commit()
    db.refresh(lease)
    d = LeaseOut.model_validate(lease).model_dump()
    d["property_name"] = lease.property_rel.name if lease.property_rel else None
    d["unit_number"]   = lease.unit_rel.unit_number if lease.unit_rel else None
    return LeaseOut(**d)


@router.get("/{tenant_id}/rent-records", response_model=list[RentRecordOut])
def get_rent_records(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    _update_overdue(db, tenant_id)
    db.commit()
    return db.query(RentRecord).filter(
        RentRecord.tenant_id == tenant_id
    ).order_by(RentRecord.due_date.desc()).all()


@router.get("/{tenant_id}/payments", response_model=list[PaymentOut])
def get_payments(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Accountant", "Staff")),
):
    return db.query(TenantPayment).filter(
        TenantPayment.tenant_id == tenant_id
    ).order_by(TenantPayment.payment_date.desc()).all()


@router.post("/{tenant_id}/leases/{lease_id}/increase", response_model=RentIncreaseOut)
def increase_rent(
    tenant_id: int,
    lease_id: int,
    payload: RentIncreaseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Staff")),
):
    lease = db.query(TenantLease).filter(
        TenantLease.id == lease_id,
        TenantLease.tenant_id == tenant_id,
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    increase = RentIncrease(
        lease_id=lease_id, old_amount=lease.rent_amount,
        new_amount=payload.new_amount, effective_from=payload.effective_from,
        notes=payload.notes,
    )
    db.add(increase)
    lease.rent_amount = payload.new_amount
    db.query(RentRecord).filter(
        RentRecord.lease_id == lease_id,
        RentRecord.due_date >= payload.effective_from,
        RentRecord.status.in_(["pending", "overdue"]),
    ).update({"amount_due": payload.new_amount})
    db.commit()
    db.refresh(increase)
    return increase


@router.post("/{tenant_id}/leases/{lease_id}/generate-records", status_code=status.HTTP_200_OK)
def generate_rent_records(
    tenant_id: int,
    lease_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("Admin", "Staff")),
):
    lease = db.query(TenantLease).filter(
        TenantLease.id == lease_id,
        TenantLease.tenant_id == tenant_id,
        TenantLease.status == "active",
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Active lease not found")
    _generate_rent_records(db, lease)
    db.commit()
    count = db.query(RentRecord).filter(RentRecord.lease_id == lease_id).count()
    return {"generated": True, "total_records": count}
