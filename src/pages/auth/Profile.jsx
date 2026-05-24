import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import '../patient/PatientPages.css';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('account'); // 'account' or 'clinical'
  const isPatient = user?.role === 'patient';

  // Personal Info Form State
  const [personalData, setPersonalData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Clinical Profile Form State (only for patients)
  const [clinicalData, setClinicalData] = useState({
    age: '',
    gender: '',
    smoking_status: 'Never',
    diabetes: false,
    hypertension: false,
    prior_cancer: false,
    prior_brain_surgery: false,
    immunosuppressed: false,
    seizures: false,
    headache_severity: 5,
    symptom_duration_weeks: '',
    functional_status: 'Independent',
    neurological_symptoms: 0
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state with user profile once fetched
  useEffect(() => {
    if (user) {
      setPersonalData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));

      if (isPatient && user.profile) {
        const p = user.profile;
        setClinicalData({
          age: p.age !== null && p.age !== undefined ? p.age : '',
          gender: p.gender || '',
          smoking_status: p.smoking_status || 'Never',
          diabetes: p.diabetes === 1,
          hypertension: p.hypertension === 1,
          prior_cancer: p.family_cancer_history === 1,
          prior_brain_surgery: p.previous_treatment === 1,
          immunosuppressed: p.immunosuppressed === 1,
          seizures: p.seizure_history === 1,
          headache_severity: p.headache_severity || 5,
          symptom_duration_weeks: p.symptom_duration_weeks !== null && p.symptom_duration_weeks !== undefined ? p.symptom_duration_weeks : '',
          functional_status: p.functional_status === 'needs_some_help' ? 'Some help' : 
                             p.functional_status === 'needs_significant_help' ? 'Significant help' : 
                             p.functional_status === 'fully_dependent' ? 'Bed-bound' : 'Independent',
          neurological_symptoms: p.neurological_symptoms === 'mild' ? 1 : 
                                 p.neurological_symptoms === 'moderate' ? 2 : 
                                 p.neurological_symptoms === 'severe' ? 3 : 0
        });
      }
    }
  }, [user, isPatient]);

  const handlePersonalSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      
      // 1. Update Name (and Clinical Profile if Patient)
      const profileBody = isPatient ? {
        name: personalData.name,
        ...clinicalData
      } : {
        name: personalData.name
      };

      const profileUrl = isPatient 
        ? 'http://127.0.0.1:5000/api/auth/profile/patient' 
        : 'http://127.0.0.1:5000/api/auth/profile/doctor';

      const profileRes = await fetch(profileUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileBody)
      });

      if (!profileRes.ok) {
        const errorData = await profileRes.json();
        throw new Error(errorData.message || 'Failed to update profile settings.');
      }

      // 2. Update Password (if specified)
      if (personalData.currentPassword && personalData.newPassword) {
        if (personalData.newPassword !== personalData.confirmPassword) {
          throw new Error('New passwords do not match.');
        }

        const passwordRes = await fetch('http://127.0.0.1:5000/api/auth/reset-password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            currentPassword: personalData.currentPassword,
            newPassword: personalData.newPassword
          })
        });

        if (!passwordRes.ok) {
          const errorData = await passwordRes.json();
          throw new Error(errorData.message || 'Failed to update password.');
        }

        // Clear password fields on success
        setPersonalData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      }

      // 3. Refresh user in global state
      await refreshUser();
      setMessage({ type: 'success', text: 'Profile settings saved successfully!' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'An error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClinicalSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      
      const profileRes = await fetch('http://127.0.0.1:5000/api/auth/profile/patient', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: personalData.name,
          ...clinicalData
        })
      });

      if (!profileRes.ok) {
        const errorData = await profileRes.json();
        throw new Error(errorData.message || 'Failed to update clinical profile.');
      }

      await refreshUser();
      setMessage({ type: 'success', text: 'Clinical intake profile saved successfully!' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'An error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-container" style={{ padding: '40px 24px', minHeight: 'calc(100vh - 80px)' }}>
      <div className="form-wrapper" style={{ maxWidth: '800px', width: '100%' }}>
        <h1 className="page-title">Profile Management</h1>
        <p className="page-subtitle">Update your personal information, clinical intake details, and security credentials</p>

        {/* Tab Navigation */}
        {isPatient && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            <button 
              type="button" 
              onClick={() => { setActiveTab('account'); setMessage({ type: '', text: '' }); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === 'account' ? '#00e5ff' : 'var(--text-secondary)',
                fontSize: '1rem',
                fontWeight: 600,
                padding: '8px 16px',
                cursor: 'pointer',
                borderBottom: activeTab === 'account' ? '2px solid #00e5ff' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              🔒 Account & Security
            </button>
            <button 
              type="button" 
              onClick={() => { setActiveTab('clinical'); setMessage({ type: '', text: '' }); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === 'clinical' ? '#00e5ff' : 'var(--text-secondary)',
                fontSize: '1rem',
                fontWeight: 600,
                padding: '8px 16px',
                cursor: 'pointer',
                borderBottom: activeTab === 'clinical' ? '2px solid #00e5ff' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              📋 Clinical Intake Profile
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {message.text && (
          <div style={{
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '0.95rem',
            fontWeight: 500,
            background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: message.type === 'success' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
            color: message.type === 'success' ? '#10b981' : '#ef4444',
            animation: 'fadeIn 0.3s ease'
          }}>
            {message.type === 'success' ? '✅' : '⚠️'} {message.text}
          </div>
        )}

        {/* Account Tab Content */}
        {(!isPatient || activeTab === 'account') && (
          <form className="intake-form" onSubmit={handlePersonalSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
              <img 
                src="https://i.pravatar.cc/150?img=12" 
                alt="Avatar" 
                style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid rgba(0,229,255,0.3)', boxShadow: '0 0 10px rgba(0,229,255,0.1)' }} 
              />
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>{user?.name}</h4>
                <span style={{ fontSize: '0.85rem', color: '#00e5ff', background: 'rgba(0,229,255,0.08)', padding: '2px 8px', borderRadius: '12px', textTransform: 'capitalize' }}>
                  {user?.role} Portal
                </span>
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', marginTop: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', color: '#1e90ff' }}>
              Personal Information
            </h3>

            <div className="form-group-row">
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={personalData.name} 
                  onChange={e => setPersonalData({ ...personalData, name: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  value={personalData.email} 
                  disabled 
                  style={{ opacity: 0.6, cursor: 'not-allowed' }} 
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Email cannot be changed
                </span>
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', marginTop: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', color: '#1e90ff' }}>
              Security Settings
            </h3>

            <div className="form-group">
              <label>Current Password</label>
              <input 
                type="password" 
                value={personalData.currentPassword} 
                onChange={e => setPersonalData({ ...personalData, currentPassword: e.target.value })} 
                placeholder="Required only to change password"
              />
            </div>
            
            <div className="form-group-row" style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label>New Password</label>
                <input 
                  type="password" 
                  value={personalData.newPassword} 
                  onChange={e => setPersonalData({ ...personalData, newPassword: e.target.value })} 
                  placeholder="Leave blank to keep same"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input 
                  type="password" 
                  value={personalData.confirmPassword} 
                  onChange={e => setPersonalData({ ...personalData, confirmPassword: e.target.value })} 
                  placeholder="Re-enter new password"
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '40px' }}>
              <button 
                type="submit" 
                className="btn btn--glow" 
                disabled={isSubmitting}
                style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
              >
                {isSubmitting ? 'Saving changes...' : 'Save Account Settings'}
              </button>
            </div>
          </form>
        )}

        {/* Clinical Intake Tab Content */}
        {isPatient && activeTab === 'clinical' && (
          <form className="intake-form" onSubmit={handleClinicalSubmit}>
            <h3 style={{ fontSize: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', color: '#1e90ff', marginBottom: '24px' }}>
              Demographic & Health Info
            </h3>

            <div className="form-group-row">
              <div className="form-group">
                <label>Age (years)</label>
                <input 
                  type="number" 
                  required 
                  min="0" 
                  max="120" 
                  value={clinicalData.age} 
                  onChange={e => setClinicalData({ ...clinicalData, age: e.target.value })} 
                  placeholder="e.g. 45" 
                />
              </div>
              <div className="form-group">
                <label>Biological Sex</label>
                <select 
                  required 
                  value={clinicalData.gender} 
                  onChange={e => setClinicalData({ ...clinicalData, gender: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div className="form-group-row" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label>Smoking Status</label>
                <select 
                  value={clinicalData.smoking_status} 
                  onChange={e => setClinicalData({ ...clinicalData, smoking_status: e.target.value })}
                >
                  <option value="Never">Never</option>
                  <option value="Former">Former</option>
                  <option value="Current">Current</option>
                </select>
              </div>
              <div className="form-group">
                <label>Symptom Duration (weeks)</label>
                <input 
                  type="number" 
                  required 
                  min="1" 
                  value={clinicalData.symptom_duration_weeks} 
                  onChange={e => setClinicalData({ ...clinicalData, symptom_duration_weeks: e.target.value })} 
                  placeholder="e.g. 4" 
                />
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', marginTop: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', color: '#1e90ff', marginBottom: '24px' }}>
              Systemic & Neurological History
            </h3>

            <div className="form-group-row">
              <div className="form-group">
                <label>Diabetes?</label>
                <select 
                  value={clinicalData.diabetes ? 'yes' : 'no'} 
                  onChange={e => setClinicalData({ ...clinicalData, diabetes: e.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="form-group">
                <label>Hypertension?</label>
                <select 
                  value={clinicalData.hypertension ? 'yes' : 'no'} 
                  onChange={e => setClinicalData({ ...clinicalData, hypertension: e.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            <div className="form-group-row" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label>Prior Cancer History?</label>
                <select 
                  value={clinicalData.prior_cancer ? 'yes' : 'no'} 
                  onChange={e => setClinicalData({ ...clinicalData, prior_cancer: e.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="form-group">
                <label>Immunosuppressed State?</label>
                <select 
                  value={clinicalData.immunosuppressed ? 'yes' : 'no'} 
                  onChange={e => setClinicalData({ ...clinicalData, immunosuppressed: e.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes (e.g. Chemotherapy)</option>
                </select>
              </div>
            </div>

            <div className="form-group-row" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label>Prior Brain Surgery?</label>
                <select 
                  value={clinicalData.prior_brain_surgery ? 'yes' : 'no'} 
                  onChange={e => setClinicalData({ ...clinicalData, prior_brain_surgery: e.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="form-group">
                <label>History of Seizures?</label>
                <select 
                  value={clinicalData.seizures ? 'yes' : 'no'} 
                  onChange={e => setClinicalData({ ...clinicalData, seizures: e.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', marginTop: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', color: '#1e90ff', marginBottom: '24px' }}>
              Symptom Severity & Functioning
            </h3>

            <div className="form-group">
              <label>Neurological Symptoms Status</label>
              <select 
                value={clinicalData.neurological_symptoms} 
                onChange={e => setClinicalData({ ...clinicalData, neurological_symptoms: parseInt(e.target.value) })}
              >
                <option value="0">None / Normal neurological status</option>
                <option value="1">Mild (Minor coordination/vision changes)</option>
                <option value="2">Moderate (Focal deficits, language difficulty)</option>
                <option value="3">Severe (Hemiparesis, cognitive deterioration)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
              <label>Functional Status (Independence)</label>
              <select 
                value={clinicalData.functional_status} 
                onChange={e => setClinicalData({ ...clinicalData, functional_status: e.target.value })}
              >
                <option value="Independent">Independent (Fully self-sufficient)</option>
                <option value="Some help">Some help (Needs minor daily assistance)</option>
                <option value="Significant help">Significant help (Requires intensive daily care)</option>
                <option value="Bed-bound">Bed-bound (Completely dependent)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '24px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                Headache Severity 
                <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>{clinicalData.headache_severity} / 10</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={clinicalData.headache_severity} 
                onChange={e => setClinicalData({ ...clinicalData, headache_severity: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: '#1e90ff', height: '6px', outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                <span>Mild</span>
                <span>Severe</span>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '40px' }}>
              <button 
                type="submit" 
                className="btn btn--glow" 
                disabled={isSubmitting}
                style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
              >
                {isSubmitting ? 'Saving clinical profile...' : 'Save Clinical Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
