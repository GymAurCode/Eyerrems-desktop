"""Multi-Tenant SaaS — companies, company_features, company_id on all tables.

Revision ID: 0020_multitenant_saas
Revises: 0019_rbac_system
Create Date: 2026-05-05 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0020_multitenant_saas'
down_revision = '0019_rbac_system'
branch_labels = None
depends_on = None

# Tables that get company_id added (excluding users/roles/audit_logs which are handled separately)
BUSINESS_TABLES = [
    "properties",
    "property_categories",
    "locations",
    "leads",
    "clients",
    "dealers",
    "deals",
    "installment_plans",
    "accounts",
    "journals",
    "invoices",
    "payments",
    "commissions",
    "expenses",
    "tenants",
    "tenant_leases",
    "departments",
    "positions",
    "branches",
    "employees",
    "leave_types",
    "holidays",
    "construction_projects",
    "contractors",
    "email_accounts",
    "reminders",
]


def _add_company_id(table: str, conn) -> None:
    """Add company_id column to a table, skip if already exists."""
    try:
        conn.execute(sa.text(
            f"ALTER TABLE {table} ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL"
        ))
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS ix_{table}_company_id ON {table}(company_id)"
        ))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_add_col"))
    else:
        conn.execute(sa.text("RELEASE SAVEPOINT sp_add_col"))


def upgrade():
    conn = op.get_bind()

    # ── 1. Create companies table ─────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id",         sa.Integer(),  primary_key=True),
        sa.Column("name",       sa.String(200), nullable=False),
        sa.Column("slug",       sa.String(100), nullable=False, unique=True),
        sa.Column("status",     sa.String(20),  nullable=False, server_default="active"),
        sa.Column("plan",       sa.String(30),  nullable=False, server_default="free"),
        sa.Column("created_at", sa.DateTime(),  nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(),  nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_companies_slug",   "companies", ["slug"],   unique=True)
    op.create_index("ix_companies_status", "companies", ["status"])

    # ── 2. Create company_features table ─────────────────────────────────────
    op.create_table(
        "company_features",
        sa.Column("id",          sa.Integer(),  primary_key=True),
        sa.Column("company_id",  sa.Integer(),  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_key", sa.String(80), nullable=False),
        sa.Column("enabled",     sa.Boolean(),  nullable=False, server_default="true"),
        sa.Column("updated_at",  sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_company_features_company_id",  "company_features", ["company_id"])
    op.create_index("ix_company_features_feature_key", "company_features", ["feature_key"])

    # ── 3. Seed default company ───────────────────────────────────────────────
    conn.execute(sa.text(
        "INSERT INTO companies (name, slug, status, plan) VALUES ('Default Company', 'default', 'active', 'enterprise')"
    ))

    # ── 4. Add company_id to users, roles, audit_logs ────────────────────────
    for table in ("users", "roles", "audit_logs"):
        conn.execute(sa.text("SAVEPOINT sp_add_col"))
        try:
            conn.execute(sa.text(
                f"ALTER TABLE {table} ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL"
            ))
            conn.execute(sa.text(
                f"CREATE INDEX IF NOT EXISTS ix_{table}_company_id ON {table}(company_id)"
            ))
            conn.execute(sa.text("RELEASE SAVEPOINT sp_add_col"))
        except Exception:
            conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_add_col"))

    # ── 5. Add is_super_admin to users ────────────────────────────────────────
    conn.execute(sa.text("SAVEPOINT sp_super"))
    try:
        conn.execute(sa.text(
            "ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_super"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_super"))

    # ── 6. Add company_id to all business tables ──────────────────────────────
    for table in BUSINESS_TABLES:
        conn.execute(sa.text("SAVEPOINT sp_add_col"))
        try:
            conn.execute(sa.text(
                f"ALTER TABLE {table} ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL"
            ))
            conn.execute(sa.text(
                f"CREATE INDEX IF NOT EXISTS ix_{table}_company_id ON {table}(company_id)"
            ))
            conn.execute(sa.text("RELEASE SAVEPOINT sp_add_col"))
        except Exception:
            conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_add_col"))

    # ── 7. Assign all existing rows to default company (id=1) ─────────────────
    all_tables = ["users", "roles", "audit_logs"] + BUSINESS_TABLES
    for table in all_tables:
        conn.execute(sa.text("SAVEPOINT sp_update"))
        try:
            conn.execute(sa.text(f"UPDATE {table} SET company_id = 1 WHERE company_id IS NULL"))
            conn.execute(sa.text("RELEASE SAVEPOINT sp_update"))
        except Exception:
            conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_update"))

    # ── 8. Seed default features for default company ──────────────────────────
    features = [
        "property_module", "crm_module", "finance_module", "tenant_module",
        "construction_module", "hr_module", "mail_module", "reminders_module",
    ]
    for feat in features:
        conn.execute(sa.text(
            f"INSERT INTO company_features (company_id, feature_key, enabled) VALUES (1, '{feat}', true)"
        ))

    # ── 9. Remove global unique constraint on roles.name ─────────────────────
    conn.execute(sa.text("SAVEPOINT sp_roles_idx"))
    try:
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_roles_name"))
        conn.execute(sa.text("ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_roles_name ON roles(name)"))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_roles_idx"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_roles_idx"))


def downgrade():
    conn = op.get_bind()

    # Remove is_super_admin
    conn.execute(sa.text("SAVEPOINT sp_drop"))
    try:
        conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS is_super_admin"))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_drop"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_drop"))

    # Remove company_id from all tables
    all_tables = ["users", "roles", "audit_logs"] + BUSINESS_TABLES
    for table in all_tables:
        conn.execute(sa.text("SAVEPOINT sp_drop_col"))
        try:
            conn.execute(sa.text(f"DROP INDEX IF EXISTS ix_{table}_company_id"))
            conn.execute(sa.text(f"ALTER TABLE {table} DROP COLUMN IF EXISTS company_id"))
            conn.execute(sa.text("RELEASE SAVEPOINT sp_drop_col"))
        except Exception:
            conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_drop_col"))

    op.drop_table("company_features")
    op.drop_table("companies")
