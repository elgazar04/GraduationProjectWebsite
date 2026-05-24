const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

const authHeader = () => {
  const token = localStorage.getItem('token');
  return { 'Authorization': `Bearer ${token}` };
};

export const scanService = {
  uploadScan: async (fileData, intakeData) => {
    const formData = new FormData();
    formData.append('image', fileData);
    formData.append('intakeData', JSON.stringify(intakeData));

    const response = await fetch(`${API_URL}/scans/upload`, {
      method: 'POST',
      headers: authHeader(),
      body: formData
    });

    if (!response.ok) throw new Error('Failed to upload scan');
    const data = await response.json();
    return { scanId: data.scanId };
  },

  getScanResults: async (scanId) => {
    const response = await fetch(`${API_URL}/scans/${scanId}`, {
      headers: authHeader()
    });

    if (!response.ok) throw new Error('Failed to get scan results');
    const data = await response.json();
    
    // Highly resilient parsing to support all formats (raw database rows, formatted JSON, etc.)
    const results = data.results || {};
    return {
      id: data.id || data._id || scanId,
      originalImage: data.image_url || (data.mri_file_path ? `http://127.0.0.1:5000${data.mri_file_path}` : null),
      classification: results.classification || data.tumor_type || 'Unknown',
      confidence: results.confidence !== undefined ? results.confidence : (data.classification_confidence ? Math.round(parseFloat(data.classification_confidence) * 100) : 0),
      location: results.location || data.tumor_location || 'Unknown',
      area: results.area || data.tumor_size_mm2 || 0,
      diameter: results.diameter || 39.7,
      treatmentSuggestion: results.treatmentSuggestion || data.treatment_plan || 'Consult specialist',
      urgencyScore: results.urgencyScore !== undefined ? results.urgencyScore : (parseInt(data.urgency_level) || 0),
      triage: results.triageTier || (data.triage_tier ? {
        level: data.triage_tier === 'emergency' || data.triage_tier === 1 ? 1 : data.triage_tier === 'urgent' || data.triage_tier === 2 ? 2 : 3,
        label: typeof data.triage_tier === 'string' ? data.triage_tier : (data.triage_tier === 1 ? 'emergency' : data.triage_tier === 2 ? 'urgent' : 'routine'),
        color: data.triage_tier === 'emergency' || data.triage_tier === 1 ? '#ef4444' : data.triage_tier === 'urgent' || data.triage_tier === 2 ? '#f59e0b' : '#10b981'
      } : { level: 3, label: 'routine', color: '#10b981' }),
      date: data.uploadDate || data.created_at || new Date().toISOString()
    };
  },

  getHistory: async () => {
    const response = await fetch(`${API_URL}/scans/history/me`, {
      headers: authHeader()
    });
    if (!response.ok) throw new Error('Failed to fetch history');
    const data = await response.json();
    return data.map(scan => ({
      id: scan._id,
      date: scan.uploadDate,
      status: scan.status,
      classification: scan.results?.classification || 'Processing',
      confidence: scan.results?.confidence || 0
    }));
  },

  downloadReport: async (scanId) => {
    console.log(`Mock generating PDF report for ${scanId}`);
    return new Promise(resolve => setTimeout(() => resolve({ url: '#' }), 1000));
  },

  shareWithDoctor: async (scanId, doctorId) => {
    console.log(`Mock sharing scan ${scanId} with doctor ${doctorId}`);
    return new Promise(resolve => setTimeout(() => resolve({ success: true }), 500));
  }
};

