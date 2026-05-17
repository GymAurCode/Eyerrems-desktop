"""Fix missing company_id columns on all tables.

Revision ID: 0029_fix_missing_company_id
Revises: 0028_maintenance_unit_id
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0029_fix_missing_company_id"
down_revision = "0028_maintenance_unit_id"
branch_labels = None
depends_on = None

ALL_TABLES = [
    "users",
    "roles",
    "audit_logs",
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

def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    for table in ALL_TABLES:
        if not inspector.has_table(table):
            continue
        
        columns = [c["name"] for c in inspector.get_columns(table)]
        if "company_id" not in columns:
            print(f"[0029] Adding company_id column to table: {table}")
            op.add_column(
                table,
                sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
            )
            op.create_index(f"ix_{table}_company_id", table, ["company_id"])
            # Seed with default company if empty/NULL
            conn.execute(sa.text(f"UPDATE {table} SET company_id = 1 WHERE company_id IS NULL"))
            
        if table in ["invoices", "commissions"] and "description" not in columns:
            print(f"[0029] Adding description column to table: {table}")
            op.add_column(
                table,
                sa.Column("description", sa.String(length=500), nullable=True)
            )

def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    for table in ALL_TABLES:
        if not inspector.has_table(table):
            continue
        
        columns = [c["name"] for c in inspector.get_columns(table)]
        if "company_id" in columns:
            op.drop_index(f"ix_{table}_company_id", table)
            op.drop_column(table, "company_id")
            
        if table in ["invoices", "commissions"] and "description" in columns:
            op.drop_column(table, "description")
