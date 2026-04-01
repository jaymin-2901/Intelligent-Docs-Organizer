const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String, required: [true, 'Full name is required'],
      trim: true, minlength: [2, 'Min 2 chars'], maxlength: [100, 'Max 100 chars'],
    },
    email: {
      type: String, required: [true, 'Email is required'],
      unique: true, lowercase: true, trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/, 'Invalid email'],
    },
    mobile: {
      type: String, required: [true, 'Mobile is required'], trim: true,
      match: [/^[+]?[\d\s\-\(\)]{7,15}$/, 'Invalid mobile number'],
    },
    password: {
      type: String, required: [true, 'Password is required'],
      minlength: [8, 'Min 8 chars'], select: false,
    },
    role:       { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive:   { type: Boolean, default: true },
    lastLogin:  { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil:     { type: Date },
    passwordResetToken:   String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

// ── Virtual: isLocked ─────────────────────────────────
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ── Hash password before save ─────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Compare passwords ─────────────────────────────────
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Increment login attempts / lock account ───────────
userSchema.methods.incLoginAttempts = function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 };
  }
  return this.updateOne(updates);
};

// ── Create password reset token ───────────────────────
userSchema.methods.createPasswordResetToken = function () {
  const raw = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken   = crypto.createHash('sha256').update(raw).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return raw;
};

// ── Safe output (no sensitive fields) ────────────────
userSchema.methods.toSafeObject = function () {
  return {
    id:        this._id,
    fullName:  this.fullName,
    email:     this.email,
    mobile:    this.mobile,
    role:      this.role,
    isActive:  this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);