from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey,
    Integer, Numeric, String, Table, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class PropertyCategory(Base):
    __tablename__ = "property_categories"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(120), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    properties = relationship("Property", back_populates="category_rel")


# ── Many-to-many: property ↔ amenity ─────────────────────────────────────────
property_amenities = Table(
    "property_amenities",
    Base.metadata,
    Column("property_id", ForeignKey("properties.id"), primary_key=True),
    Column("amenity_id",  ForeignKey("amenities.id"),  primary_key=True),
)


class Location(Base):
    """Hierarchical location tree (e.g. DHA → Phase 1)."""
    __tablename__ = "locations"

    id         = Column(Integer, primary_key=True)
    tid        = Column(String(20), unique=True, nullable=False)
    name       = Column(String(120), nullable=False)
    parent_id  = Column(Integer, ForeignKey("locations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    parent   = relationship("Location", remote_side=[id], back_populates="children")
    children = relationship("Location", back_populates="parent", cascade="all, delete-orphan")


class Amenity(Base):
    __tablename__ = "amenities"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(120), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Property(Base):
    __tablename__ = "properties"

    id                      = Column(Integer, primary_key=True)
    tid                     = Column(String(20), unique=True, nullable=False)   # PRO-0001
    name                    = Column(String(120), nullable=False)               # kept for display
    address                 = Column(String(255))
    description             = Column(Text)
    property_type_option_id = Column(Integer, ForeignKey("master_setting_options.id"), nullable=True)
    status                  = Column(String(30), nullable=False, default="available")
    # Split status fields
    listing_status          = Column(String(30), nullable=True, default="available")
    operational_status      = Column(String(30), nullable=True, default="active")
    category                = Column(String(80))                                    # legacy free-text
    category_id             = Column(Integer, ForeignKey("property_categories.id"), nullable=True)
    size                    = Column(String(80))
    size_unit               = Column(String(10), nullable=True)                     # sqft / sqm / marla / kanal
    for_sale                = Column(Boolean, nullable=False, default=False)
    sale_price              = Column(Numeric(12, 2), nullable=True)
    # Ownership & Legal
    owner_name              = Column(String(255), nullable=True)
    owner_type              = Column(String(20), nullable=True)                     # Individual / Company
    cnic_ntn                = Column(String(50), nullable=True)
    ownership_pct           = Column(Numeric(5, 2), nullable=True, default=100)
    title_deed_number       = Column(String(100), nullable=True)
    registration_date       = Column(Date, nullable=True)
    mortgage_lien           = Column(Boolean, nullable=True, default=False)
    lender_name             = Column(String(255), nullable=True)
    outstanding_amount      = Column(Numeric(14, 2), nullable=True)
    regulatory_authority    = Column(String(30), nullable=True)                     # RERA / DHA / LDA / CDA / Private / Other
    # Pricing extensions
    purchase_price          = Column(Numeric(14, 2), nullable=True)
    current_market_value    = Column(Numeric(14, 2), nullable=True)
    asking_price            = Column(Numeric(14, 2), nullable=True)
    commission_pct          = Column(Numeric(5, 2), nullable=True)
    # COA Linkage
    income_gl_account_id    = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    expense_gl_account_id   = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    asset_gl_account_id     = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    cost_centre             = Column(String(100), nullable=True)
    dealer_id               = Column(Integer, ForeignKey("dealers.id"), nullable=True)
    year_built              = Column(Integer, nullable=True)
    location_id             = Column(Integer, ForeignKey("locations.id"), nullable=True)
    created_at              = Column(DateTime, default=datetime.utcnow, nullable=False)

    floors       = relationship("Floor",         back_populates="property", cascade="all, delete-orphan")
    images       = relationship("PropertyImage", back_populates="property", cascade="all, delete-orphan")
    attachments  = relationship("PropertyAttachment", back_populates="property", cascade="all, delete-orphan")
    amenities    = relationship("Amenity", secondary=property_amenities)
    property_type_option = relationship("MasterSettingOption", foreign_keys=[property_type_option_id])
    location     = relationship("Location")
    dealer       = relationship("Dealer", foreign_keys=[dealer_id])
    category_rel = relationship("PropertyCategory", back_populates="properties")
    # GL account relationships
    income_gl_account   = relationship("Account", foreign_keys=[income_gl_account_id], primaryjoin="Account.id == Property.income_gl_account_id")
    expense_gl_account  = relationship("Account", foreign_keys=[expense_gl_account_id], primaryjoin="Account.id == Property.expense_gl_account_id")
    asset_gl_account    = relationship("Account", foreign_keys=[asset_gl_account_id], primaryjoin="Account.id == Property.asset_gl_account_id")


class Floor(Base):
    __tablename__ = "floors"

    id          = Column(Integer, primary_key=True)
    tid         = Column(String(20), unique=True, nullable=False)   # FLR-0001
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    floor_number= Column(Integer, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    property = relationship("Property", back_populates="floors")
    units    = relationship("Unit", back_populates="floor", cascade="all, delete-orphan")


class Unit(Base):
    __tablename__ = "units"
    __table_args__ = (UniqueConstraint("floor_id", "unit_number", name="uq_floor_unit_number"),)

    id                  = Column(Integer, primary_key=True)
    tid                 = Column(String(20), unique=True, nullable=False)   # UNT-0001
    floor_id            = Column(Integer, ForeignKey("floors.id"), nullable=False)
    unit_number         = Column(String(20), nullable=False)
    status              = Column(String(20), nullable=False, default="available")
    unit_type_option_id = Column(Integer, ForeignKey("master_setting_options.id"), nullable=True)
    size                = Column(String(80), nullable=True)
    rent_amount         = Column(Numeric(12, 2))
    sale_price          = Column(Numeric(12, 2))
    # New fields
    unit_type           = Column(String(50), nullable=True)                # Studio / 1BR / 2BR / Penthouse etc.
    area                = Column(Numeric(12, 2), nullable=True)
    area_unit           = Column(String(10), nullable=True)                # sqft / sqm / marla
    furnishing_status   = Column(String(20), nullable=True)                # furnished / semi-furnished / unfurnished
    security_deposit    = Column(Numeric(12, 2), nullable=True)
    notes               = Column(Text, nullable=True)
    floor_number        = Column(Integer, nullable=True)                   # denormalized for easy filtering
    property_id         = Column(Integer, ForeignKey("properties.id"), nullable=True)  # denormalized
    current_tenant_name = Column(String(120), nullable=True)
    lease_end_date      = Column(Date, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)

    floor            = relationship("Floor", back_populates="units")
    property         = relationship("Property", foreign_keys=[property_id])
    unit_type_option = relationship("MasterSettingOption", foreign_keys=[unit_type_option_id])
    leases           = relationship("Lease", back_populates="unit")


class PropertyImage(Base):
    __tablename__ = "property_images"

    id          = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    file_path   = Column(String(512), nullable=False)
    sort_order  = Column(Integer, nullable=False, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    property = relationship("Property", back_populates="images")


class PropertyAttachment(Base):
    __tablename__ = "property_attachments"

    id            = Column(Integer, primary_key=True)
    property_id   = Column(Integer, ForeignKey("properties.id"), nullable=False)
    file_path     = Column(String(512), nullable=False)
    filename      = Column(String(255), nullable=False)
    document_type = Column(String(50), nullable=True)      # Title Deed / NOC / Insurance Policy / etc.
    document_name = Column(String(255), nullable=True)
    expiry_date   = Column(Date, nullable=True)
    notes         = Column(Text, nullable=True)
    uploaded_by   = Column(String(120), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)

    property = relationship("Property", back_populates="attachments")


class Lease(Base):
    __tablename__ = "leases"

    id           = Column(Integer, primary_key=True)
    tid          = Column(String(20), unique=True, nullable=False)   # LEA-0001
    property_id  = Column(Integer, ForeignKey("properties.id"), nullable=True)
    unit_id      = Column(Integer, ForeignKey("units.id"), nullable=False)
    tenant_name  = Column(String(120), nullable=True)   # backward compat
    tenant_id    = Column(Integer, ForeignKey("tenants.id"), nullable=True)

    # ── Lease Terms (Section B) ──
    start_date           = Column(Date, nullable=False)
    end_date             = Column(Date, nullable=False)
    monthly_rent         = Column(Numeric(12, 2), nullable=False)
    annual_rent          = Column(Numeric(14, 2), nullable=True)
    payment_frequency    = Column(String(30), nullable=False, default="monthly")
    first_payment_due_date = Column(Date, nullable=True)
    security_deposit     = Column(Numeric(12, 2), nullable=True)
    deposit_status       = Column(String(20), nullable=True, default="pending")
    notice_period        = Column(Integer, nullable=True, default=30)

    # ── Late Payment Rules (Section C) ──
    grace_period  = Column(Integer, nullable=True, default=5)
    late_fee_type = Column(String(20), nullable=True)  # fixed | percentage
    late_fee_value = Column(Numeric(12, 2), nullable=True)

    # ── Payment Method (Section D) ──
    payment_method       = Column(String(30), nullable=True, default="cash")
    pdc_count            = Column(Integer, nullable=True)
    bank_name            = Column(String(120), nullable=True)
    bank_account_details = Column(String(255), nullable=True)

    # ── Renewal Terms (Section E) ──
    auto_renewal           = Column(Boolean, nullable=True, default=False)
    renewal_duration_months = Column(Integer, nullable=True)
    rent_increase_pct      = Column(Numeric(5, 2), nullable=True)

    # ── Termination tracking ──
    termination_date   = Column(Date, nullable=True)
    termination_reason = Column(String(50), nullable=True)
    renewed_from_lease_id = Column(Integer, ForeignKey("leases.id"), nullable=True)

    # ── Status & audit ──
    status     = Column(String(30), nullable=False, default="active")
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    unit     = relationship("Unit", back_populates="leases")
    property = relationship("Property", foreign_keys=[property_id])
    tenant   = relationship("Tenant", foreign_keys=[tenant_id])
    payments = relationship("LeasePayment", back_populates="lease", cascade="all, delete-orphan")
    pdcs     = relationship("LeasePdc",     back_populates="lease", cascade="all, delete-orphan")
    documents = relationship("LeaseDocument", back_populates="lease", cascade="all, delete-orphan")
    renewed_from = relationship("Lease", remote_side=[id], foreign_keys=[renewed_from_lease_id])


class LeasePayment(Base):
    __tablename__ = "lease_payments"

    id             = Column(Integer, primary_key=True)
    tid            = Column(String(20), unique=True, nullable=False)  # LPM-0001
    lease_id       = Column(Integer, ForeignKey("leases.id"), nullable=False)
    amount         = Column(Numeric(12, 2), nullable=False)
    payment_date   = Column(Date, nullable=False)
    payment_method = Column(String(30), nullable=True)
    reference_no   = Column(String(80), nullable=True)
    cheque_no      = Column(String(50), nullable=True)
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)

    lease = relationship("Lease", back_populates="payments")


class LeasePdc(Base):
    __tablename__ = "lease_pdcs"

    id        = Column(Integer, primary_key=True)
    lease_id  = Column(Integer, ForeignKey("leases.id"), nullable=False)
    cheque_no = Column(String(50), nullable=False)
    amount    = Column(Numeric(12, 2), nullable=False)
    due_date  = Column(Date, nullable=False)
    status    = Column(String(20), nullable=False, default="pending")  # pending | cleared | bounced

    lease = relationship("Lease", back_populates="pdcs")


class LeaseDocument(Base):
    __tablename__ = "lease_documents"

    id            = Column(Integer, primary_key=True)
    lease_id      = Column(Integer, ForeignKey("leases.id"), nullable=False)
    file_path     = Column(String(512), nullable=False)
    filename      = Column(String(255), nullable=False)
    document_type = Column(String(50), nullable=True, default="lease_agreement")
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)

    lease = relationship("Lease", back_populates="documents")


class Contact(Base):
    """Unified contacts table — replaces both Buyer and Seller."""
    __tablename__ = "contacts"

    id         = Column(Integer, primary_key=True)
    tid        = Column(String(20), unique=True, nullable=False)   # CON-0001
    # Section A: Personal Information
    name            = Column(String(120), nullable=False)
    role            = Column(String(50), nullable=False, default="buyer")  # Comma-sep: buyer,seller,agent
    contact_type    = Column(String(20), nullable=False, default="individual")  # individual | company
    cnic            = Column(String(50), nullable=True)   # 00000-0000000-0
    date_of_birth   = Column(Date, nullable=True)
    nationality     = Column(String(50), nullable=True)
    profession      = Column(String(100), nullable=True)
    company_name    = Column(String(120), nullable=True)
    ntn             = Column(String(50), nullable=True)
    company_reg_no  = Column(String(50), nullable=True)
    authorized_person = Column(String(120), nullable=True)
    # Section B: Contact Details
    email           = Column(String(255), nullable=True)
    phone           = Column(String(50), nullable=True)
    whatsapp        = Column(String(50), nullable=True)
    secondary_phone = Column(String(50), nullable=True)
    address         = Column(Text, nullable=True)
    city            = Column(String(80), nullable=True)
    # Section C: Financial Information (KYC)
    tax_ntn           = Column(String(50), nullable=True)
    source_of_funds   = Column(String(50), nullable=True)
    annual_income_range = Column(String(30), nullable=True)
    bank_name         = Column(String(120), nullable=True)
    bank_account_no   = Column(String(80), nullable=True)
    kyc_status        = Column(String(20), nullable=False, default="pending")
    # Section E: Internal Notes
    internal_notes  = Column(Text, nullable=True)
    # Audit
    archived        = Column(Boolean, nullable=False, default=False)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    documents    = relationship("ContactDocument", back_populates="contact", cascade="all, delete-orphan")
    interactions = relationship("ContactInteraction", back_populates="contact", cascade="all, delete-orphan",
                                order_by="ContactInteraction.interaction_date.desc()")


class ContactDocument(Base):
    __tablename__ = "contact_documents"

    id            = Column(Integer, primary_key=True)
    contact_id    = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    document_type = Column(String(50), nullable=False)
    file_path     = Column(String(512), nullable=False)
    filename      = Column(String(255), nullable=False)
    status        = Column(String(20), nullable=False, default="pending")  # pending | verified | rejected
    uploaded_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    contact = relationship("Contact", back_populates="documents")


class ContactInteraction(Base):
    __tablename__ = "contact_interactions"

    id              = Column(Integer, primary_key=True)
    contact_id      = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    type            = Column(String(20), nullable=False)  # call | email | meeting | note
    notes           = Column(Text, nullable=True)
    interaction_date = Column(Date, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    contact = relationship("Contact", back_populates="interactions")


class Buyer(Base):
    """Legacy — kept for FK backward compat with PropertySale. Prefer Contact."""
    __tablename__ = "buyers"

    id         = Column(Integer, primary_key=True)
    tid        = Column(String(20), unique=True, nullable=False)   # BUY-0001
    name       = Column(String(120), nullable=False)
    email      = Column(String(255), nullable=True)
    phone      = Column(String(50), nullable=True)
    address    = Column(String(255), nullable=True)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    purchases = relationship("PropertySale", back_populates="buyer", foreign_keys="PropertySale.buyer_id")


class Seller(Base):
    """Legacy — kept for FK backward compat with PropertySale. Prefer Contact."""
    __tablename__ = "sellers"

    id         = Column(Integer, primary_key=True)
    tid        = Column(String(20), unique=True, nullable=False)   # SEL-0001
    name       = Column(String(120), nullable=False)
    email      = Column(String(255), nullable=True)
    phone      = Column(String(50), nullable=True)
    address    = Column(String(255), nullable=True)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    sales = relationship("PropertySale", back_populates="seller", foreign_keys="PropertySale.seller_id")


class PropertySale(Base):
    __tablename__ = "property_sales"

    id          = Column(Integer, primary_key=True)
    tid         = Column(String(20), unique=True, nullable=False)   # SAL-0001
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    unit_id     = Column(Integer, ForeignKey("units.id"), nullable=True)
    buyer_id    = Column(Integer, ForeignKey("buyers.id"), nullable=False)     # legacy FK
    seller_id   = Column(Integer, ForeignKey("sellers.id"), nullable=False)    # legacy FK
    buyer_contact_id  = Column(Integer, ForeignKey("contacts.id"), nullable=True)   # new unified
    seller_contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)   # new unified
    sale_price  = Column(Numeric(12, 2), nullable=False)

    # ── Section B: Financial Details ──
    token_amount      = Column(Numeric(12, 2), nullable=True)
    token_date        = Column(Date, nullable=True)
    payment_type      = Column(String(30), nullable=True)  # full_cash | mortgage | instalment | mixed
    bank_name         = Column(String(120), nullable=True)
    loan_amount       = Column(Numeric(12, 2), nullable=True)
    approval_date     = Column(Date, nullable=True)
    commission_pct    = Column(Numeric(5, 2), nullable=True)
    commission_amount = Column(Numeric(12, 2), nullable=True)
    commission_paid_to = Column(String(120), nullable=True)
    stamp_duty        = Column(Numeric(12, 2), nullable=True)
    registration_fee  = Column(Numeric(12, 2), nullable=True)

    # ── Section C: Legal & Registration ──
    sale_date           = Column(Date, nullable=False)      # kept for backward compat
    agreement_date      = Column(Date, nullable=True)       # new preferred name
    transfer_date       = Column(Date, nullable=True)
    transfer_deed_number = Column(String(100), nullable=True)
    sale_stage          = Column(String(30), nullable=False, default="enquiry")  # replaces status
    status              = Column(String(30), nullable=False, default="pending")  # kept for backward compat
    cancellation_reason = Column(Text, nullable=True)

    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    property = relationship("Property")
    unit     = relationship("Unit")
    buyer    = relationship("Buyer",  back_populates="purchases", foreign_keys=[buyer_id])
    seller   = relationship("Seller", back_populates="sales",     foreign_keys=[seller_id])
    instalments = relationship("SaleInstalment", back_populates="sale", cascade="all, delete-orphan")
    stage_history = relationship("SaleStageHistory", back_populates="sale", cascade="all, delete-orphan", order_by="SaleStageHistory.timestamp")
    documents = relationship("SaleDocument", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("SalePayment", back_populates="sale", cascade="all, delete-orphan")


class SaleInstalment(Base):
    __tablename__ = "sale_instalments"

    id             = Column(Integer, primary_key=True)
    sale_id        = Column(Integer, ForeignKey("property_sales.id"), nullable=False)
    milestone_name = Column(String(100), nullable=False)
    due_date       = Column(Date, nullable=False)
    amount         = Column(Numeric(12, 2), nullable=False)
    status         = Column(String(20), nullable=False, default="pending")  # pending | paid | overdue

    sale = relationship("PropertySale", back_populates="instalments")
    payments = relationship("SalePayment", back_populates="instalment")


class SaleStageHistory(Base):
    __tablename__ = "sale_stage_history"

    id         = Column(Integer, primary_key=True)
    sale_id    = Column(Integer, ForeignKey("property_sales.id"), nullable=False)
    from_stage = Column(String(30), nullable=True)
    to_stage   = Column(String(30), nullable=False)
    changed_by = Column(String(120), nullable=True)
    timestamp  = Column(DateTime, default=datetime.utcnow, nullable=False)

    sale = relationship("PropertySale", back_populates="stage_history")


class SaleDocument(Base):
    __tablename__ = "sale_documents"

    id            = Column(Integer, primary_key=True)
    sale_id       = Column(Integer, ForeignKey("property_sales.id"), nullable=False)
    file_path     = Column(String(512), nullable=False)
    filename      = Column(String(255), nullable=False)
    document_type = Column(String(50), nullable=True)  # sale_agreement | transfer_deed | additional
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)

    sale = relationship("PropertySale", back_populates="documents")


class SalePayment(Base):
    __tablename__ = "sale_payments"

    id            = Column(Integer, primary_key=True)
    sale_id       = Column(Integer, ForeignKey("property_sales.id"), nullable=False)
    instalment_id = Column(Integer, ForeignKey("sale_instalments.id"), nullable=True)
    amount        = Column(Numeric(12, 2), nullable=False)
    payment_date  = Column(Date, nullable=False)
    reference_no  = Column(String(100), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)

    sale       = relationship("PropertySale", back_populates="payments")
    instalment = relationship("SaleInstalment", back_populates="payments")
