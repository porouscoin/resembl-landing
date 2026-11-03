'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiStreamPost } from '@/lib/api';
import type { SectionSummary } from '@/lib/types';

export default function SummaryPanel({
  arxivId,
  pdfUrl,
  title,
  autoStart = false,
}: {
  arxivId: string | null;
  pdfUrl: string | null;
  title: string;
  autoStart?: boolean;
}) {
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoStartedRef = useRef(false);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setStatusMsg('');
  }, []);

  const makeStreamHandler = useCallback(
    (keepExisting: boolean) => {
      setLoading(true);
      setError('');
      if (!keepExisting) setSections([]);
      setIsComplete(false);
      setStatusMsg(keepExisting ? 'Continuing summarisation...' : 'Starting summarisation...');
      setProgress(0);

      const existingSections = keepExisting
        ? sections.map((s) => ({ index: s.index, title: s.title, summary: s.summary }))
        : [];

      abortRef.current = apiStreamPost(
        '/summarize-sections-stream',
        {
          arxiv_id: arxivId,
          pdf_url: pdfUrl,
          title,
          session_id: `summary_${Date.now()}`,
          existing_sections: existingSections,
        },
        (event) => {
          if (event.type === 'section' && event.section) {
            setSections((prev) => {
              const exists = prev.some((s) => s.title === event.section.title);
              if (exists) return prev;
              return [...prev, { title: event.section.title, summary: event.section.summary, index: event.section.index }];
            });
          }
          if (event.message) setStatusMsg(event.message);
          if (event.progress != null) setProgress(event.progress);
          if (event.type === 'complete') {
            setLoading(false);
            setStatusMsg('');
            setIsComplete(true);
          }
          if (event.type === 'error') {
            setError(event.message || 'Summarisation failed');
            setLoading(false);
            setStatusMsg('');
          }
        },
        (err) => {
          if (err.name !== 'AbortError') {
            console.error('Summary stream error:', err);
            setError('Connection lost. Please try again.');
          }
          setLoading(false);
          setStatusMsg('');
        },
      );
    },
    [arxivId, pdfUrl, title, sections],
  );

  const handleSummarize = useCallback(() => makeStreamHandler(false), [makeStreamHandler]);
  const handleContinue  = useCallback(() => makeStreamHandler(true),  [makeStreamHandler]);

  useEffect(() => {
    autoStartedRef.current = false;
  }, [arxivId, pdfUrl, title]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    if (!arxivId && !pdfUrl) return;
    autoStartedRef.current = true;
    makeStreamHandler(false);
  }, [autoStart, arxivId, pdfUrl, makeStreamHandler]);

  return (
    <div className="card summary-page-card">
      <h3 className="card-title summary-page-title">Section Summaries</h3>

      {sections.length === 0 && !loading && !error && !autoStart && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <p className="summary-page-muted" style={{ marginBottom: '1rem' }}>
            Generate AI-powered section summaries for this paper
          </p>
          <button className="btn btn-primary" onClick={handleSummarize}>
            Generate Summaries
          </button>
        </div>
      )}

      {loading && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.5rem' }}>
            <span className="spinner" />
            <span className="summary-page-status" style={{ fontSize: '.85rem' }}>{statusMsg}</span>
            <button
              className="btn btn-secondary analyze-back-btn"
              onClick={handleStop}
              style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '.8rem', marginBottom: 0 }}
            >
              Stop
            </button>
          </div>
          {progress > 0 && (
            <div style={{ background: 'var(--surface-alt)', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: '6px', transition: 'width .3s ease' }} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', color: 'var(--error)', marginBottom: '1rem' }}>
          {error}
          <button className="btn btn-secondary" style={{ marginLeft: '1rem' }} onClick={handleSummarize}>
            Retry
          </button>
        </div>
      )}

      {sections.length > 0 && (
        <div className="summary-timeline-rail">
          {sections.map((section, i) => {
            const bullets = section.summary
              .split('\n')
              .map((l) => l.replace(/^[-•*]\s*/, '').trim())
              .filter(Boolean);
            return (
              <div
                key={i}
                className="summary-timeline-item"
                style={{ animation: 'fadeSlideIn .4s ease both', animationDelay: `${i * 0.06}s` }}
              >
                <span className="summary-timeline-dot" />
                <h4 className="summary-timeline-title">{section.title}</h4>
                <ul className="summary-timeline-bullets">
                  {bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {sections.length > 0 && !loading && !isComplete && (
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={handleContinue}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Continue generating
        </button>
      )}
    </div>
  );
}
