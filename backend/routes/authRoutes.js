const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// ── Validation ────────────────────────────────────────
const signupRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('mobile').trim().notEmpty().withMessage('Mobile is required')
    .matches(/^[+]?[\d\s\-\(\)]{7,15}$/).withMessage('Enter a valid mobile number'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/).withMessage('Password too weak'),
  body('confirmPassword')
    .custom((val, { req }) => val === req.body.password)
    .withMessage('Passwords do not match'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Routes ────────────────────────────────────────────
router.post('/auth/signup',           signupRules, ctrl.signup);
router.post('/auth/login',            loginRules,  ctrl.login);
router.get ('/auth/me',               protect,     ctrl.getMe);
router.put ('/auth/profile',          protect,     ctrl.updateProfile);
router.put ('/auth/change-password',  protect,     ctrl.changePassword);
router.post('/auth/forgot-password',               ctrl.forgotPassword);
router.post('/auth/reset-password/:token',         ctrl.resetPassword);

module.exports = router;
