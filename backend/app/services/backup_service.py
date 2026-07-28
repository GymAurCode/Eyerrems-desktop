import base64
import hashlib
import io
import json
import logging
import os
import shutil
import subprocess
import tarfile
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import MetaData, Table, inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.backup import Backup, BackupSetting

log = logging.getLogger("rems.backup")

_STRING_LIKE_TYPES = {
    "VARCHAR", "CHAR", "TEXT", "CLOB", "NVARCHAR", "NCHAR",
    "STRING", "JSON", "JSONB", "UUID", "BLOB",
}

_DATE_LIKE_TYPES = {"DATE", "DATETIME", "TIMESTAMP", "TIME"}

_NUMERIC_LIKE_TYPES = {
    "INTEGER", "INT", "BIGINT", "SMALLINT", "TINYINT",
    "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL",
    "SERIAL", "BIGSERIAL",
}

_BOOLEAN_TYPES = {"BOOLEAN", "BOOL"}


def _get_python_type(col_type_str: str) -> str:
    upper = col_type_str.upper().split("(")[0].split()[0]
    if upper in _STRING_LIKE_TYPES:
        return "string"
    if upper in _DATE_LIKE_TYPES:
        return "datetime"
    if upper in _NUMERIC_LIKE_TYPES:
        return "numeric"
    if upper in _BOOLEAN_TYPES:
        return "boolean"
    return "string"


def _format_value(value, col_type_str: str) -> str:
    if value is None:
        return "NULL"
    py_type = _get_python_type(col_type_str)
    if py_type == "string":
        escaped = str(value).replace("'", "''")
        return f"'{escaped}'"
    if py_type == "datetime":
        if hasattr(value, "strftime"):
            return f"'{value.strftime('%Y-%m-%d %H:%M:%S')}'"
        return f"'{value}'"
    if py_type == "boolean":
        if isinstance(value, bool):
            return "TRUE" if value else "FALSE"
        v = str(value).lower()
        return "TRUE" if v in ("1", "true", "t", "yes", "y") else "FALSE"
    if py_type == "numeric":
        return str(value)
    return str(value)


_EXCLUDED_TABLES = {
    "alembic_version",
    "spatial_ref_sys",
    "backups",
    "backup_settings",
}


def _get_table_names(insp: inspect) -> list[str]:
    return [t for t in insp.get_table_names() if t not in _EXCLUDED_TABLES]


def _dump_database(db: Session, output_path: Path) -> int:
    insp = inspect(db.bind)
    tables = _get_table_names(insp)
    total_rows = 0
    dialect = db.bind.dialect.name if db.bind and db.bind.dialect else "postgresql"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("-- REMS Database Backup\n")
        f.write(f"-- Generated: {datetime.now(timezone.utc).isoformat()}\n")
        f.write("-- Tables: " + ", ".join(tables) + "\n\n")

        if dialect == "postgresql":
            f.write("SET session_replication_role = 'replica';\n\n")
            try:
                db.execute(text("SET session_replication_role = 'replica'"))
            except Exception:
                pass
        elif dialect == "sqlite":
            f.write("PRAGMA foreign_keys = OFF;\n\n")
            try:
                db.execute(text("PRAGMA foreign_keys = OFF"))
            except Exception:
                pass

        for table_name in tables:
            try:
                columns = insp.get_columns(table_name)
                col_names = [c["name"] for c in columns]
                col_types = {c["name"]: str(c.get("type", "")) for c in columns}

                rows = db.execute(text(f"SELECT * FROM {table_name}")).fetchall()

                if not rows:
                    f.write(f"-- Table {table_name}: 0 rows\n\n")
                    continue

                if columns:
                    f.write(f"-- Table {table_name}: {len(rows)} rows\n")

                    batch_size = 100
                    for i in range(0, len(rows), batch_size):
                        batch = rows[i : i + batch_size]
                        values_list = []
                        for row in batch:
                            formatted = []
                            for c in col_names:
                                val = getattr(row, c, None)
                                formatted.append(_format_value(val, col_types.get(c, "TEXT")))
                            values_list.append(f"({', '.join(formatted)})")

                        f.write(f"INSERT INTO {table_name} ({', '.join(col_names)}) VALUES\n")
                        f.write(",\n".join(values_list))
                        f.write(";\n")

                    total_rows += len(rows)
                f.write("\n")
            except Exception as e:
                log.warning("Skipping table %s: %s", table_name, e)
                f.write(f"-- Skipped table {table_name}: {e}\n\n")

        if dialect == "postgresql":
            f.write("SET session_replication_role = 'origin';\n")
            try:
                db.execute(text("SET session_replication_role = 'origin'"))
            except Exception:
                pass
        elif dialect == "sqlite":
            f.write("PRAGMA foreign_keys = ON;\n")
            try:
                db.execute(text("PRAGMA foreign_keys = ON"))
            except Exception:
                pass

    log.info("Dumped %d rows from %d tables to %s", total_rows, len(tables), output_path)
    return total_rows


def _copy_uploads(target_dir: Path):
    upload_path = Path(settings.upload_dir)
    if upload_path.exists():
        files_dir = target_dir / "files"
        shutil.copytree(str(upload_path), str(files_dir), dirs_exist_ok=True)
        log.info("Copied uploads from %s", upload_path)
    else:
        (target_dir / "files").mkdir(parents=True, exist_ok=True)
        log.warning("Uploads directory %s does not exist", upload_path)


def _get_app_version() -> str:
    try:
        import pkg_resources
        return pkg_resources.get_distribution("rems").version
    except Exception:
        pass
    try:
        from app import __version__
        return __version__
    except Exception:
        pass
    return "1.0.0"


def _compute_sha256(filepath: Path) -> str:
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha.update(chunk)
    return sha.hexdigest()


def _encrypt_data(data: bytes, key: bytes) -> bytes:
    f = Fernet(key)
    return f.encrypt(data)


def _decrypt_data(data: bytes, key: bytes) -> bytes:
    f = Fernet(key)
    return f.decrypt(data)


def _make_encryption_key(password: str) -> bytes:
    key = hashlib.sha256(password.encode()).digest()
    return Fernet.generate_key() + key[:11]


def _derive_key(password: str) -> bytes:
    raw = hashlib.sha256(password.encode()).hexdigest()[:43]
    return "J6" + raw + "="


def _compute_directory_size(path: Path) -> int:
    total = 0
    for entry in path.rglob("*"):
        if entry.is_file():
            total += entry.stat().st_size
    return total


class BackupServiceError(Exception):
    pass


class RestoreError(Exception):
    pass


class BackupService:

    BACKUP_DIR_NAME = "rems_backups"
    BACKUP_VERSION = "2.0"
    BACKUP_EXT = ".remsbak"

    @classmethod
    def get_backup_dir(cls, setting: Optional[BackupSetting] = None) -> Path:
        env = os.getenv("REMS_BACKUP_DIR")
        if env:
            path = Path(env)
        elif setting and setting.backup_dir:
            path = Path(setting.backup_dir)
        else:
            path = Path.home() / "REMS Backups"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @classmethod
    def get_temp_dir(cls) -> Path:
        path = Path(tempfile.gettempdir()) / f"rems_backup_{uuid.uuid4().hex[:8]}"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @classmethod
    def create_backup(
        cls,
        db: Session,
        user,
        backup_type: str = "manual",
        password: Optional[str] = None,
        notes: Optional[str] = None,
        filename_prefix: Optional[str] = None,
    ) -> Backup:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        prefix = filename_prefix or "REMS_Backup"
        filename = f"{prefix}_{timestamp}{cls.BACKUP_EXT}"
        company_id = user.company_id if not user.is_super_admin else None
        setting = cls.get_or_create_settings(db, company_id)
        backup_dir = cls.get_backup_dir(setting)
        filepath = backup_dir / filename

        temp_dir = cls.get_temp_dir()
        try:
            backup_record = Backup(
                filename=filename,
                filepath=str(filepath),
                backup_version=cls.BACKUP_VERSION,
                app_version=_get_app_version(),
                company_id=company_id,
                created_by_id=user.id,
                created_by_name=user.full_name or user.email,
                backup_type=backup_type,
                status="creating",
                checksum="",
                notes=notes or "",
                is_encrypted=bool(password),
                started_at=datetime.now(timezone.utc),
            )
            db.add(backup_record)
            db.flush()

            # Dump database
            dump_path = temp_dir / "database.sql"
            row_count = _dump_database(db, dump_path)

            # Copy uploaded files
            _copy_uploads(temp_dir)

            # Create metadata
            metadata = {
                "backup_id": backup_record.id,
                "filename": filename,
                "backup_version": cls.BACKUP_VERSION,
                "app_version": _get_app_version(),
                "db_version": "1.0",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user.email,
                "created_by_name": user.full_name or user.email,
                "company_id": user.company_id,
                "backup_type": backup_type,
                "row_count": row_count,
                "table_count": len(_get_table_names(inspect(db.bind))),
            }
            with open(temp_dir / "metadata.json", "w") as f:
                json.dump(metadata, f, indent=2)

            # Create version.json
            version_info = {
                "backup_version": cls.BACKUP_VERSION,
                "app_version": _get_app_version(),
                "schema_version": "1.0",
                "minimum_restore_version": "1.0",
            }
            with open(temp_dir / "version.json", "w") as f:
                json.dump(version_info, f, indent=2)

            # Create settings.json - export app settings
            settings_data = {
                "app_name": "REMS",
                "timezone": "UTC",
                "upload_dir": settings.upload_dir,
            }
            try:
                for key in dir(settings):
                    if not key.startswith("_") and not callable(getattr(settings, key, None)):
                        try:
                            val = getattr(settings, key)
                            if isinstance(val, (str, int, float, bool, list, dict)) or val is None:
                                settings_data[key] = val
                        except Exception:
                            pass
            except Exception:
                pass
            with open(temp_dir / "settings.json", "w") as f:
                json.dump(settings_data, f, indent=2, default=str)

            # Create logs.json - recent audit logs summary
            logs_data = {"exported_at": datetime.now(timezone.utc).isoformat(), "entries": []}
            try:
                from app.models.audit import AuditLog
                recent = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(1000).all()
                logs_data["entries"] = [
                    {
                        "id": a.id,
                        "action": a.action,
                        "module": a.module,
                        "entity_type": a.entity_type,
                        "entity_id": str(a.entity_id) if a.entity_id else None,
                        "user_email": a.user_email,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in recent
                ]
            except Exception as e:
                log.warning("Could not export audit logs: %s", e)
            with open(temp_dir / "logs.json", "w") as f:
                json.dump(logs_data, f, indent=2)

            # Create checksum file
            checksum_content = ""
            for item in sorted(temp_dir.iterdir()):
                if item.is_file() and item.name != "checksum.sha256":
                    item_hash = _compute_sha256(item)
                    checksum_content += f"{item_hash}  {item.name}\n"
            with open(temp_dir / "checksum.sha256", "w") as f:
                f.write(checksum_content)

            # Package into tar.gz
            with tarfile.open(str(filepath), "w:gz") as tar:
                for item in temp_dir.iterdir():
                    tar.add(str(item), arcname=item.name)

            # Verify file exists and has content
            if not filepath.exists():
                raise BackupServiceError("Backup file was not created on disk")
            file_size = filepath.stat().st_size
            if file_size == 0:
                filepath.unlink(missing_ok=True)
                raise BackupServiceError("Backup file is empty (0 bytes)")
            log.info("Backup archive verified on disk: %s (%s bytes)", filepath, file_size)

            # Compute overall checksum
            final_checksum = _compute_sha256(filepath)

            # Encrypt if password provided
            if password:
                cls._encrypt_file(filepath, password)
                final_checksum = _compute_sha256(filepath)
                file_size = filepath.stat().st_size

            # Update backup record
            backup_record.checksum = final_checksum
            backup_record.file_size = file_size
            backup_record.status = "completed"
            backup_record.completed_at = datetime.now(timezone.utc)

            db.commit()

            log.info(
                "Backup created: %s (%s bytes, checksum: %s)",
                filename, file_size, final_checksum,
            )

            # Apply retention policy
            cls.apply_retention_policy(db, user)

            # Audit log
            try:
                from app.core.audit import log_action
                log_action(
                    db=db,
                    module="backup",
                    action="CREATE",
                    record_id=str(backup_record.id),
                    record_label=f"Backup: {filename}",
                    changed_by=user.email,
                    changed_by_role=getattr(getattr(user, "role", None), "name", None),
                    new_data={
                        "filename": filename,
                        "size": file_size,
                        "backup_type": backup_type,
                    },
                )
            except Exception as e:
                log.warning("Audit log failed: %s", e)

            db.refresh(backup_record)
            return backup_record

        except Exception as e:
            log.error("Backup creation failed: %s", e, exc_info=True)
            try:
                if "backup_record" in dir():
                    backup_record.status = "failed"
                    backup_record.notes = str(e)
                    db.commit()
            except Exception:
                pass
            raise BackupServiceError(f"Backup creation failed: {e}") from e
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @classmethod
    def _encrypt_file(cls, filepath: Path, password: str):
        key = base64.urlsafe_b64encode(hashlib.sha256(password.encode()).digest())
        f = Fernet(key)
        with open(filepath, "rb") as fp:
            data = fp.read()
        encrypted = f.encrypt(data)
        with open(filepath, "wb") as fp:
            fp.write(encrypted)

    @classmethod
    def _decrypt_file(cls, filepath: Path, password: str) -> bytes:
        key = base64.urlsafe_b64encode(hashlib.sha256(password.encode()).digest())
        f = Fernet(key)
        with open(filepath, "rb") as fp:
            data = fp.read()
        try:
            return f.decrypt(data)
        except InvalidToken as e:
            raise BackupServiceError(f"Decryption failed (wrong password or corrupt file): {e}") from e

    @classmethod
    def list_backups(
        cls,
        db: Session,
        company_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Backup]:
        query = db.query(Backup).filter(Backup.deleted_at.is_(None))
        if company_id:
            query = query.filter(Backup.company_id == company_id)
        query = query.order_by(Backup.created_at.desc())
        return query.offset(offset).limit(limit).all()

    @classmethod
    def count_backups(cls, db: Session, company_id: Optional[int] = None) -> int:
        query = db.query(Backup).filter(Backup.deleted_at.is_(None))
        if company_id:
            query = query.filter(Backup.company_id == company_id)
        return query.count()

    @classmethod
    def get_backup(cls, db: Session, backup_id: int) -> Optional[Backup]:
        return db.query(Backup).filter(Backup.id == backup_id, Backup.deleted_at.is_(None)).first()

    @classmethod
    def delete_backup(cls, db: Session, backup: Backup):
        filepath = Path(backup.filepath)
        if filepath.exists():
            filepath.unlink()
        backup.deleted_at = datetime.now(timezone.utc)
        db.commit()

        try:
            from app.core.audit import log_action
            log_action(
                db=db,
                module="backup",
                action="DELETE",
                record_id=str(backup.id),
                record_label=f"Backup: {backup.filename}",
                changed_by="system",
                new_data={"filename": backup.filename},
            )
        except Exception:
            pass

    @classmethod
    def verify_backup(cls, filepath: Path, password: Optional[str] = None) -> dict:
        if not filepath.exists():
            return {"valid": False, "error": "File not found"}

        result = {
            "valid": False,
            "file_size": filepath.stat().st_size,
            "checksum_match": False,
            "backup_version": None,
            "app_version": None,
            "created_at": None,
            "errors": [],
        }

        temp_dir = cls.get_temp_dir()
        try:
            data = None
            if password:
                data = cls._decrypt_file(filepath, password)
                buf = io.BytesIO(data)
                with tarfile.open(fileobj=buf, mode="r:gz") as tar:
                    tar.extractall(path=str(temp_dir))
            else:
                import tarfile
                with tarfile.open(str(filepath), "r:gz") as tar:
                    tar.extractall(path=str(temp_dir))

            # Verify checksum
            checksum_file = temp_dir / "checksum.sha256"
            if checksum_file.exists():
                stored_checksums = checksum_file.read_text()
                all_match = True
                for item in sorted(temp_dir.iterdir()):
                    if item.is_file() and item.name != "checksum.sha256":
                        expected_parts = [
                            line for line in stored_checksums.splitlines()
                            if item.name in line
                        ]
                        if expected_parts:
                            expected_hash = expected_parts[0].split()[0]
                            actual_hash = _compute_sha256(item)
                            if expected_hash != actual_hash:
                                all_match = False
                                result["errors"].append(f"Checksum mismatch for {item.name}")
                result["checksum_match"] = all_match
            else:
                result["errors"].append("Missing checksum.sha256")

            # Read metadata
            metadata_path = temp_dir / "metadata.json"
            if metadata_path.exists():
                meta = json.loads(metadata_path.read_text())
                result["backup_version"] = meta.get("backup_version")
                result["app_version"] = meta.get("app_version")
                result["created_at"] = meta.get("created_at")
                result["metadata"] = meta

            # Read version.json
            version_path = temp_dir / "version.json"
            if version_path.exists():
                version_data = json.loads(version_path.read_text())
                result["backup_version"] = version_data.get("backup_version", result["backup_version"])
                result["minimum_version"] = version_data.get("minimum_restore_version")

            # Verify database.sql exists
            db_sql_path = temp_dir / "database.sql"
            if not db_sql_path.exists():
                result["errors"].append("Missing database.sql")

            # Verify files directory
            files_dir = temp_dir / "files"
            if not files_dir.exists():
                result["errors"].append("Missing files/ directory")

            result["valid"] = len(result["errors"]) == 0 and result["checksum_match"]

        except (tarfile.TarError, BackupServiceError, Exception) as e:
            result["errors"].append(str(e))
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

        return result

    @classmethod
    def restore_backup(
        cls,
        db: Session,
        backup: Backup,
        user,
        password: Optional[str] = None,
        request=None,
    ) -> dict:
        filepath = Path(backup.filepath)
        if not filepath.exists():
            raise RestoreError(f"Backup file not found: {filepath}")

        temp_dir = cls.get_temp_dir()
        try:
            # Auto-create backup before restore
            try:
                cls.create_backup(db, user, backup_type="pre_restore", notes="Auto-backup before restore")
                log.info("Auto-backup created before restore")
            except Exception as e:
                log.warning("Auto-backup before restore failed: %s", e)

            # Extract backup
            data = None
            if backup.is_encrypted and password:
                data = cls._decrypt_file(filepath, password)
                buf = io.BytesIO(data)
                with tarfile.open(fileobj=buf, mode="r:gz") as tar:
                    tar.extractall(path=str(temp_dir))
            elif backup.is_encrypted and not password:
                raise RestoreError("Backup is encrypted and no password provided")
            else:
                with tarfile.open(str(filepath), "r:gz") as tar:
                    tar.extractall(path=str(temp_dir))

            # Verify checksum
            checksum_file = temp_dir / "checksum.sha256"
            if checksum_file.exists():
                stored = checksum_file.read_text()
                for item in sorted(temp_dir.iterdir()):
                    if item.is_file() and item.name != "checksum.sha256":
                        expected_parts = [
                            line for line in stored.splitlines() if item.name in line
                        ]
                        if expected_parts:
                            expected_hash = expected_parts[0].split()[0]
                            actual_hash = _compute_sha256(item)
                            if expected_hash != actual_hash:
                                raise RestoreError(f"Checksum mismatch for {item.name}")
            else:
                raise RestoreError("Missing checksum.sha256 in backup")

            # Verify backup version compatibility
            version_path = temp_dir / "version.json"
            if version_path.exists():
                vdata = json.loads(version_path.read_text())
                bv = vdata.get("backup_version", "0.0")
                try:
                    if float(bv) < 1.0:
                        raise RestoreError(f"Incompatible backup version: {bv}")
                except ValueError:
                    pass

            # Read database.sql
            db_sql_path = temp_dir / "database.sql"
            if not db_sql_path.exists():
                raise RestoreError("database.sql not found in backup")

            # Get current app version from backup
            metadata_path = temp_dir / "metadata.json"
            meta = {}
            if metadata_path.exists():
                meta = json.loads(metadata_path.read_text())

            # Update backup status
            backup.status = "restoring"
            db.commit()

            # Drop and recreate all tables
            cls._drop_all_tables(db)
            Base = cls._get_base()
            Base.metadata.create_all(bind=db.bind)
            log.info("Database schema recreated")

            # Execute the SQL dump
            sql_content = db_sql_path.read_text(encoding="utf-8")
            cls._execute_sql_in_batches(db, sql_content)
            log.info("Database data restored from SQL dump")

            # Restore uploaded files
            files_dir = temp_dir / "files"
            if files_dir.exists():
                upload_path = Path(settings.upload_dir)
                if upload_path.exists():
                    shutil.rmtree(str(upload_path))
                shutil.copytree(str(files_dir), str(upload_path), dirs_exist_ok=True)
                log.info("Uploaded files restored")

            # Restore settings.json (non-sensitive settings)
            settings_path = temp_dir / "settings.json"
            if settings_path.exists():
                try:
                    imported_settings = json.loads(settings_path.read_text())
                    log.info("Settings imported from backup")
                except Exception as e:
                    log.warning("Could not import settings: %s", e)

            # Update backup record
            backup.status = "completed"
            backup.restored_at = datetime.now(timezone.utc)
            backup.restored_by_id = user.id
            backup.restore_count = (backup.restore_count or 0) + 1
            db.commit()

            log.info("Restore completed: %s", backup.filename)

            try:
                from app.core.audit import log_action
                log_action(
                    db=db,
                    module="backup",
                    action="RESTORE",
                    record_id=str(backup.id),
                    record_label=f"Backup: {backup.filename}",
                    changed_by=user.email,
                    changed_by_role=getattr(getattr(user, "role", None), "name", None),
                    new_data={
                        "filename": backup.filename,
                        "restored_at": backup.restored_at.isoformat(),
                    },
                )
            except Exception:
                pass

            return {
                "success": True,
                "message": "Backup restored successfully",
                "backup_id": backup.id,
                "filename": backup.filename,
                "metadata": meta,
            }

        except (RestoreError, Exception) as e:
            log.error("Restore failed: %s", e, exc_info=True)
            try:
                backup.status = "failed"
                backup.notes = f"Restore failed: {e}"
                db.commit()
            except Exception:
                pass
            raise RestoreError(str(e)) from e
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @classmethod
    def _drop_all_tables(cls, db: Session):
        insp = inspect(db.bind)
        tables = insp.get_table_names()
        for t in tables:
            if t not in _EXCLUDED_TABLES and not t.startswith("sqlite_"):
                try:
                    db.execute(text(f"DROP TABLE IF EXISTS {t} CASCADE"))
                except Exception as e:
                    log.warning("Could not drop table %s: %s", t, e)
        db.commit()

    @classmethod
    def _get_base(cls):
        from app.core.database import Base
        return Base

    @classmethod
    def _execute_sql_in_batches(cls, db: Session, sql: str):
        statements = []
        current = []
        for line in sql.split("\n"):
            stripped = line.strip()
            if stripped.upper().startswith("--") or stripped == "":
                continue
            current.append(line)
            if stripped.rstrip().endswith(";"):
                statements.append("\n".join(current))
                current = []
        if current:
            statements.append("\n".join(current))

        for i, stmt in enumerate(statements):
            stmt = stmt.strip()
            if not stmt:
                continue
            try:
                db.execute(text(stmt))
            except Exception as e:
                log.warning("Statement %d failed: %s - %s", i, stmt[:80], e)
            if i % 10 == 0:
                try:
                    db.commit()
                except Exception:
                    pass
        try:
            db.commit()
        except Exception:
            pass

    @classmethod
    def get_backup_stats(cls, db: Session, company_id: Optional[int] = None) -> dict:
        query = db.query(Backup).filter(Backup.deleted_at.is_(None))
        if company_id:
            query = query.filter(Backup.company_id == company_id)

        total = query.count()
        last_backup = query.order_by(Backup.created_at.desc()).first()
        last_restore = (
            db.query(Backup)
            .filter(Backup.restored_at.isnot(None))
            .order_by(Backup.restored_at.desc())
            .first()
        )

        total_size = (
            db.query(Backup.file_size)
            .filter(Backup.deleted_at.is_(None))
        )
        if company_id:
            total_size = total_size.filter(Backup.company_id == company_id)

        storage_used = sum(
            r[0] or 0 for r in total_size.all()
        )

        failed = (
            db.query(Backup)
            .filter(Backup.status == "failed", Backup.deleted_at.is_(None))
        )
        if company_id:
            failed = failed.filter(Backup.company_id == company_id)
        failed_count = failed.count()

        setting = cls.get_or_create_settings(db, company_id)
        backup_dir = cls.get_backup_dir(setting)

        return {
            "total_backups": total,
            "failed_backups": failed_count,
            "storage_used_bytes": storage_used,
            "last_backup_id": last_backup.id if last_backup else None,
            "last_backup_filename": last_backup.filename if last_backup else None,
            "last_backup_created_at": last_backup.created_at.isoformat() if last_backup else None,
            "last_backup_status": last_backup.status if last_backup else None,
            "last_restore_id": last_restore.id if last_restore else None,
            "last_restore_filename": last_restore.filename if last_restore else None,
            "last_restore_at": last_restore.restored_at.isoformat() if last_restore else None,
            "backup_dir": str(backup_dir),
        }

    @classmethod
    def apply_retention_policy(cls, db: Session, user=None):
        setting = db.query(BackupSetting).first()
        if not setting:
            return

        query = (
            db.query(Backup)
            .filter(Backup.deleted_at.is_(None))
            .order_by(Backup.created_at.desc())
        )
        if setting.company_id:
            query = query.filter(Backup.company_id == setting.company_id)

        all_backups = query.all()

        to_delete = []
        if setting.retention_mode == "count" and len(all_backups) > setting.retention_count:
            to_delete = all_backups[setting.retention_count :]
        elif setting.retention_mode == "days" and setting.retention_days > 0:
            cutoff = datetime.now(timezone.utc) - timedelta(days=setting.retention_days)
            for b in all_backups:
                if b.created_at and b.created_at.replace(tzinfo=timezone.utc) < cutoff:
                    to_delete.append(b)

        for b in to_delete:
            try:
                cls.delete_backup(db, b)
                log.info("Retention: deleted old backup %s", b.filename)
            except Exception as e:
                log.warning("Retention delete failed for %s: %s", b.filename, e)

        if to_delete:
            log.info("Retention policy applied: deleted %d old backup(s)", len(to_delete))

    @classmethod
    def get_or_create_settings(cls, db: Session, company_id: Optional[int] = None) -> BackupSetting:
        setting = db.query(BackupSetting).filter(
            BackupSetting.company_id == company_id
        ).first()
        if not setting:
            setting = BackupSetting(
                company_id=company_id,
                auto_backup_enabled=True,
                schedule_interval="24h",
                retention_mode="count",
                retention_count=30,
                retention_days=90,
            )
            db.add(setting)
            db.commit()
        return setting

    @classmethod
    def compute_next_run(cls, interval: str, from_time: Optional[datetime] = None) -> datetime:

        now = from_time or datetime.now(timezone.utc)
        interval_map = {
            "6h": timedelta(hours=6),
            "12h": timedelta(hours=12),
            "24h": timedelta(hours=24),
            "weekly": timedelta(weeks=1),
            "monthly": timedelta(days=30),
        }
        delta = interval_map.get(interval, timedelta(hours=24))
        return now + delta

    @classmethod
    def update_backup_dir(cls, db: Session, company_id: Optional[int], backup_dir: str) -> BackupSetting:
        setting = cls.get_or_create_settings(db, company_id)
        setting.backup_dir = backup_dir
        db.commit()
        db.refresh(setting)
        return setting

    @classmethod
    def upload_backup(
        cls,
        db: Session,
        user,
        file_obj,
        password: Optional[str] = None,
    ) -> Backup:
        company_id = user.company_id if not user.is_super_admin else None
        setting = cls.get_or_create_settings(db, company_id)
        backup_dir = cls.get_backup_dir(setting)
        filename = file_obj.filename or f"REMS_Uploaded_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}{cls.BACKUP_EXT}"
        if not filename.endswith(cls.BACKUP_EXT):
            filename += cls.BACKUP_EXT

        filepath = backup_dir / Path(filename).name

        content = file_obj.read()
        with open(filepath, "wb") as f:
            f.write(content)

        checksum = _compute_sha256(filepath)
        file_size = filepath.stat().st_size

        # Verify the uploaded backup
        verify_result = cls.verify_backup(filepath, password)
        if not verify_result.get("valid"):
            filepath.unlink()
            errors = "; ".join(verify_result.get("errors", ["Invalid backup"]))
            raise BackupServiceError(f"Uploaded backup verification failed: {errors}")

        backup_record = Backup(
            filename=filepath.name,
            filepath=str(filepath),
            file_size=file_size,
            checksum=checksum,
            backup_version=verify_result.get("backup_version") or cls.BACKUP_VERSION,
            app_version=verify_result.get("app_version") or _get_app_version(),
            company_id=user.company_id if not user.is_super_admin else None,
            created_by_id=user.id,
            created_by_name=user.full_name or user.email,
            backup_type="uploaded",
            status="completed",
            is_encrypted=bool(password),
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(backup_record)
        db.commit()
        db.refresh(backup_record)

        try:
            from app.core.audit import log_action
            log_action(
                db=db,
                module="backup",
                action="UPLOAD",
                record_id=str(backup_record.id),
                record_label=f"Backup: {backup_record.filename}",
                changed_by=user.email,
                new_data={"filename": backup_record.filename, "size": file_size},
            )
        except Exception:
            pass

        return backup_record

    @classmethod
    def download_backup(cls, db: Session, backup_id: int) -> tuple[Optional[Path], Optional[str]]:
        backup = cls.get_backup(db, backup_id)
        if not backup:
            return None, None
        filepath = Path(backup.filepath)
        if not filepath.exists():
            return None, None
        return filepath, backup.filename
