import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('http://127.0.0.1:5000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error('Error fetching notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (n) => {
    // Mark as read first
    if (!n.is_read) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`http://127.0.0.1:5000/api/notifications/${n.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Error marking as read', err);
      }
    }

    setIsOpen(false);

    // Navigate based on notification type and reference_id
    if (n.reference_id) {
      switch (n.type) {
        case 'scan_completed':
          navigate(`/patient/results/${n.reference_id}`);
          break;
        case 'consultation_requested':
        case 'consultation_accepted':
        case 'consultation_declined':
        case 'notes_available':
          navigate('/patient/dashboard');
          break;
        case 'new_message':
          navigate('/patient/dashboard');
          break;
        case 'doctor_verified':
          navigate('/doctor/dashboard');
          break;
        default:
          navigate('/patient/dashboard');
      }
    }

    fetchNotifications();
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'scan_completed': return '🧠';
      case 'consultation_requested': return '📅';
      case 'consultation_accepted': return '✅';
      case 'consultation_declined': return '❌';
      case 'notes_available': return '📝';
      case 'new_message': return '💬';
      case 'doctor_verified': return '⚕️';
      default: return '🔔';
    }
  };

  const getActionLabel = (type) => {
    switch (type) {
      case 'scan_completed': return 'View Report →';
      case 'consultation_requested': return 'View Details →';
      case 'consultation_accepted': return 'Open Consultation →';
      case 'notes_available': return 'Read Notes →';
      case 'new_message': return 'Open Chat →';
      default: return null;
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: '1.4rem', position: 'relative', padding: '6px',
          borderRadius: '8px', transition: 'background 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: 'white', borderRadius: '50%',
            minWidth: '18px', height: '18px', fontSize: '0.65rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', boxShadow: '0 2px 6px rgba(239,68,68,0.5)',
            animation: 'notifPulse 2s infinite'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: '0',
          width: '360px', maxHeight: '440px', overflowY: 'auto',
          background: 'linear-gradient(180deg, #0d2137, #0a1929)',
          border: '1px solid rgba(30,144,255,0.2)',
          borderRadius: '16px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(30,144,255,0.1)',
          zIndex: 1000,
          animation: 'notifSlideIn 0.2s ease-out'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{
                background: 'rgba(30,144,255,0.15)', color: '#1e90ff',
                padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600
              }}>
                {unreadCount} new
              </span>
            )}
          </div>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.4 }}>🔔</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No notifications yet</p>
            </div>
          ) : (
            notifications.map(n => {
              const actionLabel = getActionLabel(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: n.is_read ? 'transparent' : 'rgba(30,144,255,0.06)',
                    cursor: 'pointer',
                    display: 'flex', gap: '12px',
                    transition: 'background 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseOut={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(30,144,255,0.06)'}
                >
                  {/* Icon */}
                  <div style={{
                    fontSize: '1.3rem', width: '38px', height: '38px',
                    background: 'rgba(255,255,255,0.06)', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {getIconForType(n.type)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '4px',
                      color: n.is_read ? 'rgba(255,255,255,0.6)' : '#fff',
                      fontWeight: n.is_read ? 400 : 500
                    }}>
                      {n.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                        {timeAgo(n.created_at)}
                      </span>
                      {actionLabel && n.reference_id && (
                        <span style={{
                          fontSize: '0.72rem', color: '#1e90ff', fontWeight: 600,
                          letterSpacing: '0.2px'
                        }}>
                          {actionLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!n.is_read && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1e90ff, #00e5ff)',
                      alignSelf: 'center', flexShrink: 0,
                      boxShadow: '0 0 6px rgba(0,229,255,0.5)'
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <style>{`
        @keyframes notifPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
