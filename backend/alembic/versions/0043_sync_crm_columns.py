"""Sync CRM model columns to DB for leads, clients, dealers, deals.

Adds columns that exist in the Python ORM model but were never
created in the database via migration.

Revision ID: 0043_sync_crm_columns
Revises: 0042_add_whatsapp_columns
Create Date: 2026-06-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0043_sync_crm_columns'
down_revision = '0042_add_whatsapp_columns'
branch_labels = None
depends_on = None


def _missing_cols(table: str) -> set:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = {c['name'] for c in inspector.get_columns(table)}
    return existing


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # ── leads ──────────────────────────────────────────────────────────────
    lead_cols = {c['name'] for c in inspector.get_columns('leads')}
    lead_additions = {
        'cnic':               (sa.String(20),),
        'address':            (sa.Text,),
        'city':               (sa.String(80),),
        'occupation':         (sa.String(120),),
        'company':            (sa.String(120),),
        'monthly_income':     (sa.Numeric(14, 2),),
        'budget_min':         (sa.Numeric(14, 2),),
        'budget_max':         (sa.Numeric(14, 2),),
        'preferred_town':     (sa.String(80),),
        'preferred_property_type': (sa.String(80),),
        'unit_preference':    (sa.String(80),),
        'campaign':           (sa.String(120),),
        'referral':           (sa.String(120),),
        'assigned_dealer_id': (sa.Integer,),
        'investor_type':      (sa.String(20),),
        'updated_at':         (sa.DateTime(),),
    }
    for col_name, (col_type,) in lead_additions.items():
        if col_name not in lead_cols:
            nullable = True
            if col_name == 'updated_at':
                op.add_column('leads', sa.Column(col_name, col_type, nullable=True,
                                                 server_default=sa.func.now()))
            elif col_name == 'assigned_dealer_id':
                op.add_column('leads', sa.Column(col_name, col_type,
                                                 sa.ForeignKey('dealers.id'), nullable=True))
            else:
                op.add_column('leads', sa.Column(col_name, col_type, nullable=nullable))

    # ── clients ────────────────────────────────────────────────────────────
    client_cols = {c['name'] for c in inspector.get_columns('clients')}
    client_additions = {
        'mailing_address':   (sa.Text,),
        'permanent_address': (sa.Text,),
        'city':              (sa.String(80),),
        'occupation':        (sa.String(120),),
        'next_of_kin_name':  (sa.String(120),),
        'next_of_kin_cnic':  (sa.String(20),),
        'next_of_kin_phone': (sa.String(50),),
        'updated_at':        (sa.DateTime(),),
    }
    for col_name, (col_type,) in client_additions.items():
        if col_name not in client_cols:
            nullable = True
            if col_name == 'updated_at':
                op.add_column('clients', sa.Column(col_name, col_type, nullable=True,
                                                   server_default=sa.func.now()))
            else:
                op.add_column('clients', sa.Column(col_name, col_type, nullable=nullable))

    # ── dealers ────────────────────────────────────────────────────────────
    dealer_cols = {c['name'] for c in inspector.get_columns('dealers')}
    if 'is_active' not in dealer_cols:
        op.add_column('dealers', sa.Column('is_active', sa.Boolean(),
                                           nullable=False, server_default=sa.text('true')))

    # ── deals ──────────────────────────────────────────────────────────────
    deal_cols = {c['name'] for c in inspector.get_columns('deals')}
    deal_additions = {
        'discount':   (sa.Numeric(14, 2),),
        'tax':        (sa.Numeric(14, 2),),
        'commission': (sa.Numeric(14, 2),),
        'net_amount': (sa.Numeric(14, 2),),
        'updated_at': (sa.DateTime(),),
    }
    for col_name, (col_type,) in deal_additions.items():
        if col_name not in deal_cols:
            if col_name == 'updated_at':
                op.add_column('deals', sa.Column(col_name, col_type, nullable=True,
                                                 server_default=sa.func.now()))
            else:
                op.add_column('deals', sa.Column(col_name, col_type, nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    for table in ('deals', 'dealers', 'clients', 'leads'):
        existing = {c['name'] for c in inspector.get_columns(table)}
        if table == 'deals':
            for col in ('discount', 'tax', 'commission', 'net_amount', 'updated_at'):
                if col in existing:
                    op.drop_column(table, col)
        elif table == 'dealers':
            if 'is_active' in existing:
                op.drop_column(table, 'is_active')
        elif table == 'clients':
            for col in ('mailing_address', 'permanent_address', 'city', 'occupation',
                        'next_of_kin_name', 'next_of_kin_cnic', 'next_of_kin_phone', 'updated_at'):
                if col in existing:
                    op.drop_column(table, col)
        elif table == 'leads':
            for col in ('cnic', 'address', 'city', 'occupation', 'company',
                        'monthly_income', 'budget_min', 'budget_max',
                        'preferred_town', 'preferred_property_type', 'unit_preference',
                        'campaign', 'referral', 'assigned_dealer_id', 'investor_type', 'updated_at'):
                if col in existing:
                    op.drop_column(table, col)
