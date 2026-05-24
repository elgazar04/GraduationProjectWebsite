import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientContext } from '../../contexts/PatientContext';
import { scanService } from '../../services/scanService';
import './PatientPages.css';

export default function MriUpload() {
  const navigate = useNavigate();
  const { intakeData, uploadScan } = usePatientContext();

  useEffect(() => {
    // If clinical intake is not complete, redirect to Intake form wizard
    if (!intakeData.age || !intakeData.gender) {
      navigate('/patient/intake');
    }
  }, [intakeData, navigate]);

  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = (selectedFile) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      alert('Please upload a valid image file (JPG, PNG). DICOM support coming soon.');
    }
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartAnalysis = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      // 1. Save scan to global state for preview purposes
      uploadScan(preview);
      
      // 2. Call API to actually upload
      const res = await scanService.uploadScan(file, intakeData);
      
      // 3. Navigate to the analysis loading screen
      navigate(`/patient/analysis/${res.scanId}`);
    } catch (err) {
      alert('Failed to upload scan. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <main className="page-container" style={{ padding: '40px 24px', minHeight: 'calc(100vh - 80px)' }}>
      <div className="upload-wrapper" style={{ maxWidth: '700px' }}>
        <h1 className="page-title">MRI Scan Upload</h1>
        <p className="page-subtitle">Upload your brain MRI image to begin the AI analysis.</p>
        
        <div className="upload-section">
          <div 
            className={`dropzone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            style={{ border: '2px dashed rgba(30,144,255,0.4)', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', padding: file ? '0' : '60px 20px', textAlign: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={e => handleFile(e.target.files[0])} 
              accept="image/jpeg, image/png" 
              style={{ display: 'none' }} 
            />
            
            {preview ? (
              <div className="preview-container" style={{ width: '100%', height: '400px', position: 'relative' }}>
                <img src={preview} alt="MRI Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s' }} className="preview-overlay">
                  <button type="button" className="btn btn--glass" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }} style={{ color: '#ff6b6b', borderColor: '#ff6b6b' }}>
                    Remove File
                  </button>
                </div>
              </div>
            ) : (
              <div className="dropzone-content">
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📤</div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Drag & Drop your MRI scan here</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>or click to browse from your device</p>
                <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px' }}>Supports JPG, PNG (Max 15MB)</span>
              </div>
            )}
          </div>

          <div className="form-actions" style={{ marginTop: '32px' }}>
            <button 
              className={`btn btn--glow ${!file ? 'disabled' : ''}`} 
              onClick={handleStartAnalysis}
              disabled={!file || isUploading}
              style={{ width: '100%', justifyContent: 'center', fontSize: '1.1rem', padding: '16px' }}
            >
              {isUploading ? 'Uploading securely...' : 'Upload & Start Analysis'}
            </button>
          </div>
          
          <DisclaimerBanner />
        </div>
      </div>
    </main>
  );
}

const DisclaimerBanner = () => (
  <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,200,0,0.05)', border: '1px solid rgba(255,200,0,0.2)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>
      <strong>Data Privacy:</strong> Your scan is encrypted and securely transmitted. We do not use your data to train public models. Please ensure all Personally Identifiable Information (PII) is removed from the image metadata before uploading.
    </p>
  </div>
);
