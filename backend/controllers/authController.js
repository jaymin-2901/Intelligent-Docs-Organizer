const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const database = require('../src/models/database');

const genToken = (id, rememberMe = false) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'dev-super-secret-jwt-key-change-in-prod', {
    expiresIn: rememberMe
      ? (process.env.JWT_REMEMBER_EXPIRES || '30d')
      : (process.env.JWT_EXPIRES_IN || '7d'),
  });

const toSafeUser = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  mobile: row.mobile,
  role: row.role,
  isActive: Boolean(row.is_active),
  lastLogin: row.last_login,
  createdAt: row.created_at,
});

const isLocked = (row) => !!(row.lock_until && new Date(row.lock_until).getTime() > Date.now());

// ════ SIGNUP ════════════════════════════════════════════
exports.signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const { fullName, email, mobile, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await database.get(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existing)
      return res.status(409).json({
        success: false,
        message: 'This email is already registered. Please login instead.',
      });

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const result = await database.run(
      `INSERT INTO users (full_name, email, mobile, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'user', 1, ?, ?)`,
      [fullName.trim(), normalizedEmail, mobile.trim(), passwordHash, now, now]
    );

    const user = await database.get('SELECT * FROM users WHERE id = ?', [result.id]);
    const token = genToken(user.id);

    res.status(201).json({
      success: true,
      message: `Welcome, ${user.full_name.split(' ')[0]}! Account created 🎉`,
      token,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('Signup:', err);
    if (String(err.message || '').includes('UNIQUE constraint failed'))
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
    const normalizedEmail = email.toLowerCase().trim();

    const user = await database.get(
      `SELECT id, full_name, email, mobile, password_hash, role, is_active, created_at,
              last_login, login_attempts, lock_until
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    if (isLocked(user)) {
      const mins = Math.ceil((new Date(user.lock_until).getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${mins} minute(s).`,
      });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      const attempts = (user.login_attempts || 0) + 1;
      const now = new Date().toISOString();
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await database.run(
          'UPDATE users SET login_attempts = ?, lock_until = ?, updated_at = ? WHERE id = ?',
          [attempts, lockUntil, now, user.id]
        );
      } else {
        await database.run(
          'UPDATE users SET login_attempts = ?, updated_at = ? WHERE id = ?',
          [attempts, now, user.id]
        );
      }

      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const lastLogin = new Date().toISOString();
    await database.run(
      'UPDATE users SET login_attempts = 0, lock_until = NULL, last_login = ?, updated_at = ? WHERE id = ?',
      [lastLogin, lastLogin, user.id]
    );

    const freshUser = await database.get(
      `SELECT id, full_name, email, mobile, role, is_active, created_at, last_login
       FROM users WHERE id = ?`,
      [user.id]
    );

    const token = genToken(user.id, rememberMe);

    res.json({
      success: true,
      message: `Welcome back, ${freshUser.full_name.split(' ')[0]}! 👋`,
      token,
      user: toSafeUser(freshUser),
    });
  } catch (err) {
    console.error('Login:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ════ GET ME ════════════════════════════════════════════
exports.getMe = async (req, res) => {
  try {
    const user = await database.get(
      `SELECT id, full_name, email, mobile, role, is_active, created_at, last_login
       FROM users
       WHERE id = ? AND is_active = 1`,
      [req.user.id]
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════ UPDATE PROFILE ════════════════════════════════════
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, mobile } = req.body;

    const existing = await database.get(
      'SELECT id, full_name, mobile FROM users WHERE id = ? AND is_active = 1',
      [req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updatedName = typeof fullName === 'string' && fullName.trim() ? fullName.trim() : existing.full_name;
    const updatedMobile = typeof mobile === 'string' && mobile.trim() ? mobile.trim() : existing.mobile;
    const now = new Date().toISOString();

    await database.run(
      'UPDATE users SET full_name = ?, mobile = ?, updated_at = ? WHERE id = ?',
      [updatedName, updatedMobile, now, req.user.id]
    );

    const user = await database.get(
      `SELECT id, full_name, email, mobile, role, is_active, created_at, last_login
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.json({ success: true, message: 'Profile updated!', user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════ CHANGE PASSWORD ═══════════════════════════════════
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const user = await database.get(
      'SELECT id, password_hash FROM users WHERE id = ? AND is_active = 1',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches)
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hashed = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();

    await database.run(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      [hashed, now, req.user.id]
    );

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════ FORGOT PASSWORD ═══════════════════════════════════
exports.forgotPassword = async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await database.get(
      'SELECT id FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    // Always respond the same to prevent email enumeration
    if (!user)
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await database.run(
      `UPDATE users
       SET password_reset_token = ?, password_reset_expires = ?, updated_at = ?
       WHERE id = ?`,
      [hashed, expiresAt, new Date().toISOString(), user.id]
    );

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetURL = `${clientUrl}/reset-password/${resetToken}`;
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
    if (!req.body.password || req.body.password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const now = new Date().toISOString();
    const user = await database.get(
      `SELECT id
       FROM users
       WHERE password_reset_token = ?
         AND password_reset_expires > ?
         AND is_active = 1
       LIMIT 1`,
      [hashed, now]
    );

    if (!user)
      return res.status(400).json({ success: false, message: 'Invalid or expired token.' });

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await database.run(
      `UPDATE users
       SET password_hash = ?,
           password_reset_token = NULL,
           password_reset_expires = NULL,
           login_attempts = 0,
           lock_until = NULL,
           updated_at = ?
       WHERE id = ?`,
      [passwordHash, new Date().toISOString(), user.id]
    );

    const token = genToken(user.id);
    res.json({ success: true, message: 'Password reset! Please login.', token });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
