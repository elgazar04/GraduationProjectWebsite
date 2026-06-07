import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../shared/NotificationBell';
import Icon from '../shared/Icon';
import './Header.css';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const getDashboardPath = () => {
    if (!user) return '/';
    if (user.role === 'doctor') return '/doctor/dashboard';
    if (user.role === 'admin') return '/admin/dashboard';
    return '/patient/dashboard';
  };

  return (
    <header className="header" id="main-header">
      <div className="header__inner container">
        <Link to="/" className="header__logo" id="logo-link">
          <span className="header__logo-icon"><Icon name="brain" size={26} color="#00FFB2" /></span>
          <span className="header__logo-text">BrainScan<span className="header__logo-accent">AI</span></span>
        </Link>

        <button className="header__hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <Icon name="menu" size={22} />
        </button>

        <nav className={`header__nav ${mobileOpen ? 'header__nav--open' : ''}`} id="main-nav">
          <Link to="/" className="header__link" onClick={() => setMobileOpen(false)}>Home</Link>
          <Link to="/info/tumors" className="header__link" onClick={() => setMobileOpen(false)}>Learn</Link>
          <Link to="/info/faq" className="header__link" onClick={() => setMobileOpen(false)}>FAQ</Link>
          {isAuthenticated && (
            <Link to={getDashboardPath()} className="header__link" onClick={() => setMobileOpen(false)}>Dashboard</Link>
          )}
        </nav>

        <div className="header__actions">
          {isAuthenticated && <NotificationBell />}

          {isAuthenticated ? (
            <div className="header__user">
              <span className="header__user-name">{user.name}</span>
              <button className="header__btn header__btn--outline" onClick={handleLogout} id="logout-btn">
                Logout
              </button>
            </div>
          ) : (
            <div className="header__auth">
              <Link to="/login" className="header__btn header__btn--outline" id="login-btn">Login</Link>
              <Link to="/patient/intake" className="header__btn header__btn--primary" id="register-btn">Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
