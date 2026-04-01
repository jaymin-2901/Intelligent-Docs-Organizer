import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { toast } from '../components/Toast';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  // ── Profile form ────────────────────────────────────
  const [profile, setProfile]       = useState({ fullName: user?.fullName || '', mobile: user?.mobile || '' });
  const [profileLoading, setPLoad]  = useState(false);

  // ── Password form ──────────────────────────────────
  const [pwd, setPwd]             = useState({ currentPassword: '', newPassword: '', confirmNew: '' });
  const [pwdLoading, setPwdLoad]  = useState(false);
  const [showCur, setShowCur]     = useState(false);
  const [showNew, setShowNew]     = useState(false);

  const initials = user?.fullName?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  // ── Update profile ──────────────────────────────────
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!profile.fullName.trim()) { toast.error('Name is required'); return; }
    setPLoad(true);
    try {
      const { data } = await authAPI.updateProfile(profile);
      if (data.success) {
        updateUser(data.user);
        toast.success(data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setPLoad(false); }
  };

  // ── Change password ─────────────────────────────────
  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    if (!pwd.currentPassword) { toast.error('Enter current password'); return; }
    if (pwd.newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (pwd.newPassword !== pwd.confirmNew) { toast.error('New passwords do not match'); return; }

    setPwdLoad(true);
    try {
      const { data } = await authAPI.changePassword({
        currentPassword: pwd.currentPassword,
        newPassword:     pwd.newPassword,
      });
      if (data.success) {
        toast.success(data.message);
        setPwd({ currentPassword: '', newPassword: '', confirmNew: '' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed');
    } finally { setPwdLoad(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="profile-page">
      <nav className="dashboard-nav">
        <Link to="/dashboard" className="dashboard-nav__brand">🔐 AuthSystem</Link>
        <div className="dashboard-nav__actions">
          <Link to="/dashboard" className="btn btn--ghost" style={{ height: 40, padding: '0 1rem', fontSize: '0.85rem' }}>
            ← Dashboard
          </Link>
          <button onClick={handleLogout} className="btn btn--outline" style={{ height: 40, padding: '0 1rem', fontSize: '0.85rem' }}>
            🚪 Logout
          </button>
          <div className="user-avatar">{initials}</div>
        </div>
      </nav>

      <div className="profile-main">
        <h1>👤 My Profile</h1>

        {/* ── Info Card ── */}
        <div className="profile-card">
          <div className="profile-avatar">{initials}</div>
          <dl>
            <div className="profile-info-row"><dt>Full Name</dt><dd>{user?.fullName}</dd></div>
            <div className="profile-info-row"><dt>Email</dt><dd>{user?.email}</dd></div>
            <div className="profile-info-row"><dt>Mobile</dt><dd>{user?.mobile || '—'}</dd></div>
            <div className="profile-info-row"><dt>Role</dt><dd style={{ textTransform: 'capitalize' }}>{user?.role}</dd></div>
            <div className="profile-info-row">
              <dt>Member Since</dt>
              <dd>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' }) : '—'}</dd>
            </div>
          </dl>
        </div>

        {/* ── Edit Profile ── */}
        <div className="profile-card">
          <h2>✏️ Edit Profile</h2>
          <form onSubmit={handleProfileSubmit}>
            <div className="profile-form-row">
              <div className="form-group">
                <input type="text" placeholder=" " value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} />
                <label>Full Name</label>
              </div>
              <div className="form-group">
                <input type="tel" placeholder=" " value={profile.mobile} onChange={(e) => setProfile((p) => ({ ...p, mobile: e.target.value }))} />
                <label>Mobile Number</label>
              </div>
            </div>
            <div className="profile-form-actions">
              <button type="submit" className="btn btn--primary" style={{ width: 'auto' }} disabled={profileLoading}>
                {profileLoading ? <span className="btn-spinner" /> : null}
                {profileLoading ? 'Saving…' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Change Password ── */}
        <div className="profile-card">
          <h2>🔒 Change Password</h2>
          <form onSubmit={handlePwdSubmit}>
            <div className="form-group">
              <div className="input-with-action">
                <input type={showCur ? 'text' : 'password'} placeholder=" " value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} autoComplete="current-password" />
                <button type="button" className="input-action-btn" onClick={() => setShowCur((p) => !p)} tabIndex={-1}>
                  {showCur ? '🙈' : '👁️'}
                </button>
              </div>
              <label>Current Password</label>
            </div>

            <div className="profile-form-row">
              <div className="form-group">
                <div className="input-with-action">
                  <input type={showNew ? 'text' : 'password'} placeholder=" " value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} autoComplete="new-password" />
                  <button type="button" className="input-action-btn" onClick={() => setShowNew((p) => !p)} tabIndex={-1}>
                    {showNew ? '🙈' : '👁️'}
                  </button>
                </div>
                <label>New Password</label>
              </div>
              <div className="form-group">
                <input type="password" placeholder=" " value={pwd.confirmNew} onChange={(e) => setPwd((p) => ({ ...p, confirmNew: e.target.value }))} autoComplete="new-password" />
                <label>Confirm New Password</label>
              </div>
            </div>

            <div className="profile-form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setPwd({ currentPassword: '', newPassword: '', confirmNew: '' })}>
                Cancel
              </button>
              <button type="submit" className="btn btn--danger" style={{ width: 'auto' }} disabled={pwdLoading}>
                {pwdLoading ? <span className="btn-spinner" /> : null}
                {pwdLoading ? 'Changing…' : '🔑 Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}