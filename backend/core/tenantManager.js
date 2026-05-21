/**
 * @file tenantManager.js
 * @description Documentary asset & Express stack alignment.
 * 
 * This file maps multi-tenant SQLite database isolation concepts to a standard Express/Node.js architecture.
 * Because the active, running backend for this application is built in Python (FastAPI + SQLAlchemy + SQLite),
 * this file acts as a reference implementation mapping `better-sqlite3` and Express patterns to the active Python core.
 * 
 * For the active FastAPI implementation, see:
 * - `backend/app/core/tenant_manager.py` (TenantManager engine caching and programmatic database seeding)
 * - `backend/app/core/database.py` (get_db dynamic session router and request context resolver)
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATABASES_DIR = path.resolve(__dirname, '../databases');

class TenantManager {
  constructor() {
    this.connections = new Map();
    this.masterDbPath = path.join(DATABASES_DIR, 'master.db');

    // Ensure database directory exists
    if (!fs.existsSync(DATABASES_DIR)) {
      fs.mkdirSync(DATABASES_DIR, { recursive: true });
    }

    // Initialize master database connection
    this.masterConnection = this.getOrLoadConnection('master', this.masterDbPath);
  }

  /**
   * Sanitizes alphanumeric slug to prevent directory traversal
   * @param {string} slug 
   * @returns {string}
   */
  sanitizeSlug(slug) {
    if (!slug) throw new Error('Company slug cannot be empty');
    const cleanSlug = slug.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!cleanSlug || cleanSlug === 'master' || cleanSlug === 'default') {
      throw new Error(`Invalid company slug: ${slug}`);
    }
    return cleanSlug;
  }

  /**
   * Retrieves or instantiates a better-sqlite3 database connection with WAL mode enabled.
   * @param {string} key 
   * @param {string} dbPath 
   * @returns {Database}
   */
  getOrLoadConnection(key, dbPath) {
    if (this.connections.has(key)) {
      return this.connections.get(key);
    }

    try {
      const db = new Database(dbPath, { verbose: console.log });
      // Optimize SQLite for high concurrency & referential integrity
      db.pragma('foreign_keys = ON');
      db.pragma('journal_mode = WAL');
      
      this.connections.set(key, db);
      return db;
    } catch (error) {
      console.error(`[TenantManager] Failed to load connection for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieves connection for a tenant company slug dynamically.
   * @param {string} slug 
   * @returns {Database}
   */
  getTenantConnection(slug) {
    const cleanSlug = this.sanitizeSlug(slug);
    const dbPath = path.join(DATABASES_DIR, `company_${cleanSlug}.db`);
    return this.getOrLoadConnection(cleanSlug, dbPath);
  }

  /**
   * Safely initializes and seeds a new tenant SQLite database file.
   * @param {number} companyId 
   * @param {string} slug 
   */
  initializeTenantDb(companyId, slug) {
    const cleanSlug = this.sanitizeSlug(slug);
    const dbPath = path.join(DATABASES_DIR, `company_${cleanSlug}.db`);

    if (fs.existsSync(dbPath)) {
      console.log(`[TenantManager] Tenant database already exists for: ${cleanSlug}`);
      return;
    }

    console.log(`[TenantManager] Creating isolated database: ${dbPath}`);
    const db = this.getTenantConnection(cleanSlug);

    try {
      db.transaction(() => {
        // Create isolated schemas: Roles, Permissions, Users, Chart of Accounts, etc.
        db.prepare(`
          CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            company_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

        db.prepare(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            full_name TEXT,
            hashed_password TEXT NOT NULL,
            company_id INTEGER,
            status TEXT DEFAULT 'pending',
            is_approved INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

        // Seed roles & features matching the tenant init python sequence
        const insertRole = db.prepare('INSERT INTO roles (name, description, company_id) VALUES (?, ?, ?)');
        insertRole.run('Admin', 'Full system access — all permissions', companyId);
        insertRole.run('Manager', 'Department management access', companyId);
        insertRole.run('Staff', 'Basic staff access', companyId);

        console.log(`[TenantManager] Successfully seeded isolated database for: ${cleanSlug}`);
      })();
    } catch (error) {
      console.error(`[TenantManager] Seeding failed for tenant: ${cleanSlug}`, error);
      throw error;
    }
  }
}

module.exports = new TenantManager();
