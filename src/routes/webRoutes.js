const express = require('express');
const router = express.Router();
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const publicDir = path.join(process.cwd(), 'public');

// Public login page
router.get('/login', (req, res, next) => {
  res.sendFile('login.html', { root: publicDir }, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

// Protected app dashboard
router.get('/', authenticateToken, (req, res, next) => {
  res.sendFile('index.html', { root: publicDir }, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

router.get('/dashboard', authenticateToken, (req, res, next) => {
  res.sendFile('index.html', { root: publicDir }, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

module.exports = router;
