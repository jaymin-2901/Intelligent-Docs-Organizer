const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User   = require('../models/User');

const genToken = (id, rememberMe = false) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'dev-super-secret-jwt-key-change-in-prod', {
    expiresIn: rememberMe ? '30d' : '7d',
  });

// ════ SIGNUP ════════════════════════════════════════════
exports.signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const { fullName, email, mobile, password } = req.body;

    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({
        success: false,
        message: 'This email is already registered. Please login instead.',
      });

    const user  = await User.create({ fullName, email, mobile, password });
    const token = genToken(user._id);

    res.status(201).json({
      success: true,
      message: `Welcome, ${user.fullName.split(' ')[0]}! Account created 🎉`,
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Signup:', err);
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ════ LOGIN ═════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const { email, password, rememberMe = false } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password +loginAttempts +lockUntil');

    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    if (user.isLocked) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${mins} minute(s).`,
      });
    }

    if (!(await user.comparePassword(password))) {
      await user.incLoginAttempts();
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Reset attempts on success
    if (user.loginAttempts > 0)
      await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = genToken(user._id, rememberMe);

    res.json({
      success: true,
      message: `Welcome back, ${user.fullName.split(' ')[0]}! 👋`,
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Login:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ════ GET ME ════════════════════════════════════════════
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════ UPDATE PROFILE ════════════════════════════════════
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, mobile } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { fullName, mobile },
      { new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Profile updated!', user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════ CHANGE PASSWORD ═══════════════════════════════════
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════ FORGOT PASSWORD ═══════════════════════════════════
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() });

    // Always respond the same to prevent email enumeration
    if (!user)
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetURL = `http://localhost:5173/reset-password/${resetToken}`;
    console.log(`\n🔗 Password Reset URL (dev): ${resetURL}\n`);

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('ForgotPassword:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════ RESET PASSWORD ════════════════════════════════════
exports.resetPassword = async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      passwordResetToken:   hashed,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ success: false, message: 'Invalid or expired token.' });

    user.password             = req.body.password;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts        = 0;
    user.lockUntil            = undefined;
    await user.save();

    const token = genToken(user._id);
    res.json({ success: true, message: 'Password reset! Please login.', token });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
