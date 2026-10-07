const db = require('./db');
const bcrypt = require('bcryptjs');

function seedDatabase() {
  const rolesCount = db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
  if (rolesCount > 0) {
    return;
  }

  console.log('[Seed] Populating initial AcxiomCRM data...');

  // Roles
  const insertRole = db.prepare('INSERT INTO roles (roleId, roleName) VALUES (?, ?)');
  insertRole.run(1, 'Admin');
  insertRole.run(2, 'Manager');
  insertRole.run(3, 'SalesExecutive');

  const passwordHash = bcrypt.hashSync('Password123!', 10);
  const now = new Date().toISOString();

  // Primary Users
  const adminId = 'usr_admin_01';
  const managerId = 'usr_mgr_01';
  const sales1Id = 'usr_sales_01';
  const sales2Id = 'usr_sales_02';

  const insertUser = db.prepare(`
    INSERT INTO users (userId, name, email, phone, passwordHash, roleId, roleName, isActive, failedLoginCount, lockoutEnd, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?)
  `);

  insertUser.run(adminId, 'Elena Vance', 'admin@acxiom.com', '+1 (555) 019-2831', passwordHash, 1, 'Admin', now);
  insertUser.run(managerId, 'Marcus Brody', 'manager@acxiom.com', '+1 (555) 014-9920', passwordHash, 2, 'Manager', now);
  insertUser.run(sales1Id, 'Alex Turner', 'sales1@acxiom.com', '+1 (555) 018-4412', passwordHash, 3, 'SalesExecutive', now);
  insertUser.run(sales2Id, 'Sophia Zhang', 'sales2@acxiom.com', '+1 (555) 012-7741', passwordHash, 3, 'SalesExecutive', now);

  // Real Enterprise Customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (customerId, customerCode, customerName, email, phone, companyName, address, city, state, status, ownerId, createdBy, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const cust1 = 'cust_849201';
  const cust2 = 'cust_849202';
  const cust3 = 'cust_849203';

  insertCustomer.run(cust1, 'CUST-8492', 'Vercel Inc', 'billing@vercel.com', '+1 (415) 890-1122', 'Vercel', '440 N Barranca Ave', 'San Francisco', 'CA', 'Active', sales1Id, adminId, now);
  insertCustomer.run(cust2, 'CUST-8493', 'Retool Inc', 'procurement@retool.com', '+1 (415) 773-9011', 'Retool', '100 Montgomery St', 'San Francisco', 'CA', 'Active', sales1Id, adminId, now);
  insertCustomer.run(cust3, 'CUST-8494', 'Datadog Tech', 'accounts@datadog.com', '+1 (212) 679-0211', 'Datadog', '620 8th Ave', 'New York', 'NY', 'Active', sales2Id, adminId, now);

  // Prospective Leads
  const insertLead = db.prepare(`
    INSERT INTO leads (leadId, leadCode, leadName, email, phone, companyName, source, status, expectedValue, priority, ownerId, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const lead1 = 'lead_10492';
  const lead2 = 'lead_10493';
  const lead3 = 'lead_10494';
  const lead4 = 'lead_10495';

  insertLead.run(lead1, 'LEAD-1049', 'David Miller', 'david.m@stripe.com', '+1 (650) 901-2231', 'Stripe', 'Website', 'New', 85000, 'High', sales1Id, now);
  insertLead.run(lead2, 'LEAD-1050', 'Claire Redfield', 'claire@supabase.io', '+1 (408) 512-8899', 'Supabase', 'Referral', 'Contacted', 45000, 'Medium', sales1Id, now);
  insertLead.run(lead3, 'LEAD-1051', 'Jason Bourne', 'j.bourne@linear.app', '+1 (212) 441-9002', 'Linear', 'Cold Call', 'Qualified', 120000, 'High', sales2Id, now);
  insertLead.run(lead4, 'LEAD-1052', 'Hannah Abbott', 'hannah@figma.com', '+1 (415) 882-1002', 'Figma', 'Trade Show', 'Converted', 95000, 'Low', sales2Id, now);

  // Pipeline Opportunities
  const insertOpp = db.prepare(`
    INSERT INTO opportunities (opportunityId, opportunityName, customerId, leadId, amount, stage, probability, expectedCloseDate, status, ownerId, notes, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const future1 = new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0];
  const future2 = new Date(Date.now() + 40 * 86400000).toISOString().split('T')[0];
  const future3 = new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0];

  const opp1 = 'opp_30491';
  const opp2 = 'opp_30492';
  const opp3 = 'opp_30493';
  const opp4 = 'opp_30494';

  insertOpp.run(opp1, 'Vercel Enterprise Platform Expansion', cust1, null, 125000, 'Proposal', 65, future1, 'Open', sales1Id, 'Sent updated SLA clause. Awaiting security review.', now);
  insertOpp.run(opp2, 'Retool Annual Custom Integrations', cust2, null, 68000, 'Negotiation', 85, future2, 'Open', sales1Id, 'Legal team finalizing terms of service.', now);
  insertOpp.run(opp3, 'Datadog Multi-Region Cloud Node Package', cust3, null, 195000, 'Qualification', 35, future3, 'Open', sales2Id, 'Discovery session completed with CTO.', now);
  insertOpp.run(opp4, 'Figma Analytics Integration Suite', cust3, lead4, 95000, 'Won', 100, now.split('T')[0], 'Won', sales2Id, 'Contract executed.', now);

  // Follow-ups
  const insertFollowUp = db.prepare(`
    INSERT INTO follow_ups (followUpId, relatedType, relatedId, customerId, leadId, followUpDate, followUpType, subject, remarks, status, assignedTo, createdDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0];

  insertFollowUp.run('flw_701', 'Opportunity', opp1, cust1, null, tomorrow, 'Meeting', 'Vercel Pricing Review Call', 'Walk through tier discounts with engineering team', 'Planned', sales1Id, now);
  insertFollowUp.run('flw_702', 'Lead', lead1, null, lead1, nextWeek, 'Call', 'Discovery call with David @ Stripe', 'Discuss payment gateway volume requirements', 'Planned', sales1Id, now);
  insertFollowUp.run('flw_703', 'Customer', cust2, cust2, null, tomorrow, 'Email', 'Send revised MSA to Retool legal', 'Include addendum for 99.9% uptime SLA', 'Planned', sales2Id, now);

  // Initial Audit Entry
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (auditLogId, userId, userName, action, entityName, recordId, oldValue, newValue, createdDate, ipAddress, result, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run('aud_101', adminId, 'Elena Vance', 'Login', 'Authentication', adminId, null, null, now, '127.0.0.1', 'Success', 'Admin logged into system workspace');
  insertAudit.run('aud_102', sales1Id, 'Alex Turner', 'Create', 'Customer', cust1, null, 'Vercel Inc', now, '127.0.0.1', 'Success', 'Registered customer record CUST-8492');

  console.log('[Seed] AcxiomCRM dataset initialized successfully.');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
