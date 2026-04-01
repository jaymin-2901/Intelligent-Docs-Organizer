import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from '../components/Toast';
import '../auth.css';

const pwdRules = [
  { re: /.{8,}/, label: 'At least 8 characters' },
  { re: /[A-Z]/, label: 'One uppercase letter' },
  { re: /[a-z]/, label: 'One lowercase letter' },
  { re: /\d/, label: 'One number' },
  { re: /[@$!%*?&#^()_+]/, label: 'One special character' },
];

const strengthColors = ['#d62828', '#f59e0b', '#f59e0b', '#7cc242', '#1f7fae'];
const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Excellent'];

export default function Signup() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();

  if (user) { navigate('/dashboard', { replace: true }); return null; }

  const [form, setForm] = useState({ fullName: '', email: '', mobile: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErrors((p) => ({ ...p, [e.target.name]: '' }));
  };

  const pwdScore = useMemo(
    () => pwdRules.reduce((s, r) => s + (r.re.test(form.password) ? 1 : 0), 0),
    [form.password]
  );

  const validate = () => {
    const err = {};
    if (!form.fullName.trim()) err.fullName = 'Full name is required';
    else if (form.fullName.trim().length < 2) err.fullName = 'Min 2 characters';
    if (!form.email.trim()) err.email = 'Email is required';
    else if (!/^\S+@\S+\.\S{2,}$/.test(form.email)) err.email = 'Enter a valid email';
    if (!form.mobile.trim()) err.mobile = 'Mobile is required';
    else if (!/^[+]?[\d\s\-()]{7,15}$/.test(form.mobile)) err.mobile = 'Enter a valid mobile';
    if (!form.password) err.password = 'Password is required';
    else if (pwdScore < 4) err.password = 'Password too weak';
    if (!form.confirmPassword) err.confirmPassword = 'Confirm password required';
    else if (form.password !== form.confirmPassword) err.confirmPassword = 'Passwords do not match';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await signup(form);
      toast.success(data.message || 'Account created!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Signup failed.';
      toast.error(msg);
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div className="auth-brand__logo">
          <span>📚</span> Doc Organizer
        </div>
        <p className="auth-brand__tagline">Join the intelligent organizer</p>
        <h2 className="auth-brand__headline">Create Account</h2>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <h1>Create Account</h1>

          {errors.general && <div className="field-error">❌ {errors.general}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input name="fullName" placeholder=" " value={form.fullName} onChange={handleChange} className={errors.fullName ? 'error' : ''} />
              <label>Full Name</label>
              {errors.fullName && <div className="field-error">⚠ {errors.fullName}</div>}
            </div>

            <div className="form-group">
              <input type="email" name="email" placeholder=" " value={form.email} onChange={handleChange} className={errors.email ? 'error' : ''} />
              <label>Email</label>
              {errors.email && <div className="field-error">⚠ {errors.email}</div>}
            </div>

            <div className="form-group">
              <input type="tel" name="mobile" placeholder=" " value={form.mobile} onChange={handleChange} className={errors.mobile ? 'error' : ''} />
              <label>Mobile</label>
              {errors.mobile && <div className="field-error">⚠ {errors.mobile}</div>}
            </div>

            <div className="form-group">
              <div className="input-with-action">
                <input type={showPwd ? 'text' : 'password'} name="password" placeholder=" " value={form.password} onChange={handleChange} className={errors.password ? 'error' : ''} />
                <button type="button" className="input-action-btn" onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
              <label>Password</label>
              {errors.password && <div className="field-error">⚠ {errors.password}</div>}
              {form.password && (
                <div className="pwd-strength">
                  <div className="pwd-strength__bar" style={{ '--score': pwdScore }}>
                    {[0,1,2,3,4].map(i => <div key={i} className="pwd-strength__seg" />)}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <div className="input-with-action">
                <input type={showCpw ? 'text' : 'password'} name="confirmPassword" placeholder=" " value={form.confirmPassword} onChange={handleChange} className={errors.confirmPassword ? 'error' : ''} />
                <button type="button" className="input-action-btn" onClick={() => setShowCpw(!showCpw)}>
                  {showCpw ? '🙈' : '👁️'}
                </button>
              </div>
              <label>Confirm Password</label>
              {errors.confirmPassword && <div className="field-error">⚠ {errors.confirmPassword}</div>}
            </div>

            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </form>

          <div className="auth-link-row">
            Have account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
