import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../patient/PatientPages.css';

export default function PatientRegister() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', dob: '', phone: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await register({ name: formData.name, email: formData.email, password: formData.password, dob: formData.dob, phone: formData.phone, role: 'patient' });
      navigate('/patient/intake');
    } catch (err) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = () => {
    const p = formData.password;
    if (!p) return { label: '', color: 'transparent', width: '0%' };
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 1) return { label: 'Weak', color: '#ef4444', width: '20%' };
    if (score <= 2) return { label: 'Fair', color: '#f59e0b', width: '40%' };
    if (score <= 3) return { label: 'Good', color: '#1e90ff', width: '65%' };
    return { label: 'Strong', color: '#10b981', width: '100%' };
  };

  const strength = passwordStrength();

  return (
    <main className="page-container" style={{ padding: '40px 24px', minHeight: 'calc(100vh - 80px)' }}>
      <div className="form-wrapper" style={{ maxWidth: '560px', padding: '48px 40px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🧠</div>
        </div>

        <h1 className="page-title" style={{ textAlign: 'center', fontSize: '2rem' }}>Create Account</h1>
        <p className="page-subtitle" style={{ textAlign: 'center', marginBottom: '28px' }}>
          Join BrainScanAI to get instant MRI analysis
        </p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.2)',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form className="intake-form" onSubmit={handleSubmit} style={{ gap: '18px' }}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem' }}>👤</span> Full Name
            </label>
            <input
              id="register-name"
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. John Doe"
              autoComplete="name"
            />
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>📧</span> Email Address
              </label>
              <input
                id="register-email"
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="email@example.com"
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>📱</span> Phone Number
              </label>
              <input
                id="register-phone"
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="+20 123 456 7890"
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem' }}>📅</span> Date of Birth
            </label>
            <input
              id="register-dob"
              type="date"
              required
              value={formData.dob}
              onChange={e => setFormData({...formData, dob: e.target.value})}
            />
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>🔒</span> Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: '1rem', color: 'rgba(255,255,255,0.4)', padding: '4px'
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Password Strength Bar */}
              {formData.password && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{
                    height: '3px', background: 'rgba(255,255,255,0.08)',
                    borderRadius: '3px', overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%', width: strength.width,
                      background: strength.color,
                      transition: 'width 0.3s ease, background 0.3s ease',
                      borderRadius: '3px'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: strength.color, marginTop: '2px', display: 'block' }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>🔒</span> Confirm Password
              </label>
              <input
                id="register-confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                placeholder="Re-enter password"
                autoComplete="new-password"
                style={{
                  borderColor: formData.confirmPassword && formData.confirmPassword !== formData.password
                    ? 'rgba(239,68,68,0.5)' : undefined
                }}
              />
              {formData.confirmPassword && formData.confirmPassword !== formData.password && (
                <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>
                  Passwords don't match
                </span>
              )}
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '8px' }}>
            <button
              type="submit"
              className="btn btn--glow"
              id="register-submit"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                  Creating Account...
                </span>
              ) : 'Create Account'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <p style={{ marginBottom: '10px' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#1e90ff', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
          </p>
          <p>
            Are you a doctor?{' '}
            <Link to="/register/doctor" style={{ color: '#00e5ff', textDecoration: 'none', fontWeight: 600 }}>
              Register as Medical Professional
            </Link>
          </p>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </main>
  );
}
