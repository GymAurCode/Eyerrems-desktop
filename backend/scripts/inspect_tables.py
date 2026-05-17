import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from sqlalchemy import create_engine, text

# Replace postgres:// with postgresql:// if needed for psycopg2
db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url)
with engine.connect() as conn:
    print("Connecting to DB...")
    
    # 1. Get all tables
    tables = conn.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    )).fetchall()
    print("Tables found:", [t[0] for t in tables])
    
    # 2. Inspect 'invoices' and 'commissions'
    for tbl in ["invoices", "commissions"]:
        exists = conn.execute(text(
            f"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '{tbl}')"
        )).scalar()
        print(f"Table '{tbl}' exists: {exists}")
        if exists:
            columns = conn.execute(text(
                f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{tbl}'"
            )).fetchall()
            print(f"Columns in '{tbl}':", [(c[0], c[1]) for c in columns])
