from datetime import datetime
from sqlalchemy.orm import Session
from app.models.finance import Account

# fmt: off
DEFAULT_ACCOUNTS = [
    # ── ASSETS (1xxx) ────────────────────────────────────────────────────────
    {"code": "1000", "name": "Assets",                  "type": "Asset",     "parent": None,   "desc": "All asset accounts"},
    {"code": "1010", "name": "Cash on Hand",            "type": "Asset",     "parent": "1000", "desc": "Physical cash on hand"},
    {"code": "1100", "name": "Main Bank Account",       "type": "Asset",     "parent": "1000", "desc": "Primary operating bank account"},
    {"code": "1200", "name": "Accounts Receivable",     "type": "Asset",     "parent": "1000", "desc": "Amounts owed by clients/tenants"},
    {"code": "1210", "name": "Rent Receivable",         "type": "Asset",     "parent": "1200", "desc": "Rent due from tenants"},
    {"code": "1220", "name": "Commission Receivable",   "type": "Asset",     "parent": "1200", "desc": "Commission due from deals"},
    {"code": "1300", "name": "Advance Receivable",      "type": "Asset",     "parent": "1000", "desc": "Advance payments made"},

    # ── LIABILITIES (2xxx) ───────────────────────────────────────────────────
    {"code": "2000", "name": "Liabilities",             "type": "Liability", "parent": None,   "desc": "All liability accounts"},
    {"code": "2100", "name": "Accounts Payable",        "type": "Liability", "parent": "2000", "desc": "Amounts owed to vendors"},
    {"code": "2200", "name": "Security Deposits",       "type": "Liability", "parent": "2000", "desc": "Tenant security deposits held"},
    {"code": "2300", "name": "Accrued Expenses",        "type": "Liability", "parent": "2000", "desc": "Expenses incurred but not yet paid"},
    {"code": "2400", "name": "Deferred Revenue",        "type": "Liability", "parent": "2000", "desc": "Advance rent received"},

    # ── EQUITY (3xxx) ────────────────────────────────────────────────────────
    {"code": "3000", "name": "Equity",                  "type": "Equity",    "parent": None,   "desc": "Owner equity accounts"},
    {"code": "3100", "name": "Owner Capital",           "type": "Equity",    "parent": "3000", "desc": "Owner investment capital"},
    {"code": "3200", "name": "Retained Earnings",       "type": "Equity",    "parent": "3000", "desc": "Accumulated profits retained"},
    {"code": "3300", "name": "Owner Drawings",          "type": "Equity",    "parent": "3000", "desc": "Owner withdrawals"},

    # ── INCOME (4xxx) ────────────────────────────────────────────────────────
    {"code": "4000", "name": "Income",                  "type": "Income",    "parent": None,   "desc": "All income accounts"},
    {"code": "4100", "name": "Rent Income",             "type": "Income",    "parent": "4000", "desc": "Rental income from properties"},
    {"code": "4200", "name": "Commission Income",       "type": "Income",    "parent": "4000", "desc": "Commission earned on deals"},
    {"code": "4300", "name": "Other Income",            "type": "Income",    "parent": "4000", "desc": "Miscellaneous income"},
    {"code": "4400", "name": "Late Fee Income",         "type": "Income",    "parent": "4000", "desc": "Late payment fees charged"},
    {"code": "4500", "name": "Property Sales Income",   "type": "Income",    "parent": "4000", "desc": "Property sale revenue"},
    {"code": "4510", "name": "Booking Income",          "type": "Income",    "parent": "4000", "desc": "Booking token/advance income"},
    {"code": "4520", "name": "Installment Income",      "type": "Income",    "parent": "4000", "desc": "Installment payment income"},

    # ── EXPENSES (5xxx) ──────────────────────────────────────────────────────
    {"code": "5000", "name": "Expenses",                "type": "Expense",   "parent": None,   "desc": "All expense accounts"},
    {"code": "5100", "name": "Maintenance Expense",     "type": "Expense",   "parent": "5000", "desc": "Property maintenance and repairs"},
    {"code": "5200", "name": "Utility Expense",         "type": "Expense",   "parent": "5000", "desc": "Electricity, water, gas"},
    {"code": "5300", "name": "Salary Expense",          "type": "Expense",   "parent": "5000", "desc": "Staff salaries and wages"},
    {"code": "5400", "name": "General Expense",         "type": "Expense",   "parent": "5000", "desc": "General operating expenses"},
    {"code": "5500", "name": "Marketing Expense",       "type": "Expense",   "parent": "5000", "desc": "Advertising and marketing costs"},
    {"code": "5600", "name": "Depreciation Expense",    "type": "Expense",   "parent": "5000", "desc": "Asset depreciation charges"},
]
# fmt: on

# System accounts that cannot be deleted
SYSTEM_ACCOUNT_CODES = {
    "1000", "1010", "1100", "1200",
    "2000", "2100", "2200",
    "3000", "3100", "3200",
    "4000", "4100", "4200", "4500", "4510", "4520",
    "5000", "5100", "5200", "5300",
}


def seed_default_coa(db: Session) -> bool:
    if db.query(Account).count() > 0:
        return False

    code_to_id: dict[str, int] = {}
    for entry in DEFAULT_ACCOUNTS:
        parent_id = code_to_id.get(entry["parent"]) if entry["parent"] else None
        account = Account(
            code=entry["code"],
            name=entry["name"],
            account_type=entry["type"],
            description=entry["desc"],
            parent_id=parent_id,
            is_active=True,
            is_system_account=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(account)
        db.flush()
        code_to_id[entry["code"]] = account.id

    db.commit()
    return True
