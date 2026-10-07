const db = require('../database/db');
const { recordAuditEntry } = require('../services/auditService');

function getFollowUps(req, res) {
  let sql = `
    SELECT f.*, u.name as assignedUserName
    FROM follow_ups f
    LEFT JOIN users u ON f.assignedTo = u.userId
    WHERE 1=1
  `;
  const params = [];

  if (req.user.roleName === 'SalesExecutive') {
    sql += ' AND f.assignedTo = ?';
    params.push(req.user.userId);
  }

  sql += ' ORDER BY f.followUpDate ASC';
  const followups = db.prepare(sql).all(...params);
  res.json({ data: followups, count: followups.length });
}

function createFollowUp(req, res) {
  const { relatedType, relatedId, customerId, leadId, followUpDate, followUpType, subject, remarks, status, assignedTo } = req.body;
  const followUpId = 'flw_' + Date.now().toString(36);
  const createdDate = new Date().toISOString();
  const targetUser = (req.user.roleName === 'SalesExecutive') ? req.user.userId : (assignedTo || req.user.userId);

  db.prepare(`
    INSERT INTO follow_ups (followUpId, relatedType, relatedId, customerId, leadId, followUpDate, followUpType, subject, remarks, status, assignedTo, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(followUpId, relatedType || 'Customer', relatedId || customerId || leadId || '', customerId || null, leadId || null, followUpDate, followUpType, subject, remarks || '', status || 'Planned', targetUser, createdDate);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'Create',
    entityName: 'FollowUp',
    recordId: followUpId,
    newValue: { subject, followUpDate },
    result: 'Success',
    details: `Scheduled follow-up: ${subject}`
  });

  const created = db.prepare('SELECT f.*, u.name as assignedUserName FROM follow_ups f LEFT JOIN users u ON f.assignedTo = u.userId WHERE f.followUpId = ?').get(followUpId);
  res.status(201).json(created);
}

function updateFollowUpStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Planned', 'Completed', 'Missed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  const existing = db.prepare('SELECT * FROM follow_ups WHERE followUpId = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Follow-up not found.' });
  }

  db.prepare('UPDATE follow_ups SET status = ? WHERE followUpId = ?').run(status, id);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'Update',
    entityName: 'FollowUp',
    recordId: id,
    oldValue: { status: existing.status },
    newValue: { status },
    result: 'Success',
    details: `Marked follow-up ${status}`
  });

  res.json({ message: `Follow-up status updated to ${status}` });
}

module.exports = { getFollowUps, createFollowUp, updateFollowUpStatus };
