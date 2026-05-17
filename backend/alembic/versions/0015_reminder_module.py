"""reminder & notification module

Revision ID: 0015_reminder_module
Revises: 0014_construction_module
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0015_reminder_module"
down_revision = "0014_construction_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # reminder_templates
    op.create_table(
        "reminder_templates",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("title_tpl", sa.String(255), nullable=False),
        sa.Column("message_tpl", sa.Text, nullable=False),
        sa.Column("module", sa.String(60), nullable=True),
        sa.Column("default_pre_alert_minutes", sa.Integer, nullable=False, server_default="30"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # reminders
    op.create_table(
        "reminders",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("module_name", sa.String(60), nullable=True),
        sa.Column("record_id", sa.Integer, nullable=True),
        sa.Column("due_time", sa.DateTime, nullable=False),
        sa.Column("recurrence", sa.String(20), nullable=False, server_default="none"),
        sa.Column("cron_expr", sa.String(100), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("pre_alert_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("template_id", sa.Integer, sa.ForeignKey("reminder_templates.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("snoozed_until", sa.DateTime, nullable=True),
        sa.Column("next_fire_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_reminders_module_name", "reminders", ["module_name"])
    op.create_index("ix_reminders_record_id", "reminders", ["record_id"])
    op.create_index("ix_reminders_due_time", "reminders", ["due_time"])
    op.create_index("ix_reminders_status", "reminders", ["status"])
    op.create_index("ix_reminders_next_fire_at", "reminders", ["next_fire_at"])
    op.create_index("ix_reminders_due_status", "reminders", ["due_time", "status"])
    op.create_index("ix_reminders_next_fire", "reminders", ["next_fire_at", "status"])

    # reminder_assignments
    op.create_table(
        "reminder_assignments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("reminder_id", sa.Integer, sa.ForeignKey("reminders.id"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reminder_assignments_reminder_id", "reminder_assignments", ["reminder_id"])
    op.create_index("ix_reminder_assignments_user_id", "reminder_assignments", ["user_id"])

    # notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reminder_id", sa.Integer, sa.ForeignKey("reminders.id"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("channel", sa.String(20), nullable=False, server_default="in_app"),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("notif_type", sa.String(20), nullable=False, server_default="info"),
        sa.Column("module_name", sa.String(60), nullable=True),
        sa.Column("record_id", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("read_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "is_read"])

    # notification_logs
    op.create_table(
        "notification_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("notification_id", sa.Integer, sa.ForeignKey("notifications.id"), nullable=False),
        sa.Column("reminder_id", sa.Integer, sa.ForeignKey("reminders.id"), nullable=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("triggered_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("delivered_at", sa.DateTime, nullable=True),
        sa.Column("read_at", sa.DateTime, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="delivered"),
    )
    op.create_index("ix_notification_logs_notification_id", "notification_logs", ["notification_id"])
    op.create_index("ix_notification_logs_user_id", "notification_logs", ["user_id"])

    # reminder_settings
    op.create_table(
        "reminder_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("sound_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("in_app_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("default_pre_alert_mins", sa.Integer, nullable=False, server_default="30"),
        sa.Column("module_preferences", sa.Text, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("reminder_settings")
    op.drop_table("notification_logs")
    op.drop_table("notifications")
    op.drop_table("reminder_assignments")
    op.drop_table("reminders")
    op.drop_table("reminder_templates")
