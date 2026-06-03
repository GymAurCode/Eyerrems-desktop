import sys, os
sys.path.insert(0, 'backend')
from app.core.database import Base
from app.core.tenant_manager import tenant_manager, DATABASES_DIR
from app.models.property import Contact, ContactDocument, ContactInteraction

tables = [Contact.__table__, ContactDocument.__table__, ContactInteraction.__table__]

# Master database
master_engine = tenant_manager.engines["master"]
Base.metadata.create_all(bind=master_engine, tables=tables)
print("Master DB: OK")

# Tenant databases
for f in os.listdir(DATABASES_DIR):
    if f.startswith('company_') and f.endswith('.db'):
        slug = f.replace('.db', '')
        try:
            db_session = tenant_manager.get_tenant_session(slug)
            engine = db_session.get_bind()
            Base.metadata.create_all(bind=engine, tables=tables)
            db_session.close()
            print(f"Tenant {slug}: OK")
        except Exception as e:
            print(f"Tenant {slug}: Error - {e}")

print("All done")
