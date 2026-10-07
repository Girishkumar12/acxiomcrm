const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'acxiom_crm_super_secret_jwt_key_2026';

function authenticateToken(req, res, next) {
  let token = req.cookies.token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized access. Authentication token missing.' });
    }
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is active and not locked
    const user = db.prepare('SELECT userId, name, email, phone, roleId, roleName, isActive, failedLoginCount, lockoutEnd FROM users WHERE userId = ?').get(decoded.userId);

    if (!user || !user.isActive) {
      res.clearCookie('token');
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: 'User account is deactivated.' });
      }
      return res.redirect('/login?error=account_deactivated');
    }

    if (user.lockoutEnd && new Date(user.lockoutEnd) > new Date()) {
      res.clearCookie('token');
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: `Account locked until ${user.lockoutEnd}.` });
      }
      return res.redirect('/login?error=account_locked');
    }

    req.user = user;
    res.locals.currentUser = user;
    next();
  } catch (err) {
    res.clearCookie('token');
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
    return res.redirect('/login');
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthenticated user.' });
      }
      return res.redirect('/login');
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: 'Forbidden. You do not have permission to access this resource.' });
      }
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Access Denied - AcxiomCRM</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
        </head>
        <body class="bg-light d-flex align-items-center justify-content-center vh-100">
          <div class="card shadow p-4 text-center" style="max-width: 450px;">
            <h2 class="text-danger mb-3"><i class="bi bi-shield-lock-fill"></i> Access Denied</h2>
            <p class="text-muted">Your role (<strong>${req.user.roleName}</strong>) does not have permission to perform this action.</p>
            <a href="/dashboard" class="btn btn-primary mt-2">Back to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    next();
  };
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireRole
};
