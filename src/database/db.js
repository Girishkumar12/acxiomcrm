const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'acxiom_crm.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      roleId INTEGER PRIMARY KEY AUTOINCREMENT,
      roleName TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      passwordHash TEXT NOT NULL,
      roleId INTEGER NOT NULL,
      roleName TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      failedLoginCount INTEGER DEFAULT 0,
      lockoutEnd TEXT,
      createdDate TEXT NOT NULL,
      FOREIGN KEY (roleId) REFERENCES roles(roleId)
    );

    CREATE TABLE IF NOT EXISTS customers (
      customerId TEXT PRIMARY KEY,
      customerCode TEXT UNIQUE NOT NULL,
      customerName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      companyName TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      status TEXT DEFAULT 'Active',
      ownerId TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      createdDate TEXT NOT NULL,
      modifiedDate TEXT,
      FOREIGN KEY (ownerId) REFERENCES users(userId)
    );

    CREATE TABLE IF NOT EXISTS leads (
      leadId TEXT PRIMARY KEY,
      leadCode TEXT UNIQUE NOT NULL,
      leadName TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      companyName TEXT,
      source TEXT DEFAULT 'Website',
      status TEXT DEFAULT 'New',
      expectedValue REAL DEFAULT 0,
      priority TEXT DEFAULT 'Medium',
      ownerId TEXT NOT NULL,
      createdDate TEXT NOT NULL,
      FOREIGN KEY (ownerId) REFERENCES users(userId)
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      opportunityId TEXT PRIMARY KEY,
      opportunityName TEXT NOT NULL,
      customerId TEXT NOT NULL,
      leadId TEXT,
      amount REAL NOT NULL,
      stage TEXT NOT NULL,
      probability INTEGER NOT NULL,
      expectedCloseDate TEXT NOT NULL,
      status TEXT DEFAULT 'Open',
      ownerId TEXT NOT NULL,
      notes TEXT,
      createdDate TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers(customerId),
      FOREIGN KEY (ownerId) REFERENCES users(userId)
    );

    CREATE TABLE IF NOT EXISTS follow_ups (
      followUpId TEXT PRIMARY KEY,
      relatedType TEXT NOT NULL,
      relatedId TEXT NOT NULL,
      customerId TEXT,
      leadId TEXT,
      followUpDate TEXT NOT NULL,
      followUpType TEXT NOT NULL,
      subject TEXT NOT NULL,
      remarks TEXT,
      status TEXT DEFAULT 'Planned',
      assignedTo TEXT NOT NULL,
      createdDate TEXT NOT NULL,
      FOREIGN KEY (assignedTo) REFERENCES users(userId)
    );

    CREATE TABLE IF NOT EXISTS activities (
      activityId TEXT PRIMARY KEY,
      activityType TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      activityDate TEXT NOT NULL,
      customerId TEXT,
      leadId TEXT,
      assignedTo TEXT NOT NULL,
      status TEXT DEFAULT 'Completed',
      createdDate TEXT NOT NULL,
      FOREIGN KEY (assignedTo) REFERENCES users(userId)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      auditLogId TEXT PRIMARY KEY,
      userId TEXT,
      userName TEXT,
      action TEXT NOT NULL,
      entityName TEXT NOT NULL,
      recordId TEXT,
      oldValue TEXT,
      newValue TEXT,
      createdDate TEXT NOT NULL,
      ipAddress TEXT,
      result TEXT DEFAULT 'Success',
      details TEXT
    );
  `);
}

initSchema();

module.exports = db;
