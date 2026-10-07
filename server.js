const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');

const webRoutes = require('./src/routes/webRoutes');
const apiRoutes = require('./src/routes/apiRoutes');
const seedDatabase = require('./src/database/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure DB is initialized and seeded
seedDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// 404 Handler
const publicDir = path.join(process.cwd(), 'public');
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.status(404).sendFile('login.html', { root: publicDir }, (err) => {
    if (err && !res.headersSent) {
      res.status(404).send('404 Page Not Found');
    }
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Unhandled server error:', err.message);
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error occurred.', message: err.message });
  }
  res.status(500).send('500 Internal Server Error: ' + err.message);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🚀 AcxiomCRM is running on http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
