import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pathlib import Path
from sqlalchemy import create_engine, text, inspect

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
    cols = inspector.get_columns('alembic_version')
    ver_col = next(c for c in cols if c['name'] == 'version_num')
    cur_len = getattr(ver_col['type'], 'length', None)
    print(f'Current version_num length: {cur_len}')
    if cur_len is not None and cur_len < 128:
        conn.execute(text('ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(128)'))
        conn.commit()
        print('Expanded to VARCHAR(128)')

    result = conn.execute(text('SELECT version_num FROM alembic_version'))
    cur = result.scalar()
    print(f'Current version: {cur}')

    conn.execute(text("DELETE FROM alembic_version"))
    conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('0036_add_company_lifecycle_fields')"))
    conn.commit()
    print('Stamped to 0036_add_company_lifecycle_fields')
