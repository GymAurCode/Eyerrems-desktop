"""initial schema"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("roles", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(50), nullable=False, unique=True))
    op.create_table("permissions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("code", sa.String(120), nullable=False, unique=True), sa.Column("description", sa.String(255), nullable=True))
    op.create_table("role_permissions", sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), primary_key=True), sa.Column("permission_id", sa.Integer(), sa.ForeignKey("permissions.id"), primary_key=True))
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("email", sa.String(255), nullable=False, unique=True), sa.Column("full_name", sa.String(120), nullable=False), sa.Column("hashed_password", sa.String(255), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")), sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))
    op.create_table("properties", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("address", sa.String(255), nullable=True), sa.Column("description", sa.Text(), nullable=True), sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))
    op.create_table("floors", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.id"), nullable=False), sa.Column("floor_number", sa.Integer(), nullable=False))
    op.create_table("units", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("floor_id", sa.Integer(), sa.ForeignKey("floors.id"), nullable=False), sa.Column("unit_number", sa.String(20), nullable=False), sa.Column("status", sa.String(20), nullable=False), sa.Column("rent_amount", sa.Numeric(12, 2), nullable=True), sa.Column("sale_price", sa.Numeric(12, 2), nullable=True), sa.UniqueConstraint("floor_id", "unit_number", name="uq_floor_unit_number"))
    op.create_table("clients", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("email", sa.String(255), nullable=True), sa.Column("phone", sa.String(50), nullable=True), sa.Column("type", sa.String(20), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))
    op.create_table("dealers", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("email", sa.String(255), nullable=True), sa.Column("phone", sa.String(50), nullable=True), sa.Column("commission_rate", sa.Numeric(10, 2), nullable=True), sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))
    op.create_table("leads", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("contact", sa.String(120), nullable=True), sa.Column("status", sa.String(20), nullable=False), sa.Column("notes", sa.Text(), nullable=True), sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))
    op.create_table("deals", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("title", sa.String(120), nullable=False), sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id"), nullable=False), sa.Column("dealer_id", sa.Integer(), sa.ForeignKey("dealers.id"), nullable=True), sa.Column("unit_id", sa.Integer(), sa.ForeignKey("units.id"), nullable=False), sa.Column("type", sa.String(20), nullable=False), sa.Column("total_amount", sa.Numeric(12, 2), nullable=False), sa.Column("status", sa.String(20), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))
    op.create_table("installments", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("deal_id", sa.Integer(), sa.ForeignKey("deals.id"), nullable=False), sa.Column("due_date", sa.Date(), nullable=False), sa.Column("amount", sa.Numeric(12, 2), nullable=False), sa.Column("paid_amount", sa.Numeric(12, 2), nullable=False, server_default="0"), sa.Column("status", sa.String(20), nullable=False))
    op.create_table("ledgers", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("ledger_type", sa.String(30), nullable=False), sa.Column("entity_type", sa.String(30), nullable=True), sa.Column("entity_id", sa.Integer(), nullable=True))
    op.create_table("transactions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("ledger_id", sa.Integer(), sa.ForeignKey("ledgers.id"), nullable=False), sa.Column("txn_type", sa.String(20), nullable=False), sa.Column("amount", sa.Numeric(12, 2), nullable=False), sa.Column("description", sa.String(255), nullable=True), sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))
    op.create_table("journal_entries", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("reference", sa.String(120), nullable=True), sa.Column("description", sa.String(255), nullable=True), sa.Column("debit", sa.Numeric(12, 2), nullable=False), sa.Column("credit", sa.Numeric(12, 2), nullable=False), sa.Column("ledger_id", sa.Integer(), sa.ForeignKey("ledgers.id"), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))


def downgrade() -> None:
    for table in ["journal_entries", "transactions", "ledgers", "installments", "deals", "leads", "dealers", "clients", "units", "floors", "properties", "users", "role_permissions", "permissions", "roles"]:
        op.drop_table(table)
