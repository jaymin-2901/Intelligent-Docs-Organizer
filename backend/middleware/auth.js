const jwt  = require('jsonwebtoken');
const database = require('../src/models/database');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token && typeof req.query.token === 'string' && req.query.token.trim()) {
      token = req.query.token.trim();
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please login.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-super-secret-jwt-key-change-in-prod');
    const user = await database.get(
      'SELECT id, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    req.user = { id: Number(user.id) };
    next();
  } catch (err) {
    const msg =
      err.name === 'TokenExpiredError'
        ? 'Session expired. Please login again.'
        : 'Invalid token. Please login.';
    res.status(401).json({ success: false, message: msg });
  }
};
