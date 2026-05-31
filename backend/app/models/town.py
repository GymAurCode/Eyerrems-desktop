"""Town / Society hierarchy models — Town → Block → TownUnit.

Integrates with the existing Property, CRM Deal, Construction, and Finance modules.
All tables include company_id for multi-tenant isolation.

Hierarchy:
  Town (society/project)
  └── Block (phase/sector/zone)
      └── TownUnit (plot/house/apartment/shop/office/etc.)

TownTransaction records every financial event against a unit and auto-creates
a double-entry journal via the Finance module.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Index, Integer, Numeric, String, Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Town (Society / Project) ──────────────────────────────────────────────────

class Town(Base):
    __tablename__ = "towns"

    id          = Column(Integer, primary_key=True)
    tid         = Column(String(20), unique=True, nullable=False)   # TWN-0001
    name        = Column(String(200), nullable=False)
    location    = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    blocks = relationship("Block", back_populates="town", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_towns_company_id", "company_id"),
        Index("ix_towns_name", "name"),
    )


# ── Block / Phase / Sector ────────────────────────────────────────────────────

class Block(Base):
    __tablename__ = "blocks"

    id          = Column(Integer, primary_key=True)
    tid         = Column(String(20), unique=True, nullable=False)   # BLK-0001
    town_id     = Column(Integer, ForeignKey("towns.id"), nullable=False)
    name        = Column(String(200), nullable=False)
    # residential | commercial | mixed | industrial
    block_type  = Column(String(50), nullable=False, default="residential")
    description = Column(Text, nullable=True)
    # Construction tracking
    progress_percentage = Column(Float, nullable=False, default=0.0)
    work_type           = Column(String(200), nullable=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    town  = relationship("Town", back_populates="blocks")
    plots = relationship("Plot", back_populates="block", cascade="all, delete-orphan")
    units = relationship("TownUnit", back_populates="block", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_blocks_town_id", "town_id"),
        Index("ix_blocks_company_id", "company_id"),
    )


# ── Plot (legacy — kept for backward compatibility) ───────────────────────────

class Plot(Base):
    __tablename__ = "plots"

    id           = Column(Integer, primary_key=True)
    tid          = Column(String(20), unique=True, nullable=False)
    block_id     = Column(Integer, ForeignKey("blocks.id"), nullable=False, index=True)
    plot_number  = Column(String(50), nullable=False)
    size         = Column(String(80), nullable=True)
    size_sqft    = Column(Numeric(10, 2), nullable=True)
    status       = Column(String(30), nullable=False, default="available", index=True)
    plot_type    = Column(String(50), nullable=True)
    price        = Column(Numeric(14, 2), nullable=True)
    owner_name   = Column(String(200), nullable=True)
    owner_phone  = Column(String(50), nullable=True)
    notes        = Column(Text, nullable=True)
    property_id  = Column(Integer, ForeignKey("properties.id"), nullable=True, index=True)
    company_id   = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    block    = relationship("Block", back_populates="plots")
    property = relationship("Property", foreign_keys=[property_id])

    __table_args__ = ()


# ── TownUnit — the upgraded multi-type property unit ─────────────────────────

# Valid unit types
UNIT_TYPES = {
    "plot", "house", "apartment", "flat", "shop", "office",
    "plaza", "market", "warehouse", "farmhouse", "building",
    "industrial", "other",
}

# Valid categories
UNIT_CATEGORIES = {"residential", "commercial", "mixed_use", "industrial"}

# Valid statuses
UNIT_STATUSES = {
    "available", "booked", "sold", "rented",
    "under_construction", "inactive",
}


class TownUnit(Base):
    """
    A property unit within a town block.
    Replaces the plot-only model with a flexible multi-type system.

    Supports: plot, house, apartment, flat, shop, office, plaza,
              market, warehouse, farmhouse, building, industrial, other
    """
    __tablename__ = "town_units"

    # ── Identity ──────────────────────────────────────────────────────────────
    id          = Column(Integer, primary_key=True)
    tid         = Column(String(20), unique=True, nullable=False)   # TUN-0001
    unit_number = Column(String(80), nullable=False)
    title       = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    # ── Hierarchy ─────────────────────────────────────────────────────────────
    block_id    = Column(Integer, ForeignKey("blocks.id"), nullable=False, index=True)
    town_id     = Column(Integer, ForeignKey("towns.id"),  nullable=False, index=True)

    # ── Classification ────────────────────────────────────────────────────────
    unit_type   = Column(String(50), nullable=False, default="plot")
    category    = Column(String(50), nullable=False, default="residential")
    status      = Column(String(30), nullable=False, default="available", index=True)

    # ── Location details ──────────────────────────────────────────────────────
    street       = Column(String(200), nullable=True)
    sector       = Column(String(100), nullable=True)
    floor_number = Column(Integer, nullable=True)    # for apartments/flats
    size_label   = Column(String(80), nullable=True)  # "5 Marla", "10 Marla"
    size_unit    = Column(String(20), nullable=True)   # "Marla", "Kanal", "Sqft", "Sqyd"
    size_sqft    = Column(Numeric(12, 2), nullable=True)
    dimensions   = Column(String(100), nullable=True)  # "30x60 ft"

    # ── Financial ─────────────────────────────────────────────────────────────
    total_price         = Column(Numeric(16, 2), nullable=True)
    cost_price          = Column(Numeric(16, 2), nullable=True)
    booking_amount      = Column(Numeric(16, 2), nullable=True)
    monthly_installment = Column(Numeric(16, 2), nullable=True)
    installment_months  = Column(Integer, nullable=True)
    installment_available = Column(Boolean, nullable=False, default=True)
    received_amount     = Column(Numeric(16, 2), nullable=False, default=Decimal("0"))
    remaining_balance   = Column(Numeric(16, 2), nullable=True)

    # ── Ownership ─────────────────────────────────────────────────────────────
    owner_name   = Column(String(200), nullable=True)
    owner_phone  = Column(String(50),  nullable=True)
    owner_cnic   = Column(String(20),  nullable=True)
    buyer_name   = Column(String(200), nullable=True)
    buyer_phone  = Column(String(50),  nullable=True)
    tenant_name  = Column(String(200), nullable=True)
    tenant_phone = Column(String(50),  nullable=True)

    # ── Structural modifiers / optional flags ─────────────────────────────────
    is_corner           = Column(Boolean, nullable=False, default=False)
    is_facing_park      = Column(Boolean, nullable=False, default=False)
    is_main_boulevard   = Column(Boolean, nullable=False, default=False)
    is_possession_ready = Column(Boolean, nullable=False, default=False)

    # ── Links to existing modules ─────────────────────────────────────────────
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True, index=True)
    plot_id     = Column(Integer, ForeignKey("plots.id"),      nullable=True, index=True)

    # ── Meta ──────────────────────────────────────────────────────────────────
    notes      = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"),     nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    block        = relationship("Block", back_populates="units")
    town         = relationship("Town")
    property     = relationship("Property", foreign_keys=[property_id])
    plot         = relationship("Plot", foreign_keys=[plot_id])
    transactions = relationship("TownTransaction", back_populates="unit",
                                cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_town_units_unit_type", "unit_type"),
    )


# ── TownTransaction — financial events against a unit ────────────────────────

TRANSACTION_TYPES = {
    "booking", "installment", "sale", "rent",
    "refund", "transfer", "adjustment",
}

PAYMENT_METHODS = {"cash", "bank", "cheque", "online", "other"}


class TownTransaction(Base):
    """
    Records every financial event against a town unit.
    Linked to the Finance module via journal_id for double-entry accounting.
    """
    __tablename__ = "town_transactions"

    id               = Column(Integer, primary_key=True)
    tid              = Column(String(20), unique=True, nullable=False)  # TTX-0001
    town_unit_id     = Column(Integer, ForeignKey("town_units.id"), nullable=True, index=True)
    town_id          = Column(Integer, ForeignKey("towns.id"),      nullable=True, index=True)
    block_id         = Column(Integer, ForeignKey("blocks.id"),     nullable=True)
    transaction_type = Column(String(50), nullable=False, index=True)
    amount           = Column(Numeric(16, 2), nullable=False)
    payment_method   = Column(String(50), nullable=True)
    reference_no     = Column(String(100), nullable=True)
    description      = Column(Text, nullable=True)
    transaction_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Finance module link — set after journal is created
    journal_id       = Column(Integer, ForeignKey("journals.id"), nullable=True)
    payer_name       = Column(String(200), nullable=True)
    payer_phone      = Column(String(50),  nullable=True)
    company_id       = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_by       = Column(Integer, ForeignKey("users.id"),     nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)

    unit    = relationship("TownUnit", back_populates="transactions")
    journal = relationship("Journal", foreign_keys=[journal_id])

    __table_args__ = ()


def sync_town_unit_columns(db) -> None:
    """Startup schema sync - automatically creates extended metadata columns on PostgreSQL if missing."""
    import sqlalchemy as sa
    engine = db.get_bind()
    inspector = sa.inspect(engine)
    columns = [c["name"] for c in inspector.get_columns("town_units")]

    alterations = [
        ("size_unit", "VARCHAR(20)"),
        ("cost_price", "NUMERIC(16, 2)"),
        ("installment_available", "BOOLEAN DEFAULT TRUE"),
        ("is_corner", "BOOLEAN DEFAULT FALSE"),
        ("is_facing_park", "BOOLEAN DEFAULT FALSE"),
        ("is_main_boulevard", "BOOLEAN DEFAULT FALSE"),
        ("is_possession_ready", "BOOLEAN DEFAULT FALSE"),
        ("created_by", "INTEGER"),
    ]

    with engine.begin() as conn:
        for col_name, col_type in alterations:
            if col_name not in columns:
                try:
                    conn.execute(sa.text(f"ALTER TABLE town_units ADD COLUMN {col_name} {col_type};"))
                    print(f"[REMS Migration] Added column '{col_name}' to 'town_units' table successfully.")
                except Exception as exc:
                    print(f"[REMS Migration] Error adding column '{col_name}': {exc}")
