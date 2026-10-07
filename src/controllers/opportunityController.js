const db = require('../database/db');
const { recordAuditEntry } = require('../services/auditService');

function getOpportunities(req, res) {
  const { search, stage } = req.query;
  let sql = `
    SELECT o.*, c.customerName, c.customerCode, u.name as ownerName
    FROM opportunities o
    JOIN customers c ON o.customerId = c.customerId
    LEFT JOIN users u ON o.ownerId = u.userId
    WHERE 1=1
  `;
  const params = [];

  if (req.user.roleName === 'SalesExecutive') {
    sql += ' AND o.ownerId = ?';
    params.push(req.user.userId);
  }

  if (search) {
    sql += ' AND (o.opportunityName LIKE ? OR c.customerName LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (stage) {
    sql += ' AND o.stage = ?';
    params.push(stage);
  }

  sql += ' ORDER BY o.createdDate DESC';

  const records = db.prepare(sql).all(...params);

  // Derived weighted pipeline
  const data = records.map(o => ({
    ...o,
    weightedPipeline: (o.amount * o.probability) / 100
  }));

  res.json({ data, count: data.length });
}

function createOpportunity(req, res) {
  const { opportunityName, customerId, leadId, amount, stage, probability, expectedCloseDate, notes, ownerId } = req.body;
  const opportunityId = 'opp_' + Date.now().toString(36);
  const createdDate = new Date().toISOString();
  const assignedTo = (req.user.roleName === 'SalesExecutive') ? req.user.userId : (ownerId || req.user.userId);
  const statusVal = stage === 'Won' ? 'Won' : (stage === 'Lost' ? 'Lost' : 'Open');

  const stmt = db.prepare(`
    INSERT INTO opportunities (opportunityId, opportunityName, customerId, leadId, amount, stage, probability, expectedCloseDate, status, ownerId, notes, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(opportunityId, opportunityName, customerId, leadId || null, parseFloat(amount), stage, parseInt(probability), expectedCloseDate, statusVal, assignedTo, notes || '', createdDate);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'Create',
    entityName: 'Opportunity',
    recordId: opportunityId,
    newValue: { opportunityName, amount, stage, probability },
    result: 'Success',
    details: `Created opportunity ${opportunityName} ($${amount})`
  });

  const created = db.prepare('SELECT o.*, c.customerName, u.name as ownerName FROM opportunities o JOIN customers c ON o.customerId = c.customerId LEFT JOIN users u ON o.ownerId = u.userId WHERE o.opportunityId = ?').get(opportunityId);
  res.status(201).json(created);
}

function updateOpportunity(req, res) {
  const { id } = req.params;
  const { opportunityName, customerId, amount, stage, probability, expectedCloseDate, notes } = req.body;

  const existing = db.prepare('SELECT * FROM opportunities WHERE opportunityId = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Opportunity not found.' });
  }

  if (req.user.roleName === 'SalesExecutive' && existing.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Permission denied. You do not own this deal.' });
  }

  const statusVal = stage === 'Won' ? 'Won' : (stage === 'Lost' ? 'Lost' : 'Open');

  db.prepare(`
    UPDATE opportunities
    SET opportunityName = ?, customerId = ?, amount = ?, stage = ?, probability = ?, expectedCloseDate = ?, status = ?, notes = ?
    WHERE opportunityId = ?
  `).run(opportunityName, customerId, parseFloat(amount), stage, parseInt(probability), expectedCloseDate, statusVal, notes || '', id);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'Update',
    entityName: 'Opportunity',
    recordId: id,
    oldValue: { stage: existing.stage, amount: existing.amount },
    newValue: { stage, amount, status: statusVal },
    result: 'Success',
    details: `Updated deal stage to ${stage}`
  });

  const updated = db.prepare('SELECT o.*, c.customerName, u.name as ownerName FROM opportunities o JOIN customers c ON o.customerId = c.customerId LEFT JOIN users u ON o.ownerId = u.userId WHERE o.opportunityId = ?').get(id);
  res.json(updated);
}

module.exports = { getOpportunities, createOpportunity, updateOpportunity };
