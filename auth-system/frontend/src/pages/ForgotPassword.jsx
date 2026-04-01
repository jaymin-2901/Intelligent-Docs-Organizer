import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { toast } from '../components/Toast';

export default function ForgotPassword() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/^\S+@\S+\.\S{2,}$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword({ email });
      toast.success(data.message);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div className="auth-brand__logo"><span>🔐</span> AuthSystem</div>
        <p className="auth-brand__tagline">Account recovery</p>
        <h2 className="auth-brand__headline">Forgot your<br />password?</h2>
        <p className="auth-brand__sub">
          No worries! Enter your registered email and we'll send you a reset link.
        </p>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          {!sent ? (
            <>
              <div className="auth-form-header">
                <h1>Reset Password</h1>
                <p>We'll send a reset link to your email</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <input
                    type="email"
                    placeholder=" "
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    className={error ? 'error' : ''}
                    autoComplete="email"
                  />
                  <label>Email Address</label>
                  {error && <div className="field-error">⚠ {error}</div>}
                </div>

                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading ? <span className="btn-spinner" /> : null}
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📧</div>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--gray-900)', marginBottom: '0.6rem' }}>
                Check your email
              </h2>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
              </p>
              <button className="btn btn--outline" onClick={() => setSent(false)} style={{ width: '100%' }}>
                Try a different email
              </button>
            </div>
          )}

          <div className="auth-link-row">
            <Link to="/login">← Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}