"""Drop and recreate the entire company_9c22617b schema with correct model columns."""
import sys
sys.path.insert(0, '.')
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.core.database import Base
from app.models import *  # noqa: F401,F403

schema = "company_9c22617b"
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

with engine.begin() as conn:
    # Drop all tables in the schema (CASCADE handles FK dependencies)
    conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
    conn.execute(text(f"CREATE SCHEMA {schema}"))

engine.dispose()

# Now recreate via create_all
engine2 = create_engine(
    settings.database_url,
    connect_args={"options": f"-csearch_path={schema}"},
    pool_pre_ping=True,
)
print(f"Recreating all {len(Base.metadata.tables)} tables in schema '{schema}'...")
Base.metadata.create_all(bind=engine2)
print("Done!")

# Also need to seed the companies table record
from app.tenant import get_master_session
from app.core.database import SessionLocal
from app.models.company import Company

# The companies table in the tenant schema needs a master_id for bootstrap
master_session = get_master_session()
master_row = master_session.execute(
    text("SELECT id FROM companies WHERE company_code = 'company_9c22617b'")
).fetchone()
if master_row:
    tenant_session = SessionLocal()
    tenant_session.execute(text(f"SET search_path TO {schema}"))
    existing = tenant_session.execute(
        text(f"SELECT id FROM {schema}.companies")
    ).fetchone()
    if not existing:
        tenant_session.execute(
            text(f"""
                INSERT INTO {schema}.companies (master_id, name, company_code)
                VALUES (:mid, 'UMX Company', 'company_9c22617b')
            """),
            {"mid": str(master_row[0])}
        )
        tenant_session.commit()
    tenant_session.close()
master_session.close()

print("Schema recreation complete!")
