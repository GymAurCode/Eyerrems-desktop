"""Compare SQLAlchemy models vs actual DB schema."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect as sa_inspect, text
from app.models import *  # noqa: F401,F403 — registers all models
from app.core.database import Base

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("❌ DATABASE_URL env var not set")
    sys.exit(1)

# Normalise URL
if DB_URL.startswith("postgres://"):
    DB_URL = DB_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DB_URL.startswith("postgresql://") and "+" not in DB_URL:
    DB_URL = DB_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DB_URL)
inspector = sa_inspect(engine)

model_tables = {}
for table_name, table in Base.metadata.tables.items():
    model_tables[table_name] = {c.name: c for c in table.columns}

actual_tables = {}
for name in inspector.get_table_names():
    cols = inspector.get_columns(name)
    actual_tables[name] = {c["name"]: c for c in cols}

print("=" * 70)
print("SCHEMA COMPARISON: SQLAlchemy Models vs Railway DB")
print("=" * 70)

# ── Missing tables ──
missing_tables = sorted(set(model_tables) - set(actual_tables))
if missing_tables:
    print(f"\n❌ MISSING TABLES ({len(missing_tables)}):")
    for t in missing_tables:
        print(f"   - {t}")
else:
    print("\n✅ All model tables exist in DB")

# ── Extra tables (in DB but not in models) ──
extra_tables = sorted(set(actual_tables) - set(model_tables))
if extra_tables:
    print(f"\n⚠️  EXTRA TABLES (in DB only, {len(extra_tables)}):")
    for t in extra_tables:
        print(f"   - {t}")

# ── Column comparison per table ──
print(f"\n{'='*70}")
print("COLUMN-LEVEL COMPARISON")
print("=" * 70)

tables_in_both = sorted(set(model_tables) & set(actual_tables))
total_missing_cols = 0

for table_name in tables_in_both:
    model_cols = model_tables[table_name]
    actual_cols = actual_tables[table_name]

    missing = set(model_cols) - set(actual_cols)
    extra = set(actual_cols) - set(model_cols)

    if missing:
        total_missing_cols += len(missing)
        print(f"\n❌ {table_name} — missing columns ({len(missing)}):")
        for c in sorted(missing):
            col = model_cols[c]
            col_type = col.type
            nullable = "NULL" if col.nullable else "NOT NULL"
            default = f" DEFAULT {col.server_default.arg}" if col.server_default else ""
            print(f"   - {c}  {col_type}  {nullable}{default}")

    if extra:
        print(f"\n⚠️  {table_name} — extra columns in DB ({len(extra)}):")
        for c in sorted(extra):
            print(f"   - {c}  {actual_cols[c]['type']}")

# ── Type mismatches ──
print(f"\n{'='*70}")
print("TYPE MISMATCHES")
print("=" * 70)
mismatches = 0
for table_name in tables_in_both:
    model_cols = model_tables[table_name]
    actual_cols = actual_tables[table_name]
    common = set(model_cols) & set(actual_cols)
    for c in sorted(common):
        m_type = str(model_cols[c].type)
        a_type = str(actual_cols[c]["type"])
        if m_type.lower() != a_type.lower():
            mismatches += 1
            print(f"   {table_name}.{c}:  Model={m_type}  |  DB={a_type}")

if mismatches == 0:
    print("   ✅ No type mismatches found")

print(f"\n{'='*70}")
print("SUMMARY")
print("=" * 70)
print(f"   Tables in Models:    {len(model_tables)}")
print(f"   Tables in Railway:   {len(actual_tables)}")
print(f"   Missing tables:      {len(missing_tables)}")
print(f"   Missing columns:     {total_missing_cols}")
print(f"   Type mismatches:     {mismatches}")
print()
