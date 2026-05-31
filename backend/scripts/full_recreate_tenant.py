"""Drop and recreate company_9c22617b schema, seeding essential tenant data."""
import sys, json
sys.path.insert(0, '.')
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.core.database import Base
from app.models import *  # noqa: F401,F403

schema = "company_9c22617b"
engine = create_engine(settings.database_url, pool_pre_ping=True)

# 1. Save essential tenant data before dropping
with engine.connect() as conn:
    conn.execute(text(f"SET LOCAL search_path TO {schema}"))
    
    # Save company record
    try:
        companies = conn.execute(text("SELECT * FROM companies")).fetchall()
    except Exception:
        companies = []
    
    # Save roles
    try:
        roles = conn.execute(text("SELECT * FROM roles")).fetchall()
    except Exception:
        roles = []
    
    # Save users (but hash the password or save clear text — be careful)
    try:
        users = conn.execute(text("SELECT * FROM users")).fetchall()
    except Exception:
        users = []
    
    # Save role_permissions
    try:
        rp = conn.execute(text("SELECT * FROM role_permissions")).fetchall()
    except Exception:
        rp = []
    
    # Save user_roles
    try:
        ur = conn.execute(text("SELECT * FROM user_roles")).fetchall()
    except Exception:
        ur = []
    
    conn.rollback()

print(f"Saved: {len(companies)} companies, {len(roles)} roles, {len(users)} users, {len(rp)} rp, {len(ur)} ur")

# 2. Drop and recreate schema
with engine.begin() as conn:
    conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
    conn.execute(text(f"CREATE SCHEMA {schema}"))

# 3. Recreate all tables via create_all in the schema
engine2 = create_engine(
    settings.database_url,
    connect_args={"options": "-csearch_path=company_9c22617b"},
    pool_pre_ping=True,
)
print(f"Creating {len(Base.metadata.tables)} tables...")
Base.metadata.create_all(bind=engine2)
engine2.dispose()

# 4. Restore essential data
engine3 = create_engine(settings.database_url, pool_pre_ping=True)
with engine3.connect() as conn:
    conn.execute(text(f"SET search_path TO {schema}"))
    
    # Restore companies
    if companies:
        col_names = [desc[0] for desc in companies[0]._mapping.keys()] if hasattr(companies[0], '_mapping') else []
        for row in companies:
            d = dict(row._mapping)
            cols = ", ".join(d.keys())
            vals = ", ".join(f":{k}" for k in d.keys())
            conn.execute(text(f"INSERT INTO companies ({cols}) VALUES ({vals})"), d)
    
    # Restore roles
    for row in roles:
        d = dict(row._mapping)
        cols = ", ".join(d.keys())
        vals = ", ".join(f":{k}" for k in d.keys())
        conn.execute(text(f"INSERT INTO roles ({cols}) VALUES ({vals}) ON CONFLICT DO NOTHING"), d)
    
    # Restore users
    for row in users:
        d = dict(row._mapping)
        cols = ", ".join(d.keys())
        vals = ", ".join(f":{k}" for k in d.keys())
        conn.execute(text(f"INSERT INTO users ({cols}) VALUES ({vals}) ON CONFLICT DO NOTHING"), d)
    
    # Restore role_permissions
    for row in rp:
        d = dict(row._mapping)
        cols = ", ".join(d.keys())
        vals = ", ".join(f":{k}" for k in d.keys())
        conn.execute(text(f"INSERT INTO role_permissions ({cols}) VALUES ({vals}) ON CONFLICT DO NOTHING"), d)
    
    # Restore user_roles
    for row in ur:
        d = dict(row._mapping)
        cols = ", ".join(d.keys())
        vals = ", ".join(f":{k}" for k in d.keys())
        conn.execute(text(f"INSERT INTO user_roles ({cols}) VALUES ({vals}) ON CONFLICT DO NOTHING"), d)
    
    conn.commit()

engine3.dispose()

# 5. Verify
engine4 = create_engine(settings.database_url, pool_pre_ping=True)
with engine4.connect() as c:
    c.execute(text(f"SET search_path TO {schema}"))
    for tbl in ['properties', 'plots', 'locations', 'tenants', 'accounts', 'companies', 'roles', 'users', 'property_amenities']:
        exists = c.execute(text("""
            SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema=:s AND table_name=:t)
        """), {"s": schema, "t": tbl}).fetchone()[0]
        print(f"  {tbl}: {'✓' if exists else '✗'}")
    # Verify plots index
    idx_exists = c.execute(text("""
        SELECT EXISTS (SELECT FROM pg_indexes WHERE schemaname=:s AND indexname='ix_plots_status')
    """), {"s": schema}).fetchone()[0]
    print(f"  ix_plots_status: {'✓' if idx_exists else '✗'}")
    c.close()
engine4.dispose()

print("\nDone!")
