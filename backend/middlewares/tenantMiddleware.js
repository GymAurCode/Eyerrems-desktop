/**
 * @file tenantMiddleware.js
 * @description Documentary asset & Express middleware alignment.
 * 
 * This file maps Express-style tenant resolution middleware to the active Python backend.
 * In a Node.js/Express stack, this middleware parses incoming JWT tokens, extracts tenant contexts (company_id),
 * and assigns database connection contexts dynamically.
 * 
 * For the active FastAPI implementation, see:
 * - `backend/app/api/deps.py` (get_current_user dependency chain)
 * - `backend/app/core/database.py` (get_db yields scoped tenant-isolated SQLite connection based on parsed JWT)
 */

const jwt = require('jsonwebtoken');
const tenantManager = require('../core/tenantManager');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

/**
 * Express Middleware to resolve company/tenant SQLite context dynamically
 */
function tenantMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Unauthenticated requests fall back to master database context
      req.db = tenantManager.masterConnection;
      req.company_id = null;
      req.is_super_admin = false;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.company_id = decoded.company_id || null;
    req.is_super_admin = !!decoded.is_super_admin;

    if (req.is_super_admin || !req.company_id) {
      // Super-admins and system accounts route to master database
      req.db = tenantManager.masterConnection;
      console.log('[TenantMiddleware] Resolved master database context for Super-Admin');
    } else {
      // Regular users are isolated to their own company's database
      // 1. Check if company is registered in master database
      const company = tenantManager.masterConnection
        .prepare('SELECT status, slug FROM companies WHERE id = ?')
        .get(req.company_id);

      if (!company) {
        return res.status(403).json({ error: 'Company account does not exist.' });
      }

      if (company.status !== 'active') {
        return res.status(403).json({ error: 'Company account is suspended.' });
      }

      // 2. Assign dynamic, isolated sqlite3 database session
      req.db = tenantManager.getTenantConnection(company.slug);
      console.log(`[TenantMiddleware] Resolved isolated tenant database for company: ${company.slug}`);
    }

    next();
  } catch (error) {
    console.error('[TenantMiddleware] Token verification or connection resolution failed:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication session token.' });
  }
}

module.exports = tenantMiddleware;
