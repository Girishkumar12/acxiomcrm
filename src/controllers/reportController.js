const db = require('../database/db');
const { recordAuditEntry } = require('../services/auditService');

function getPipelineReport(req, res) {
  let userClause = '';
  const params = [];
  if (req.user.roleName === 'SalesExecutive') {
    userClause = ' WHERE ownerId = ? ';
    params.push(req.user.userId);
  }

  const stageReport = db.prepare(`
    SELECT stage, COUNT(*) as count, SUM(amount) as totalAmount, SUM((amount * probability) / 100) as weightedAmount
    FROM opportunities
    ${userClause}
    GROUP BY stage
  `).all(...params);

  const ownerReport = db.prepare(`
    SELECT u.name as ownerName, COUNT(o.opportunityId) as count, SUM(o.amount) as totalAmount
    FROM opportunities o
    JOIN users u ON o.ownerId = u.userId
    ${userClause}
    GROUP BY o.ownerId
  `).all(...params);

  res.json({ stageReport, ownerReport });
}

function getUsers(req, res) {
  const users = db.prepare('SELECT userId, name, email, phone, roleId, roleName, isActive, failedLoginCount, lockoutEnd, createdDate FROM users ORDER BY name ASC').all();
  res.json({ data: users });
}

function updateUserRole(req, res) {
  const { id } = req.params;
  const { roleName } = req.body;

  const roleMap = { 'Admin': 1, 'Manager': 2, 'SalesExecutive': 3 };
  if (!roleMap[roleName]) {
    return res.status(400).json({ error: 'Invalid role provided.' });
  }

  const target = db.prepare('SELECT * FROM users WHERE userId = ?').get(id);
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.prepare('UPDATE users SET roleId = ?, roleName = ? WHERE userId = ?').run(roleMap[roleName], roleName, id);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'RoleChange',
    entityName: 'User',
    recordId: id,
    oldValue: { roleName: target.roleName },
    newValue: { roleName },
    result: 'Success',
    details: `Changed role of ${target.email} to ${roleName}`
  });

  res.json({ message: `Updated user role to ${roleName}` });
}

function unlockUserAccount(req, res) {
  const { id } = req.params;
  const target = db.prepare('SELECT * FROM users WHERE userId = ?').get(id);
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.prepare('UPDATE users SET failedLoginCount = 0, lockoutEnd = NULL WHERE userId = ?').run(id);

  recordAuditEntry({
    userId: req.user.userId,
    userName: req.user.name,
    action: 'AccountUnlock',
    entityName: 'User',
    recordId: id,
    result: 'Success',
    details: `Unlocked account for ${target.email}`
  });

  res.json({ message: `Account unlocked for ${target.email}` });
}

function getAuditLogs(req, res) {
  const { user, module: mod, action } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (user) {
    sql += ' AND (userName LIKE ? OR userId LIKE ?)';
    params.push(`%${user}%`, `%${user}%`);
  }

  if (mod) {
    sql += ' AND entityName = ?';
    params.push(mod);
  }

  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }

  sql += ' ORDER BY createdDate DESC LIMIT 200';
  const logs = db.prepare(sql).all(...params);
  res.json({ data: logs });
}

module.exports = { getPipelineReport, getUsers, updateUserRole, unlockUserAccount, getAuditLogs };
