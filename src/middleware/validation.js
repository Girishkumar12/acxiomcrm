const { body, validationResult } = require('express-validator');
const db = require('../database/db');

// Helper to check validation errors and return consistent JSON format
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMap = {};
    errors.array().forEach(err => {
      errorMap[err.path] = err.msg;
    });

    if (req.path.startsWith('/api/')) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errorMap,
        errors: errors.array()
      });
    }

    return res.status(400).json({
      success: false,
      error: errors.array()[0].msg,
      details: errorMap
    });
  }
  next();
}

// 1. Customer Validation
const validateCustomer = [
  body('customerName')
    .trim()
    .notEmpty().withMessage('Customer Name is required.')
    .isLength({ max: 100 }).withMessage('Customer Name cannot exceed 100 characters.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Enter a valid email address.')
    .custom((email, { req }) => {
      const customerId = req.params?.id || req.body?.customerId;
      let query = 'SELECT customerId FROM customers WHERE email = ?';
      const params = [email.toLowerCase()];
      if (customerId) {
        query += ' AND customerId != ?';
        params.push(customerId);
      }
      const existing = db.prepare(query).get(...params);
      if (existing) {
        throw new Error('A customer with this email address already exists.');
      }
      return true;
    }),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^[0-9\-\+\(\)\s]{7,15}$/).withMessage('Enter a valid phone number (7-15 digits).')
    .custom((phone, { req }) => {
      const customerId = req.params?.id || req.body?.customerId;
      let query = 'SELECT customerId FROM customers WHERE phone = ?';
      const params = [phone];
      if (customerId) {
        query += ' AND customerId != ?';
        params.push(customerId);
      }
      const existing = db.prepare(query).get(...params);
      if (existing) {
        throw new Error('A customer with this phone number already exists.');
      }
      return true;
    }),
  body('companyName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Company Name cannot exceed 100 characters.'),
  handleValidationErrors
];

// 2. Lead Validation
const validateLead = [
  body('leadName')
    .trim()
    .notEmpty().withMessage('Lead Name is required.')
    .isLength({ max: 100 }).withMessage('Lead Name cannot exceed 100 characters.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Enter a valid email address.'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^[0-9\-\+\(\)\s]{7,15}$/).withMessage('Enter a valid phone number.'),
  body('expectedValue')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Expected Value must be a non-negative number.'),
  body('status')
    .optional()
    .isIn(['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'])
    .withMessage('Invalid lead status.'),
  handleValidationErrors
];

// 3. Opportunity Validation
const validateOpportunity = [
  body('opportunityName')
    .trim()
    .notEmpty().withMessage('Opportunity Name is required.'),
  body('customerId')
    .trim()
    .notEmpty().withMessage('Customer selection is required.')
    .custom((custVal) => {
      const cust = db.prepare('SELECT customerId FROM customers WHERE customerId = ?').get(custVal);
      if (!cust) throw new Error('Selected customer does not exist.');
      return true;
    }),
  body('amount')
    .notEmpty().withMessage('Opportunity Amount is required.')
    .isFloat({ gt: 0 }).withMessage('Opportunity Amount must be greater than 0.'),
  body('probability')
    .notEmpty().withMessage('Probability is required.')
    .isInt({ min: 0, max: 100 }).withMessage('Probability must be between 0 and 100.'),
  body('expectedCloseDate')
    .notEmpty().withMessage('Expected Close Date is required.')
    .isISO8601().withMessage('Expected Close Date must be a valid date format (YYYY-MM-DD).')
    .custom((closeDateStr, { req }) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const stage = req.body?.stage || 'Qualification';
      if (stage !== 'Won' && stage !== 'Lost' && closeDateStr < todayStr) {
        throw new Error('Expected Close Date cannot be in the past.');
      }
      return true;
    }),
  handleValidationErrors
];

// 4. Follow-Up Validation
const validateFollowUp = [
  body('subject')
    .trim()
    .notEmpty().withMessage('Follow-Up Subject is required.'),
  body('followUpDate')
    .notEmpty().withMessage('Follow-Up Date is required.')
    .custom((dateStr, { req }) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const status = req.body?.status || 'Planned';
      // If planned or new, date cannot be earlier than today
      if (status === 'Planned' && dateStr < todayStr) {
        throw new Error('Follow-up date cannot be earlier than today.');
      }
      return true;
    }),
  body('followUpType')
    .trim()
    .notEmpty().withMessage('Follow-Up Type is required.')
    .isIn(['Call', 'Meeting', 'Email', 'Task']).withMessage('Invalid follow-up type.'),
  handleValidationErrors
];

module.exports = {
  validateCustomer,
  validateLead,
  validateOpportunity,
  validateFollowUp,
  handleValidationErrors
};
