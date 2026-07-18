"""CRM models — Enterprise Real Estate CRM.
Includes: Leads, Clients, Dealers, Deals, FollowUps, SiteVisits,
InstallmentPlans, Payments, Communications, Activities, Timeline, Audit.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer,
    Numeric, String, Text, JSON,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.finance import Journal  # noqa: F401 — for InstallmentPayment FK


# ── Lead ──────────────────────────────────────────────────────────────────────

class Lead(Base):
    __tablename__ = "leads"

    id         = Column(Integer, primary_key=True)
    lead_id    = Column(String(20), unique=True, nullable=False)

    # Identity
    name       = Column(String(120), nullable=False)
    phone      = Column(String(50), nullable=True)
    whatsapp   = Column(String(50), nullable=True)
    email      = Column(String(255), nullable=True)
    cnic       = Column(String(20), nullable=True)
    address    = Column(Text, nullable=True)
    city       = Column(String(80), nullable=True)

    # Business
    occupation   = Column(String(120), nullable=True)
    company      = Column(String(120), nullable=True)
    monthly_income = Column(Numeric(14, 2), nullable=True)

    # Property Interest
    budget_min           = Column(Numeric(14, 2), nullable=True)
    budget_max           = Column(Numeric(14, 2), nullable=True)
    preferred_town       = Column(String(80), nullable=True)
    preferred_property_type = Column(String(80), nullable=True)
    unit_preference         = Column(String(80), nullable=True)
    preferred_project       = Column(String(120), nullable=True)

    # Acquisition
    source     = Column(String(80), nullable=True)
    campaign   = Column(String(120), nullable=True)
    referral   = Column(String(120), nullable=True)
    assigned_dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=True)

    # Lead Cost (snapshot when dealer assigned)
    lead_cost = Column(Numeric(14, 2), nullable=True)

    # Tag: investor | end_user
    investor_type = Column(String(20), nullable=True)

    # Linear pipeline stages (enforced by backend — cannot skip):
    # new → contacted → qualified → follow_up → site_visit → quotation → negotiation → deal_won → converted | lost
    STATUS_ORDER = [
        "new", "contacted", "qualified", "follow_up",
        "site_visit", "quotation", "negotiation",
        "deal_won", "converted", "lost",
    ]
    status     = Column(String(30), nullable=False, default="new")
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    client        = relationship("Client", back_populates="lead", uselist=False)
    assigned_dealer = relationship("Dealer", foreign_keys=[assigned_dealer_id])
    followups     = relationship("FollowUp", back_populates="lead", cascade="all, delete-orphan")
    site_visits   = relationship("SiteVisit", back_populates="lead", cascade="all, delete-orphan")


# ── FollowUp ──────────────────────────────────────────────────────────────────

class FollowUp(Base):
    """Dedicated follow-up management."""
    __tablename__ = "followups"

    id      = Column(Integer, primary_key=True)
    fu_id   = Column(String(20), unique=True, nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    date        = Column(Date, nullable=False)
    time        = Column(String(10), nullable=True)  # HH:MM
    # type: call | whatsapp | sms | meeting | email
    fu_type     = Column(String(20), nullable=False, default="call")
    # status: pending | completed | missed
    fu_status   = Column(String(20), nullable=False, default="pending")
    notes       = Column(Text, nullable=True)
    reminded    = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    lead = relationship("Lead", back_populates="followups")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])


# ── SiteVisit ─────────────────────────────────────────────────────────────────

class SiteVisit(Base):
    """Site visit management."""
    __tablename__ = "site_visits"

    id          = Column(Integer, primary_key=True)
    visit_id    = Column(String(20), unique=True, nullable=False)
    lead_id     = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    dealer_id   = Column(Integer, ForeignKey("dealers.id"), nullable=True)

    date       = Column(Date, nullable=False)
    time       = Column(String(10), nullable=True)
    # status: scheduled | completed | cancelled | no_show
    sv_status  = Column(String(20), nullable=False, default="scheduled")
    remarks    = Column(Text, nullable=True)
    # Post-visit client feedback (filled when status changes to completed)
    feedback   = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    lead     = relationship("Lead", back_populates="site_visits")
    property = relationship("Property", foreign_keys=[property_id])
    dealer   = relationship("Dealer", foreign_keys=[dealer_id])


# ── Payment (standalone) ──────────────────────────────────────────────────────

class Payment(Base):
    """Standalone payment record — can be linked to deals, bookings, or installments."""
    __tablename__ = "crm_payments"

    id          = Column(Integer, primary_key=True)
    payment_id  = Column(String(20), unique=True, nullable=False)
    client_id   = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    deal_id     = Column(Integer, ForeignKey("deals.id"), nullable=True)
    booking_id  = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    installment_id = Column(Integer, ForeignKey("installments.id"), nullable=True)

    amount          = Column(Numeric(14, 2), nullable=False)
    payment_date    = Column(DateTime, nullable=False, default=datetime.utcnow)
    payment_method  = Column(String(30), nullable=False, default="cash")
    receipt_number  = Column(String(100), nullable=True)
    reference       = Column(String(255), nullable=True)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    journal_id = Column(Integer, ForeignKey("journals.id"), nullable=True)

    client      = relationship("Client", foreign_keys=[client_id])
    deal        = relationship("Deal", foreign_keys=[deal_id])
    booking     = relationship("Booking", foreign_keys=[booking_id])
    installment = relationship("Installment", foreign_keys=[installment_id])
    journal     = relationship("Journal", foreign_keys=[journal_id])


# ── CrmTimelineEntry (Centralized Timeline) ───────────────────────────────────

class CrmTimelineEntry(Base):
    """Centralized timeline engine for all CRM entities."""
    __tablename__ = "crm_timeline_entries"

    id          = Column(Integer, primary_key=True)
    entity_type = Column(String(30), nullable=False, index=True)  # lead | client | dealer | deal | booking
    entity_id   = Column(Integer, nullable=False, index=True)
    action      = Column(String(50), nullable=False)  # lead_created | lead_converted | followup_added | visit_scheduled | deal_created | deal_won | booking_created | payment_received | etc.
    description = Column(Text, nullable=True)
    old_value   = Column(String(255), nullable=True)
    new_value   = Column(String(255), nullable=True)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    performed_by = relationship("User", foreign_keys=[performed_by_id])


# ── Client ────────────────────────────────────────────────────────────────────

class Client(Base):
    __tablename__ = "clients"

    id                     = Column(Integer, primary_key=True)
    client_id              = Column(String(20), unique=True, nullable=False)
    tracking_id            = Column(String(20), unique=True, nullable=False)
    lead_id                = Column(Integer, ForeignKey("leads.id"), nullable=True)

    # Personal
    name                   = Column(String(120), nullable=False)
    phone                  = Column(String(50), nullable=True)
    whatsapp               = Column(String(50), nullable=True)
    email                  = Column(String(255), nullable=True)
    cnic                   = Column(String(20), nullable=True)
    address                = Column(Text, nullable=True)
    mailing_address        = Column(Text, nullable=True)
    permanent_address      = Column(Text, nullable=True)
    city                   = Column(String(80), nullable=True)

    # Business
    company_name           = Column(String(120), nullable=True)
    occupation             = Column(String(120), nullable=True)

    # Next of Kin
    next_of_kin_name       = Column(String(120), nullable=True)
    next_of_kin_cnic       = Column(String(20), nullable=True)
    next_of_kin_phone      = Column(String(50), nullable=True)

    # Status: active | inactive | potential
    status                 = Column(String(20), nullable=False, default="active")
    dealer_id              = Column(Integer, ForeignKey("dealers.id"), nullable=True)
    interested_property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    notes                  = Column(Text, nullable=True)
    created_at             = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at             = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    lead                = relationship("Lead", back_populates="client")
    assigned_dealer     = relationship("Dealer", foreign_keys=[dealer_id])
    deals               = relationship("Deal", back_populates="client")
    communications      = relationship(
        "Communication", back_populates="client",
        foreign_keys="Communication.tracking_id",
        primaryjoin="Client.tracking_id == Communication.tracking_id",
    )
    interested_property = relationship("Property", foreign_keys=[interested_property_id])
    attachments         = relationship("ClientAttachment", back_populates="client",
                                       cascade="all, delete-orphan")


# ── ClientAttachment ──────────────────────────────────────────────────────────

class ClientAttachment(Base):
    __tablename__ = "client_attachments"

    id         = Column(Integer, primary_key=True)
    client_id  = Column(Integer, ForeignKey("clients.id"), nullable=False)
    file_path  = Column(String(512), nullable=False)
    filename   = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="attachments")


# ── Dealer ────────────────────────────────────────────────────────────────────

class Dealer(Base):
    __tablename__ = "dealers"

    id               = Column(Integer, primary_key=True)
    dealer_id        = Column(String(20), unique=True, nullable=False)   # DEA-0001
    name             = Column(String(120), nullable=False)
    email            = Column(String(255), nullable=True)
    phone            = Column(String(50), nullable=True)
    company          = Column(String(120), nullable=True)
    commission_type  = Column(String(20), nullable=False, default="percentage")
    commission_rate  = Column(Numeric(12, 2), nullable=True)
    cnic             = Column(String(20), nullable=True)
    address          = Column(Text, nullable=True)
    notes            = Column(Text, nullable=True)
    is_active        = Column(Boolean, nullable=False, default=True)
    monthly_target   = Column(Numeric(12, 2), nullable=True)
    cost_per_lead    = Column(Numeric(14, 2), nullable=True)  # cost dealer pays per lead
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)

    deals       = relationship("Deal", back_populates="dealer")
    attachments = relationship("DealerAttachment", back_populates="dealer",
                               cascade="all, delete-orphan")
    ledger_entries = relationship("DealerLedgerEntry", back_populates="dealer",
                                  cascade="all, delete-orphan")


# ── DealerAttachment ──────────────────────────────────────────────────────────

class DealerAttachment(Base):
    __tablename__ = "dealer_attachments"

    id         = Column(Integer, primary_key=True)
    dealer_id  = Column(Integer, ForeignKey("dealers.id"), nullable=False)
    file_path  = Column(String(512), nullable=False)
    filename   = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dealer = relationship("Dealer", back_populates="attachments")


# ── InstallmentType ───────────────────────────────────────────────────────────

class InstallmentType(Base):
    __tablename__ = "installment_types"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(120), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── Deal ──────────────────────────────────────────────────────────────────────

class Deal(Base):
    """
    Deal with full lifecycle: draft → negotiation → won → lost / cancelled.
    When status becomes `won`, a Booking should be created automatically.
    """
    __tablename__ = "deals"

    id           = Column(Integer, primary_key=True)
    deal_id      = Column(String(20), unique=True, nullable=False)
    tracking_id  = Column(String(20), nullable=False)
    client_id    = Column(Integer, ForeignKey("clients.id"), nullable=False)
    property_id  = Column(Integer, ForeignKey("properties.id"), nullable=True)
    unit_id      = Column(Integer, ForeignKey("units.id"), nullable=True)
    dealer_id    = Column(Integer, ForeignKey("dealers.id"), nullable=True)
    # Town hierarchy support
    deal_type    = Column(String(20), nullable=False, default="property")
    reference_id = Column(Integer, nullable=True)
    deal_title   = Column(String(255), nullable=True)
    client_role  = Column(String(20), nullable=True)   # Buyer | Seller | Investor

    # ── Financial ─────────────────────────────────────────────────────────────
    deal_value          = Column(Numeric(14, 2), nullable=False)  # proposed price
    down_payment        = Column(Numeric(14, 2), nullable=True)
    down_payment_status = Column(String(20), nullable=False, default="pending")
    discount            = Column(Numeric(14, 2), nullable=True)
    tax             = Column(Numeric(14, 2), nullable=True)
    commission      = Column(Numeric(14, 2), nullable=True)
    net_amount      = Column(Numeric(14, 2), nullable=True)

    proposed_installment_type  = Column(String(30), nullable=True)
    proposed_installment_count = Column(Integer, nullable=True)
    negotiation_notes          = Column(Text, nullable=True)

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    # draft → negotiation → won → lost → cancelled
    status     = Column(String(20), nullable=False, default="draft")
    deal_date  = Column(Date, nullable=True)
    due_date   = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    client      = relationship("Client", back_populates="deals")
    dealer      = relationship("Dealer", back_populates="deals")
    property    = relationship("Property", foreign_keys=[property_id])
    unit        = relationship("Unit",     foreign_keys=[unit_id])
    attachments = relationship("DealAttachment", back_populates="deal",
                               cascade="all, delete-orphan")
    bookings    = relationship("Booking", foreign_keys="Booking.deal_id",
                               back_populates="deal")


# ── DealAttachment ────────────────────────────────────────────────────────────

class DealAttachment(Base):
    __tablename__ = "deal_attachments"

    id         = Column(Integer, primary_key=True)
    deal_id    = Column(Integer, ForeignKey("deals.id"), nullable=False)
    file_path  = Column(String(512), nullable=False)
    filename   = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    deal = relationship("Deal", back_populates="attachments")


# ── InstallmentPlan ───────────────────────────────────────────────────────────

class InstallmentPlan(Base):
    """
    Payment schedule for a Booking (not a Deal).
    Belongs to booking_id, not deal_id.

    deal_id is kept as a legacy column for backward compatibility with
    existing CRM routes. New plans should use booking_id.
    """
    __tablename__ = "installment_plans"

    id                   = Column(Integer, primary_key=True)
    booking_id           = Column(Integer, ForeignKey("bookings.id"), nullable=True, unique=True)
    deal_id              = Column(Integer, ForeignKey("deals.id"), nullable=True)  # legacy — kept for compat
    type_id              = Column(Integer, ForeignKey("installment_types.id"), nullable=True)
    total_amount         = Column(Numeric(14, 2), nullable=False)
    down_payment         = Column(Numeric(14, 2), nullable=False, default=0)
    remaining_amount     = Column(Numeric(14, 2), nullable=False, default=0)
    down_payment_status  = Column(String(20), nullable=False, default="pending")
    total_count          = Column(Integer, nullable=True)
    frequency            = Column(String(20), nullable=True)
    amount_per           = Column(Numeric(14, 2), nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow, nullable=False)

    booking          = relationship("Booking", back_populates="installment_plan")
    installment_type = relationship("InstallmentType")
    installments     = relationship("Installment", back_populates="plan",
                                    cascade="all, delete-orphan",
                                    order_by="Installment.due_date")


# ── Installment ───────────────────────────────────────────────────────────────

class Installment(Base):
    __tablename__ = "installments"

    id          = Column(Integer, primary_key=True)
    plan_id     = Column(Integer, ForeignKey("installment_plans.id"), nullable=False)
    due_date    = Column(Date, nullable=False)
    amount      = Column(Numeric(12, 2), nullable=False)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)
    # type: monthly | quarterly | yearly | custom
    type        = Column(String(20), nullable=False, default="custom")
    # status: pending | partial | paid | overdue
    status      = Column(String(20), nullable=False, default="pending")

    plan     = relationship("InstallmentPlan", back_populates="installments")
    payments = relationship("InstallmentPayment", back_populates="installment",
                            cascade="all, delete-orphan")


# ── InstallmentPayment ────────────────────────────────────────────────────────

class InstallmentPayment(Base):
    """Payment made against a specific installment — triggers journal entry."""
    __tablename__ = "installment_payments"

    id               = Column(Integer, primary_key=True)
    installment_id   = Column(Integer, ForeignKey("installments.id"), nullable=False)
    method           = Column(String(20), nullable=False)   # cash | bank
    amount           = Column(Numeric(12, 2), nullable=False)
    date             = Column(DateTime, nullable=False)
    reference_number = Column(String(100), nullable=True)
    journal_id       = Column(Integer, ForeignKey("journals.id"), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)

    installment = relationship("Installment", back_populates="payments")
    journal     = relationship("Journal")


# ── Communication ─────────────────────────────────────────────────────────────

class Communication(Base):
    __tablename__ = "communications"

    id          = Column(Integer, primary_key=True)
    tracking_id = Column(String(20), nullable=False, index=True)
    client_id   = Column(Integer, ForeignKey("clients.id"), nullable=True)
    type        = Column(String(20), nullable=False)   # call|sms|email|meeting
    subject     = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    comm_date   = Column(Date, nullable=True)
    attachment  = Column(String(512), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship(
        "Client",
        foreign_keys=[tracking_id],
        primaryjoin="Communication.tracking_id == Client.tracking_id",
        back_populates="communications",
    )


# ── LeadActivity ──────────────────────────────────────────────────────────────

class LeadActivity(Base):
    """Unified activity log for leads and clients.

    entity_type: 'lead' | 'client'
    entity_id:   id of the lead or client row
    type:        call | whatsapp | followup | note | email
    status:      initiated | completed | missed | pending | done (type-dependent)
    """
    __tablename__ = "lead_activities"

    id          = Column(Integer, primary_key=True)
    entity_type = Column(String(20), nullable=False)          # lead | client
    entity_id   = Column(Integer, nullable=False, index=True)
    type        = Column(String(20), nullable=False)           # call|whatsapp|followup|note|email
    message     = Column(Text, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)            # for follow-ups
    status      = Column(String(20), nullable=False, default="initiated")
    notified    = Column(Boolean, nullable=False, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ── AutomationRule ────────────────────────────────────────────────────────────

class AutomationRule(Base):
    """CRM automation rules: trigger → action mapping."""
    __tablename__ = "automation_rules"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(120), nullable=False)
    trigger     = Column(String(50), nullable=False)   # lead_converted | deal_won | booking_confirmed | installment_overdue | payment_received
    action      = Column(String(50), nullable=False)   # create_client | suggest_booking | generate_installments | create_reminder | update_balance
    config      = Column(JSON, nullable=True)           # rule-specific config
    enabled     = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
