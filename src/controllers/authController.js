const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');
const { recordAuditEntry } = require('../services/auditService');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function login(req, res) {
  const { email, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide both email address and password.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

  if (!user) {
    recordAuditEntry({
      userId: null,
      userName: normalizedEmail,
      action: 'FailedLogin',
      entityName: 'Authentication',
      ipAddress: clientIp,
      result: 'Failure',
      details: 'Unregistered email attempt'
    });
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }

  // Check account lockout
  if (user.lockoutEnd && new Date(user.lockoutEnd) > new Date()) {
    recordAuditEntry({
      userId: user.userId,
      userName: user.name,
      action: 'AccountLockoutAttempt',
      entityName: 'Authentication',
      ipAddress: clientIp,
      result: 'Blocked',
      details: `Lockout active until ${user.lockoutEnd}`
    });
    return res.status(403).json({
      error: `Account temporary locked due to failed attempts. Try again after ${new Date(user.lockoutEnd).toLocaleTimeString()}.`
    });
  }

  const matches = bcrypt.compareSync(password, user.passwordHash);

  if (!matches) {
    const failedCount = (user.failedLoginCount || 0) + 1;
    let lockoutTime = null;

    if (failedCount >= MAX_LOGIN_ATTEMPTS) {
      lockoutTime = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET failedLoginCount = ?, lockoutEnd = ? WHERE userId = ?')
        .run(failedCount, lockoutTime, user.userId);

      recordAuditEntry({
        userId: user.userId,
        userName: user.name,
        action: 'AccountLockout',
        entityName: 'Authentication',
        recordId: user.userId,
        ipAddress: clientIp,
        result: 'Failure',
        details: `Account locked after ${failedCount} failed attempts.`
      });

      return res.status(403).json({
        error: `Account locked for 15 minutes due to 5 consecutive failed login attempts.`
      });
    }

    db.prepare('UPDATE users SET failedLoginCount = ? WHERE userId = ?').run(failedCount, user.userId);

    recordAuditEntry({
      userId: user.userId,
      userName: user.name,
      action: 'FailedLogin',
      entityName: 'Authentication',
      recordId: user.userId,
      ipAddress: clientIp,
      result: 'Failure',
      details: `Failed attempt ${failedCount}/${MAX_LOGIN_ATTEMPTS}`
    });

    return res.status(401).json({
      error: `Invalid email or password. Failed attempts: ${failedCount}/${MAX_LOGIN_ATTEMPTS}`
    });
  }

  if (!user.isActive) {
    recordAuditEntry({
      userId: user.userId,
      userName: user.name,
      action: 'FailedLogin',
      entityName: 'Authentication',
      recordId: user.userId,
      ipAddress: clientIp,
      result: 'Failure',
      details: 'Account deactivated'
    });
    return res.status(403).json({ error: 'Your account is currently disabled. Please contact your workspace admin.' });
  }

  // Reset login attempt counter on clean auth
  db.prepare('UPDATE users SET failedLoginCount = 0, lockoutEnd = NULL WHERE userId = ?').run(user.userId);

  const tokenPayload = {
    userId: user.userId,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: user.roleName
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 3600 * 1000 });

  recordAuditEntry({
    userId: user.userId,
    userName: user.name,
    action: 'Login',
    entityName: 'Authentication',
    recordId: user.userId,
    ipAddress: clientIp,
    result: 'Success',
    details: `Authenticated as ${user.roleName}`
  });

  res.json({
    message: 'Authentication successful.',
    token,
    user: {
      userId: user.userId,
      name: user.name,
      email: user.email,
      roleName: user.roleName
    }
  });
}

function logout(req, res) {
  if (req.user) {
    recordAuditEntry({
      userId: req.user.userId,
      userName: req.user.name,
      action: 'Logout',
      entityName: 'Authentication',
      recordId: req.user.userId,
      result: 'Success',
      details: 'User logged out'
    });
  }
  res.clearCookie('token');
  res.json({ message: 'Session ended.' });
}

module.exports = { login, logout };
