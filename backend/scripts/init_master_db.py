import logging
from app.core.tenant_manager import tenant_manager
from app.core.database import Base
from app.models.company import Company
from sqlalchemy.orm import Session

log = logging.getLogger("rems.init_master")

def init_master_db():
    # Ensure master DB schema exists
    engine = tenant_manager.engines["master"]
    Base.metadata.create_all(bind=engine)
    # Create a session
    SessionLocal = tenant_manager.sessionmakers["master"]
    db: Session = SessionLocal()
    try:
        # Check if default company exists
        default = db.query(Company).filter(Company.slug == "default").first()
        if not default:
            default = Company(name="Default Company", slug="default", status="active", plan="free", currency_code="PKR")
            db.add(default)
            db.commit()
            log.info("[Init] Created default company in master DB.")
        else:
            log.info("[Init] Default company already present.")
    except Exception as e:
        db.rollback()
        log.error(f"[Init] Failed to initialize master DB: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_master_db()
