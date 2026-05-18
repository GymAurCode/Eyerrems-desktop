"""Generic validation helpers for import rows."""
import re
from decimal import Decimal, InvalidOperation
from typing import Any

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^[\d\s+\-()]{7,20}$")


def req(row: dict[str, Any], field: str, label: str | None = None) -> str | None:
    v = row.get(field)
    if v is None or (isinstance(v, str) and not v.strip()):
        return f"{label or field} is required"
    return None


def opt_str(row: dict[str, Any], field: str) -> str | None:
    v = row.get(field)
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def validate_email(value: str | None, field: str = "email") -> str | None:
    if not value:
        return None
    if not _EMAIL_RE.match(value):
        return f"Invalid {field} format"
    return None


def validate_phone(value: str | None, required: bool = False) -> str | None:
    if not value:
        return "Phone is required" if required else None
    if not _PHONE_RE.match(value):
        return "Invalid phone format"
    return None


def validate_enum(value: str | None, allowed: set[str], field: str) -> str | None:
    if not value:
        return None
    if value.lower() not in {a.lower() for a in allowed}:
        return f"{field} must be one of: {', '.join(sorted(allowed))}"
    return None


def parse_decimal(value: str | None, field: str, required: bool = False) -> tuple[Decimal | None, str | None]:
    if not value or not str(value).strip():
        if required:
            return None, f"{field} is required"
        return None, None
    try:
        cleaned = str(value).replace(",", "").strip()
        return Decimal(cleaned), None
    except (InvalidOperation, ValueError):
        return None, f"Invalid number for {field}"


def parse_int(value: str | None, field: str, required: bool = False) -> tuple[int | None, str | None]:
    if not value or not str(value).strip():
        if required:
            return None, f"{field} is required"
        return None, None
    try:
        return int(float(str(value).replace(",", "").strip())), None
    except (ValueError, TypeError):
        return None, f"Invalid integer for {field}"


def check_in_file_duplicate(ctx, key: str | None, row_number: int) -> str | None:
    if not key:
        return None
    prev = ctx.file_keys_seen.get(key)
    if prev is not None:
        return f"Duplicate in file (same as row {prev})"
    ctx.file_keys_seen[key] = row_number
    return None
