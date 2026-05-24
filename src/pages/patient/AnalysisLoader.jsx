import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatientContext } from '../../contexts/PatientContext';
import { scanService } from '../../services/scanService';
import './PatientPages.css';

const STAGES = [
  { threshold: 15, text: 'Preprocessing image and normalizing contrast...' },
  { threshold: 35, text: 'Running EfficientNet Classification...' },
  { threshold: 55, text: 'Running U-Net Segmentation...' },
  { threshold: 72, text: 'Extracting tumor size and location...' },
  { threshold: 88, text: 'Running XGBoost treatment suggestion models...' },
  { threshold: 100, text: 'Finalizing report and generating triage...' },
];

export default function AnalysisLoader() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { setResults } = usePatientContext();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing AI pipeline...');
  const [isComplete, setIsComplete] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let animProgress = 0;
    let cancelled = false;

    // Animated progress bar (visual only — real status comes from polling)
    const animInterval = setInterval(() => {
      if (completedRef.current || cancelled) return;
      if (animProgress < 90) {
        animProgress += 0.8 + Math.random() * 1.5;
        const clamped = Math.min(Math.floor(animProgress), 90);
        setProgress(clamped);

        const stage = STAGES.find(s => clamped < s.threshold);
        if (stage) setStatusText(stage.text);
      }
    }, 350);

    // Real polling — check every 2s if AI pipeline has finished
    const pollInterval = setInterval(async () => {
      if (cancelled || completedRef.current) return;
      try {
        const results = await scanService.getScanResults(scanId);
        // getScanResults returns a flat object with .classification at the top level
        if (results && results.classification && results.classification !== 'Unknown' && results.classification !== 'Processing') {
          completedRef.current = true;
          clearInterval(animInterval);
          clearInterval(pollInterval);

          // Animate progress from current to 100%
          let current = animProgress;
          const finishAnim = setInterval(() => {
            current += 3;
            if (current >= 100) {
              current = 100;
              clearInterval(finishAnim);
              setIsComplete(true);
            }
            setProgress(Math.min(Math.floor(current), 100));
          }, 40);

          setStatusText('✅ Analysis Complete. Preparing your report...');
          setResults(results);

          // Navigate after the completion animation settles
          setTimeout(() => {
            if (!cancelled) navigate(`/patient/results/${scanId}`);
          }, 1800);
        }
      } catch (err) {
        // Scan might still be processing — keep polling
        console.log('[Polling] Scan still processing...');
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(animInterval);
      clearInterval(pollInterval);
    };
  }, [scanId, navigate, setResults]);

  return (
    <main className="page-container" style={{ padding: '80px 24px', minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center' }}>
      <div className="form-wrapper" style={{ maxWidth: '600px', textAlign: 'center' }}>
        <div style={{
          fontSize: '5rem',
          marginBottom: '32px',
          animation: isComplete ? 'none' : 'pulseGlow 2s infinite ease-in-out',
          transform: isComplete ? 'scale(1.1)' : undefined,
          transition: 'transform 0.5s ease',
          filter: isComplete ? 'drop-shadow(0 0 30px rgba(16,185,129,0.8))' : undefined
        }}>
          {isComplete ? '✅' : '🧠'}
        </div>

        <h2 style={{ fontSize: '1.8rem', marginBottom: '16px' }}>
          {isComplete ? 'Analysis Complete!' : 'Analyzing Neural Structures'}
        </h2>
        <p style={{
          color: isComplete ? '#10b981' : 'var(--text-secondary)',
          marginBottom: '40px',
          minHeight: '24px',
          fontWeight: isComplete ? 600 : 400,
          transition: 'color 0.4s ease'
        }}>
          {statusText}
        </p>

        {/* Progress bar */}
        <div style={{
          width: '100%', height: '10px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '10px', overflow: 'hidden', marginBottom: '12px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: isComplete
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : 'linear-gradient(90deg, #1e90ff, #00e5ff)',
            transition: 'width 0.3s ease, background 0.5s ease',
            boxShadow: isComplete
              ? '0 0 12px rgba(16,185,129,0.6)'
              : '0 0 10px rgba(0,229,255,0.5)',
            borderRadius: '10px'
          }} />
        </div>
        <div style={{
          color: isComplete ? '#10b981' : '#00e5ff',
          fontWeight: 700,
          fontSize: '1.3rem',
          transition: 'color 0.4s ease'
        }}>
          {progress}%
        </div>

        {/* Pipeline stages list */}
        <div style={{ marginTop: '32px', textAlign: 'left' }}>
          {STAGES.slice(0, 5).map((stage, i) => {
            const done = progress >= stage.threshold;
            const active = !done && (i === 0 || progress >= STAGES[i - 1].threshold);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '6px 0',
                opacity: done ? 1 : active ? 0.9 : 0.35,
                transition: 'opacity 0.4s ease'
              }}>
                <span style={{ fontSize: '0.85rem', width: '20px', textAlign: 'center' }}>
                  {done ? '✅' : active ? '⏳' : '○'}
                </span>
                <span style={{
                  fontSize: '0.85rem',
                  color: done ? '#10b981' : active ? '#00e5ff' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400
                }}>
                  {stage.text.replace('...', '')}
                </span>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes pulseGlow {
            0% { transform: scale(0.95); filter: drop-shadow(0 0 10px rgba(0,229,255,0.2)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 40px rgba(0,229,255,0.8)); }
            100% { transform: scale(0.95); filter: drop-shadow(0 0 10px rgba(0,229,255,0.2)); }
          }
        `}</style>
      </div>
    </main>
  );
}
