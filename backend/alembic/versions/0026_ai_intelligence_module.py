"""AI Intelligence Center — anomalies, risk scores, alerts, duplicates, queries, insights.

Revision ID: 0026_ai_intelligence_module
Revises: 0025_currency_settings
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0026_ai_intelligence_module"
down_revision = "0025_currency_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ai_anomalies ──────────────────────────────────────────────────────────
    op.create_table(
        "ai_anomalies",
        sa.Column("id",           sa.Integer(),     nullable=False),
        sa.Column("company_id",   sa.Integer(),     nullable=False),
        sa.Column("anomaly_type", sa.String(80),    nullable=False),
        sa.Column("severity",     sa.String(20),    nullable=False, server_default="MEDIUM"),
        sa.Column("module",       sa.String(50),    nullable=True),
        sa.Column("entity_type",  sa.String(80),    nullable=True),
        sa.Column("entity_id",    sa.Integer(),     nullable=True),
        sa.Column("user_id",      sa.Integer(),     nullable=True),
        sa.Column("description",  sa.Text(),        nullable=False),
        sa.Column("details",      sa.Text(),        nullable=True),
        sa.Column("risk_score",   sa.Float(),       nullable=False, server_default="0"),
        sa.Column("is_resolved",  sa.Boolean(),     nullable=False, server_default="false"),
        sa.Column("resolved_by",  sa.Integer(),     nullable=True),
        sa.Column("resolved_at",  sa.DateTime(),    nullable=True),
        sa.Column("created_at",   sa.DateTime(),    nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"],    ["users.id"],     ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by"],["users.id"],     ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_anomalies_company_id",   "ai_anomalies", ["company_id"])
    op.create_index("ix_ai_anomalies_anomaly_type", "ai_anomalies", ["anomaly_type"])
    op.create_index("ix_ai_anomalies_severity",     "ai_anomalies", ["severity"])
    op.create_index("ix_ai_anomalies_user_id",      "ai_anomalies", ["user_id"])
    op.create_index("ix_ai_anomalies_is_resolved",  "ai_anomalies", ["is_resolved"])
    op.create_index("ix_ai_anomalies_created_at",   "ai_anomalies", ["created_at"])

    # ── ai_risk_scores ────────────────────────────────────────────────────────
    op.create_table(
        "ai_risk_scores",
        sa.Column("id",            sa.Integer(),  nullable=False),
        sa.Column("company_id",    sa.Integer(),  nullable=False),
        sa.Column("subject_type",  sa.String(40), nullable=False),
        sa.Column("subject_id",    sa.Integer(),  nullable=False),
        sa.Column("score",         sa.Float(),    nullable=False, server_default="0"),
        sa.Column("risk_level",    sa.String(20), nullable=False, server_default="LOW"),
        sa.Column("factors",       sa.Text(),     nullable=True),
        sa.Column("last_computed", sa.DateTime(), nullable=False),
        sa.Column("created_at",    sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_risk_scores_company_id",   "ai_risk_scores", ["company_id"])
    op.create_index("ix_ai_risk_scores_subject_type", "ai_risk_scores", ["subject_type"])
    op.create_index("ix_ai_risk_scores_subject_id",   "ai_risk_scores", ["subject_id"])
    op.create_index("ix_ai_risk_scores_risk_level",   "ai_risk_scores", ["risk_level"])

    # ── ai_alerts ─────────────────────────────────────────────────────────────
    op.create_table(
        "ai_alerts",
        sa.Column("id",           sa.Integer(),   nullable=False),
        sa.Column("company_id",   sa.Integer(),   nullable=False),
        sa.Column("alert_type",   sa.String(80),  nullable=False),
        sa.Column("severity",     sa.String(20),  nullable=False, server_default="MEDIUM"),
        sa.Column("title",        sa.String(255), nullable=False),
        sa.Column("message",      sa.Text(),      nullable=False),
        sa.Column("module",       sa.String(50),  nullable=True),
        sa.Column("entity_type",  sa.String(80),  nullable=True),
        sa.Column("entity_id",    sa.Integer(),   nullable=True),
        sa.Column("user_id",      sa.Integer(),   nullable=True),
        sa.Column("anomaly_id",   sa.Integer(),   nullable=True),
        sa.Column("is_read",      sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("is_dismissed", sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("created_at",   sa.DateTime(),  nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"],    ["users.id"],     ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["anomaly_id"], ["ai_anomalies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_alerts_company_id",   "ai_alerts", ["company_id"])
    op.create_index("ix_ai_alerts_alert_type",   "ai_alerts", ["alert_type"])
    op.create_index("ix_ai_alerts_severity",     "ai_alerts", ["severity"])
    op.create_index("ix_ai_alerts_user_id",      "ai_alerts", ["user_id"])
    op.create_index("ix_ai_alerts_is_read",      "ai_alerts", ["is_read"])
    op.create_index("ix_ai_alerts_is_dismissed", "ai_alerts", ["is_dismissed"])
    op.create_index("ix_ai_alerts_created_at",   "ai_alerts", ["created_at"])

    # ── ai_duplicate_matches ──────────────────────────────────────────────────
    op.create_table(
        "ai_duplicate_matches",
        sa.Column("id",           sa.Integer(),  nullable=False),
        sa.Column("company_id",   sa.Integer(),  nullable=False),
        sa.Column("entity_type",  sa.String(80), nullable=False),
        sa.Column("entity_id_a",  sa.Integer(),  nullable=False),
        sa.Column("entity_id_b",  sa.Integer(),  nullable=False),
        sa.Column("confidence",   sa.Float(),    nullable=False),
        sa.Column("match_fields", sa.Text(),     nullable=True),
        sa.Column("status",       sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewed_by",  sa.Integer(),  nullable=True),
        sa.Column("reviewed_at",  sa.DateTime(), nullable=True),
        sa.Column("created_at",   sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"],["users.id"],     ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_duplicate_matches_company_id",  "ai_duplicate_matches", ["company_id"])
    op.create_index("ix_ai_duplicate_matches_entity_type", "ai_duplicate_matches", ["entity_type"])
    op.create_index("ix_ai_duplicate_matches_status",      "ai_duplicate_matches", ["status"])
    op.create_index("ix_ai_duplicate_matches_created_at",  "ai_duplicate_matches", ["created_at"])

    # ── ai_queries ────────────────────────────────────────────────────────────
    op.create_table(
        "ai_queries",
        sa.Column("id",              sa.Integer(),   nullable=False),
        sa.Column("company_id",      sa.Integer(),   nullable=False),
        sa.Column("user_id",         sa.Integer(),   nullable=True),
        sa.Column("raw_query",       sa.Text(),      nullable=False),
        sa.Column("detected_intent", sa.String(80),  nullable=True),
        sa.Column("mapped_query",    sa.Text(),      nullable=True),
        sa.Column("result_summary",  sa.Text(),      nullable=True),
        sa.Column("result_count",    sa.Integer(),   nullable=True),
        sa.Column("execution_ms",    sa.Integer(),   nullable=True),
        sa.Column("was_blocked",     sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("block_reason",    sa.String(255), nullable=True),
        sa.Column("created_at",      sa.DateTime(),  nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"],    ["users.id"],     ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_queries_company_id",      "ai_queries", ["company_id"])
    op.create_index("ix_ai_queries_user_id",         "ai_queries", ["user_id"])
    op.create_index("ix_ai_queries_detected_intent", "ai_queries", ["detected_intent"])
    op.create_index("ix_ai_queries_created_at",      "ai_queries", ["created_at"])

    # ── ai_insights ───────────────────────────────────────────────────────────
    op.create_table(
        "ai_insights",
        sa.Column("id",              sa.Integer(),  nullable=False),
        sa.Column("company_id",      sa.Integer(),  nullable=False),
        sa.Column("period_type",     sa.String(20), nullable=False),
        sa.Column("period_label",    sa.String(40), nullable=False),
        sa.Column("summary_text",    sa.Text(),     nullable=False),
        sa.Column("metrics",         sa.Text(),     nullable=True),
        sa.Column("anomaly_count",   sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("alert_count",     sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("duplicate_count", sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("high_risk_count", sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("created_at",      sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_insights_company_id",  "ai_insights", ["company_id"])
    op.create_index("ix_ai_insights_period_type", "ai_insights", ["period_type"])
    op.create_index("ix_ai_insights_created_at",  "ai_insights", ["created_at"])


def downgrade() -> None:
    op.drop_table("ai_insights")
    op.drop_table("ai_queries")
    op.drop_table("ai_duplicate_matches")
    op.drop_table("ai_alerts")
    op.drop_table("ai_risk_scores")
    op.drop_table("ai_anomalies")
