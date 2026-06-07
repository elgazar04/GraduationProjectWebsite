import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/shared/Icon';
import '../patient/PatientPages.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const user = await login(formData.email, formData.password);
      if (user.role === 'doctor') navigate('/doctor/dashboard');
      else if (user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/patient/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="page-container">
      <div className="form-wrapper" style={{ maxWidth: '460px', padding: '48px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ width: '56px', height: '56px', margin: '0 auto 12px', background: 'rgba(0,255,178,0.08)', borderRadius: '16px', border: '1px solid rgba(0,255,178,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="brain" size={30} color="#00FFB2" />
          </div>
        </div>

        <h1 className="page-title" style={{ textAlign: 'center', fontSize: '2rem' }}>Welcome Back</h1>
        <p className="page-subtitle" style={{ textAlign: 'center', marginBottom: '28px' }}>
          Sign in to access your BrainScanAI dashboard
        </p>

        {error && (
          <div className="alert-banner alert-banner--danger" style={{ marginBottom: '20px', justifyContent: 'center' }}>
            <Icon name="alertCircle" size={18} color="var(--color-danger)" /> {error}
          </div>
        )}

        <form className="intake-form" onSubmit={handleSubmit} style={{ gap: '20px' }}>
          <div className="form-group">
            <label><Icon name="mail" size={16} /> Email Address</label>
            <input
              id="login-email"
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label><Icon name="lock" size={16} /> Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '4px', color: 'var(--text-tertiary)',
                  transition: 'color 0.2s', display: 'flex'
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '8px' }}>
            <button
              type="submit"
              className="btn btn--glow"
              id="login-submit"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <span className="spinner"></span>
                  Signing In...
                </span>
              ) : 'Sign In'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--neon-cyan)', textDecoration: 'none', fontWeight: 600 }}>
            Create one
          </Link>
        </div>
      </div>
    </main>
  );
}
