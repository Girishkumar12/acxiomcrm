const express = require('express');
const router = express.Router();

const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateCustomer, validateLead, validateOpportunity, validateFollowUp } = require('../middleware/validation');

const authController = require('../controllers/authController');
const customerController = require('../controllers/customerController');
const leadController = require('../controllers/leadController');
const opportunityController = require('../controllers/opportunityController');
const followUpController = require('../controllers/followUpController');
const reportController = require('../controllers/reportController');

// -------------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------------
router.post('/auth/login', authController.login);
router.post('/auth/logout', authenticateToken, authController.logout);

// -------------------------------------------------------------------
// CUSTOMERS
// -------------------------------------------------------------------
router.get('/customers', authenticateToken, customerController.getCustomers);
router.get('/customers/:id', authenticateToken, customerController.getCustomerById);
router.post('/customers', authenticateToken, validateCustomer, customerController.createCustomer);
router.put('/customers/:id', authenticateToken, validateCustomer, customerController.updateCustomer);
router.delete('/customers/:id', authenticateToken, requireRole('Admin', 'Manager'), customerController.deleteCustomer);

// -------------------------------------------------------------------
// LEADS
// -------------------------------------------------------------------
router.get('/leads', authenticateToken, leadController.getLeads);
router.post('/leads', authenticateToken, validateLead, leadController.createLead);
router.post('/leads/:id/convert', authenticateToken, leadController.convertLead);

// -------------------------------------------------------------------
// OPPORTUNITIES
// -------------------------------------------------------------------
router.get('/opportunities', authenticateToken, opportunityController.getOpportunities);
router.post('/opportunities', authenticateToken, validateOpportunity, opportunityController.createOpportunity);
router.put('/opportunities/:id', authenticateToken, validateOpportunity, opportunityController.updateOpportunity);

// -------------------------------------------------------------------
// FOLLOW-UPS
// -------------------------------------------------------------------
router.get('/followups', authenticateToken, followUpController.getFollowUps);
router.post('/followups', authenticateToken, validateFollowUp, followUpController.createFollowUp);
router.put('/followups/:id/status', authenticateToken, followUpController.updateFollowUpStatus);

// -------------------------------------------------------------------
// REPORTS & ADMIN
// -------------------------------------------------------------------
router.get('/reports/pipeline', authenticateToken, reportController.getPipelineReport);
router.get('/users', authenticateToken, requireRole('Admin', 'Manager'), reportController.getUsers);
router.put('/users/:id/role', authenticateToken, requireRole('Admin'), reportController.updateUserRole);
router.put('/users/:id/unlock', authenticateToken, requireRole('Admin'), reportController.unlockUserAccount);
router.get('/audit-logs', authenticateToken, requireRole('Admin', 'Manager'), reportController.getAuditLogs);

module.exports = router;
