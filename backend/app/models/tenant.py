"""Tenant Management Models — Tenant, Lease, RentRecord, RentIncrease, TenantPayment, Maintenance."""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey,
    Integer, Numeric, String, Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id          = Column(Integer, primary_key=True)
    tenant_id   = Column(String(20), unique=True, nullable=False)   # TEN-0001
    name        = Column(String(120), nullable=False)
    phone       = Column(String(50), nullable=False)
    email       = Column(String(255), nullable=True)
    cnic        = Column(String(20), nullable=True)
    family_size = Column(Integer, nullable=True)
    notes       = Column(Text, nullable=True)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    leases      = relationship("TenantLease", back_populates="tenant", cascade="all, delete-orphan")
    payments    = relationship("TenantPayment", back_populates="tenant", cascade="all, delete-orphan")


class TenantLease(Base):
    __tablename__ = "tenant_leases"

    id                = Column(Integer, primary_key=True)
    tenant_id         = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    property_id       = Column(Integer, ForeignKey("properties.id"), nullable=False)
    unit_id           = Column(Integer, ForeignKey("units.id"), nullable=True)
    is_full_property  = Column(Boolean, nullable=False, default=False)
    rent_amount       = Column(Numeric(12, 2), nullable=False)
    security_deposit  = Column(Numeric(12, 2), nullable=True)
    rent_cycle        = Column(String(20), nullable=False, default="monthly")  # monthly|quarterly|yearly
    due_day           = Column(Integer, nullable=False, default=1)             # day of month
    lease_start       = Column(Date, nullable=False)
    lease_end         = Column(Date, nullable=True)
    status            = Column(String(20), nullable=False, default="active")   # active|ended
    created_at        = Column(DateTime, default=datetime.utcnow, nullable=False)

    tenant       = relationship("Tenant", back_populates="leases")
    property_rel = relationship("Property", foreign_keys=[property_id])
    unit_rel     = relationship("Unit", foreign_keys=[unit_id])
    rent_records = relationship("RentRecord", back_populates="lease", cascade="all, delete-orphan")
    increases    = relationship("RentIncrease", back_populates="lease", cascade="all, delete-orphan")


class RentRecord(Base):
    __tablename__ = "rent_records"

    id           = Column(Integer, primary_key=True)
    tenant_id    = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    lease_id     = Column(Integer, ForeignKey("tenant_leases.id"), nullable=False)
    amount_due   = Column(Numeric(12, 2), nullable=False)
    amount_paid  = Column(Numeric(12, 2), nullable=False, default=0)
    due_date     = Column(Date, nullable=False)
    paid_date    = Column(Date, nullable=True)
    status       = Column(String(20), nullable=False, default="pending")  # pending|paid|partial|overdue
    late_fee     = Column(Numeric(12, 2), nullable=True)
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    lease        = relationship("TenantLease", back_populates="rent_records")
    tenant_rel   = relationship("Tenant", foreign_keys=[tenant_id])


class RentIncrease(Base):
    __tablename__ = "rent_increases"

    id             = Column(Integer, primary_key=True)
    lease_id       = Column(Integer, ForeignKey("tenant_leases.id"), nullable=False)
    old_amount     = Column(Numeric(12, 2), nullable=False)
    new_amount     = Column(Numeric(12, 2), nullable=False)
    effective_from = Column(Date, nullable=False)
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)

    lease = relationship("TenantLease", back_populates="increases")


class TenantPayment(Base):
    __tablename__ = "tenant_payments"

    id             = Column(Integer, primary_key=True)
    tenant_id      = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    rent_record_id = Column(Integer, ForeignKey("rent_records.id"), nullable=True)
    amount         = Column(Numeric(12, 2), nullable=False)
    payment_date   = Column(Date, nullable=False)
    payment_method = Column(String(40), nullable=False, default="cash")  # cash|bank|cheque|online
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)

    tenant      = relationship("Tenant", back_populates="payments")
    rent_record = relationship("RentRecord", foreign_keys=[rent_record_id])


class Maintenance(Base):
    __tablename__ = "maintenance_records"

    id             = Column(Integer, primary_key=True)
    property_id    = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    unit_id        = Column(Integer, ForeignKey("units.id",       ondelete="SET NULL"), nullable=True,  index=True)
    tenant_id      = Column(Integer, ForeignKey("tenants.id"),    nullable=True,  index=True)

    # ── Core fields ───────────────────────────────────────────────────────────
    title          = Column(String(255), nullable=True)
    description    = Column(Text, nullable=False)
    category       = Column(String(50),  nullable=False, default="repair", index=True)
    # repair | electrical | plumbing | hvac | cleaning | security | other | emergency | preventive | utility
    mtype          = Column(String(30),  nullable=False, default="repair")   # kept for backward compat
    priority       = Column(String(20),  nullable=False, default="normal", index=True)
    # low | normal | high | urgent
    status         = Column(String(30),  nullable=False, default="pending", index=True)
    # pending | assigned | in_progress | completed | cancelled

    # ── Cost tracking ─────────────────────────────────────────────────────────
    estimated_cost = Column(Numeric(12, 2), nullable=True)
    actual_cost    = Column(Numeric(12, 2), nullable=True)
    cost           = Column(Numeric(12, 2), nullable=False, default=0)   # kept for backward compat

    # ── Assignment ────────────────────────────────────────────────────────────
    assigned_to    = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    vendor_name    = Column(String(120), nullable=True)
    vendor_phone   = Column(String(50),  nullable=True)

    # ── Dates ─────────────────────────────────────────────────────────────────
    date           = Column(Date, nullable=False)
    completed_date = Column(Date, nullable=True)

    # ── Notes & integration flags ─────────────────────────────────────────────
    notes          = Column(Text, nullable=True)
    expense_posted = Column(Boolean, nullable=False, default=False)
    ledger_posted  = Column(Boolean, nullable=False, default=False)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    property_rel   = relationship("Property",  foreign_keys=[property_id])
    unit_rel       = relationship("Unit",      foreign_keys=[unit_id])
    tenant_rel     = relationship("Tenant",    foreign_keys=[tenant_id])
    assigned_emp   = relationship("Employee",  foreign_keys=[assigned_to])
    creator        = relationship("User",      foreign_keys=[created_by])
    activity_logs  = relationship("MaintenanceActivityLog", back_populates="maintenance",
                                  cascade="all, delete-orphan", order_by="MaintenanceActivityLog.created_at")


class MaintenanceActivityLog(Base):
    """Immutable audit trail for every status change and action on a maintenance request."""
    __tablename__ = "maintenance_activity_logs"

    id             = Column(Integer, primary_key=True)
    maintenance_id = Column(Integer, ForeignKey("maintenance_records.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action         = Column(String(80), nullable=False)
    old_status     = Column(String(30), nullable=True)
    new_status     = Column(String(30), nullable=True)
    note           = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    maintenance    = relationship("Maintenance", back_populates="activity_logs")
    user           = relationship("User", foreign_keys=[user_id])
