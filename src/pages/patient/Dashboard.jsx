import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DoctorRating from '../../components/shared/DoctorRating';
import ChatWindow from '../../components/shared/ChatWindow';
import { useAuth } from '../../contexts/AuthContext';
import './PatientPages.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [scans, setScans] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState(null); // consultationId
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const scansRes = await fetch('http://127.0.0.1:5000/api/scans/history/me', { headers });
      if (scansRes.ok) setScans(await scansRes.json());
      
      const consultsRes = await fetch('http://127.0.0.1:5000/api/consultations/me', { headers });
      if (consultsRes.ok) setConsultations(await consultsRes.json());
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const upcomingConsultations = consultations.filter(c => c.status === 'accepted' || c.status === 'pending');
  const completedConsultations = consultations.filter(c => c.status === 'completed');

  return (
    <main className="page-container" style={{ padding: '40px 24px', minHeight: 'calc(100vh - 80px)' }}>
      <div className="form-wrapper" style={{ maxWidth: '1000px', width: '100%' }}>
        <h1 className="page-title">Patient Dashboard</h1>
        <p className="page-subtitle">Welcome back, {user?.name}. Here is an overview of your recent activity.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          {/* Quick Actions */}
          <div className="dashboard-card" style={{ background: 'rgba(30,144,255,0.05)', border: '1px solid rgba(30,144,255,0.2)', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ marginBottom: '16px', color: '#1e90ff' }}>New Analysis</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Upload a new MRI scan for instant AI analysis.</p>
            <Link 
              to={user?.profile?.age && user?.profile?.gender ? "/patient/upload" : "/patient/intake"} 
              className="btn btn--glow" 
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Upload MRI Scan
            </Link>
          </div>

          {/* Upcoming Consultations */}
          <div className="dashboard-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', borderRadius: '16px', maxHeight: '250px', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '16px' }}>Upcoming Consultations</h3>
            {loading ? <p>Loading...</p> : upcomingConsultations.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No upcoming consultations.</p> : upcomingConsultations.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Dr. {c.doctor_name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{new Date(c.meeting_time).toLocaleString()}</div>
                  <div style={{ color: c.status === 'pending' ? '#f59e0b' : '#10b981', fontSize: '0.75rem', textTransform: 'uppercase' }}>{c.status}</div>
                </div>
                {c.status === 'accepted' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn btn--glass" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>Join Call</button>
                    <button className="btn btn--glow" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setActiveChat(c.id)}>Chat</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Active Chat Modal (Inline for simplicity) */}
        {activeChat && (
          <div style={{ marginBottom: '40px', position: 'relative' }}>
            <button 
              onClick={() => setActiveChat(null)} 
              style={{ position: 'absolute', right: '10px', top: '10px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', zIndex: 10 }}
            >
              Close Chat
            </button>
            <ChatWindow consultationId={activeChat} currentUserRole={user?.role} currentUserId={user?.id} />
          </div>
        )}

        {/* Completed Consultations & Ratings */}
        {completedConsultations.length > 0 && (
          <>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>Completed Consultations</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              {completedConsultations.map(c => (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: '16px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Dr. {c.doctor_name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>{new Date(c.meeting_time).toLocaleDateString()}</div>
                  <div style={{ fontSize: '0.9rem', marginBottom: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <strong>Doctor Notes:</strong> {c.clinical_notes || 'No notes provided.'}
                  </div>
                  {c.rating ? (
                    <div style={{ color: '#f59e0b' }}>Your Rating: {c.rating} ★</div>
                  ) : (
                    <DoctorRating consultationId={c.id} onRated={fetchData} />
                  )}
                  <button className="btn btn--glass" style={{ width: '100%', marginTop: '16px' }} onClick={() => setActiveChat(c.id)}>View Chat History</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Recent Scans Table */}
        <h2 style={{ fontSize: '1.4rem', marginBottom: '16px' }}>Recent Scans</h2>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Scan ID</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center' }}>Loading...</td></tr>
              ) : scans.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No scans found.</td></tr>
              ) : scans.map(scan => {
                const isEmergency = scan.triage_tier === 1 || scan.triage_tier === 'emergency';
                const isUrgent = scan.triage_tier === 2 || scan.triage_tier === 'urgent';
                const isCompleted = scan.status === 'completed';
                
                let badgeColor = '#f59e0b';
                let badgeBg = 'rgba(245,158,11,0.1)';
                if (isCompleted) {
                  if (isEmergency) {
                    badgeColor = '#ef4444';
                    badgeBg = 'rgba(239,68,68,0.1)';
                  } else if (isUrgent) {
                    badgeColor = '#f59e0b';
                    badgeBg = 'rgba(245,158,11,0.1)';
                  } else {
                    badgeColor = '#10b981';
                    badgeBg = 'rgba(16,185,129,0.1)';
                  }
                }

                const scanIdVal = scan.id || scan._id;
                const scanDateVal = scan.created_at || scan.uploadDate || scan.date;

                return (
                  <tr key={scanIdVal} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px' }}>{scanDateVal ? new Date(scanDateVal).toLocaleDateString() : 'N/A'}</td>
                    <td style={{ padding: '16px', fontSize: '0.85rem', fontFamily: 'monospace' }}>{scanIdVal || 'N/A'}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        color: badgeColor,
                        background: badgeBg,
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', textTransform: 'capitalize', fontWeight: '600'
                      }}>
                        {scan.status} {isCompleted && `(${scan.tumor_type || scan.results?.classification || 'Normal'})`}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {isCompleted && scanIdVal ? (
                        <Link to={`/patient/results/${scanIdVal}`} style={{ color: '#1e90ff', textDecoration: 'none', fontWeight: '500' }}>View Report</Link>
                      ) : isCompleted ? (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No ID</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Processing...</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
