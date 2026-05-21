-- REMOVE SUPER ADMIN AND MANAGER ROLES MIGRATION
-- This script cleans up database remnants of the super-admin and manager roles.

-- 1. Remove is_super_admin column from users if it exists (for databases that support ALTER TABLE DROP COLUMN)
-- Note: SQLite does not support dropping columns directly in older versions without table recreation, 
-- but since SQLAlchemy model doesn't map it, it is ignored at the application level.
-- In PostgreSQL or newer SQLite:
-- ALTER TABLE users DROP COLUMN IF EXISTS is_super_admin;

-- 2. Clean up any super admin/platform manager role references
DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name IN ('Super Admin', 'Platform Manager', 'Manager'));
DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name IN ('Super Admin', 'Platform Manager', 'Manager'));
DELETE FROM roles WHERE name IN ('Super Admin', 'Platform Manager', 'Manager');
