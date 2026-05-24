import { useState, useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { usePatientContext } from '../../contexts/PatientContext';
import { scanService } from '../../services/scanService';
import './PatientPages.css';

// Subcomponents for Results Page
const ThreePanelView = ({ originalImage }) => {
  // In a real app, the mask and contour would be separate images returned by the API.
  // We simulate them using CSS filters/overlays for the prototype.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
      <div className="panel-card">
        <h4>Original MRI</h4>
        <div className="image-frame">
          <img src={originalImage || 'https://via.placeholder.com/400x400?text=No+Scan'} alt="Original MRI" />
        </div>
      </div>
      <div className="panel-card">
        <h4>Predicted Mask</h4>
        <div className="image-frame" style={{ position: 'relative' }}>
          <img src={originalImage || 'https://via.placeholder.com/400x400?text=No+Scan'} alt="Mask" style={{ filter: 'grayscale(100%) contrast(150%)' }} />
          <div style={{ position: 'absolute', top: '40%', left: '45%', width: '40px', height: '30px', background: 'rgba(239,68,68,0.6)', borderRadius: '40% 60% 70% 30%', filter: 'blur(4px)' }} />
        </div>
      </div>
      <div className="panel-card">
        <h4>Contour Overlay</h4>
        <div className="image-frame" style={{ position: 'relative' }}>
          <img src={originalImage || 'https://via.placeholder.com/400x400?text=No+Scan'} alt="Overlay" />
          <div style={{ position: 'absolute', top: '40%', left: '45%', width: '40px', height: '30px', border: '2px solid #ef4444', borderRadius: '40% 60% 70% 30%' }} />
          <div style={{ position: 'absolute', top: '35%', left: '55%', background: 'rgba(0,0,0,0.8)', color: '#00e5ff', padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid #00e5ff' }}>39.7mm</div>
        </div>
      </div>
      <style>{`
        .panel-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; text-align: center; }
        .panel-card h4 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .image-frame { width: 100%; aspect-ratio: 1; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); }
        .image-frame img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </div>
  );
};

const ConfidenceBar = ({ confidence }) => {
  let color = '#10b981'; // Green
  if (confidence < 70) color = '#f59e0b'; // Yellow
  if (confidence < 50) color = '#ef4444'; // Red

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>AI Confidence</span>
        <span style={{ color, fontWeight: 'bold' }}>{confidence}%</span>
      </div>
      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
        <div style={{ width: `${confidence}%`, height: '100%', background: color, borderRadius: '10px' }} />
      </div>
      {confidence < 70 && <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '6px' }}>⚠️ Low confidence. Specialist review highly recommended.</div>}
    </div>
  );
};

const DisclaimerBanner = () => (
  <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderLeft: '4px solid #ef4444', borderRadius: '0 8px 8px 0', display: 'flex', gap: '12px' }}>
    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
      <strong>DISCLAIMER:</strong> This is an AI-generated analysis and is NOT a clinical diagnosis. This tool is intended to assist medical professionals, not replace them. Please consult a qualified neuro-specialist for any medical decisions.
    </div>
  </div>
);

// Phase 5 Components
const TriageBadge = ({ triage }) => {
  const getColors = () => {
    if (triage.level === 1) return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', icon: '🔴' };
    if (triage.level === 2) return { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', icon: '🟡' };
    return { bg: 'rgba(16,185,129,0.15)', text: '#10b981', icon: '🟢' };
  };
  const { bg, text, icon } = getColors();

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: bg, padding: '8px 16px', borderRadius: '30px', border: `1px solid ${text}40` }}>
      <span>{icon}</span>
      <span style={{ color: text, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.9rem' }}>
        Tier {triage.level} • {triage.label}
      </span>
    </div>
  );
};

const EmergencyRedirect = () => (
  <div style={{ marginTop: '32px', padding: '24px', background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444', borderRadius: '16px', textAlign: 'center' }}>
    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚑</div>
    <h3 style={{ color: '#ef4444', fontSize: '1.5rem', marginBottom: '12px' }}>URGENT MEDICAL ATTENTION REQUIRED</h3>
    <p style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '24px' }}>Based on this analysis, you must proceed to the nearest Emergency Room immediately. Standard online booking has been disabled for your safety.</p>
    <a href="tel:911" className="btn btn--glow" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 4px 20px rgba(239,68,68,0.4)', padding: '16px 40px', fontSize: '1.2rem', color: '#fff', textDecoration: 'none' }}>CALL EMERGENCY SERVICES</a>
  </div>
);

const ContactDoctorCTA = ({ triage }) => {
  if (triage.level === 1) return null; // Handled by EmergencyRedirect
  
  const isUrgent = triage.level === 2;
  return (
    <Link to="/patient/doctors" className="btn btn--glow" style={{ flex: 1, justifyContent: 'center', background: isUrgent ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #1e90ff, #0055bb)' }}>
      {isUrgent ? '⚠️ Find Priority Appointment' : '📅 Book Routine Follow-up'}
    </Link>
  );
};

const ShareReportPrompt = ({ scanId }) => {
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const handleShare = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/scans/${scanId}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShared(true);
        setShareLink(`http://localhost:3000${data.url}`);
      } else {
        alert('Failed to generate share link.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="no-print" style={{ marginTop: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>Share with your Doctor</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Generate a secure link to send this AI report to a specialist.</p>
        </div>
        <button 
          className={`btn ${shared ? 'btn--glass' : 'btn--glow'}`} 
          onClick={handleShare}
          disabled={shared || loading}
          style={{ padding: '12px 24px' }}
        >
          {loading ? 'Generating...' : shared ? '✓ Link Generated' : '📤 Generate Link'}
        </button>
      </div>
      {shared && (
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1e90ff' }}>
          <code style={{ color: '#00e5ff', fontSize: '0.9rem' }}>{shareLink}</code>
          <button className="btn btn--glass" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => navigator.clipboard.writeText(shareLink)}>Copy</button>
        </div>
      )}
    </div>
  );
};

export default function ScanResults() {
  const { scanId } = useParams();
  const { analysisResults, setResults } = usePatientContext();
  const [localReport, setLocalReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError('');
        // Check if context has correct report already loaded
        if (analysisResults && (analysisResults.id === scanId || analysisResults._id === scanId)) {
          setLocalReport(analysisResults);
        } else {
          // Fetch from backend
          const fetched = await scanService.getScanResults(scanId);
          setLocalReport(fetched);
          setResults(fetched); // sync back to context if needed
        }
      } catch (err) {
        console.error('Error loading report:', err);
        setError('Failed to load report. Please make sure the scan exists.');
      } finally {
        setLoading(false);
      }
    };

    if (scanId) {
      fetchReport();
    }
  }, [scanId, analysisResults, setResults]);

  if (loading) {
    return (
      <main className="page-container" style={{ padding: '80px 24px', minHeight: 'calc(100vh - 80px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="analysis-brain-loader" style={{ fontSize: '3.5rem', marginBottom: '20px', animation: 'pulseGlow 1.5s infinite ease-in-out' }}>🧠</div>
          <h3 style={{ color: 'var(--text-primary)' }}>Loading Report Details...</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Retrieving clinical metrics & spatial boundaries</p>
        </div>
      </main>
    );
  }

  if (error || !localReport) {
    return (
      <main className="page-container" style={{ padding: '40px 24px', minHeight: 'calc(100vh - 80px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="form-wrapper" style={{ maxWidth: '500px', textAlign: 'center', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h3 style={{ color: '#ef4444', marginBottom: '12px' }}>Report Not Found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error || 'Unable to retrieve scan data.'}</p>
          <Link to="/patient/dashboard" className="btn btn--glow" style={{ justifyContent: 'center' }}>Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  const res = localReport;

  return (
    <main className="page-container" style={{ padding: '40px 24px', minHeight: 'calc(100vh - 80px)' }}>
      <div className="form-wrapper" style={{ maxWidth: '1000px', padding: '40px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '24px' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '2.5rem' }}>Analysis Results</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>Scan ID: {scanId} • Date: {new Date(res.date || Date.now()).toLocaleDateString()}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            {res.triage && <TriageBadge triage={res.triage} />}
          </div>
        </div>

        {/* 3 Panel View */}
        <ThreePanelView originalImage={res.originalImage} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Classification & Confidence */}
          <div style={{ background: 'rgba(30,144,255,0.05)', border: '1px solid rgba(30,144,255,0.2)', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ color: '#1e90ff', marginBottom: '8px', fontSize: '1.4rem' }}>{res.classification}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>Primary Classification</p>
            <ConfidenceBar confidence={res.confidence} />
          </div>

          {/* Measurements & Location */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Spatial Analysis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.95rem' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>Location</div>
                <div style={{ fontWeight: 600 }}>{res.location}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>Est. Volume Area</div>
                <div style={{ fontWeight: 600 }}>{res.area} mm²</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>Max Diameter</div>
                <div style={{ fontWeight: 600 }}>{res.diameter} mm</div>
              </div>
            </div>
          </div>
        </div>

        {/* Treatment Explanation */}
        <div style={{ marginTop: '24px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', padding: '24px', borderRadius: '16px' }}>
          <h3 style={{ color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💡</span> AI Treatment Guidance
          </h3>
          <div style={{ color: 'var(--text-primary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
            <p style={{ marginBottom: '12px' }}><strong>Suggested Pathway:</strong> {res.treatmentSuggestion}</p>
            <p style={{ color: 'var(--text-secondary)' }}>Based on the provided medical history and image segmentation features, the model suggests a multi-modal approach. The size and location of the tumor may make it a candidate for surgical resection, followed by targeted radiation therapy to clear margins. Immediate consultation is advised to verify this pathway.</p>
          </div>
        </div>

        <DisclaimerBanner />

        {res.triage && res.triage.level === 1 ? (
          <EmergencyRedirect />
        ) : (
          <>
            {/* Action Buttons */}
            <div className="no-print" style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
              <ContactDoctorCTA triage={res.triage || { level: 3 }} />
              <button className="btn btn--glass" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.print()}>
                📄 Print / Save as PDF
              </button>
            </div>
            <ShareReportPrompt scanId={scanId || res.id || res._id} />
          </>
        )}

      </div>
    </main>
  );
}
