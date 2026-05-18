"""Import batches and row logs

Revision ID: 0033_import_module
Revises: 0032_town_units_upgrade
Create Date: 2026-05-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0033_import_module"
down_revision = "0032_town_units_upgrade"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if tables already exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if "import_batches" not in existing_tables:
        op.create_table(
        "import_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("module_key", sa.String(64), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_format", sa.String(10), nullable=False),
        sa.Column("duplicate_mode", sa.String(20), nullable=False, server_default="skip"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imported_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True),
        sa.Column("imported_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
        op.create_index("ix_import_batches_module_key", "import_batches", ["module_key"])
        op.create_index("ix_import_batches_company_id", "import_batches", ["company_id"])
    else:
        print("import_batches table already exists, skipping creation")

    if "import_row_logs" not in existing_tables:
        op.create_table(
        "import_row_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("import_batches.id"), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("row_data_json", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(64), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
    )
        op.create_index("ix_import_row_logs_batch_id", "import_row_logs", ["batch_id"])
    else:
        print("import_row_logs table already exists, skipping creation")


def downgrade() -> None:
    op.drop_table("import_row_logs")
    op.drop_table("import_batches")
