const db = require('../database/db');
const { recordAuditEntry } = require('../services/auditService');

function getCustomers(req, res) {
  const { search, status } = req.query;
  let sql = `
    SELECT c.*, u.name as ownerName
    FROM customers c
    LEFT JOIN users u ON c.ownerId = u.userId
    WHERE 1=1
  `;
  const params = [];

  if (req.user.roleName === 'SalesExecutive') {
    sql += ' AND c.ownerId = ?';
    params.push(req.user.userId);
  }

  if (search) {
    sql += ' AND (c.customerName LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.companyName LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY c.createdDate DESC';

  const records = db.prepare(sql).all(...params);
  res.json({ data: records, count: records.length });
}

function getCustomerById(req, res) {
  let sql = `
    SELECT c.*, u.name as ownerName
    FROM customers c
    LEFT JOIN users u ON c.ownerId = u.userId
    WHERE c.customerId = ?
  `;
  const params = [req.params.id];

  if (req.user.roleName === 'SalesExecutive') {
    sql += ' AND c.ownerId = ?';
    params.push(req.user.userId);
  }

  const record = db.prepare(sql).get(...params);
  if (!record) {
    return res.status(404).json({ error: 'Customer not found or unauthorized.' });
  }

  res.json(record);
}

function createCustomer(req, res) {
  const { customerName, email, phone, companyName, address, city, state, status, ownerId } = req.body;
  const customerId = 'cust_' + Date.now().toString(36);
  const customerCode = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
  const createdDate = new Date().toISOString();
  const assignedTo = (req.user.roleName === 'SalesExecutive') ? req.user.userId : (ownerId || req.user.userId);

  const stmt = db.prepare(`
    INSERT INTO customers (customerId, customerCode, customerName, email, phone, companyName, address, city, state, status, ownerId, createdBy, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(customerId, customerCode, customerName, email.toLowerCase(), phone, companyName || '', address || '', city || '', state || '', status || 'Active', assignedTo, req.user.userId, createdDate);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'Create',
    entityName: 'Customer',
    recordId: customerId,
    newValue: { customerCode, customerName, email, phone },
    result: 'Success',
    details: `Created customer record ${customerCode}`
  });

  const created = db.prepare('SELECT c.*, u.name as ownerName FROM customers c LEFT JOIN users u ON c.ownerId = u.userId WHERE c.customerId = ?').get(customerId);
  res.status(201).json(created);
}

function updateCustomer(req, res) {
  const { id } = req.params;
  const { customerName, email, phone, companyName, address, city, state, status, ownerId } = req.body;

  const existing = db.prepare('SELECT * FROM customers WHERE customerId = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Customer record not found.' });
  }

  if (req.user.roleName === 'SalesExecutive' && existing.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Permission denied. You do not own this customer record.' });
  }

  const assignedTo = (req.user.roleName === 'SalesExecutive') ? existing.ownerId : (ownerId || existing.ownerId);
  const modifiedDate = new Date().toISOString();

  db.prepare(`
    UPDATE customers
    SET customerName = ?, email = ?, phone = ?, companyName = ?, address = ?, city = ?, state = ?, status = ?, ownerId = ?, modifiedDate = ?
    WHERE customerId = ?
  `).run(customerName, email.toLowerCase(), phone, companyName || '', address || '', city || '', state || '', status || existing.status, assignedTo, modifiedDate, id);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'Update',
    entityName: 'Customer',
    recordId: id,
    oldValue: { customerName: existing.customerName, email: existing.email },
    newValue: { customerName, email },
    result: 'Success',
    details: `Updated customer record ${existing.customerCode}`
  });

  const updated = db.prepare('SELECT c.*, u.name as ownerName FROM customers c LEFT JOIN users u ON c.ownerId = u.userId WHERE c.customerId = ?').get(id);
  res.json(updated);
}

function deleteCustomer(req, res) {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM customers WHERE customerId = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  db.prepare("UPDATE customers SET status = 'Inactive', modifiedDate = ? WHERE customerId = ?").run(new Date().toISOString(), id);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'Delete',
    entityName: 'Customer',
    recordId: id,
    oldValue: existing,
    result: 'Success',
    details: `Deactivated customer ${existing.customerCode}`
  });

  res.json({ message: `Customer ${existing.customerCode} set to inactive.` });
}

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer };
