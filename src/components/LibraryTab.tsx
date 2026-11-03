'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibrary, LibraryPaper } from '@/lib/LibraryContext';
import PaperQAModal from './PaperQAModal';

type Action = 'analyze' | 'ask' | null;

export default function LibraryTab() {
  const { papers, removePaper } = useLibrary();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);

  const selectedPaper = papers.find((p) => (p.arxiv_id || p.pdf_url) === selectedId) ?? null;

  const handleAction = (a: Action) => {
    if (!selectedPaper) return;
    setAction(a);
  };

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      {/* Page Header */}
      <motion.div
        className="library-page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="page-title library-title-center">My Library</h1>
      </motion.div>

      {/* Action pill bar */}
      <motion.div
        className="library-pill-section"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <div className="input-mode-heading">Actions</div>
        <div className="library-pill-row">
          <div className="input-mode-pill-bar">
            <button
              className={`input-mode-pill library-pill${action === 'analyze' || (!action && false) ? ' active' : ''}${!selectedPaper ? ' pill-disabled' : ''}`}
              disabled={!selectedPaper}
              onClick={() => {
                if (!selectedPaper) return;
                if (selectedPaper.arxiv_id) {
                  router.push(`/analyze?arxiv=${encodeURIComponent(selectedPaper.arxiv_id)}`);
                  return;
                }
                if (selectedPaper.pdf_url) {
                  router.push(`/analyze?pdf=${encodeURIComponent(selectedPaper.pdf_url)}`);
                }
              }}
            >
              Analyze
            </button>
            <button
              className={`input-mode-pill library-pill${action === 'ask' ? ' active' : ''}${!selectedPaper ? ' pill-disabled' : ''}`}
              disabled={!selectedPaper}
              onClick={() => handleAction('ask')}
            >
              Ask
            </button>
            <button
              className={`input-mode-pill library-pill${!selectedPaper ? ' pill-disabled' : ''}`}
              disabled={!selectedPaper}
              onClick={() => {
                if (!selectedPaper) return;
                const params = new URLSearchParams();
                if (selectedPaper.arxiv_id) params.set('arxiv', selectedPaper.arxiv_id);
                if (selectedPaper.pdf_url) params.set('pdf', selectedPaper.pdf_url);
                params.set('title', selectedPaper.title);
                router.push(`/paper-summary?${params.toString()}`);
              }}
            >
              Summarize
            </button>
          </div>
          <button
            className="library-add-btn"
            onClick={() => router.push('/search')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Paper
          </button>
        </div>
      </motion.div>

      {/* Library list */}
      {papers.length === 0 ? (
        <motion.div
          className="library-empty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="library-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <h3>Your library is empty</h3>
          <p>Search for papers on the Home page and add them to your library.</p>
          <button className="btn btn-primary" onClick={() => router.push('/search')} style={{ marginTop: '1rem' }}>
            Go to Home
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {papers.map((paper) => {
            const paperKey = paper.arxiv_id || paper.pdf_url;
            const isSelected = selectedId === paperKey;
            return (
              <motion.div
                key={paperKey}
                className={`library-paper-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(paperKey)}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="library-paper-check">
                  <div className={`library-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </div>
                <div className="library-paper-body">
                  <div className="paper-title">{paper.title}</div>
                  <div className="paper-meta">
                    {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''} · {paper.published}
                  </div>
                  <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', margin: '.4rem 0 0', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {paper.abstract}
                  </p>
                </div>
                <div className="library-paper-actions" onClick={(e) => e.stopPropagation()}>
                  {paper.arxiv_id && (
                    <a
                      href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lib-icon-btn"
                      data-tooltip="View on ArXiv"
                      title="View on ArXiv"
                      aria-label="View on ArXiv"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                      </svg>
                    </a>
                  )}
                  {!paper.arxiv_id && paper.pdf_url && (
                    <a
                      href={`${window.location.protocol}//${window.location.hostname}:8000${paper.pdf_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lib-icon-btn"
                      data-tooltip="View PDF"
                      title="View PDF"
                      aria-label="View PDF"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </a>
                  )}
                  <button
                    className="lib-icon-btn"
                    data-tooltip="Remove"
                    title="Remove paper"
                    aria-label="Remove paper"
                    onClick={() => {
                      const key = paper.arxiv_id || paper.pdf_url;
                      removePaper(key);
                      if (selectedId === key) setSelectedId(null);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
      {/* Q&A Modal */}
      {action === 'ask' && selectedPaper && (
        <PaperQAModal
          arxivId={selectedPaper.arxiv_id || null}
          pdfUrl={selectedPaper.pdf_url || null}
          title={selectedPaper.title}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}
