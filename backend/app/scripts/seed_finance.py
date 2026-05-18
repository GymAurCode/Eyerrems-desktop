"""
Finance Module Seed Script

Initializes chart of accounts with standard accounting structure.
Run this ONCE after applying the finance migration.
"""

from decimal import Decimal
from datetime import datetime

from sqlalchemy.orm import Session

# Adjust import path when running script directly
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[2]))

from app.core.database import SessionLocal
from app.models.finance import Account


# Standard Chart of Accounts
CHART_OF_ACCOUNTS = [
    # ASSETS
    {"code": "1000", "name": "Bank Account", "account_type": "Asset", "parent_code": None},
    {"code": "1100", "name": "Cash", "account_type": "Asset", "parent_code": None},
    {"code": "1200", "name": "Accounts Receivable", "account_type": "Asset", "parent_code": None},
    {"code": "1210", "name": "Allowance for Doubtful Accounts", "account_type": "Asset", "parent_code": "1200"},
    {"code": "1250", "name": "Commission Receivable", "account_type": "Asset", "parent_code": None},
    {"code": "1300", "name": "Prepaid Expenses", "account_type": "Asset", "parent_code": None},
    {"code": "1500", "name": "Property & Equipment", "account_type": "Asset", "parent_code": None},
    {"code": "1550", "name": "Accumulated Depreciation", "account_type": "Asset", "parent_code": None},

    # LIABILITIES
    {"code": "2000", "name": "Accounts Payable", "account_type": "Liability", "parent_code": None},
    {"code": "2100", "name": "Accrued Expenses", "account_type": "Liability", "parent_code": None},
    {"code": "2200", "name": "Tenant Deposits", "account_type": "Liability", "parent_code": None},
    {"code": "2300", "name": "Short-term Debt", "account_type": "Liability", "parent_code": None},
    {"code": "2500", "name": "Long-term Debt", "account_type": "Liability", "parent_code": None},

    # EQUITY
    {"code": "3000", "name": "Owner's Capital", "account_type": "Equity", "parent_code": None},
    {"code": "3100", "name": "Retained Earnings", "account_type": "Equity", "parent_code": None},
    {"code": "3200", "name": "Owner's Draws", "account_type": "Equity", "parent_code": None},

    # INCOME
    {"code": "4100", "name": "Rent Income", "account_type": "Income", "parent_code": None},
    {"code": "4110", "name": "Residential Rent", "account_type": "Income", "parent_code": "4100"},
    {"code": "4120", "name": "Commercial Rent", "account_type": "Income", "parent_code": "4100"},
    {"code": "4200", "name": "Commission Income", "account_type": "Income", "parent_code": None},
    {"code": "4300", "name": "Late Fees", "account_type": "Income", "parent_code": None},
    {"code": "4400", "name": "Miscellaneous Income", "account_type": "Income", "parent_code": None},

    # EXPENSES
    {"code": "5000", "name": "Property Maintenance", "account_type": "Expense", "parent_code": None},
    {"code": "5010", "name": "Repairs & Maintenance", "account_type": "Expense", "parent_code": "5000"},
    {"code": "5020", "name": "Utilities", "account_type": "Expense", "parent_code": "5000"},
    {"code": "5030", "name": "Cleaning & Janitorial", "account_type": "Expense", "parent_code": "5000"},
    {"code": "5100", "name": "Property Management Fees", "account_type": "Expense", "parent_code": None},
    {"code": "5200", "name": "Commission Expense", "account_type": "Expense", "parent_code": None},
    {"code": "5300", "name": "Depreciation Expense", "account_type": "Expense", "parent_code": None},
    {"code": "5400", "name": "Property Taxes", "account_type": "Expense", "parent_code": None},
    {"code": "5500", "name": "Insurance", "account_type": "Expense", "parent_code": None},
    {"code": "5600", "name": "Administrative Expenses", "account_type": "Expense", "parent_code": None},
    {"code": "5610", "name": "Office Supplies", "account_type": "Expense", "parent_code": "5600"},
    {"code": "5620", "name": "Professional Fees", "account_type": "Expense", "parent_code": "5600"},
    {"code": "5630", "name": "Accounting & Bookkeeping", "account_type": "Expense", "parent_code": "5600"},
    {"code": "5700", "name": "Advertising & Marketing", "account_type": "Expense", "parent_code": None},
    {"code": "5800", "name": "Interest Expense", "account_type": "Expense", "parent_code": None},
    {"code": "5900", "name": "Miscellaneous Expenses", "account_type": "Expense", "parent_code": None},
]


def seed_chart_of_accounts(db: Session) -> None:
    """Initialize chart of accounts"""
    existing = db.query(Account).count()
    if existing > 0:
        print("Chart of accounts already exists. Skipping seed.")
        return

    accounts_by_code: dict[str, int] = {}

    for acc_data in CHART_OF_ACCOUNTS:
        parent_id = None
        if acc_data["parent_code"]:
            parent_id = accounts_by_code.get(acc_data["parent_code"])

        account = Account(
            code=acc_data["code"],
            name=acc_data["name"],
            account_type=acc_data["account_type"],
            parent_id=parent_id,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(account)
        db.flush()
        accounts_by_code[acc_data["code"]] = account.id

    db.commit()
    print(f"✓ Initialized {len(CHART_OF_ACCOUNTS)} accounts")


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
