"""For each tenant schema, add any columns that exist in SQLAlchemy models but missing in DB tables.

Uses information_schema to detect missing columns and issues ALTER TABLE ADD COLUMN.
"""
import sys
sys.path.insert(0, '.')
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.core.database import Base
from app.models import *  # noqa: F401,F403

from sqlalchemy import inspect as sa_inspect

IGNORE_TABLES = {
    "alembic_version",
    "spatial_ref_sys",
    "geography_columns",
    "geometry_columns",
}


def type_to_sql(col):
    """Convert a SQLAlchemy Column type to a PostgreSQL DDL type string."""
    t = col.type
    from sqlalchemy import String, Integer, Float, Numeric, Boolean, DateTime, Date, Text, BigInteger, SmallInteger
    if isinstance(t, String):
        length = t.length if t.length else 255
        return f"VARCHAR({length})"
    elif isinstance(t, Text):
        return "TEXT"
    elif isinstance(t, Integer):
        return "INTEGER"
    elif isinstance(t, BigInteger):
        return "BIGINT"
    elif isinstance(t, SmallInteger):
        return "SMALLINT"
    elif isinstance(t, Float):
        return "FLOAT"
    elif isinstance(t, Numeric):
        prec = t.precision
        scale = t.scale
        if prec is not None and scale is not None:
            return f"NUMERIC({prec},{scale})"
        elif prec is not None:
            return f"NUMERIC({prec})"
        return "NUMERIC"
    elif isinstance(t, Boolean):
        return "BOOLEAN"
    elif isinstance(t, DateTime):
        return "TIMESTAMP WITHOUT TIME ZONE"
    elif isinstance(t, Date):
        return "DATE"
    else:
        return "TEXT"


def main():
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
    )

    # Find all tenant schemas
    with engine.connect() as conn:
        schemas = conn.execute(text("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'company_%'
            ORDER BY schema_name
        """)).fetchall()

    for (schema_name,) in schemas:
        print(f"\n=== {schema_name} ===")
        eng = create_engine(
            settings.database_url,
            connect_args={"options": f"-csearch_path={schema_name}"},
            pool_pre_ping=True,
        )

        # Get current model metadata for this schema
        with eng.connect() as conn:
            for table_name, table in Base.metadata.tables.items():
                if table_name in IGNORE_TABLES:
                    continue

                # Check if table exists
                exists = conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = :s AND table_name = :t
                    )
                """), {"s": schema_name, "t": table_name}).fetchone()[0]

                if not exists:
                    continue  # create_all handles this separately

                # Get existing columns
                existing_cols = {
                    row[0]
                    for row in conn.execute(text("""
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = :s AND table_name = :t
                    """), {"s": schema_name, "t": table_name}).fetchall()
                }

                # Find missing columns
                for col_name, col in table.columns.items():
                    if col_name in existing_cols:
                        continue

                    # Skip relationship columns and foreign keys handled by create_all
                    nullable = "NULL" if col.nullable else "NOT NULL"
                    default_clause = ""
                    if col.default is not None:
                        from sqlalchemy.schema import Sequence, DefaultClause
                        if hasattr(col.default, "arg"):
                            default_clause = f" DEFAULT {col.default.arg}"

                    col_type = type_to_sql(col)
                    alter_sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{col_name}" {col_type} {nullable}{default_clause}'
                    print(f"  Adding missing column {table_name}.{col_name} ({col_type})")
                    try:
                        conn.execute(text(alter_sql))
                    except Exception as e:
                        print(f"    ERROR: {e}")

                # Also check constraints like unique
                for col_name, col in table.columns.items():
                    if col.unique and col_name not in existing_cols:
                        # It was just added above; now add UNIQUE constraint
                        pass  # will handle separately

            conn.commit()
        eng.dispose()

    engine.dispose()
    print("\nDone!")


if __name__ == "__main__":
    main()
