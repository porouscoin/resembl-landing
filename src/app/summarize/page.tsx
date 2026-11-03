'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiStreamPost, apiFormPost } from '@/lib/api';
import type { SectionSummary } from '@/lib/types';
import DashboardLayout from '@/components/DashboardLayout';

function SummarizeContent() {
  const [arxivId, setArxivId] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [started, setStarted] = useState(false);
  const [inputMode, setInputMode] = useState<'arxiv' | 'upload'>('arxiv');

  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sections]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (sections.length > 0) setExpandedIdx(sections.length - 1);
  }, [sections.length]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setStatusMsg('');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setTitle(file.name.replace(/\.pdf$/i, ''));
    }
  };

  const handleUploadAndSummarize = async () => {
    if (!pdfFile) return;
    setLoading(true);
    setError('');
    setSections([]);
    setStarted(true);
    setIsComplete(false);
    setStatusMsg('Uploading PDF...');

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('session_id', `upload_${Date.now()}`);

      const base = `${window.location.protocol}//${window.location.hostname}:8000`;
      const res = await fetch(`${base}/api/analyze`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.pdf_url) {
        setPdfUrl(data.pdf_url);
        setTitle(data.paper_title || title);
        startStream(null, data.pdf_url, data.paper_title || title, false);
      } else {
        setError('Failed to upload PDF');
        setLoading(false);
      }
    } catch {
      setError('Failed to upload PDF');
      setLoading(false);
    }
  };

  const startStream = useCallback(
    (aid: string | null, pUrl: string | null, pTitle: string, keepExisting: boolean) => {
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
          arxiv_id: aid,
          pdf_url: pUrl,
          title: pTitle,
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
            setError('Connection lost. Please try again.');
          }
          setLoading(false);
          setStatusMsg('');
        },
      );
    },
    [sections],
  );

  const handleArxivSummarize = () => {
    if (!arxivId.trim()) return;
    const cleanId = arxivId.trim().replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '').replace(/\.pdf$/i, '');
    setTitle(cleanId);
    startStream(cleanId, null, cleanId, false);
  };

  const handleContinue = useCallback(() => {
    const aid = inputMode === 'arxiv' ? arxivId.trim() : null;
    startStream(aid, pdfUrl, title, true);
  }, [inputMode, arxivId, pdfUrl, title, startStream]);

  return (
    <div>
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="page-title">AI Paper Summaries</h1>
        <p className="page-subtitle">Generate comprehensive section-by-section summaries of any research paper, streamed in real-time</p>
      </motion.div>

      {/* Input area */}
      {!started && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="input-mode-grid sum-mb-1">
            <button className={`input-mode-card ${inputMode === 'arxiv' ? 'active' : ''}`} onClick={() => setInputMode('arxiv')}>
              <div className="input-mode-icon-wrap arxiv">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </div>
              <div className="input-mode-info">
                <div className="input-mode-label">ArXiv ID / URL</div>
                <div className="input-mode-desc">Paste paper identifier</div>
              </div>
            </button>
            <button className={`input-mode-card ${inputMode === 'upload' ? 'active' : ''}`} onClick={() => setInputMode('upload')}>
              <div className="input-mode-icon-wrap upload">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div className="input-mode-info">
                <div className="input-mode-label">Upload PDF</div>
                <div className="input-mode-desc">Summarize your own paper</div>
              </div>
            </button>
          </div>

          {inputMode === 'arxiv' ? (
            <div className="sum-flex-row">
              <div className="sum-flex-1">
                <label htmlFor="sum-arxiv" className="ks-label">ArXiv ID or URL</label>
                <input
                  id="sum-arxiv"
                  className="input"
                  placeholder="e.g. 2301.07041 or https://arxiv.org/abs/2301.07041"
                  value={arxivId}
                  onChange={(e) => setArxivId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleArxivSummarize()}
                />
              </div>
              <button
                className="btn btn-primary"
                disabled={!arxivId.trim() || loading}
                onClick={handleArxivSummarize}
              >
                Summarize
              </button>
            </div>
          ) : (
            <div className="sum-flex-row">
              <div className="sum-flex-1">
                <label htmlFor="sum-pdf" className="ks-label">PDF File</label>
                <input
                  id="sum-pdf"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="input"
                  onChange={handleFileChange}
                />
              </div>
              <button
                className="btn btn-primary"
                disabled={!pdfFile || loading}
                onClick={handleUploadAndSummarize}
              >
                Summarize
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Back to input */}
      {started && !loading && (
        <motion.button
          className="btn btn-secondary sum-back-btn"
          onClick={() => { setStarted(false); setSections([]); setError(''); setIsComplete(false); setProgress(0); }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ← New Summary
        </motion.button>
      )}

      {/* Progress */}
      {loading && (
        <div className="card sum-mb-1">
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
              <button className="btn btn-secondary sum-stop-btn" onClick={handleStop}>Stop</button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card sum-error-card">
          <p className="sum-error-text">{error}</p>
          <button className="btn btn-secondary sum-retry-btn" onClick={() => { setStarted(false); setError(''); }}>
            Try Again
          </button>
        </div>
      )}

      {/* Sections */}
      {sections.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {title && <h3 className="sum-section-title">{title}</h3>}
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
                    <button className="summary-section-header" onClick={() => setExpandedIdx(isExpanded ? null : i)}>
                      <span className="summary-section-title">{section.title}</span>
                      <svg className={`summary-section-chevron ${isExpanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div className="summary-section-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                          <ul className="summary-bullets">
                            {bullets.map((b, j) => <li key={j}>{b}</li>)}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div ref={bottomRef} />

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
              <button className="btn btn-ghost" onClick={() => setExpandedIdx(null)}>Collapse All</button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function SummarizePage() {
  return (
    <DashboardLayout>
      <SummarizeContent />
    </DashboardLayout>
  );
}
