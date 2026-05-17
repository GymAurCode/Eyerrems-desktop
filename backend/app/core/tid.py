"""Auto-incrementing Tracking ID generator."""
from sqlalchemy import func
from sqlalchemy.orm import Session


def next_tid(db: Session, model, prefix: str) -> str:
    """Return the next TID for a model, e.g. PRO-0042."""
    count = db.query(func.count(model.id)).scalar() or 0
    return f"{prefix}-{count + 1:04d}"
