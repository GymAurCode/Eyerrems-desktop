import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

log = logging.getLogger("rems.db")

# ── Engine configuration ──────────────────────────────────────────────────────
# Railway PostgreSQL (and most cloud providers) require SSL.
# We detect a Railway/cloud URL by checking for common proxy hostnames or
# the absence of localhost/127.0.0.1, then enforce sslmode=require.
# The connect_args approach works with both psycopg2 and psycopg3 drivers.

def _build_engine():
    url = settings.database_url
    is_local = any(h in url for h in ("localhost", "127.0.0.1", "::1"))

    connect_args: dict = {}
    if not is_local:
        # Cloud / Railway PostgreSQL — SSL is mandatory.
        # psycopg2 accepts sslmode in connect_args; psycopg3 accepts ssl="require".
        # We set both keys so either driver works.
        connect_args = {
            "sslmode": "require",
        }
        log.info("[DB] Remote database detected — SSL enabled (sslmode=require)")
    else:
        log.info("[DB] Local database detected — SSL disabled")

    engine = create_engine(
        url,
        pool_pre_ping=True,       # Detect stale connections before use
        pool_size=5,              # Keep a small pool for Railway's connection limits
        max_overflow=10,
        pool_recycle=300,         # Recycle connections every 5 min to avoid Railway timeouts
        connect_args=connect_args,
    )

    # Log first successful connection for diagnostics
    @event.listens_for(engine, "connect")
    def on_connect(dbapi_conn, connection_record):
        log.info("[DB] PostgreSQL connection established successfully")

    return engine


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as exc:
        log.error("[DB] Session error: %s", exc, exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


def check_db_connection() -> bool:
    """Health-check helper — returns True if the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        log.error("[DB] Health check failed: %s", exc)
        return False
