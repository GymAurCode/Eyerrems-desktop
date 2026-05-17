"""RBAC System Enhancement

Revision ID: 0019_rbac_system
Revises: 0018_crm_activities
Create Date: 2026-05-05 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '0019_rbac_system'
down_revision = '0018_crm_activities'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(20), nullable=False, server_default='pending'))
        batch_op.add_column(sa.Column('is_approved', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('approved_by', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('approved_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
        batch_op.add_column(sa.Column('last_login', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key('fk_users_approved_by', 'users', ['approved_by'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_users_status', ['status'])
        batch_op.create_index('ix_users_email', ['email'])
        batch_op.alter_column('role_id', nullable=True)
    
    # Update existing users to have active status if approved (PostgreSQL syntax)
    op.execute("""
        UPDATE users 
        SET status = CASE 
            WHEN approval_status = 'approved' THEN 'active'
            WHEN approval_status = 'rejected' THEN 'suspended'
            ELSE 'pending'
        END,
        is_approved = CASE 
            WHEN approval_status = 'approved' THEN true
            ELSE false
        END
    """)
    
    # Add new columns to roles table
    with op.batch_alter_table('roles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
        batch_op.create_index('ix_roles_id', ['id'])
        batch_op.create_index('ix_roles_name', ['name'])
    
    # Update permissions table - rename code to name and add module
    with op.batch_alter_table('permissions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('name', sa.String(120), nullable=True))
        batch_op.add_column(sa.Column('module', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
        batch_op.create_index('ix_permissions_id', ['id'])
    
    # Copy code to name
    op.execute("UPDATE permissions SET name = code WHERE name IS NULL")
    
    # Extract module from permission code (e.g., "hr.view" -> "HR")
    op.execute("""
        UPDATE permissions 
        SET module = CASE 
            WHEN name LIKE 'hr.%' THEN 'HR'
            WHEN name LIKE 'finance.%' THEN 'Finance'
            WHEN name LIKE 'crm.%' THEN 'CRM'
            WHEN name LIKE 'property.%' THEN 'Property'
            WHEN name LIKE 'tenant.%' THEN 'Tenant'
            WHEN name LIKE 'construction.%' THEN 'Construction'
            WHEN name LIKE 'mail.%' THEN 'Mail'
            WHEN name LIKE 'users%' OR name LIKE 'user.%' THEN 'Admin'
            WHEN name LIKE 'roles%' OR name LIKE 'role.%' THEN 'Admin'
            ELSE 'System'
        END
        WHERE module IS NULL
    """)
    
    with op.batch_alter_table('permissions', schema=None) as batch_op:
        batch_op.alter_column('name', nullable=False)
        batch_op.alter_column('module', nullable=False)
        batch_op.create_index('ix_permissions_name', ['name'])
        batch_op.create_index('ix_permissions_module', ['module'])
        batch_op.drop_column('code')
    
    # Create user_roles association table (many-to-many)
    op.create_table(
        'user_roles',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'role_id')
    )
    
    # Migrate existing single role to user_roles table
    op.execute("""
        INSERT INTO user_roles (user_id, role_id)
        SELECT id, role_id FROM users WHERE role_id IS NOT NULL
    """)
    
    # Create user_permissions association table (permission overrides)
    op.create_table(
        'user_permissions',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'permission_id')
    )
    
    # Update role_permissions to use CASCADE
    op.drop_table('role_permissions')
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )
    
    # Enhance audit_logs table
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('module', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('ip_address', sa.String(45), nullable=True))
        batch_op.add_column(sa.Column('user_agent', sa.String(255), nullable=True))
        batch_op.create_index('ix_audit_logs_id', ['id'])
        batch_op.create_index('ix_audit_logs_user_id', ['user_id'])
        batch_op.create_index('ix_audit_logs_action', ['action'])
        batch_op.create_index('ix_audit_logs_module', ['module'])
        batch_op.create_index('ix_audit_logs_entity_type', ['entity_type'])
        batch_op.create_index('ix_audit_logs_created_at', ['created_at'])


def downgrade():
    # Remove indexes from audit_logs
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.drop_index('ix_audit_logs_created_at')
        batch_op.drop_index('ix_audit_logs_entity_type')
        batch_op.drop_index('ix_audit_logs_module')
        batch_op.drop_index('ix_audit_logs_action')
        batch_op.drop_index('ix_audit_logs_user_id')
        batch_op.drop_index('ix_audit_logs_id')
        batch_op.drop_column('user_agent')
        batch_op.drop_column('ip_address')
        batch_op.drop_column('description')
        batch_op.drop_column('module')
    
    # Drop new tables
    op.drop_table('user_permissions')
    op.drop_table('user_roles')
    
    # Restore permissions table
    with op.batch_alter_table('permissions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('code', sa.String(120), nullable=True))
        batch_op.drop_index('ix_permissions_module')
        batch_op.drop_index('ix_permissions_name')
        batch_op.drop_index('ix_permissions_id')
    
    op.execute("UPDATE permissions SET code = name WHERE code IS NULL")
    
    with op.batch_alter_table('permissions', schema=None) as batch_op:
        batch_op.alter_column('code', nullable=False)
        batch_op.drop_column('created_at')
        batch_op.drop_column('module')
        batch_op.drop_column('name')
    
    # Restore roles table
    with op.batch_alter_table('roles', schema=None) as batch_op:
        batch_op.drop_index('ix_roles_name')
        batch_op.drop_index('ix_roles_id')
        batch_op.drop_column('updated_at')
        batch_op.drop_column('created_at')
        batch_op.drop_column('description')
    
    # Restore users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index('ix_users_email')
        batch_op.drop_index('ix_users_status')
        batch_op.drop_constraint('fk_users_approved_by', type_='foreignkey')
        batch_op.alter_column('role_id', nullable=False)
        batch_op.drop_column('last_login')
        batch_op.drop_column('updated_at')
        batch_op.drop_column('approved_at')
        batch_op.drop_column('approved_by')
        batch_op.drop_column('is_approved')
        batch_op.drop_column('status')
