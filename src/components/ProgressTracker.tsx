'use client';

import { useEffect, useState } from 'react';
import type { ProgressEvent } from '@/lib/types';

/* Connect directly to FastAPI (port 8000) to avoid Next.js proxy buffering SSE */
const SSE_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

/* ── 4-step definitions ────────────────────────────────────────────────────
   allKeys  = backend step keys that belong to this visible step
   finalKey = the last backend key — when it completes, the step is done     */
const ARXIV_STEPS = [
  { key: 'step1', label: 'Fetching the paper',        allKeys: ['fetch', 'download'], finalKey: 'download' },
  { key: 'step2', label: 'Reading & understanding it', allKeys: ['extract', 'embed'],  finalKey: 'embed' },
  { key: 'step3', label: 'Finding related papers',     allKeys: ['similar', 'cluster'], finalKey: 'similar' },
  { key: 'step4', label: 'Preparing your results',     allKeys: ['visualizations', 'finalize'], finalKey: 'finalize' },
];

const PDF_STEPS = [
  { key: 'step1', label: 'Uploading your file',        allKeys: ['upload'],           finalKey: 'upload' },
  { key: 'step2', label: 'Reading & understanding it', allKeys: ['extract', 'embed'], finalKey: 'embed' },
  { key: 'step3', label: 'Finding related papers',     allKeys: ['similar'],          finalKey: 'similar' },
  { key: 'step4', label: 'Preparing your results',     allKeys: ['visualizations', 'finalize'], finalKey: 'finalize' },
];

/* Inline SVG checkmark — no icon-font dependency */
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="var(--success)" opacity="0.15" />
      <path d="M4.5 8.5l2.5 2.5 4.5-5" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  sessionId: string;
  mode?: 'arxiv' | 'pdf';
}

export default function ProgressTracker({ sessionId, mode = 'arxiv' }: Props) {
  /* Store events by backend key */
  const [events, setEvents] = useState<Record<string, ProgressEvent>>({});
  const [latestMsg, setLatestMsg] = useState('Starting analysis...');
  const [serverProgress, setServerProgress] = useState<number>(0);

  const STEPS = mode === 'pdf' ? PDF_STEPS : ARXIV_STEPS;

  useEffect(() => {
    const es = new EventSource(`${SSE_BASE}/progress/${sessionId}`);
    es.onmessage = (e) => {
      try {
        const data: ProgressEvent = JSON.parse(e.data);
        if (data.heartbeat || data.timeout_warning) {
          setLatestMsg(data.message || 'Working on it...');
          return;
        }
        if (data.step) {
          setEvents((prev) => ({ ...prev, [data.step]: data }));
          setLatestMsg(data.message || '');
          if (typeof data.progress === 'number') {
            setServerProgress((prev) => Math.max(prev, data.progress as number));
          }
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [sessionId]);

  const completedCount = STEPS.filter((s) => events[s.finalKey]?.completed).length;
  const fallbackPct = Math.round((completedCount / STEPS.length) * 100);
  const pct = serverProgress > 0 ? serverProgress : fallbackPct;

  return (
    <div className="card analyze-events-card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
        <h3 className="card-title analyze-events-title" style={{ margin: 0 }}>Analyzing Paper</h3>
        <span className="analyze-events-percent" style={{ fontSize: '.8rem', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div className="progress-bar" style={{ marginBottom: '.75rem' }}>
        <div className="progress-fill" style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
      <p className="analyze-events-latest" style={{ fontSize: '.82rem', marginBottom: '1rem', minHeight: '1.2em' }}>{latestMsg}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
        {STEPS.map((step) => {
          const done  = !!events[step.finalKey]?.completed;
          const active = !done && step.allKeys.some((k) => k in events);
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {done ? (
                  <CheckIcon />
                ) : active ? (
                  <span className="spinner" style={{ width: 13, height: 13 }} />
                ) : (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'inline-block' }} />
                )}
              </span>
              <span className="analyze-events-step-label" style={{
                fontSize: '.85rem',
                fontWeight: active ? 600 : 400,
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
