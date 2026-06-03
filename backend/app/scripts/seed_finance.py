"""
Finance Module Seed Script

Initializes chart of accounts with the standard structure defined in
default_coa.py. Run this ONCE after applying the finance migration.

Usage:
    python -m app.scripts.seed_finance
"""

from datetime import datetime

from sqlalchemy.orm import Session
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[2]))

from app.core.database import SessionLocal
from app.models.finance import Account
from app.core.default_coa import DEFAULT_ACCOUNTS, SYSTEM_ACCOUNT_CODES


def seed_chart_of_accounts(db: Session) -> None:
    """Initialize chart of accounts, only adding missing ones."""
    existing = {a.code: a.id for a in db.query(Account).all()}
    created = 0

    for entry in DEFAULT_ACCOUNTS:
        if entry["code"] in existing:
            continue
        parent_id = existing.get(entry["parent"]) if entry.get("parent") else None
        account = Account(
            code=entry["code"],
            name=entry["name"],
            account_type=entry["type"],
            parent_id=parent_id,
            description=entry.get("desc"),
            is_active=True,
            is_system_account=entry["code"] in SYSTEM_ACCOUNT_CODES,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(account)
        db.flush()
        existing[entry["code"]] = account.id
        created += 1

    db.commit()
    print(f"✓ Initialized {created} new accounts (total: {db.query(Account).count()})")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_chart_of_accounts(db)
        print("✓ Finance seed completed")
    except Exception as e:
        print(f"✗ Error: {e}")
        db.rollback()
    finally:
        db.close()
