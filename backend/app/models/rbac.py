from sqlalchemy import (Column, String, Boolean, DateTime,
                        Integer, Text, JSON, ForeignKey)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import uuid


class RbacRole(Base):
    __tablename__ = "rbac_roles"

    id = Column(String, primary_key=True,
                default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    permissions = relationship("RolePermission",
                               back_populates="role",
                               cascade="all, delete-orphan")
    users = relationship("RoleUser", back_populates="role")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "user_count": len(self.users) if self.users else 0,
            "permissions": [p.to_dict() for p in (self.permissions or [])],
        }


class RolePermission(Base):
    __tablename__ = "rbac_role_permissions"

    id = Column(String, primary_key=True,
                default=lambda: str(uuid.uuid4()))
    role_id = Column(String, ForeignKey("rbac_roles.id"), nullable=False)

    module = Column(String(50), nullable=False)

    tab = Column(String(100), nullable=True)

    can_view = Column(Boolean, default=False)
    can_add = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)

    role = relationship("RbacRole", back_populates="permissions")

    def to_dict(self):
        return {
            "id": self.id,
            "role_id": self.role_id,
            "module": self.module,
            "tab": self.tab,
            "can_view": self.can_view,
            "can_add": self.can_add,
            "can_edit": self.can_edit,
            "can_delete": self.can_delete,
        }


class RoleUser(Base):
    __tablename__ = "rbac_role_users"

    id = Column(String, primary_key=True,
                default=lambda: str(uuid.uuid4()))
    role_id = Column(String, ForeignKey("rbac_roles.id"), nullable=False)

    full_name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(500), nullable=False)

    company_slug = Column(String(100), nullable=True)
    slug_locked = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=True)

    last_login = Column(DateTime, nullable=True)
    last_login_ip = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    role = relationship("RbacRole", back_populates="users")
    login_history = relationship("LoginHistory",
                                  back_populates="user",
                                  cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog",
                                  back_populates="user",
                                  cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "role_id": self.role_id,
            "role_name": self.role.name if self.role else None,
            "full_name": self.full_name,
            "email": self.email,
            "company_slug": self.company_slug,
            "slug_locked": self.slug_locked,
            "is_active": self.is_active,
            "must_change_password": self.must_change_password,
            "last_login": self.last_login.isoformat()
                         if self.last_login else None,
            "created_at": self.created_at.isoformat(),
        }


class LoginHistory(Base):
    __tablename__ = "rbac_login_history"

    id = Column(String, primary_key=True,
                default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("rbac_role_users.id"), nullable=False)
    user_email = Column(String(255), nullable=False)

    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)

    login_at = Column(DateTime, default=datetime.utcnow)
    logout_at = Column(DateTime, nullable=True)

    status = Column(String(20), default="success")

    failure_reason = Column(String(200), nullable=True)

    user = relationship("RoleUser", back_populates="login_history")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_email": self.user_email,
            "ip_address": self.ip_address,
            "login_at": self.login_at.isoformat(),
            "logout_at": self.logout_at.isoformat()
                        if self.logout_at else None,
            "status": self.status,
            "failure_reason": self.failure_reason,
        }


class ActivityLog(Base):
    __tablename__ = "rbac_activity_logs"

    id = Column(String, primary_key=True,
                default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("rbac_role_users.id"),
                     nullable=True)
    user_email = Column(String(255), nullable=False)
    user_name = Column(String(200), nullable=True)

    action = Column(String(50), nullable=False)

    module = Column(String(50), nullable=False)
    record_type = Column(String(100), nullable=True)
    record_id = Column(String(255), nullable=True)
    record_label = Column(String(500), nullable=True)

    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)

    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("RoleUser", back_populates="activity_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "user_email": self.user_email,
            "user_name": self.user_name,
            "action": self.action,
            "module": self.module,
            "record_type": self.record_type,
            "record_id": self.record_id,
            "record_label": self.record_label,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat(),
        }


class AdminNotification(Base):
    __tablename__ = "rbac_admin_notifications"

    id = Column(String, primary_key=True,
                default=lambda: str(uuid.uuid4()))

    type = Column(String(50), nullable=False)

    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    related_user_email = Column(String(255), nullable=True)
    related_module = Column(String(50), nullable=True)

    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "related_user_email": self.related_user_email,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }
