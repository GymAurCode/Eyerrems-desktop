"""Town / Society hierarchy models — Town → Block → Plot.

Integrates with the existing Property, CRM Deal, and Construction modules.
All tables include company_id for multi-tenant isolation.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Index, Integer, Numeric, String, Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Town (Society) ────────────────────────────────────────────────────────────

class Town(Base):
    __tablename__ = "towns"

    id          = Column(Integer, primary_key=True)
    tid         = Column(String(20), unique=True, nullable=False)   # TWN-0001
    name        = Column(String(200), nullable=False)
    location    = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    blocks = relationship("Block", back_populates="town", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_towns_company_id", "company_id"),
    )


# ── Block / Phase ─────────────────────────────────────────────────────────────

class Block(Base):
    __tablename__ = "blocks"

    id          = Column(Integer, primary_key=True)
    tid         = Column(String(20), unique=True, nullable=False)   # BLK-0001
    town_id     = Column(Integer, ForeignKey("towns.id"), nullable=False, index=True)
    name        = Column(String(200), nullable=False)
    # residential | commercial | mixed | industrial
    block_type  = Column(String(50), nullable=False, default="residential")
    description = Column(Text, nullable=True)
    # Construction tracking fields
    progress_percentage = Column(Float, nullable=False, default=0.0)
    work_type           = Column(String(200), nullable=True)  # road, sewerage, electricity, etc.
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    town  = relationship("Town", back_populates="blocks")
    plots = relationship("Plot", back_populates="block", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_blocks_town_id", "town_id"),
        Index("ix_blocks_company_id", "company_id"),
    )


# ── Plot ──────────────────────────────────────────────────────────────────────

class Plot(Base):
    __tablename__ = "plots"

    id           = Column(Integer, primary_key=True)
    tid          = Column(String(20), unique=True, nullable=False)   # PLT-0001
    block_id     = Column(Integer, ForeignKey("blocks.id"), nullable=False, index=True)
    plot_number  = Column(String(50), nullable=False)
    size         = Column(String(80), nullable=True)    # e.g. "5 Marla", "10 Marla", "1 Kanal"
    size_sqft    = Column(Numeric(10, 2), nullable=True)
    # available | booked | sold | reserved
    status       = Column(String(30), nullable=False, default="available", index=True)
    plot_type    = Column(String(50), nullable=True)    # residential | commercial | corner | etc.
    price        = Column(Numeric(14, 2), nullable=True)
    owner_name   = Column(String(200), nullable=True)
    owner_phone  = Column(String(50), nullable=True)
    notes        = Column(Text, nullable=True)
    # Link to existing Property model (optional — for developed plots)
    property_id  = Column(Integer, ForeignKey("properties.id"), nullable=True, index=True)
    company_id   = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    block    = relationship("Block", back_populates="plots")
    property = relationship("Property", foreign_keys=[property_id])

    __table_args__ = (
        Index("ix_plots_block_id", "block_id"),
        Index("ix_plots_status", "status"),
        Index("ix_plots_company_id", "company_id"),
    )
