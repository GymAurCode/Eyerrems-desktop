"""Reusable Soft Delete, Restore, Business Number, and Recycle Bin services.

Every module must use these services instead of direct `db.delete()`.
"""

import logging
from datetime import datetime
from typing import Any, Optional, Type

from fastapi import HTTPException, Request, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.models.auth import User
from app.models.rbac import Role
from app.services.activity_service import AuditLogService

log = logging.getLogger("rems.soft_delete")

# ── Module registry ──────────────────────────────────────────────────────────

MODULE_REGISTRY: dict[str, dict[str, Any]] = {}


def register_module(
    module_key: str,
    module_label: str,
    model_class: Type,
    business_number_field: Optional[str] = None,
    business_number_prefix: Optional[str] = None,
    name_field: str = "name",
    status_field: Optional[str] = None,
    id_field: str = "id",
    display_id_field: Optional[str] = None,
    use_year_prefix: bool = False,
    number_pad: int = 4,
):
    """Register a model for soft delete / recycle bin support.

    Args:
        module_key: Unique key like 'crm_leads', 'properties', etc.
        module_label: Human-readable label like 'CRM Leads'.
        model_class: The SQLAlchemy model class.
        business_number_field: Column name holding the sequential business number (e.g. 'lead_id').
        business_number_prefix: Prefix for generation (e.g. 'LD').
        name_field: Column used as the record display name.
        status_field: Column holding status (e.g. 'status').
        id_field: Primary key column name (default 'id').
        display_id_field: Column shown as ID in recycle bin (e.g. 'lead_id').
        use_year_prefix: Whether numbers use year prefix like INV-2026-000001.
        number_pad: Zero-padding width for the sequence number.
    """
    MODULE_REGISTRY[module_key] = {
        "module_label": module_label,
        "model_class": model_class,
        "business_number_field": business_number_field,
        "business_number_prefix": business_number_prefix,
        "name_field": name_field,
        "status_field": status_field,
        "id_field": id_field,
        "display_id_field": display_id_field or business_number_field,
        "use_year_prefix": use_year_prefix,
        "number_pad": number_pad,
    }
    log.info("Registered module '%s' (%s) for soft delete", module_key, module_label)


# ── Business Number Generator ────────────────────────────────────────────────

class BusinessNumberGenerator:
    """Reusable sequential business number generator.

    Supports two patterns:
    - Simple: '{PREFIX}-{SEQ:04d}'  (e.g. LD-0001)
    - Year-prefixed: '{PREFIX}-{YEAR}-{SEQ:06d}'  (e.g. INV-2026-000001)
    """

    @staticmethod
    def next_number(
        db: Session,
        model_class: Type,
        field: str,
        prefix: str,
        use_year_prefix: bool = False,
        pad: int = 4,
        year: Optional[int] = None,
    ) -> str:
        if use_year_prefix:
            y = year or datetime.utcnow().year
            like_pattern = f"{prefix}-{y}-%"
            last = (
                db.query(getattr(model_class, field))
                .filter(getattr(model_class, field).like(like_pattern))
                .order_by(getattr(model_class, field).desc())
                .first()
            )
            if last and last[0]:
                parts = last[0].split("-")
                seq = int(parts[-1]) + 1
            else:
                seq = 1
            return f"{prefix}-{y}-{seq:0{pad}d}"
        else:
            like_pattern = f"{prefix}-%"
            last = (
                db.query(getattr(model_class, field))
                .filter(getattr(model_class, field).like(like_pattern))
                .order_by(getattr(model_class, field).desc())
                .first()
            )
            if last and last[0]:
                parts = last[0].split("-")
                seq = int(parts[-1]) + 1
            else:
                seq = 1
            return f"{prefix}-{seq:0{pad}d}"

    @staticmethod
    def number_exists(
        db: Session,
        model_class: Type,
        field: str,
        number: str,
        exclude_id: Optional[int] = None,
    ) -> bool:
        query = db.query(model_class).filter(getattr(model_class, field) == number)
        if exclude_id is not None:
            query = query.filter(getattr(model_class, "id") != exclude_id)
        return query.first() is not None


# ── Soft Delete Service ──────────────────────────────────────────────────────

class SoftDeleteService:
    """Marks a record as deleted (soft delete) instead of removing it."""

    @staticmethod
    def soft_delete(
        db: Session,
        model_instance: Any,
        user: User,
        module_key: str,
        reason: Optional[str] = None,
        request: Optional[Request] = None,
    ) -> dict:
        """Mark a record as soft-deleted.

        Returns a dict with the deleted record info for recycling.
        """
        now = datetime.utcnow()
        model_instance.is_deleted = True
        model_instance.deleted_at = now
        model_instance.deleted_by = user.id
        db.flush()

        registry = MODULE_REGISTRY.get(module_key)
        name_field = registry["name_field"] if registry else "name"
        display_id_field = registry["display_id_field"] if registry else None
        status_field = registry["status_field"] if registry else None

        record_name = str(getattr(model_instance, name_field, ""))
        original_id = str(getattr(model_instance, display_id_field, "")) if display_id_field else str(getattr(model_instance, "id", ""))
        status = str(getattr(model_instance, status_field, "")) if status_field else ""

        old_data = {
            k: str(v) for k, v in model_instance.__dict__.items()
            if not k.startswith("_")
        }

        AuditLogService.log_delete(
            db=db,
            actor=user,
            module=module_key,
            entity_type=module_key,
            entity_id=model_instance.id,
            entity_name=record_name,
            old_data=old_data,
            request=request,
        )

        log.info(
            "Soft deleted %s id=%s name=%s by user=%s",
            module_key, model_instance.id, record_name, user.id,
        )

        return {
            "module": module_key,
            "module_label": registry["module_label"] if registry else module_key,
            "record_id": model_instance.id,
            "original_id": original_id,
            "record_name": record_name,
            "status": status,
            "deleted_by_id": user.id,
            "deleted_by_name": getattr(user, "full_name", user.email),
            "deleted_at": now.isoformat(),
            "reason": reason,
            "created_at": str(getattr(model_instance, "created_at", "")),
        }

    @staticmethod
    def apply_soft_delete_filter(query, model_class):
        """Apply is_deleted=False filter to any query."""
        if hasattr(model_class, "is_deleted"):
            return query.filter(model_class.is_deleted == False)  # noqa: E712
        return query

    @staticmethod
    def get_active_query(db: Session, model_class: Type):
        """Get a base query that excludes soft-deleted records."""
        query = db.query(model_class)
        return SoftDeleteService.apply_soft_delete_filter(query, model_class)


# ── Restore Service ──────────────────────────────────────────────────────────

class RestoreService:
    """Restores a soft-deleted record, handling business number conflicts."""

    @staticmethod
    def restore(
        db: Session,
        model_instance: Any,
        user: User,
        module_key: str,
        request: Optional[Request] = None,
    ) -> dict:
        """Restore a soft-deleted record.

        If the original business number is already taken, a new one is
        generated automatically.

        Returns a dict describing the restore outcome.
        """
        registry = MODULE_REGISTRY.get(module_key)
        now = datetime.utcnow()

        old_number = None
        new_number = None
        renumber_reason = None

        bnf = registry["business_number_field"] if registry else None
        bnp = registry["business_number_prefix"] if registry else None
        uyp = registry.get("use_year_prefix", False) if registry else False
        npad = registry.get("number_pad", 4) if registry else 4

        if bnf and bnp:
            old_number = str(getattr(model_instance, bnf, "") or "")

            if old_number and BusinessNumberGenerator.number_exists(
                db, registry["model_class"], bnf, old_number, exclude_id=model_instance.id
            ):
                new_number = BusinessNumberGenerator.next_number(
                    db, registry["model_class"], bnf, bnp,
                    use_year_prefix=uyp, pad=npad,
                )
                setattr(model_instance, bnf, new_number)
                setattr(model_instance, "original_business_number", old_number)
                renumber_reason = (
                    f"Original number {old_number} already in use. "
                    f"Assigned new number {new_number}."
                )

        model_instance.is_deleted = False
        model_instance.deleted_at = None
        model_instance.deleted_by = None
        model_instance.restored_at = now
        model_instance.restored_by = user.id

        restore_count = getattr(model_instance, "restore_count", 0) or 0
        model_instance.restore_count = restore_count + 1

        db.flush()

        name_field = registry["name_field"] if registry else "name"
        record_name = str(getattr(model_instance, name_field, ""))

        extra_data = {
            "restored_by": user.email,
            "restore_time": now.isoformat(),
        }
        if old_number:
            extra_data["old_number"] = old_number
        if new_number:
            extra_data["new_number"] = new_number
        if renumber_reason:
            extra_data["renumber_reason"] = renumber_reason

        AuditLogService.log(
            db=db,
            actor=user,
            action="RESTORE",
            module=module_key,
            entity_type=module_key,
            entity_id=model_instance.id,
            entity_name=record_name,
            new_data=extra_data,
            request=request,
        )

        log.info(
            "Restored %s id=%s name=%s by user=%s%s",
            module_key, model_instance.id, record_name, user.id,
            f" (renumbered: {old_number} -> {new_number})" if new_number else "",
        )

        return {
            "success": True,
            "old_number": old_number,
            "new_number": new_number,
            "renumber_reason": renumber_reason,
            "record_name": record_name,
        }


# ── Recycle Bin Service ──────────────────────────────────────────────────────

class RecycleBinService:
    """Service for querying the recycle bin across all registered modules."""

    @staticmethod
    def get_deleted_records(
        db: Session,
        module_filter: Optional[str] = None,
        search: Optional[str] = None,
        deleted_by: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        restore_status: Optional[str] = None,
        company_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        """Aggregate deleted records from all registered modules."""
        results = []

        for module_key, reg in MODULE_REGISTRY.items():
            if module_filter and module_filter != module_key:
                continue

            model_class = reg["model_class"]
            if not hasattr(model_class, "is_deleted"):
                continue

            try:
                query = db.query(model_class).filter(
                    getattr(model_class, "is_deleted") == True  # noqa: E712
                )

                if search:
                    name_field = reg["name_field"]
                    like_pattern = f"%{search}%"
                    query = query.filter(
                        getattr(model_class, name_field).ilike(like_pattern)
                    )

                if date_from:
                    try:
                        dt = datetime.fromisoformat(date_from)
                        query = query.filter(model_class.deleted_at >= dt)
                    except ValueError:
                        pass

                if date_to:
                    try:
                        dt = datetime.fromisoformat(date_to)
                        query = query.filter(model_class.deleted_at <= dt)
                    except ValueError:
                        pass

                if restore_status == "restored":
                    query = query.filter(model_class.restored_at.isnot(None))
                elif restore_status == "deleted":
                    query = query.filter(model_class.restored_at.is_(None))
                elif restore_status == "permanent":
                    pass

                query = query.order_by(model_class.deleted_at.desc())

                records = query.limit(limit).offset(offset).all()

                for rec in records:
                    name_field = reg["name_field"]
                    display_id_field = reg["display_id_field"] or reg["business_number_field"]
                    status_field = reg["status_field"]

                    entry = {
                        "module": module_key,
                        "module_label": reg["module_label"],
                        "record_id": getattr(rec, "id", None),
                        "original_id": str(getattr(rec, display_id_field, "")) if display_id_field else str(getattr(rec, "id", "")),
                        "record_name": str(getattr(rec, name_field, "")),
                        "status": str(getattr(rec, status_field, "")) if status_field else "",
                        "deleted_by": getattr(rec, "deleted_by", None),
                        "deleted_at": getattr(rec, "deleted_at", None),
                        "restored_at": getattr(rec, "restored_at", None),
                        "restored_by": getattr(rec, "restored_by", None),
                        "original_business_number": getattr(rec, "original_business_number", None),
                        "restore_count": getattr(rec, "restore_count", 0),
                        "created_at": getattr(rec, "created_at", None),
                    }
                    results.append(entry)
            except Exception as exc:
                log.warning("RecycleBin query failed for module '%s': %s", module_key, exc)
                continue

        # Batch resolve user info for all deleted_by / restored_by IDs
        user_ids = set()
        for entry in results:
            if entry.get("deleted_by"):
                user_ids.add(entry["deleted_by"])
            if entry.get("restored_by"):
                user_ids.add(entry["restored_by"])
        user_map = {}
        if user_ids:
            users = (
                db.query(User)
                .options(
                    joinedload(User.company),
                )
                .filter(User.id.in_(user_ids))
                .all()
            )
            role_ids = [u.role_id for u in users if u.role_id]
            roles = {}
            if role_ids:
                for r in db.query(Role).filter(Role.id.in_(role_ids)).all():
                    roles[r.id] = r.name
            for u in users:
                user_map[u.id] = {
                    "id": u.id,
                    "full_name": u.full_name,
                    "email": u.email,
                    "role_name": roles.get(u.role_id, ""),
                    "avatar": getattr(u, "avatar", None) or "",
                }
        for entry in results:
            uid = entry.get("deleted_by")
            entry["deleted_by_user"] = user_map.get(uid) if uid else None
            rid = entry.get("restored_by")
            entry["restored_by_user"] = user_map.get(rid) if rid else None

        return results

    @staticmethod
    def get_statistics(db: Session, company_id: Optional[int] = None) -> dict:
        """Return aggregate statistics for the recycle bin."""
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start
        while week_start.weekday() != 0:
            week_start = week_start.replace(day=week_start.day - 1)
        month_start = today_start.replace(day=1)

        stats = {
            "deleted_today": 0,
            "deleted_this_week": 0,
            "deleted_this_month": 0,
            "total_deleted": 0,
            "recently_restored": 0,
        }

        for module_key, reg in MODULE_REGISTRY.items():
            model_class = reg["model_class"]
            if not hasattr(model_class, "is_deleted"):
                continue

            try:
                deleted_count = (
                    db.query(func.count(model_class.id))
                    .filter(model_class.is_deleted == True)  # noqa: E712
                    .scalar() or 0
                )
                stats["total_deleted"] += deleted_count

                today_count = (
                    db.query(func.count(model_class.id))
                    .filter(
                        model_class.is_deleted == True,  # noqa: E712
                        model_class.deleted_at >= today_start,
                    )
                    .scalar() or 0
                )
                stats["deleted_today"] += today_count

                week_count = (
                    db.query(func.count(model_class.id))
                    .filter(
                        model_class.is_deleted == True,  # noqa: E712
                        model_class.deleted_at >= week_start,
                    )
                    .scalar() or 0
                )
                stats["deleted_this_week"] += week_count

                month_count = (
                    db.query(func.count(model_class.id))
                    .filter(
                        model_class.is_deleted == True,  # noqa: E712
                        model_class.deleted_at >= month_start,
                    )
                    .scalar() or 0
                )
                stats["deleted_this_month"] += month_count

                restored_count = (
                    db.query(func.count(model_class.id))
                    .filter(
                        model_class.restored_at.isnot(None),
                        model_class.restored_at >= today_start,
                    )
                    .scalar() or 0
                )
                stats["recently_restored"] += restored_count

            except Exception as exc:
                log.warning("Stats query failed for module '%s': %s", module_key, exc)
                continue

        return stats


# ── Module registration setup ────────────────────────────────────────────────

def register_all_modules():
    """Call this during app startup to register all models for soft delete."""
    from app.models.crm import Lead, Client, Dealer, Deal, FollowUp, SiteVisit
    from app.models.property import Property, Floor, Unit, Lease, Contact, Buyer, Seller, PropertySale
    from app.models.tenant import Tenant, Maintenance
    from app.models.finance import Invoice, Payment, Expense, Vendor, Journal
    from app.models.construction import (
        ConstructionProject, ProjectPhase, ConstructionTask,
        Contractor, Procurement, DailyProgress, ConstructionExpense,
        QualityInspection, SafetyIncident, ConstructionDocument,
    )
    from app.models.hr import Employee, Department, Position, Branch, ShiftTemplate, Holiday
    from app.models.booking import Booking
    from app.models.client_pipeline import Contract, Transfer, Handover, AfterSalesTicket
    from app.models.town import Town, Block, Plot, TownUnit
    from app.models.mail import EmailAccount
    from app.models.rbac import Role
    from app.models.auth import User

    register_module("crm_leads", "CRM Leads", Lead,
                    business_number_field="lead_id", business_number_prefix="LD",
                    name_field="name", status_field="status", display_id_field="lead_id")
    register_module("crm_clients", "CRM Clients", Client,
                    business_number_field="client_id", business_number_prefix="CLI",
                    name_field="name", status_field="status", display_id_field="client_id")
    register_module("crm_dealers", "CRM Dealers", Dealer,
                    business_number_field="dealer_id", business_number_prefix="DEA",
                    name_field="name", status_field=None, display_id_field="dealer_id")
    register_module("crm_deals", "CRM Deals", Deal,
                    business_number_field="deal_id", business_number_prefix="DEAL",
                    name_field="deal_title", status_field="status", display_id_field="deal_id")
    register_module("crm_followups", "CRM Follow-ups", FollowUp,
                    business_number_field="fu_id", business_number_prefix="FU",
                    name_field="id", status_field="fu_status", display_id_field="fu_id")
    register_module("crm_site_visits", "CRM Site Visits", SiteVisit,
                    business_number_field="visit_id", business_number_prefix="VIS",
                    name_field="id", status_field="sv_status", display_id_field="visit_id")
    register_module("properties", "Properties", Property,
                    business_number_field="tid", business_number_prefix="PRO",
                    name_field="name", status_field="status", display_id_field="tid")
    register_module("floors", "Floors", Floor,
                    business_number_field="tid", business_number_prefix="FLR",
                    name_field="id", status_field=None, display_id_field="tid")
    register_module("units", "Units", Unit,
                    business_number_field="tid", business_number_prefix="UNT",
                    name_field="unit_number", status_field="status", display_id_field="tid")
    register_module("leases", "Leases", Lease,
                    business_number_field="tid", business_number_prefix="LEA",
                    name_field="id", status_field="status", display_id_field="tid")
    register_module("contacts", "Contacts", Contact,
                    business_number_field="tid", business_number_prefix="CON",
                    name_field="name", status_field=None, display_id_field="tid")
    register_module("property_sales", "Property Sales", PropertySale,
                    business_number_field="tid", business_number_prefix="SAL",
                    name_field="id", status_field="status", display_id_field="tid")
    register_module("tenants", "Tenants", Tenant,
                    business_number_field=None, business_number_prefix=None,
                    name_field="name", status_field="status")
    register_module("maintenance", "Maintenance", Maintenance,
                    business_number_field=None, business_number_prefix=None,
                    name_field="description", status_field="status")
    register_module("finance_invoices", "Invoices", Invoice,
                    business_number_field="invoice_number", business_number_prefix="INV",
                    name_field="invoice_number", status_field="status", display_id_field="invoice_number",
                    use_year_prefix=True, number_pad=6)
    register_module("finance_payments", "Payments", Payment,
                    business_number_field="payment_number", business_number_prefix="PAY",
                    name_field="payment_number", status_field="status", display_id_field="payment_number",
                    use_year_prefix=True, number_pad=6)
    register_module("finance_expenses", "Expenses", Expense,
                    business_number_field="expense_number", business_number_prefix="EXP",
                    name_field="expense_number", status_field="approval_status", display_id_field="expense_number",
                    use_year_prefix=True, number_pad=6)
    register_module("finance_vendors", "Vendors", Vendor,
                    business_number_field="vendor_code", business_number_prefix="VEN",
                    name_field="vendor_name", status_field=None, display_id_field="vendor_code",
                    use_year_prefix=True, number_pad=6)
    register_module("finance_journals", "Journals", Journal,
                    business_number_field="journal_number", business_number_prefix="JE",
                    name_field="journal_number", status_field="status", display_id_field="journal_number",
                    use_year_prefix=True, number_pad=6)
    register_module("construction_projects", "Construction Projects", ConstructionProject,
                    business_number_field="project_code", business_number_prefix="PRJ",
                    name_field="name", status_field="status", display_id_field="project_code")
    register_module("construction_phases", "Construction Phases", ProjectPhase,
                    business_number_field=None, business_number_prefix=None,
                    name_field="name", status_field="status")
    register_module("construction_tasks", "Construction Tasks", ConstructionTask,
                    business_number_field="task_number", business_number_prefix="TSK",
                    name_field="name", status_field="status")
    register_module("construction_contractors", "Construction Contractors", Contractor,
                    business_number_field=None, business_number_prefix=None,
                    name_field="name", status_field=None)
    register_module("construction_procurement", "Construction Procurement", Procurement,
                    business_number_field=None, business_number_prefix=None,
                    name_field="item_name", status_field="status")
    register_module("construction_daily_progress", "Daily Progress", DailyProgress,
                    business_number_field=None, business_number_prefix=None,
                    name_field="id", status_field=None)
    register_module("construction_expenses", "Construction Expenses", ConstructionExpense,
                    business_number_field=None, business_number_prefix=None,
                    name_field="description", status_field="expense_type")
    register_module("construction_inspections", "Quality Inspections", QualityInspection,
                    business_number_field=None, business_number_prefix=None,
                    name_field="inspection_type", status_field="status")
    register_module("construction_safety", "Safety Incidents", SafetyIncident,
                    business_number_field=None, business_number_prefix=None,
                    name_field="title", status_field="status")
    register_module("construction_documents", "Construction Documents", ConstructionDocument,
                    business_number_field=None, business_number_prefix=None,
                    name_field="name", status_field=None)
    register_module("hr_employees", "HR Employees", Employee,
                    business_number_field=None, business_number_prefix=None,
                    name_field="full_name", status_field="employment_status")
    register_module("hr_departments", "HR Departments", Department,
                    business_number_field=None, business_number_prefix=None,
                    name_field="name", status_field=None)
    register_module("hr_shift_templates", "HR Shift Templates", ShiftTemplate,
                    business_number_field=None, business_number_prefix=None,
                    name_field="shift_name", status_field=None)
    register_module("hr_holidays", "HR Holidays", Holiday,
                    business_number_field=None, business_number_prefix=None,
                    name_field="name", status_field=None)
    register_module("bookings", "Bookings", Booking,
                    business_number_field="booking_id", business_number_prefix="BKG",
                    name_field="id", status_field="status", display_id_field="booking_id")
    register_module("contracts", "Contracts", Contract,
                    business_number_field="contract_id", business_number_prefix="CTR",
                    name_field="id", status_field="status", display_id_field="contract_id")
    register_module("transfers", "Transfers", Transfer,
                    business_number_field="transfer_id", business_number_prefix="TRF",
                    name_field="id", status_field="status", display_id_field="transfer_id")
    register_module("handovers", "Handovers", Handover,
                    business_number_field="handover_id", business_number_prefix="HND",
                    name_field="id", status_field="status", display_id_field="handover_id")
    register_module("tickets", "AfterSales Tickets", AfterSalesTicket,
                    business_number_field="ticket_id", business_number_prefix="AST",
                    name_field="id", status_field="status", display_id_field="ticket_id")
    register_module("towns", "Towns", Town,
                    business_number_field="tid", business_number_prefix="TWN",
                    name_field="name", status_field="status", display_id_field="tid")
    register_module("blocks", "Blocks", Block,
                    business_number_field="tid", business_number_prefix="BLK",
                    name_field="name", status_field="status", display_id_field="tid")
    register_module("plots", "Plots", Plot,
                    business_number_field="tid", business_number_prefix="PLT",
                    name_field="id", status_field="status", display_id_field="tid")
    register_module("town_units", "Town Units", TownUnit,
                    business_number_field=None, business_number_prefix=None,
                    name_field="unit_number", status_field="status")
    register_module("email_accounts", "Email Accounts", EmailAccount,
                    business_number_field=None, business_number_prefix=None,
                    name_field="email", status_field="status")
    register_module("roles", "Roles", Role,
                    business_number_field=None, business_number_prefix=None,
                    name_field="name", status_field=None)
    register_module("users", "Users", User,
                    business_number_field=None, business_number_prefix=None,
                    name_field="full_name", status_field="status")

    log.info("All %d modules registered for soft delete / recycle bin", len(MODULE_REGISTRY))