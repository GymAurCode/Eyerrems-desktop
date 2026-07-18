"""Replace old reminder tables with new reminder system.

Revision ID: 0051
Revises: 0050_add_payment_missing_columns
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TIMESTAMP

revision = "0051"
down_revision = "0050_add_payment_missing_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old tables (CASCADE handles FK constraints)
    op.execute("DROP TABLE IF EXISTS reminder_assignments CASCADE")
    op.execute("DROP TABLE IF EXISTS notification_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
    op.execute("DROP TABLE IF EXISTS reminder_settings CASCADE")
    op.execute("DROP TABLE IF EXISTS reminders CASCADE")
    op.execute("DROP TABLE IF EXISTS reminder_templates CASCADE")

    # Create new reminder_templates table
    op.create_table(
        "reminder_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("title_template", sa.String(200), nullable=False),
        sa.Column("description_template", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("repeat", sa.String(10), nullable=False, server_default="none"),
        sa.Column("reminder_before", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reminder_templates_id"), "reminder_templates", ["id"])
    op.create_index(op.f("ix_reminder_templates_user_id"), "reminder_templates", ["user_id"])

    # Create new reminders table
    op.create_table(
        "reminders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(40), nullable=True),
        sa.Column("remind_at", TIMESTAMP(timezone=True), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("repeat", sa.String(10), nullable=False, server_default="none"),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("reminder_before", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notification_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("snoozed_until", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("completed_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"],),
        sa.ForeignKeyConstraint(["template_id"], ["reminder_templates.id"],),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reminders_id"), "reminders", ["id"])
    op.create_index(op.f("ix_reminders_user_id"), "reminders", ["user_id"])
    op.create_index(op.f("ix_reminders_category"), "reminders", ["category"])
    op.create_index(op.f("ix_reminders_remind_at"), "reminders", ["remind_at"])

    # Create new notification_logs table
    op.create_table(
        "notification_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("reminder_id", sa.Integer(), nullable=False),
        sa.Column("triggered_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("status", sa.String(12), nullable=False, server_default="delivered"),
        sa.Column("user_action", sa.String(12), nullable=True),
        sa.Column("snooze_minutes", sa.Integer(), nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["reminder_id"], ["reminders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notification_logs_id"), "notification_logs", ["id"])
    op.create_index(op.f("ix_notification_logs_reminder_id"), "notification_logs", ["reminder_id"])


def downgrade() -> None:
    # Drop new tables
    op.execute("DROP TABLE IF EXISTS notification_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS reminders CASCADE")
    op.execute("DROP TABLE IF EXISTS reminder_templates CASCADE")

    # Recreate old tables
    op.create_table(
        "reminder_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("title_tpl", sa.String(255), nullable=False),
        sa.Column("message_tpl", sa.Text(), nullable=False),
        sa.Column("module", sa.String(60), nullable=True),
        sa.Column("default_pre_alert_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "reminders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("module_name", sa.String(60), nullable=True),
        sa.Column("record_id", sa.Integer(), nullable=True),
        sa.Column("due_time", sa.DateTime(), nullable=False),
        sa.Column("recurrence", sa.String(20), nullable=False, server_default="none"),
        sa.Column("cron_expr", sa.String(100), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("pre_alert_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("snoozed_until", sa.DateTime(), nullable=True),
        sa.Column("next_fire_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "reminder_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reminder_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reminder_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False, server_default="in_app"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notif_type", sa.String(20), nullable=False, server_default="info"),
        sa.Column("module_name", sa.String(60), nullable=True),
        sa.Column("record_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "notification_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("notification_id", sa.Integer(), nullable=False),
        sa.Column("reminder_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(), nullable=False),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="delivered"),
    )

    op.create_table(
        "reminder_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("sound_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("in_app_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("default_pre_alert_mins", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("module_preferences", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
