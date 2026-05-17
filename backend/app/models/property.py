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
    category                = Column(String(80))                                    # legacy free-text
    category_id             = Column(Integer, ForeignKey("property_categories.id"), nullable=True)
    size                    = Column(String(80))
    for_sale                = Column(Boolean, nullable=False, default=False)
    sale_price              = Column(Numeric(12, 2), nullable=True)
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
    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)

    floor            = relationship("Floor", back_populates="units")
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

    id          = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    file_path   = Column(String(512), nullable=False)
    filename    = Column(String(255), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    property = relationship("Property", back_populates="attachments")


class Lease(Base):
    __tablename__ = "leases"

    id           = Column(Integer, primary_key=True)
    tid          = Column(String(20), unique=True, nullable=False)   # LEA-0001
    unit_id      = Column(Integer, ForeignKey("units.id"), nullable=False)
    tenant_name  = Column(String(120), nullable=True)   # placeholder until tenant module
    start_date   = Column(Date, nullable=False)
    end_date     = Column(Date, nullable=True)
    monthly_rent = Column(Numeric(12, 2), nullable=False)
    status       = Column(String(30), nullable=False, default="active")
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    unit = relationship("Unit", back_populates="leases")


class Buyer(Base):
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
    buyer_id    = Column(Integer, ForeignKey("buyers.id"), nullable=False)
    seller_id   = Column(Integer, ForeignKey("sellers.id"), nullable=False)
    sale_price  = Column(Numeric(12, 2), nullable=False)
    sale_date   = Column(Date, nullable=False)
    status      = Column(String(30), nullable=False, default="pending")
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    property = relationship("Property")
    unit     = relationship("Unit")
    buyer    = relationship("Buyer",  back_populates="purchases", foreign_keys=[buyer_id])
    seller   = relationship("Seller", back_populates="sales",     foreign_keys=[seller_id])
