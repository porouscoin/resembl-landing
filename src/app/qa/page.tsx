'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/DashboardLayout';

const PaperQAModalInner = dynamic(() => import('@/components/PaperQAModalInner'), { ssr: false });

function QAContent() {
  const [arxivId, setArxivId] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'arxiv' | 'upload'>('arxiv');
  const [activeSession, setActiveSession] = useState<{ arxivId: string | null; pdfUrl: string | null; title: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleArxivStart = () => {
    if (!arxivId.trim()) return;
    const cleanId = arxivId.trim().replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '').replace(/\.pdf$/i, '');
    setActiveSession({ arxivId: cleanId, pdfUrl: null, title: cleanId });
  };

  const handleUploadStart = async () => {
    if (!pdfFile) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('session_id', `upload_${Date.now()}`);
      const base = `${window.location.protocol}//${window.location.hostname}:8000`;
      const res = await fetch(`${base}/api/analyze`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.pdf_url) {
        setActiveSession({ arxivId: null, pdfUrl: data.pdf_url, title: data.paper_title || pdfFile.name });
      } else {
        setError('Failed to upload PDF');
      }
    } catch {
      setError('Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  if (activeSession) {
    return (
      <div>
        <motion.button
          className="btn btn-secondary qa-back-btn"
          onClick={() => setActiveSession(null)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ← New Paper
        </motion.button>
        <div className="card qa-card-flush">
          <PaperQAModalInner
            arxivId={activeSession.arxivId}
            pdfUrl={activeSession.pdfUrl}
            title={activeSession.title}
            onClose={() => setActiveSession(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="page-title">Smart Paper Q&A</h1>
        <p className="page-subtitle">Ask questions about any paper and get answers with source citations and inline PDF highlighting</p>
      </motion.div>

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
              <div className="input-mode-desc">Ask about your own paper</div>
            </div>
          </button>
        </div>

        {inputMode === 'arxiv' ? (
          <div className="sum-flex-row">
            <div className="sum-flex-1">
              <label htmlFor="qa-arxiv" className="ks-label">ArXiv ID or URL</label>
              <input
                id="qa-arxiv"
                className="input"
                placeholder="e.g. 2301.07041 or https://arxiv.org/abs/2301.07041"
                value={arxivId}
                onChange={(e) => setArxivId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleArxivStart()}
              />
            </div>
            <button className="btn btn-primary" disabled={!arxivId.trim()} onClick={handleArxivStart}>
              Start Q&A
            </button>
          </div>
        ) : (
          <div className="sum-flex-row">
            <div className="sum-flex-1">
              <label htmlFor="qa-pdf" className="ks-label">PDF File</label>
              <input
                id="qa-pdf"
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="input"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }}
              />
            </div>
            <button className="btn btn-primary" disabled={!pdfFile || uploading} onClick={handleUploadStart}>
              {uploading ? <span className="spinner" /> : 'Start Q&A'}
            </button>
          </div>
        )}

        {error && (
          <p className="qa-error-text">{error}</p>
        )}
      </motion.div>
    </div>
  );
}

export default function QAPage() {
  return (
    <DashboardLayout>
      <QAContent />
    </DashboardLayout>
  );
}
