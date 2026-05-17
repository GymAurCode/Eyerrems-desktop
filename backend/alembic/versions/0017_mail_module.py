"""mail_module

Revision ID: 0017_mail_module
Revises: 0016_hr_module
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "0017_mail_module"
down_revision = "0016_hr_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # email_accounts
    op.create_table(
        "email_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("email_address", sa.String(255), nullable=False, unique=True),
        sa.Column("smtp_host", sa.String(255), nullable=False),
        sa.Column("smtp_port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("smtp_use_tls", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("imap_host", sa.String(255), nullable=False),
        sa.Column("imap_port", sa.Integer(), nullable=False, server_default="993"),
        sa.Column("imap_use_ssl", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("encrypted_password", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_sync_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # email_threads
    op.create_table(
        "email_threads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("email_accounts.id"), nullable=False),
        sa.Column("subject", sa.String(998), nullable=False),
        sa.Column("last_message_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("has_unread", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # emails
    op.create_table(
        "emails",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("email_accounts.id"), nullable=False),
        sa.Column("thread_id", sa.Integer(), sa.ForeignKey("email_threads.id"), nullable=True),
        sa.Column("message_id", sa.String(998), nullable=True, index=True),
        sa.Column("imap_uid", sa.BigInteger(), nullable=True),
        sa.Column("folder", sa.String(50), nullable=False, server_default="inbox"),
        sa.Column("from_address", sa.String(998), nullable=False),
        sa.Column("from_name", sa.String(255), nullable=True),
        sa.Column("to_addresses", sa.Text(), nullable=False),
        sa.Column("cc_addresses", sa.Text(), nullable=True),
        sa.Column("bcc_addresses", sa.Text(), nullable=True),
        sa.Column("subject", sa.String(998), nullable=False, server_default="(no subject)"),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("body_html", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_starred", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # email_attachments
    op.create_table(
        "email_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email_id", sa.Integer(), sa.ForeignKey("emails.id"), nullable=False),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("content_type", sa.String(255), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("storage_path", sa.String(1024), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Indexes for performance
    op.create_index("ix_emails_account_folder", "emails", ["account_id", "folder"])
    op.create_index("ix_emails_date", "emails", ["date"])
    op.create_index("ix_email_threads_account", "email_threads", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_email_threads_account", "email_threads")
    op.drop_index("ix_emails_date", "emails")
    op.drop_index("ix_emails_account_folder", "emails")
    op.drop_table("email_attachments")
    op.drop_table("emails")
    op.drop_table("email_threads")
    op.drop_table("email_accounts")
