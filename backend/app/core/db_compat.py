"""Database compatibility helpers — provides backend-agnostic SQL function wrappers
for PostgreSQL and SQLite dialects."""

from sqlalchemy import func


def _dialect(db):
    return db.bind.dialect.name if db.bind else "postgresql"


def date_format(db, column, fmt):
    """Format a date/time column as string.

    PostgreSQL: to_char(col, fmt)  e.g. 'YYYY-MM'
    SQLite:     strftime(col, fmt)  e.g. '%Y-%m'
    """
    if _dialect(db) == "sqlite":
        sqlite_fmt = fmt.replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
        return func.strftime(sqlite_fmt, column)
    return func.to_char(column, fmt)


def date_diff_days(db, end_col, start_col):
    """Return the number of days between two date/time columns.

    PostgreSQL: date_part('day', end_col - start_col)
    SQLite:     julianday(end_col) - julianday(start_col)
    """
    if _dialect(db) == "sqlite":
        return func.julianday(end_col) - func.julianday(start_col)
    return func.date_part("day", end_col - start_col)
