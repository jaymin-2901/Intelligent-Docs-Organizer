import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from '../components/Toast';
import '../auth.css';

export default function Login() {
  const { login, user } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const from             = location.state?.from?.pathname || '/dashboard/doc-view';
  const prefillEmail     = (location.state?.prefillEmail || '').trim();

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [from, navigate, user]);

  if (user) return null;

  const [form, setForm]         = useState({ email: prefillEmail, password: '', rememberMe: false });
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    setErrors((p) => ({ ...p, [name]: '' }));
  };

  const validate = () => {
    const err = {};
    if (!form.email.trim()) err.email = 'Email is required';
    else if (!/^\S+@\S+\.\S{2,}$/.test(form.email)) err.email = 'Enter a valid email';
    if (!form.password) err.password = 'Password is required';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const data = await login(form.email, form.password, form.rememberMe);
      toast.success(data.message || 'Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Try again.';
      toast.error(msg);
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* ── Brand Panel ── */}
      <div className="auth-brand">
        <div className="auth-brand__logo">
          <span>📚</span> Doc Organizer
        </div>
        <p className="auth-brand__tagline">AI-Powered Document Management</p>
        <h2 className="auth-brand__headline">
          Welcome back!<br />Sign in to analyze.
        </h2>
      </div>

      {/* ── Form Panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <h1>Sign In</h1>
            <p>Enter your credentials to access your dashboard</p>
          </div>

          {errors.general && (
            <div className="field-error" style={{ marginBottom: '1rem' }}>
              ❌ {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <input
                type="email"
                name="email"
                placeholder=" "
                value={form.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                autoComplete="email"
              />
              <label>Email</label>
              {errors.email && <div className="field-error">⚠ {errors.email}</div>}
            </div>

            <div className="form-group">
              <div className="input-with-action">
                <input
                  type={showPwd ? 'text' : 'password'}
                  name="password"
                  placeholder=" "
                  value={form.password}
                  onChange={handleChange}
                  className={errors.password ? 'error' : ''}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-action-btn"
                  onClick={() => setShowPwd((p) => !p)}
                  tabIndex={-1}
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
              <label>Password</label>
              {errors.password && <div className="field-error">⚠ {errors.password}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <label className="checkbox-group">
                <input type="checkbox" name="rememberMe" checked={form.rememberMe} onChange={handleChange} />
                <span className="checkbox-custom">{form.rememberMe ? '✓' : ''}</span>
                <span className="checkbox-label">Remember me</span>
              </label>
            </div>

            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="auth-link-row">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
