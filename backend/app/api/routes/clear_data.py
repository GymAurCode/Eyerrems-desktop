import logging
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_admin_role
from app.core.security import verify_password
from app.models.auth import User
from app.models.backup import Backup
from app.services.backup_service import BackupService, BackupServiceError, _compute_sha256

log = logging.getLogger("rems.clear_data")

router = APIRouter(prefix="/backup/clear-data", tags=["clear-data"])

SYSTEM_TABLE_NAMES: set[str] = {
    "alembic_version",
    "spatial_ref_sys",
    "users",
    "companies",
    "roles",
    "role_permissions",
    "permissions",
    "user_permissions",
    "user_roles",
    "backups",
    "backup_settings",
    "company_features",
    "lookup_values",
    "master_setting_options",
    "report_settings",
    "report_branding",
    "system_settings",
}

SYSTEM_TABLE_PREFIXES: tuple[str, ...] = ("rbac", "rbac2_", "rbac3_")


class VerifyPasswordRequest(BaseModel):
    password: str


def _verify_super_admin_password(db: Session, user: User, password: str) -> None:
    if not user.hashed_password:
        log.error("verify-password: user.hashed_password is None/empty for %s", user.email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid administrator password.",
        )
    if not verify_password(password, user.hashed_password):
        log.warning(
            "verify-password: password mismatch for %s (hash length=%d)",
            user.email, len(user.hashed_password),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid administrator password.",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Table discovery
# ─────────────────────────────────────────────────────────────────────────────

def _is_system_table(name: str) -> bool:
    if name in SYSTEM_TABLE_NAMES:
        return True
    return any(name.startswith(p) for p in SYSTEM_TABLE_PREFIXES)


def _discover_tables(db: Session) -> tuple[list[str], list[str]]:
    """Discover all user tables and split into system vs business.

    Returns (system_tables, business_tables) both alphabetically sorted.
    """
    insp = inspect(db.bind)
    all_tables = set(insp.get_table_names())
    system = sorted(t for t in all_tables if _is_system_table(t))
    business = sorted(all_tables - set(system))
    log.info("Discovered %d total tables", len(all_tables))
    log.info("System tables (%d): %s", len(system), system)
    log.info("Business tables to clear (%d): %s", len(business), business)
    return system, business


# ─────────────────────────────────────────────────────────────────────────────
# PostgreSQL clear — TRUNCATE CASCADE
# ─────────────────────────────────────────────────────────────────────────────

def _clear_postgresql(db: Session, tables: list[str]) -> dict[str, int]:
    """Clear all business tables via TRUNCATE ... CASCADE.

    PostgreSQL's TRUNCATE with CASCADE:
      - Automatically handles FK constraints
      - RESTART IDENTITY resets all serial sequences atomically
      - Single statement is atomic and fast
    """
    if not tables:
        log.info("No business tables to truncate.")
        return {}

    # Log current schema context
    try:
        schema_row = db.execute(text("SELECT current_schema()")).scalar()
        log.info("PostgreSQL current_schema: %s", schema_row)
    except Exception as e:
        log.warning("Could not read current_schema: %s", e)

    try:
        db_row = db.execute(text("SELECT current_database()")).scalar()
        log.info("PostgreSQL current_database: %s", db_row)
    except Exception as e:
        log.warning("Could not read current_database: %s", e)

    # Log row counts BEFORE clearing
    log.info("--- Row counts BEFORE clear ---")
    before_counts: dict[str, int] = {}
    for t in tables:
        try:
            before_counts[t] = db.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar() or 0
            log.info("  %s: %d rows", t, before_counts[t])
        except Exception as e:
            log.warning("  %s: could not count — %s", t, e)
            before_counts[t] = -1

    # Build single TRUNCATE statement
    quoted = ", ".join(f'"{t}"' for t in tables)
    sql = f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE;"
    log.info("Executing: %s", sql)

    db.execute(text(sql))
    log.info("TRUNCATE completed successfully.")

    # Log row counts AFTER clearing
    log.info("--- Row counts AFTER clear ---")
    after_counts: dict[str, int] = {}
    for t in tables:
        try:
            after_counts[t] = db.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar() or 0
            log.info("  %s: %d rows", t, after_counts[t])
        except Exception as e:
            log.warning("  %s: could not count — %s", t, e)
            after_counts[t] = -1

    # Build result: rows_deleted = before - after for each table
    cleared: dict[str, int] = {}
    for t in tables:
        before = before_counts.get(t, 0)
        after = after_counts.get(t, 0)
        if before >= 0 and after >= 0:
            cleared[t] = before - after
        else:
            cleared[t] = after

    return cleared


# ─────────────────────────────────────────────────────────────────────────────
# SQLite clear — DELETE FROM with FK constraint suppression
# ─────────────────────────────────────────────────────────────────────────────

def _clear_sqlite(db: Session, tables: list[str]) -> dict[str, int]:
    """Clear all business tables via sequential DELETE FROM.

    SQLite does not support TRUNCATE. Instead:
      1. Disable FK constraint enforcement on RAW connection BEFORE any
         db.execute() call (otherwise SQLAlchemy auto-begins a transaction
         and PRAGMA foreign_keys becomes a no-op inside a transaction).
      2. DELETE FROM each table (in any order — FK is OFF)
      3. Reset sqlite_sequence
      4. FK enforcement is automatically restored on next connection
         via TenantManager's connection event listener.
    """
    if not tables:
        log.info("No business tables to delete.")
        return {}

    # Step 1: Get raw DBAPI connection and disable FK enforcement.
    # This MUST happen before any db.execute() call because SQLAlchemy
    # with autocommit=False auto-begins a transaction on the first
    # statement.  PRAGMA foreign_keys=OFF is a no-op inside a transaction.
    raw_conn = db.connection().connection
    fk_was_on = False
    try:
        cursor = raw_conn.execute("PRAGMA foreign_keys")
        fk_was_on = cursor.fetchone()[0] == 1
        if fk_was_on:
            raw_conn.execute("PRAGMA foreign_keys=OFF")
            log.info("Disabled FK constraints (was ON=%s)", fk_was_on)
            cursor = raw_conn.execute("PRAGMA foreign_keys")
            log.info("FK status after disable: %s (0=OFF)", cursor.fetchone()[0])
    except Exception as e:
        log.warning("Could not disable FK constraints: %s", e)

    # Step 2: Log database file path (via raw connection to avoid transaction)
    try:
        db_path = raw_conn.execute("PRAGMA database_list").fetchone()
        log.info("SQLite database: %s", db_path[2] if db_path else "unknown")
    except Exception as e:
        log.warning("Could not read database path: %s", e)

    # Step 3: Count rows BEFORE (first db.execute() — auto-begins tx with FK OFF)
    log.info("--- Row counts BEFORE clear ---")
    before_counts: dict[str, int] = {}
    for t in tables:
        try:
            before_counts[t] = db.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar() or 0
            log.info("  %s: %d rows", t, before_counts[t])
        except Exception as e:
            log.warning("  %s: could not count — %s", t, e)
            before_counts[t] = -1

    # Step 4: DELETE FROM each business table
    log.info("--- DELETE FROM each business table ---")
    failed_tables: list[str] = []
    for t in tables:
        try:
            result = db.execute(text(f'DELETE FROM "{t}"'))
            log.info("  %s: %d rows deleted", t, result.rowcount)
        except Exception as e:
            failed_tables.append(t)
            log.error("  %s: FAILED — %s", t, e)

    if failed_tables:
        db.rollback()
        raise RuntimeError(
            f"DELETE failed on {len(failed_tables)} table(s): "
            f"{', '.join(failed_tables)}. All changes rolled back."
        )

    # Step 5: Count rows AFTER
    log.info("--- Row counts AFTER clear ---")
    after_counts: dict[str, int] = {}
    for t in tables:
        try:
            after_counts[t] = db.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar() or 0
            log.info("  %s: %d rows", t, after_counts[t])
        except Exception as e:
            log.warning("  %s: could not count — %s", t, e)
            after_counts[t] = -1

    # Step 6: Reset autoincrement sequences
    try:
        db.execute(text("DELETE FROM sqlite_sequence"))
        log.info("Reset sqlite_sequence")
    except Exception:
        log.info("sqlite_sequence table does not exist (no AUTOINCREMENT columns) — skipping")

    # Step 7: Build result
    cleared: dict[str, int] = {}
    for t in tables:
        before = before_counts.get(t, 0)
        after = after_counts.get(t, 0)
        if before >= 0 and after >= 0:
            cleared[t] = before - after
        else:
            cleared[t] = after

    return cleared


# ─────────────────────────────────────────────────────────────────────────────
# Clear orchestration
# ─────────────────────────────────────────────────────────────────────────────

def _clear_business_data(db: Session) -> dict[str, int]:
    """Discover business tables and clear them.

    Dispatches to the appropriate backend:
      - PostgreSQL → TRUNCATE ... CASCADE
      - SQLite      → DELETE FROM with FK suppression

    Returns a dict mapping table_name → rows_deleted.
    Raises RuntimeError on failure.
    """
    system_tables, business_tables = _discover_tables(db)

    if not business_tables:
        log.info("No business tables to clear.")
        return {}

    # Determine dialect
    dialect = "unknown"
    if db.bind and db.bind.dialect:
        dialect = db.bind.dialect.name
    log.info("Dialect: %s | System: %d | Business: %d",
             dialect, len(system_tables), len(business_tables))

    start = time.monotonic()

    if dialect == "postgresql":
        cleared = _clear_postgresql(db, business_tables)
    elif dialect == "sqlite":
        cleared = _clear_sqlite(db, business_tables)
    else:
        raise RuntimeError(f"Unsupported database dialect: {dialect}")

    elapsed = time.monotonic() - start
    total_rows = sum(max(0, v) for v in cleared.values())
    cleared_count = sum(1 for v in cleared.values() if v >= 0)
    log.info("Clear completed in %.2fs: %d tables, %d rows deleted",
             elapsed, cleared_count, total_rows)

    return cleared


# ─────────────────────────────────────────────────────────────────────────────
# Verification
# ─────────────────────────────────────────────────────────────────────────────

def _verify_tables_empty(db: Session, tables: list[str]) -> list[str]:
    """Verify all given tables are empty. Returns list of tables still with data."""
    log.info("--- Verification ---")
    non_empty: list[str] = []
    for t in tables:
        try:
            count = db.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar() or 0
            if count > 0:
                non_empty.append(f"{t} ({count} rows)")
                log.warning("  %s: %d rows — STILL HAS DATA", t, count)
            else:
                log.info("  %s: 0 rows", t)
        except Exception as e:
            log.warning("  %s: could not verify — %s", t, e)
            non_empty.append(f"{t} (unknown)")
    if non_empty:
        log.error("Verification FAILED — %d tables still contain data", len(non_empty))
    else:
        log.info("Verification PASSED — all tables empty")
    return non_empty


# ─────────────────────────────────────────────────────────────────────────────
# API endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/verify-password")
def verify_password_endpoint(
    req: VerifyPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_admin_role),
):
    _verify_super_admin_password(db, current_user, req.password)
    return {
        "success": True,
        "message": "Password verified successfully.",
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/prepare")
def prepare_clear_data(
    req: VerifyPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_admin_role),
):
    _verify_super_admin_password(db, current_user, req.password)

    try:
        backup = BackupService.create_backup(
            db=db,
            user=current_user,
            backup_type="manual",
            notes=f"Pre-clear recovery backup — created by {current_user.email}",
            filename_prefix="REMS_PreClearBackup",
        )
    except BackupServiceError as e:
        log.error("Pre-clear backup creation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup creation failed: {e}. Clear data aborted.",
        )

    filepath = Path(backup.filepath)
    if not filepath.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backup file was not created on disk. Clear data aborted.",
        )

    if backup.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup status is '{backup.status}', not 'completed'. Clear data aborted.",
        )

    try:
        verify_result = BackupService.verify_backup(filepath)
        if not verify_result.get("valid"):
            errors = "; ".join(verify_result.get("errors", ["Unknown verification error"]))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Backup verification failed: {errors}. Clear data aborted.",
            )
        log.info("Pre-clear backup verified successfully: %s", backup.filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup verification error: {e}. Clear data aborted.",
        )

    current_checksum = _compute_sha256(filepath)
    if current_checksum != backup.checksum:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backup checksum mismatch after verification. Clear data aborted.",
        )

    setting = BackupService.get_or_create_settings(db, company_id=None)
    backup_dir = BackupService.get_backup_dir(setting)

    return {
        "success": True,
        "message": "Recovery backup created and verified successfully.",
        "backup": {
            "id": backup.id,
            "filename": backup.filename,
            "file_size": backup.file_size,
            "checksum": backup.checksum,
            "backup_version": backup.backup_version,
            "app_version": backup.app_version,
            "backup_type": backup.backup_type,
            "status": backup.status,
            "created_by_name": backup.created_by_name,
            "created_at": backup.created_at.isoformat() if backup.created_at else None,
            "filepath": str(filepath),
            "backup_dir": str(backup_dir),
        },
    }


@router.post("/execute")
def execute_clear_data(
    req: VerifyPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_admin_role),
):
    overall_start = time.monotonic()
    _verify_super_admin_password(db, current_user, req.password)

    client_host = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Log multi-tenant context
    log.info("=" * 60)
    log.info("CLEAR DATA EXECUTION STARTED")
    log.info("Initiator: %s (role_id=%s, super_admin=%s)",
             current_user.email, current_user.role_id, current_user.is_super_admin)
    log.info("Client: %s | UA: %s", client_host, user_agent)

    try:
        dialect = db.bind.dialect.name if db.bind and db.bind.dialect else "unknown"
        log.info("Dialect: %s", dialect)

        if dialect == "postgresql":
            try:
                schema = db.execute(text("SELECT current_schema()")).scalar()
                database = db.execute(text("SELECT current_database()")).scalar()
                log.info("Schema: %s | Database: %s", schema, database)
            except Exception as e:
                log.warning("Could not read schema/database context: %s", e)
        elif dialect == "sqlite":
            try:
                raw = db.connection().connection
                db_file = raw.execute("PRAGMA database_list").fetchone()
                log.info("Database file: %s", db_file[2] if db_file else "unknown")
            except Exception as e:
                log.warning("Could not read database path: %s", e)

        cleared = _clear_business_data(db)

    except Exception as e:
        tb = traceback.format_exc()
        log.error("Clear data operation FAILED: %s\n%s", e, tb)
        elapsed = time.monotonic() - overall_start
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error": str(e),
                "traceback": tb,
                "duration_seconds": round(elapsed, 2),
                "verification": "failed",
            },
        )

    # Verification
    log.info("--- Starting post-clear verification ---")
    business_tables_cleared = list(cleared.keys())
    non_empty = _verify_tables_empty(db, business_tables_cleared)

    verification_passed = len(non_empty) == 0
    if non_empty:
        elapsed = time.monotonic() - overall_start
        log.error("Verification FAILED after clear: %s", non_empty)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "failed_tables": non_empty,
                "reason": "Tables still contain data after clear operation",
                "duration_seconds": round(elapsed, 2),
                "verification": "failed",
            },
        )

    total_deleted = sum(max(0, c) for c in cleared.values())
    deleted_tables = [t for t, c in cleared.items() if c >= 0]

    overall_elapsed = time.monotonic() - overall_start
    log.info("Clear data completed successfully in %.2fs", overall_elapsed)

    audit_data = {
        "action": "CLEAR_DATA",
        "cleared_by": current_user.email,
        "cleared_by_role": "Admin",
        "cleared_at": datetime.now(timezone.utc).isoformat(),
        "ip_address": client_host,
        "browser": user_agent,
        "tables_cleared": deleted_tables,
        "rows_removed": total_deleted,
        "duration_seconds": round(overall_elapsed, 2),
        "verification": "passed",
    }

    try:
        from app.services.activity_service import AuditLogService
        AuditLogService.log(
            db=db,
            actor=current_user,
            action="CLEAR_DATA",
            module="backup",
            entity_type="system",
            entity_id="all",
            entity_name="System Clear Data",
            new_data=audit_data,
            ip_address=client_host,
            request=request,
        )
    except Exception as e:
        log.warning("Audit log after clear data failed: %s", e)

    db.refresh(current_user)

    return {
        "success": verification_passed,
        "deleted_tables": len(deleted_tables),
        "deleted_rows": total_deleted,
        "duration_seconds": round(overall_elapsed, 2),
        "verification": "passed" if verification_passed else "failed",
        "cleared_at": datetime.now(timezone.utc).isoformat(),
        "details": {
            "tables_cleared": deleted_tables,
            "total_rows_removed": total_deleted,
        },
    }
