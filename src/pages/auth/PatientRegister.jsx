import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/shared/Icon';
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

    if (score <= 1) return { label: 'Weak', color: 'var(--color-danger)', width: '20%' };
    if (score <= 2) return { label: 'Fair', color: 'var(--color-warning)', width: '40%' };
    if (score <= 3) return { label: 'Good', color: 'var(--neon-cyan)', width: '65%' };
    return { label: 'Strong', color: 'var(--neon-green)', width: '100%' };
  };

  const strength = passwordStrength();

  return (
    <main className="page-container">
      <div className="form-wrapper" style={{ maxWidth: '560px', padding: '48px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ width: '56px', height: '56px', margin: '0 auto 12px', background: 'rgba(0,255,178,0.08)', borderRadius: '16px', border: '1px solid rgba(0,255,178,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="brain" size={30} color="#00FFB2" />
          </div>
        </div>

        <h1 className="page-title" style={{ textAlign: 'center', fontSize: '2rem' }}>Create Account</h1>
        <p className="page-subtitle" style={{ textAlign: 'center', marginBottom: '28px' }}>
          Join BrainScanAI to get instant MRI analysis
        </p>

        {error && (
          <div className="alert-banner alert-banner--danger" style={{ marginBottom: '20px', justifyContent: 'center' }}>
            <Icon name="alertCircle" size={18} color="var(--color-danger)" /> {error}
          </div>
        )}

        <form className="intake-form" onSubmit={handleSubmit} style={{ gap: '18px' }}>
          <div className="form-group">
            <label><Icon name="user" size={16} /> Full Name</label>
            <input id="register-name" type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" autoComplete="name" />
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label><Icon name="mail" size={16} /> Email Address</label>
              <input id="register-email" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@example.com" autoComplete="email" />
            </div>
            <div className="form-group">
              <label><Icon name="phone" size={16} /> Phone Number</label>
              <input id="register-phone" type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+20 123 456 7890" autoComplete="tel" />
            </div>
          </div>

          <div className="form-group">
            <label><Icon name="calendar" size={16} /> Date of Birth</label>
            <input id="register-dob" type="date" required value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label><Icon name="lock" size={16} /> Password</label>
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
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)', display: 'flex' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              {formData.password && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: strength.width, background: strength.color, transition: 'width 0.3s ease, background 0.3s ease', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: strength.color, marginTop: '2px', display: 'block' }}>{strength.label}</span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label><Icon name="lock" size={16} /> Confirm Password</label>
              <input
                id="register-confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                placeholder="Re-enter password"
                autoComplete="new-password"
                style={{ borderColor: formData.confirmPassword && formData.confirmPassword !== formData.password ? 'rgba(255,77,106,0.5)' : undefined }}
              />
              {formData.confirmPassword && formData.confirmPassword !== formData.password && (
                <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginTop: '2px' }}>Passwords don't match</span>
              )}
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '8px' }}>
            <button type="submit" className="btn btn--glow" id="register-submit" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }} disabled={isLoading}>
              {isLoading ? (<span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}><span className="spinner"></span> Creating Account...</span>) : 'Create Account'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <p style={{ marginBottom: '10px' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--neon-cyan)', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
          </p>
          <p>
            Are you a doctor?{' '}
            <Link to="/register/doctor" style={{ color: 'var(--neon-green)', textDecoration: 'none', fontWeight: 600 }}>Register as Medical Professional</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
