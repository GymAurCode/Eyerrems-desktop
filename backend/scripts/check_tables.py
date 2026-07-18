import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pathlib import Path
from sqlalchemy import create_engine, inspect

app_dir = Path(__file__).parent.parent
env_path = app_dir / '.env'
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip("'").strip('"'))

raw = os.environ.get('DATABASE_URL', '')
if not raw:
    from app.core.config import settings
    raw = settings.database_url
if raw.startswith('postgres://'):
    raw = raw.replace('postgres://', 'postgresql+psycopg2://', 1)

engine = create_engine(raw)
with engine.connect() as conn:
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    print('Tables:', tables)
    schemas = inspector.get_schema_names()
    print('Schemas:', schemas)
