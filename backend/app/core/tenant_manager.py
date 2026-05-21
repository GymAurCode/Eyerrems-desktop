import logging
import os
import re
import threading
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings

log = logging.getLogger("rems.tenant_manager")

# Create local databases directory under the backend folder
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATABASES_DIR = BASE_DIR / "databases"
DATABASES_DIR.mkdir(parents=True, exist_ok=True)

class TenantManager:
    """
    Manages and caches connections (engines and session makers) for:
      - The master database (companies, system settings, super admins)
      - Tenant databases (isolated company databases)
    
    Ensures safe initialization of new company database files on-demand.
    """
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super(TenantManager, cls).__new__(cls, *args, **kwargs)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        self.engines: Dict[str, any] = {}
        self.sessionmakers: Dict[str, sessionmaker] = {}
        
        # Resolve master database URL (default to sqlite if not defined/empty)
        db_url = settings.database_url
        if not db_url:
            self.master_db_path = str(DATABASES_DIR / "master.db")
            db_url = f"sqlite:///{self.master_db_path}"
        elif db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
            
        self.master_db_url = db_url
        
        # Build master database engine
        self._get_or_create_engine("master", self.master_db_url)
        self._initialized = True
        log.info(f"[TenantManager] Initialized master database engine.")

    def sanitize_slug(self, slug: str) -> str:
        """Sanitize slug to prevent directory traversal or malformed file names."""
        if not slug:
            raise ValueError("Company slug cannot be empty")
        # Allow only alphanumeric, hyphens, and underscores
        clean_slug = re.sub(r"[^a-zA-Z0-9_\-]", "", slug)
        if not clean_slug or clean_slug in ("master", "default"):
            raise ValueError(f"Invalid company slug: '{slug}'")
        return clean_slug

    def get_tenant_db_path(self, slug: str) -> str:
        """Resolve absolute path to tenant's database file safely."""
        clean_slug = self.sanitize_slug(slug)
        db_path = DATABASES_DIR / f"company_{clean_slug}.db"
        # Ensure it resolves inside the DATABASES_DIR to prevent path traversal
        if not str(db_path.resolve()).startswith(str(DATABASES_DIR.resolve())):
            raise ValueError("Path traversal detected in slug")
        return str(db_path)

    def _get_or_create_engine(self, key: str, db_url: str):
        """Retrieve cached engine & sessionmaker or create new ones safely."""
        if key in self.engines:
            return self.engines[key], self.sessionmakers[key]

        with self._lock:
            if key in self.engines:
                return self.engines[key], self.sessionmakers[key]

            log.info(f"[TenantManager] Creating engine for '{key}' with URL: {db_url}")
            
            is_sqlite = db_url.startswith("sqlite")
            connect_args = {}
            if is_sqlite:
                connect_args["check_same_thread"] = False
                
            engine = create_engine(
                db_url,
                connect_args=connect_args,
                pool_pre_ping=True
            )

            if is_sqlite:
                @event.listens_for(engine, "connect")
                def set_sqlite_pragma(dbapi_connection, connection_record):
                    cursor = dbapi_connection.cursor()
                    cursor.execute("PRAGMA foreign_keys=ON")
                    cursor.execute("PRAGMA journal_mode=WAL")
                    cursor.close()

            SessionClass = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            
            self.engines[key] = engine
            self.sessionmakers[key] = SessionClass
            return engine, SessionClass

    def get_master_session(self) -> Session:
        """Get a DB session to the master database."""
        _, SessionClass = self._get_or_create_engine("master", self.master_db_url)
        return SessionClass()

    def get_tenant_session(self, slug: str) -> Session:
        """Get a DB session for a specific company slug dynamically."""
        db_path = self.get_tenant_db_path(slug)
        db_url = f"sqlite:///{db_path}"
        _, SessionClass = self._get_or_create_engine(slug, db_url)
        return SessionClass()

    def get_tenant_session_by_id(self, company_id: int) -> Optional[Session]:
        """Resolves slug from master db and returns tenant session."""
        if not company_id:
            return None
            
        master_db = self.get_master_session()
        try:
            from app.models.company import Company
            company = master_db.query(Company).filter(Company.id == company_id).first()
            if not company:
                log.warning(f"[TenantManager] Company ID {company_id} not found in master database")
                return None
            return self.get_tenant_session(company.slug)
        finally:
            master_db.close()

    def initialize_tenant_db(self, company_id: int, slug: str):
        """
        Creates SQLite database file, creates all tables from metadata,
        and seeds default Chart of Accounts, features and roles.
        """
        db_path = self.get_tenant_db_path(slug)
        log.info(f"[TenantManager] Creating/initializing isolated tenant database: {db_path}")

        # Ensure directory exists
        DATABASES_DIR.mkdir(parents=True, exist_ok=True)
        
        # Get engine & session maker for tenant
        db_url = f"sqlite:///{db_path}"
        engine, SessionClass = self._get_or_create_engine(slug, db_url)
        
        # Create all tables programmatically
        from app.core.database import Base
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            # SQLite raises an OperationalError if an index already exists.
            # We ignore duplicate index errors to make initialization idempotent.
            if "already exists" in str(e):
                log.warning(f"[TenantManager] Duplicate index ignored during init: {e}")
            else:
                raise
        log.info(f"[TenantManager] Created schema successfully for company '{slug}'")

        # Seed data
        db = SessionClass()
        try:
            # 1. Seed Chart of Accounts
            from app.core.default_coa import seed_default_coa
            seeded_coa = seed_default_coa(db)
            if seeded_coa:
                log.info(f"[TenantManager] Seeded default Chart of Accounts for company '{slug}'")

            # 2. Seed Default Features
            from app.models.company import CompanyFeature
            for feature_key in CompanyFeature.DEFAULT_FEATURES:
                db.add(CompanyFeature(company_id=company_id, feature_key=feature_key, enabled=True))
            
            # 3. Seed Default Permissions and Roles
            from app.services.rbac_service import RBACService
            from app.models.auth import Permission, Role
            
            RBACService.seed_default_permissions(db)
            all_permissions = db.query(Permission).all()
            
            roles_config = {
                "Admin": {
                    "description": "Full system access — all permissions",
                    "permissions": all_permissions,
                },
                "Manager": {
                    "description": "Department management access",
                    "permissions": db.query(Permission).filter(
                        Permission.name.in_([
                            "user.view", "dashboard.view", "dashboard:view",
                            "hr.view", "hr.create", "hr.update",
                            "finance.view", "finance.create", "finance.update",
                            "crm.view", "crm.create", "crm.update",
                            "property.view", "property.create", "property.update",
                            "tenant.view", "tenant.create", "tenant.update",
                            "construction.view", "construction.create", "construction.update",
                        ])
                    ).all(),
                },
                "Staff": {
                    "description": "Basic staff access",
                    "permissions": db.query(Permission).filter(
                        Permission.name.in_([
                            "dashboard.view", "dashboard:view",
                            "hr.view", "finance.view",
                            "crm.view", "crm.create", "crm.update",
                            "property.view", "tenant.view", "construction.view",
                            "mail.view", "mail.send",
                        ])
                    ).all(),
                },
            }

            for role_name, config in roles_config.items():
                role = Role(
                    name=role_name,
                    description=config["description"],
                    company_id=company_id,
                    permissions=config["permissions"],
                )
                db.add(role)
            
            db.commit()
            log.info(f"[TenantManager] Successfully completed seeding for company '{slug}'")
        except Exception as e:
            db.rollback()
            log.error(f"[TenantManager] Error seeding tenant database: {e}", exc_info=True)
            raise e
        finally:
            db.close()

# Export singleton instance
tenant_manager = TenantManager()
