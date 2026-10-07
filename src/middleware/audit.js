const db = require('../database/db');
const { v4: uuidv4 } = require('crypto');

function logAudit({ userId, userName, action, entityName, recordId, oldValue = null, newValue = null, ipAddress = '127.0.0.1', result = 'Success', details = '' }) {
  try {
    const auditLogId = 'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const createdDate = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO audit_logs (auditLogId, userId, userName, action, entityName, recordId, oldValue, newValue, createdDate, ipAddress, result, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      auditLogId,
      userId || 'ANONYMOUS',
      userName || 'System / Anonymous',
      action,
      entityName,
      recordId ? String(recordId) : null,
      typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue,
      typeof newValue === 'object' ? JSON.stringify(newValue) : newValue,
      createdDate,
      ipAddress,
      result,
      details
    );
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

module.exports = { logAudit };
