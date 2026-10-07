const db = require('../database/db');
const { recordAuditEntry } = require('../services/auditService');

function getLeads(req, res) {
  const { search, status } = req.query;
  let sql = `
    SELECT l.*, u.name as ownerName
    FROM leads l
    LEFT JOIN users u ON l.ownerId = u.userId
    WHERE 1=1
  `;
  const params = [];

  if (req.user.roleName === 'SalesExecutive') {
    sql += ' AND l.ownerId = ?';
    params.push(req.user.userId);
  }

  if (search) {
    sql += ' AND (l.leadName LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.companyName LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (status) {
    sql += ' AND l.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY l.createdDate DESC';

  const leads = db.prepare(sql).all(...params);
  res.json({ data: leads, count: leads.length });
}

function createLead(req, res) {
  const { leadName, email, phone, companyName, source, status, expectedValue, priority, ownerId } = req.body;
  const leadId = 'lead_' + Date.now().toString(36);
  const leadCode = 'LEAD-' + Math.floor(2000 + Math.random() * 8000);
  const createdDate = new Date().toISOString();
  const assignedTo = (req.user.roleName === 'SalesExecutive') ? req.user.userId : (ownerId || req.user.userId);

  const stmt = db.prepare(`
    INSERT INTO leads (leadId, leadCode, leadName, email, phone, companyName, source, status, expectedValue, priority, ownerId, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(leadId, leadCode, leadName, email.toLowerCase(), phone, companyName || '', source || 'Website', status || 'New', expectedValue || 0, priority || 'Medium', assignedTo, createdDate);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'Create',
    entityName: 'Lead',
    recordId: leadId,
    newValue: { leadCode, leadName, email },
    result: 'Success',
    details: `Created lead ${leadCode}`
  });

  const created = db.prepare('SELECT l.*, u.name as ownerName FROM leads l LEFT JOIN users u ON l.ownerId = u.userId WHERE l.leadId = ?').get(leadId);
  res.status(201).json(created);
}

function convertLead(req, res) {
  const { id } = req.params;
  const { createOpportunity = true, opportunityAmount = 0, stage = 'Qualification' } = req.body;

  const lead = db.prepare('SELECT * FROM leads WHERE leadId = ?').get(id);
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found.' });
  }

  if (lead.status === 'Converted') {
    return res.status(400).json({ error: 'Lead has already been converted.' });
  }

  const createdDate = new Date().toISOString();
  const customerId = 'cust_' + Date.now().toString(36);
  const customerCode = 'CUST-' + Math.floor(1000 + Math.random() * 9000);

  // 1. Create Customer
  db.prepare(`
    INSERT INTO customers (customerId, customerCode, customerName, email, phone, companyName, address, city, state, status, ownerId, createdBy, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customerId, customerCode, lead.leadName, lead.email, lead.phone, lead.companyName || '', '', '', '', 'Active', lead.ownerId, req.user.userId, createdDate);

  // 2. Mark Lead as Converted
  db.prepare("UPDATE leads SET status = 'Converted' WHERE leadId = ?").run(id);

  let opportunityId = null;
  if (createOpportunity) {
    opportunityId = 'opp_' + Date.now().toString(36);
    const amountVal = parseFloat(opportunityAmount) > 0 ? parseFloat(opportunityAmount) : (lead.expectedValue || 25000);
    const closeDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO opportunities (opportunityId, opportunityName, customerId, leadId, amount, stage, probability, expectedCloseDate, status, ownerId, notes, createdDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(opportunityId, `${lead.leadName} Deal`, customerId, id, amountVal, stage, 50, closeDate, 'Open', lead.ownerId, 'Converted from lead ' + lead.leadCode, createdDate);
  }

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'LeadConversion',
    entityName: 'Lead',
    recordId: id,
    oldValue: { status: lead.status },
    newValue: { status: 'Converted', customerId, opportunityId },
    result: 'Success',
    details: `Converted lead ${lead.leadCode} -> Customer ${customerCode}`
  });

  res.json({
    message: `Lead ${lead.leadCode} converted successfully.`,
    customerId,
    opportunityId
  });
}

module.exports = { getLeads, createLead, convertLead };
