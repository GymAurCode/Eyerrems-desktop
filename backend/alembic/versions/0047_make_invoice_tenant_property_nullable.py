"""Make invoices.tenant_id and invoices.property_id nullable

Revision ID: 0047_make_invoice_tenant_property_nullable
Revises: 0046_add_invoice_type_column
Create Date: 2026-06-07 15:35:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0047_make_invoice_tenant_property_nullable"
down_revision = "0046_add_invoice_type_column"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.alter_column("tenant_id", nullable=True)
        batch_op.alter_column("property_id", nullable=True)


def downgrade():
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.alter_column("tenant_id", nullable=False)
        batch_op.alter_column("property_id", nullable=False)
