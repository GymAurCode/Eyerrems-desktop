"""Company (SaaS Tenant) model — one row per customer company."""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(200), nullable=False)
    slug          = Column(String(100), unique=True, nullable=False, index=True)
    status        = Column(String(20), nullable=False, default="active", index=True)   # active | suspended
    plan          = Column(String(30), nullable=False, default="free")                 # free | premium | enterprise
    currency_code = Column(String(10), nullable=False, default="PKR")                 # PKR | USD
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    features = relationship("CompanyFeature", back_populates="company", cascade="all, delete-orphan")
    users    = relationship("User", back_populates="company", foreign_keys="User.company_id")


class CompanyFeature(Base):
    """Per-company feature flags — controls which modules are enabled."""
    __tablename__ = "company_features"

    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_key = Column(String(80), nullable=False)   # hr_module, finance_module, ai_module …
    enabled     = Column(Boolean, nullable=False, default=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company", back_populates="features")

    # Default feature set applied to every new company
    DEFAULT_FEATURES: list[str] = [
        "property_module",
        "crm_module",
        "finance_module",
        "tenant_module",
        "construction_module",
        "hr_module",
        "mail_module",
        "reminders_module",
    ]
