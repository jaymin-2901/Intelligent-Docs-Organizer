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
router.post('/signup',           signupRules, ctrl.signup);
router.post('/login',            loginRules,  ctrl.login);
router.get ('/me',               protect,     ctrl.getMe);
router.put ('/profile',          protect,     ctrl.updateProfile);
router.put ('/change-password',  protect,     ctrl.changePassword);
router.post('/forgot-password',               ctrl.forgotPassword);
router.post('/reset-password/:token',         ctrl.resetPassword);

module.exports = router;
