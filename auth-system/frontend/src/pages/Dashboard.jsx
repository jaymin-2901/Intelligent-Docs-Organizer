import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  const lastLogin = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Just now';

  return (
    <div className="dashboard">
      {/* ── Nav ── */}
      <nav className="dashboard-nav">
        <div className="dashboard-nav__brand">🔐 AuthSystem</div>
        <div className="dashboard-nav__actions">
          <Link to="/profile" className="btn btn--ghost" style={{ height: 40, padding: '0 1rem', fontSize: '0.85rem' }}>
            ⚙️ Profile
          </Link>
          <button onClick={handleLogout} className="btn btn--outline" style={{ height: 40, padding: '0 1rem', fontSize: '0.85rem' }}>
            🚪 Logout
          </button>
          <div className="user-avatar">{initials}</div>
        </div>
      </nav>

      {/* ── Main ── */}
      <div className="dashboard-main">
        <div className="dashboard-welcome">
          <h1>👋 Welcome, {user?.fullName?.split(' ')[0] || 'User'}!</h1>
          <p>Here's your account overview</p>
        </div>

        {/* Stats */}
        <div className="dashboard-stats">
          <div className="stat-card stat-card--blue">
            <div className="stat-card__icon">🛡️</div>
            <div className="stat-card__value">Active</div>
            <div className="stat-card__label">Account Status</div>
          </div>

          <div className="stat-card stat-card--green">
            <div className="stat-card__icon">📅</div>
            <div className="stat-card__value">{memberSince}</div>
            <div className="stat-card__label">Member Since</div>
          </div>

          <div className="stat-card stat-card--purple">
            <div className="stat-card__icon">🔑</div>
            <div className="stat-card__value" style={{ fontSize: '1rem' }}>{lastLogin}</div>
            <div className="stat-card__label">Last Login</div>
          </div>

          <div className="stat-card stat-card--red">
            <div className="stat-card__icon">👤</div>
            <div className="stat-card__value" style={{ fontSize: '1.1rem', wordBreak: 'break-all' }}>{user?.email}</div>
            <div className="stat-card__label">Email</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-quick">
          <h2>⚡ Quick Actions</h2>
          <div className="quick-actions-grid">
            <Link to="/profile" className="quick-action">
              <div className="quick-action__icon">👤</div>
              <div className="quick-action__text">
                <h4>Edit Profile</h4>
                <p>Update name & mobile</p>
              </div>
            </Link>

            <Link to="/profile" className="quick-action">
              <div className="quick-action__icon">🔒</div>
              <div className="quick-action__text">
                <h4>Change Password</h4>
                <p>Update your password</p>
              </div>
            </Link>

            <div className="quick-action" onClick={handleLogout} style={{ cursor: 'pointer' }}>
              <div className="quick-action__icon">🚪</div>
              <div className="quick-action__text">
                <h4>Logout</h4>
                <p>End your session</p>
              </div>
            </div>

            <div className="quick-action" style={{ opacity: 0.5 }}>
              <div className="quick-action__icon">📊</div>
              <div className="quick-action__text">
                <h4>Analytics</h4>
                <p>Coming soon…</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}