"""Auth models — User, Role, Permission with full multi-tenant support."""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from app.core.database import Base

# ── Association tables ────────────────────────────────────────────────────────

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


# ── Role ─────────────────────────────────────────────────────────────────────

class Role(Base):
    __tablename__ = "roles"

    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    # NULL company_id = system-wide role (used by super-admin / seed data)
    name        = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    users       = relationship("User", secondary=user_roles, back_populates="roles")
    company     = relationship("Company", foreign_keys=[company_id])


# ── Permission ────────────────────────────────────────────────────────────────

class Permission(Base):
    __tablename__ = "permissions"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(120), unique=True, nullable=False, index=True)  # e.g. "hr.view"
    module      = Column(String(50), nullable=False, index=True)                # e.g. "HR"
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")
    users = relationship("User", secondary=user_permissions, back_populates="direct_permissions")


# ── User ──────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    # ── Multi-tenant fields ──────────────────────────────────────────────────
    company_id       = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    is_super_admin   = Column(Boolean, nullable=False, default=False)
    # ────────────────────────────────────────────────────────────────────────
    email            = Column(String(255), nullable=False, index=True)
    # NOTE: email is unique *per company* — enforced at application layer
    full_name        = Column(String(120), nullable=False)
    hashed_password  = Column(String(255), nullable=False)

    # Status
    status           = Column(String(20), nullable=False, default="pending", index=True)
    is_approved      = Column(Boolean, default=False, nullable=False)
    is_active        = Column(Boolean, default=True, nullable=False)

    # Approval tracking
    approved_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at      = Column(DateTime, nullable=True)

    # Legacy compat
    approval_status  = Column(String(20), nullable=False, default="pending")
    role_id          = Column(Integer, ForeignKey("roles.id"), nullable=True)

    # Timestamps
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login       = Column(DateTime, nullable=True)

    # Relationships
    company          = relationship("Company", foreign_keys=[company_id], back_populates="users")
    role             = relationship("Role", foreign_keys=[role_id])
    roles            = relationship("Role", secondary=user_roles, back_populates="users")
    direct_permissions = relationship("Permission", secondary=user_permissions, back_populates="users")
    approver         = relationship("User", remote_side=[id], foreign_keys=[approved_by])

    # ── Permission helpers ────────────────────────────────────────────────────

    def get_all_permissions(self) -> set[str]:
        """Aggregate permissions from all assigned roles + direct overrides."""
        perms: set[str] = set()
        for role in self.roles:
            for p in role.permissions:
                perms.add(p.name)
        for p in self.direct_permissions:
            perms.add(p.name)
        if not self.roles and self.role:
            for p in self.role.permissions:
                perms.add(p.name)
        return perms

    def has_permission(self, name: str) -> bool:
        return name in self.get_all_permissions()

    def has_any_permission(self, *names: str) -> bool:
        perms = self.get_all_permissions()
        return any(n in perms for n in names)

    def has_all_permissions(self, *names: str) -> bool:
        perms = self.get_all_permissions()
        return all(n in perms for n in names)
