import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer" id="main-footer">
      <div className="footer__inner container">
        <div className="footer__grid">
          <div className="footer__brand">
            <div className="footer__logo">
              <span className="footer__logo-icon">🧠</span>
              <span className="footer__logo-text">BrainScan<span className="footer__logo-accent">AI</span></span>
            </div>
            <p className="footer__desc">
              Advanced AI-powered brain tumor detection system. Upload MRI scans, 
              get instant classification, segmentation, and treatment suggestions.
            </p>
          </div>

          <div className="footer__col">
            <h4 className="footer__heading">Platform</h4>
            <ul className="footer__links">
              <li><Link to="/patient/intake">Upload MRI</Link></li>
              <li><Link to="/patient/doctors">Find a Doctor</Link></li>
              <li><Link to="/info/tumors">Tumor Info</Link></li>
              <li><Link to="/info/faq">FAQ</Link></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4 className="footer__heading">Account</h4>
            <ul className="footer__links">
              <li><Link to="/login">Login</Link></li>
              <li><Link to="/register">Register</Link></li>
              <li><Link to="/register/doctor">Doctor Signup</Link></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4 className="footer__heading">Legal</h4>
            <ul className="footer__links">
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Disclaimer</a></li>
            </ul>
          </div>
        </div>

        <div className="footer__disclaimer">
          <p>⚠️ <strong>Disclaimer:</strong> This system is not a substitute for professional medical diagnosis. Always consult a qualified healthcare provider for clinical decisions.</p>
        </div>

        <div className="footer__bottom">
          <p>&copy; {new Date().getFullYear()} BrainScanAI — Graduation Project. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
