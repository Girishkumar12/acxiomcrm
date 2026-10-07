const db = require('../database/db');

/**
 * Audit Service
 * Handles append-only logging for security & CRM data operations.
 */
function recordAuditEntry({ userId, userName, action, entityName, recordId = null, oldValue = null, newValue = null, ipAddress = '127.0.0.1', result = 'Success', details = '' }) {
  try {
    const auditLogId = 'aud_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const createdDate = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO audit_logs (auditLogId, userId, userName, action, entityName, recordId, oldValue, newValue, createdDate, ipAddress, result, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      auditLogId,
      userId || 'anonymous',
      userName || 'System',
      action,
      entityName,
      recordId ? String(recordId) : null,
      typeof oldValue === 'object' && oldValue !== null ? JSON.stringify(oldValue) : oldValue,
      typeof newValue === 'object' && newValue !== null ? JSON.stringify(newValue) : newValue,
      createdDate,
      ipAddress,
      result,
      details
    );
  } catch (err) {
    console.error('[AuditService] Failed to write log:', err.message);
  }
}

module.exports = { recordAuditEntry };
