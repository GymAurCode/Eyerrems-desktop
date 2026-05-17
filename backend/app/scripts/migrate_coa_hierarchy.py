"""
COA Hierarchy Migration
-----------------------
Converts the existing flat accounts into a professional tree structure.
Safe: never deletes existing accounts, only assigns parent_id and normalises types.

Run once:
    cd backend
    python -m app.scripts.migrate_coa_hierarchy
"""
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.finance import Account

# ── Type normalisation map ────────────────────────────────────────────────────
# Old seed used lowercase / 'revenue'; model expects Title-case
TYPE_NORM = {
    "asset":     "Asset",
    "liability": "Liability",
    "equity":    "Equity",
    "revenue":   "Income",
    "income":    "Income",
    "expense":   "Expense",
}

# ── Root group definitions ────────────────────────────────────────────────────
ROOTS = [
    {"code": "1000", "name": "Assets",      "type": "Asset"},
    {"code": "2000", "name": "Liabilities", "type": "Liability"},
    {"code": "3000", "name": "Equity",      "type": "Equity"},
    {"code": "4000", "name": "Income",      "type": "Income"},
    {"code": "5000", "name": "Expenses",    "type": "Expense"},
]

# ── Existing account re-parenting map  (code → root_code) ────────────────────
# These are the 6 accounts already in the DB
REPARENT = {
    "1000": None,   # will become the Assets root itself (renamed)
    "1100": "1000", # Bank → under Assets
    "2000": None,   # will become Liabilities root
    "3000": None,   # will become Equity root
    "4000": None,   # will become Income root
    "5000": None,   # will become Expenses root
}

# ── New sub-accounts to add (if not already present) ─────────────────────────
NEW_ACCOUNTS = [
    # Assets
    {"code": "1010", "name": "Cash on Hand",          "type": "Asset",     "parent": "1000", "desc": "Physical cash"},
    {"code": "1200", "name": "Accounts Receivable",   "type": "Asset",     "parent": "1000", "desc": "Amounts owed by clients/tenants"},
    {"code": "1210", "name": "Rent Receivable",        "type": "Asset",     "parent": "1200", "desc": "Rent due from tenants"},
    {"code": "1220", "name": "Commission Receivable",  "type": "Asset",     "parent": "1200", "desc": "Commission due from deals"},
    {"code": "1300", "name": "Advance Receivable",     "type": "Asset",     "parent": "1000", "desc": "Advance payments made"},
    # Liabilities
    {"code": "2100", "name": "Accounts Payable",       "type": "Liability", "parent": "2000", "desc": "Amounts owed to vendors"},
    {"code": "2200", "name": "Security Deposits",      "type": "Liability", "parent": "2000", "desc": "Tenant security deposits held"},
    {"code": "2300", "name": "Accrued Expenses",       "type": "Liability", "parent": "2000", "desc": "Expenses incurred but not paid"},
    # Income
    {"code": "4100", "name": "Rent Income",            "type": "Income",    "parent": "4000", "desc": "Rental income from properties"},
    {"code": "4200", "name": "Commission Income",      "type": "Income",    "parent": "4000", "desc": "Commission earned on deals"},
    {"code": "4300", "name": "Other Income",           "type": "Income",    "parent": "4000", "desc": "Miscellaneous income"},
    # Expenses
    {"code": "5100", "name": "Maintenance Expense",    "type": "Expense",   "parent": "5000", "desc": "Property maintenance"},
    {"code": "5200", "name": "Utility Expense",        "type": "Expense",   "parent": "5000", "desc": "Electricity, water, gas"},
    {"code": "5300", "name": "Salary Expense",         "type": "Expense",   "parent": "5000", "desc": "Staff salaries"},
    {"code": "5400", "name": "General Expense",        "type": "Expense",   "parent": "5000", "desc": "General operating expenses"},
    # Equity
    {"code": "3100", "name": "Owner Capital",          "type": "Equity",    "parent": "3000", "desc": "Owner investment capital"},
    {"code": "3200", "name": "Retained Earnings",      "type": "Equity",    "parent": "3000", "desc": "Accumulated profits"},
]


def run(db: Session) -> None:
    existing = {a.code: a for a in db.query(Account).all()}
    print(f"Found {len(existing)} existing accounts")

    # ── Step 1: Rename + normalise the 6 existing root accounts ──────────────
    renames = {
        "1000": ("Assets",      "Asset"),
        "1100": ("Main Bank Account", "Asset"),
        "2000": ("Liabilities", "Liability"),
        "3000": ("Equity",      "Equity"),
        "4000": ("Income",      "Income"),
        "5000": ("Expenses",    "Expense"),
    }
    for code, (new_name, new_type) in renames.items():
        if code in existing:
            acc = existing[code]
            print(f"  Rename {code}: '{acc.name}' → '{new_name}', type '{acc.account_type}' → '{new_type}'")
            acc.name = new_name
            acc.account_type = new_type
            acc.parent_id = None  # these stay as roots
    db.flush()

    # Refresh map after renames
    existing = {a.code: a for a in db.query(Account).all()}

    # ── Step 2: Re-parent Bank (1100) under Assets (1000) ────────────────────
    if "1100" in existing and "1000" in existing:
        existing["1100"].parent_id = existing["1000"].id
        print(f"  Re-parent 1100 (Bank) → under 1000 (Assets)")
    db.flush()

    # ── Step 3: Add new sub-accounts (skip if code already exists) ───────────
    existing = {a.code: a for a in db.query(Account).all()}
    added = 0
    for entry in NEW_ACCOUNTS:
        if entry["code"] in existing:
            print(f"  Skip {entry['code']} — already exists")
            continue
        parent = existing.get(entry["parent"])
        if not parent:
            print(f"  WARN: parent {entry['parent']} not found for {entry['code']}, skipping")
            continue
        acc = Account(
            code=entry["code"],
            name=entry["name"],
            account_type=entry["type"],
            description=entry.get("desc"),
            parent_id=parent.id,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(acc)
        db.flush()
        existing[entry["code"]] = acc
        print(f"  Added {entry['code']} '{entry['name']}' under {entry['parent']}")
        added += 1

    db.commit()
    print(f"\nDone. Added {added} new accounts. Total: {db.query(Account).count()}")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        run(db)
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()
