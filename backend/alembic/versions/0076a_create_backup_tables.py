"""Create backup tables (backups, backup_settings)

Revision ID: 0076a_create_backup_tables
Revises: 73280885add4
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0076a_create_backup_tables"
down_revision: Union[str, None] = "73280885add4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ─── backups ─────────────────────────────────────────────────────────────
    if not inspect(conn).has_table("backups"):
        op.create_table(
            "backups",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("filename", sa.String(255), nullable=False),
            sa.Column("filepath", sa.String(512), nullable=False),
            sa.Column("file_size", sa.BigInteger(), server_default=sa.text("0")),
            sa.Column("checksum", sa.String(64), nullable=False),
            sa.Column("backup_version", sa.String(10), nullable=False, server_default=sa.text("'1.0'")),
            sa.Column("app_version", sa.String(20), nullable=False),
            sa.Column("db_version", sa.String(20), server_default=sa.text("'1.0'")),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True),
            sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_by_name", sa.String(255), nullable=True),
            sa.Column("backup_type", sa.String(20), server_default=sa.text("'manual'")),
            sa.Column("status", sa.String(20), server_default=sa.text("'completed'")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_encrypted", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("encryption_method", sa.String(50), nullable=True),
            sa.Column("restored_at", sa.DateTime(), nullable=True),
            sa.Column("restored_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("restore_count", sa.Integer(), server_default=sa.text("0")),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("deleted_at", sa.DateTime(), nullable=True),
        )

    # ─── backup_settings (without backup_dir — added by 0077) ────────────────
    if not inspect(conn).has_table("backup_settings"):
        op.create_table(
            "backup_settings",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True, unique=True),
            sa.Column("auto_backup_enabled", sa.Boolean(), server_default=sa.text("true")),
            sa.Column("schedule_interval", sa.String(20), server_default=sa.text("'24h'")),
            sa.Column("retention_mode", sa.String(10), server_default=sa.text("'count'")),
            sa.Column("retention_count", sa.Integer(), server_default=sa.text("30")),
            sa.Column("retention_days", sa.Integer(), server_default=sa.text("90")),
            sa.Column("last_scheduled_run", sa.DateTime(), nullable=True),
            sa.Column("next_scheduled_run", sa.DateTime(), nullable=True),
            sa.Column("encryption_enabled", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )


def downgrade() -> None:
    conn = op.get_bind()
    for tbl in ["backup_settings", "backups"]:
        if inspect(conn).has_table(tbl):
            op.drop_table(tbl)
