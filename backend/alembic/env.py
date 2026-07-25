"""
Alembic environment — works for both local PostgreSQL and Railway.

Connection URL is always sourced from settings.database_url_fixed
to avoid ConfigParser % interpolation issues (tenant schema URLs
contain %3D / %2C from urlencode which ConfigParser misinterprets).

For tenant schema migrations, the search_path is passed via the
ALEMBIC_SEARCH_PATH environment variable (set by main.py).
"""
import os
from logging.config import fileConfig
from urllib.parse import urlencode, urlparse, urlunparse, parse_qs

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import settings
from app.core.database import Base
from app.models import *  # noqa: F401,F403  — registers all ORM models

config = context.config
db_url = settings.database_url_fixed

search_path = os.environ.get("ALEMBIC_SEARCH_PATH")
if search_path and db_url:
    parsed = urlparse(db_url)
    qs = parse_qs(parsed.query)
    qs["options"] = f"-csearch_path={search_path}"
    db_url = urlunparse(parsed._replace(query=urlencode(qs, doseq=True)))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
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
    connectable = create_engine(db_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
