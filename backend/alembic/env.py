"""
Alembic environment — works for both local PostgreSQL and Railway.

Connection priority:
  1. DATABASE_URL env var (Railway injects this automatically)
  2. settings.database_url from .env file
"""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

from app.core.config import settings
from app.core.database import Base
from app.models import *  # noqa: F401,F403  — registers all ORM models

# ── Alembic config object ─────────────────────────────────────────────────────
config = context.config

# Railway injects DATABASE_URL as a plain postgres:// URL; SQLAlchemy requires
# postgresql+psycopg2://. Fix the scheme if needed.
def _normalise_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    return url

db_url = _normalise_url(
    os.environ.get("DATABASE_URL", "") or settings.database_url
)
config.set_main_option("sqlalchemy.url", db_url)

# ── Logging ───────────────────────────────────────────────────────────────────
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Target metadata (all models must be imported above) ───────────────────────
target_metadata = Base.metadata


# ── Migration runners ─────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL script)."""
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live DB connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,          # detect column type changes
            compare_server_default=True, # detect default value changes
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
