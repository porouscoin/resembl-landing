'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiStreamPost } from '@/lib/api';
import type { SectionSummary } from '@/lib/types';

interface Props {
  arxivId: string | null;
  pdfUrl: string | null;
  title: string;
  onClose: () => void;
}

export default function PaperSummaryModal({ arxivId, pdfUrl, title, onClose }: Props) {
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sections]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Auto-expand latest section as it streams in
  useEffect(() => {
    if (sections.length > 0) {
      setExpandedIdx(sections.length - 1);
    }
  }, [sections.length]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setStatusMsg('');
  }, []);

  const makeStreamHandler = useCallback(
    (keepExisting: boolean) => {
      setLoading(true);
      setError('');
      if (!keepExisting) {
        setSections([]);
        setStarted(true);
      }
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

  return (
    <AnimatePresence>
      <motion.div
        className="summary-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="summary-panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="summary-panel-header">
            <div className="summary-panel-header-left">
              <div className="summary-panel-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div>
                <h2 className="summary-panel-title">Section Summaries</h2>
                <p className="summary-panel-subtitle" title={title}>{title}</p>
              </div>
            </div>
            <button className="summary-panel-close" onClick={onClose} aria-label="Close summary panel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="summary-panel-body">
            {/* Not started — hero CTA */}
            {!started && (
              <div className="summary-start-cta">
                <div className="summary-start-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                <h3 className="summary-start-heading">AI-Powered Summaries</h3>
                <p className="summary-start-desc">
                  Automatically extract and summarize each section of this paper into concise bullet points.
                </p>
                <button className="btn btn-primary summary-start-btn" onClick={handleSummarize}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Generate Summaries
                </button>
              </div>
            )}

            {/* Progress */}
            {loading && (
              <div className="summary-progress-area">
                <div className="summary-progress-bar-track">
                  <motion.div
                    className="summary-progress-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <div className="summary-progress-info">
                  <span className="spinner" />
                  <span>{statusMsg}</span>
                  {progress > 0 && <span className="summary-progress-pct">{Math.round(progress)}%</span>}
                  <button
                    className="btn btn-secondary"
                    onClick={handleStop}
                    style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '.8rem' }}
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="summary-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>{error}</span>
                <button className="btn btn-secondary" onClick={handleSummarize}>Retry</button>
              </div>
            )}

            {/* Section Timeline */}
            {sections.length > 0 && (
              <div className="summary-timeline">
                {sections.map((section, i) => {
                  const bullets = section.summary
                    .split('\n')
                    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
                    .filter(Boolean);
                  const isExpanded = expandedIdx === i;

                  return (
                    <motion.div
                      key={i}
                      className={`summary-section ${isExpanded ? 'expanded' : ''}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.05 }}
                    >
                      <div className="summary-section-dot">
                        <span className="summary-section-num">{i + 1}</span>
                      </div>
                      <div className="summary-section-content">
                        <button
                          className="summary-section-header"
                          onClick={() => setExpandedIdx(isExpanded ? null : i)}
                        >
                          <span className="summary-section-title">{section.title}</span>
                          <svg
                            className={`summary-section-chevron ${isExpanded ? 'open' : ''}`}
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </button>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              className="summary-section-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                            >
                              <ul className="summary-bullets">
                                {bullets.map((b, j) => (
                                  <li key={j}>{b}</li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <div ref={bottomRef} />

            {/* Footer actions */}
            {sections.length > 0 && !loading && (
              <div className="summary-footer-actions">
                {!isComplete && (
                  <button className="btn btn-primary" onClick={handleContinue}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    Continue generating
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => setExpandedIdx(null)}>
                  Collapse All
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
