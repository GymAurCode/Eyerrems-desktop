"""
RBAC Service - Role-Based Access Control Business Logic
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.auth import Permission, Role, User


class RBACService:
    """Service for managing roles, permissions, and user access"""
    
    @staticmethod
    def get_role_by_id(db: Session, role_id: int) -> Optional[Role]:
        """Get role by ID with permissions loaded"""
        return (
            db.query(Role)
            .options(joinedload(Role.permissions))
            .filter(Role.id == role_id)
            .first()
        )
    
    @staticmethod
    def get_role_by_name(db: Session, name: str) -> Optional[Role]:
        """Get role by name with permissions loaded"""
        return (
            db.query(Role)
            .options(joinedload(Role.permissions))
            .filter(Role.name == name)
            .first()
        )
    
    @staticmethod
    def list_roles(db: Session, skip: int = 0, limit: int = 100) -> list[Role]:
        """List all roles"""
        return (
            db.query(Role)
            .options(joinedload(Role.permissions))
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    @staticmethod
    def create_role(
        db: Session, 
        name: str, 
        description: Optional[str] = None,
        permission_ids: Optional[list[int]] = None
    ) -> Role:
        """Create a new role"""
        # Check if role already exists
        existing = db.query(Role).filter(Role.name == name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{name}' already exists"
            )
        
        role = Role(name=name, description=description)
        
        # Assign permissions if provided
        if permission_ids:
            permissions = db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
            if len(permissions) != len(permission_ids):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One or more permission IDs are invalid"
                )
            role.permissions = permissions
        
        db.add(role)
        db.flush()
        db.refresh(role)
        return role
    
    @staticmethod
    def update_role(
        db: Session,
        role_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        permission_ids: Optional[list[int]] = None
    ) -> Role:
        """Update an existing role"""
        role = RBACService.get_role_by_id(db, role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )
        
        # Check name uniqueness if changing
        if name and name != role.name:
            existing = db.query(Role).filter(Role.name == name).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role '{name}' already exists"
                )
            role.name = name
        
        if description is not None:
            role.description = description
        
        # Update permissions if provided
        if permission_ids is not None:
            permissions = db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
            if len(permissions) != len(permission_ids):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One or more permission IDs are invalid"
                )
            role.permissions = permissions
        
        db.flush()
        db.refresh(role)
        return role
    
    @staticmethod
    def delete_role(db: Session, role_id: int) -> bool:
        """Delete a role"""
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )
        
        # Check if role is assigned to any users
        if role.users:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete role '{role.name}' - it is assigned to {len(role.users)} user(s)"
            )
        
        db.delete(role)
        db.flush()
        return True
    
    @staticmethod
    def get_permission_by_id(db: Session, permission_id: int) -> Optional[Permission]:
        """Get permission by ID"""
        return db.query(Permission).filter(Permission.id == permission_id).first()
    
    @staticmethod
    def get_permission_by_name(db: Session, name: str) -> Optional[Permission]:
        """Get permission by name"""
        return db.query(Permission).filter(Permission.name == name).first()
    
    @staticmethod
    def list_permissions(
        db: Session, 
        module: Optional[str] = None,
        skip: int = 0, 
        limit: int = 500
    ) -> list[Permission]:
        """List all permissions, optionally filtered by module"""
        query = db.query(Permission)
        
        if module:
            query = query.filter(Permission.module == module)
        
        return query.order_by(Permission.module, Permission.name).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_modules(db: Session) -> list[str]:
        """Get list of all unique modules"""
        result = db.query(Permission.module).distinct().order_by(Permission.module).all()
        return [row[0] for row in result]
    
    @staticmethod
    def create_permission(
        db: Session,
        name: str,
        module: str,
        description: Optional[str] = None
    ) -> Permission:
        """Create a new permission"""
        # Check if permission already exists
        existing = db.query(Permission).filter(Permission.name == name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Permission '{name}' already exists"
            )
        
        permission = Permission(name=name, module=module, description=description)
        db.add(permission)
        db.flush()
        db.refresh(permission)
        return permission
    
    @staticmethod
    def assign_roles_to_user(db: Session, user_id: int, role_ids: list[int]) -> User:
        """Assign multiple roles to a user"""
        user = (
            db.query(User)
            .options(joinedload(User.roles))
            .filter(User.id == user_id)
            .first()
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        roles = db.query(Role).filter(Role.id.in_(role_ids)).all()
        if len(roles) != len(role_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more role IDs are invalid"
            )
        
        user.roles = roles
        db.flush()
        db.refresh(user)
        return user
    
    @staticmethod
    def assign_permissions_to_user(
        db: Session, 
        user_id: int, 
        permission_ids: list[int]
    ) -> User:
        """Assign direct permission overrides to a user"""
        user = (
            db.query(User)
            .options(joinedload(User.direct_permissions))
            .filter(User.id == user_id)
            .first()
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        permissions = db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
        if len(permissions) != len(permission_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more permission IDs are invalid"
            )
        
        user.direct_permissions = permissions
        db.flush()
        db.refresh(user)
        return user
    
    @staticmethod
    def get_user_permissions(db: Session, user_id: int) -> set[str]:
        """Get all permissions for a user (from roles + direct)"""
        user = (
            db.query(User)
            .options(
                joinedload(User.roles).joinedload(Role.permissions),
                joinedload(User.direct_permissions),
                joinedload(User.role).joinedload(Role.permissions)
            )
            .filter(User.id == user_id)
            .first()
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return user.get_all_permissions()
    
    @staticmethod
    def check_user_permission(db: Session, user_id: int, permission_name: str) -> bool:
        """Check if user has a specific permission"""
        permissions = RBACService.get_user_permissions(db, user_id)
        return permission_name in permissions
    
    @staticmethod
    def seed_default_permissions(db: Session) -> list[Permission]:
        """Seed default permissions for all modules"""
        default_permissions = [
            # Admin/User Management
            ("user.view", "Admin", "View users"),
            ("user.create", "Admin", "Create users"),
            ("user.update", "Admin", "Update users"),
            ("user.delete", "Admin", "Delete users"),
            ("user.approve", "Admin", "Approve/reject user registrations"),
            ("user.manage", "Admin", "Full user management"),
            
            # Role Management
            ("role.view", "Admin", "View roles"),
            ("role.create", "Admin", "Create roles"),
            ("role.update", "Admin", "Update roles"),
            ("role.delete", "Admin", "Delete roles"),
            ("role.assign", "Admin", "Assign roles to users"),
            
            # Permission Management
            ("permission.view", "Admin", "View permissions"),
            ("permission.assign", "Admin", "Assign permissions"),
            
            # Audit Logs
            ("audit.view", "Admin", "View audit logs"),
            
            # Dashboard
            ("dashboard.view", "Dashboard", "View dashboard"),
            
            # HR Module
            ("hr.view", "HR", "View HR data"),
            ("hr.create", "HR", "Create HR records"),
            ("hr.update", "HR", "Update HR records"),
            ("hr.delete", "HR", "Delete HR records"),
            ("hr.manage", "HR", "Full HR management"),
            
            # Finance Module
            ("finance.view", "Finance", "View financial data"),
            ("finance.create", "Finance", "Create financial records"),
            ("finance.update", "Finance", "Update financial records"),
            ("finance.delete", "Finance", "Delete financial records"),
            ("finance.approve", "Finance", "Approve financial transactions"),
            ("finance.manage", "Finance", "Full finance management"),
            
            # CRM Module
            ("crm.view", "CRM", "View CRM data"),
            ("crm.create", "CRM", "Create CRM records"),
            ("crm.update", "CRM", "Update CRM records"),
            ("crm.delete", "CRM", "Delete CRM records"),
            ("crm.manage", "CRM", "Full CRM management"),
            
            # Property Module
            ("property.view", "Property", "View properties"),
            ("property.create", "Property", "Create properties"),
            ("property.update", "Property", "Update properties"),
            ("property.delete", "Property", "Delete properties"),
            ("property.manage", "Property", "Full property management"),
            
            # Tenant Module
            ("tenant.view", "Tenant", "View tenants"),
            ("tenant.create", "Tenant", "Create tenants"),
            ("tenant.update", "Tenant", "Update tenants"),
            ("tenant.delete", "Tenant", "Delete tenants"),
            ("tenant.manage", "Tenant", "Full tenant management"),
            
            # Construction Module
            ("construction.view", "Construction", "View construction projects"),
            ("construction.create", "Construction", "Create construction records"),
            ("construction.update", "Construction", "Update construction records"),
            ("construction.delete", "Construction", "Delete construction records"),
            ("construction.manage", "Construction", "Full construction management"),
            
            # Mail Module
            ("mail.view", "Mail", "View emails"),
            ("mail.send", "Mail", "Send emails"),
            ("mail.manage", "Mail", "Manage email accounts"),
            
            # Legacy permissions for backward compatibility
            ("users:manage", "Admin", "Legacy: Manage users"),
            ("dashboard:view", "Dashboard", "Legacy: View dashboard"),
        ]
        
        created_permissions = []
        for name, module, description in default_permissions:
            existing = db.query(Permission).filter(Permission.name == name).first()
            if not existing:
                perm = Permission(name=name, module=module, description=description)
                db.add(perm)
                created_permissions.append(perm)
        
        if created_permissions:
            db.flush()
        
        return created_permissions
    
    @staticmethod
    def seed_default_roles(db: Session) -> list[Role]:
        """Seed default roles with permissions"""
        # Ensure permissions exist
        RBACService.seed_default_permissions(db)
        
        # Get ALL permissions for Admin
        all_permissions = db.query(Permission).all()
        
        # Define default roles
        roles_config = {
            "Admin": {
                "description": "Full system access - ALL PERMISSIONS",
                "permissions": [p.name for p in all_permissions]  # ALL permissions
            },
            "Manager": {
                "description": "Department management access",
                "permissions": [
                    "user.view",
                    "dashboard.view", "dashboard:view",
                    "hr.view", "hr.create", "hr.update",
                    "finance.view", "finance.create", "finance.update",
                    "crm.view", "crm.create", "crm.update",
                    "property.view", "property.create", "property.update",
                    "tenant.view", "tenant.create", "tenant.update",
                    "construction.view", "construction.create", "construction.update",
                ]
            },
            "Staff": {
                "description": "Basic staff access",
                "permissions": [
                    "dashboard.view", "dashboard:view",
                    "hr.view",
                    "finance.view",
                    "crm.view", "crm.create", "crm.update",
                    "property.view",
                    "tenant.view",
                    "construction.view",
                    "mail.view", "mail.send",
                ]
            },
        }
        
        created_roles = []
        for role_name, config in roles_config.items():
            existing = db.query(Role).filter(Role.name == role_name).first()
            if existing:
                # Update existing Admin role to have ALL permissions
                if role_name == "Admin":
                    existing.permissions = all_permissions
                    existing.description = config["description"]
                    db.flush()
                continue
            
            # Get permissions
            perms = (
                db.query(Permission)
                .filter(Permission.name.in_(config["permissions"]))
                .all()
            )
            
            role = Role(
                name=role_name,
                description=config["description"],
                permissions=perms
            )
            db.add(role)
            created_roles.append(role)
        
        if created_roles:
            db.flush()
        
        return created_roles
