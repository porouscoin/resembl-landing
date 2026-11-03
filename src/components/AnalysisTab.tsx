'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { StatusData, SearchResult, Paper } from '@/lib/types';
import { useLibrary } from '@/lib/LibraryContext';
import KeywordSearch from './KeywordSearch';
import PdfUpload from './PdfUpload';
import ArxivAnalyze from './ArxivAnalyze';
import FuturisticHomeBackground from './FuturisticHomeBackground';

type InputMode = 'keywords' | 'upload' | 'arxiv';

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const paperItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

interface AnalysisTabProps {
  status: StatusData | null;
  showFuturisticBackground?: boolean;
}

export default function AnalysisTab({ status, showFuturisticBackground = false }: AnalysisTabProps) {
  const [mode, setMode] = useState<InputMode>('keywords');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { addPaper, isInLibrary } = useLibrary();

  // Portal requires document to be available (client-side only)
  useEffect(() => { setMounted(true); }, []);

  const isReady = status?.status === 'ready';

  const handleAddPaper = (paper: Paper) => {
    addPaper(paper);
    setToast('Paper added to library');
    setTimeout(() => setToast(null), 2500);
  };

  const hasResults = !!(searchResult?.papers && searchResult.papers.length > 0) || !!searchResult?.error;

  return (
    <div className={`analysis-tab-root ${hasResults ? 'has-results' : ''} ${showFuturisticBackground ? 'futuristic-home' : ''}`}>
      {/* Background rendered via portal at document.body to escape all stacking contexts */}
      {showFuturisticBackground && mounted && createPortal(
        <div className="futuristic-bg-layer">
          <FuturisticHomeBackground />
        </div>,
        document.body,
      )}

      {/* Search zone — vertically above center when no results */}
      <div className="search-zone">
        {/* Centered Pill Bar */}
        <motion.div
          className="input-mode-section"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
        <div className="input-mode-heading">Search by</div>
        <div className="input-mode-pill-bar">
          <button className={`input-mode-pill ${mode === 'keywords' ? 'active' : ''}`} onClick={() => setMode('keywords')}>
            Keyword
          </button>
          <button className={`input-mode-pill ${mode === 'arxiv' ? 'active' : ''}`} onClick={() => setMode('arxiv')}>
            Arxiv ID
          </button>
          <button className={`input-mode-pill ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
            Upload
          </button>
        </div>
      </motion.div>

      {/* Input Forms */}
      <motion.div
        className="search-form-area"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <AnimatePresence mode="wait">
          {mode === 'keywords' && (
            <motion.div key="keywords" {...fadeSlide}>
              <KeywordSearch
                disabled={!isReady}
                onResult={setSearchResult}
                onAnalyze={(url) => { setMode('arxiv'); }}
              />
            </motion.div>
          )}
          {mode === 'upload' && (
            <motion.div key="upload" {...fadeSlide}>
              <PdfUpload
                disabled={!isReady}
                onResult={setSearchResult}
              />
            </motion.div>
          )}
          {mode === 'arxiv' && (
            <motion.div key="arxiv" {...fadeSlide}>
              <ArxivAnalyze
                disabled={!isReady}
                onResult={setSearchResult}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      </div>{/* end .search-zone */}

      {/* Search Results */}
      {searchResult?.papers && searchResult.papers.length > 0 && (
        <motion.div
          className="results-list"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="results-list-heading">
            {searchResult.search_info ?? `${searchResult.total_results} papers found`}
          </h3>
          <motion.div variants={stagger} initial="initial" animate="animate">
            {searchResult.papers.map((paper) => {
              const paperKey = paper.arxiv_id || paper.pdf_url;
              return (
                <motion.div key={paper.rank} className="result-card" variants={paperItem}>
                  {/* Corner action buttons */}
                  <div className="result-card-corner-btns">
                    {paper.arxiv_id && (
                      <a
                        href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="corner-btn"
                        aria-label="View on ArXiv"
                        data-tooltip="View on ArXiv"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
                        </svg>
                      </a>
                    )}
                    {!paper.arxiv_id && paper.pdf_url && (
                      <a
                        href={`${window.location.protocol}//${window.location.hostname}:8000${paper.pdf_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="corner-btn"
                        aria-label="View PDF"
                        data-tooltip="View PDF"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </a>
                    )}
                    {paperKey && (
                      <button
                        className={`corner-btn ${(isInLibrary(paperKey) || isInLibrary(paper.title)) ? 'corner-btn-done' : ''}`}
                        onClick={() => !(isInLibrary(paperKey) || isInLibrary(paper.title)) && handleAddPaper(paper)}
                        aria-label={(isInLibrary(paperKey) || isInLibrary(paper.title)) ? 'In Library' : 'Add to Library'}
                        data-tooltip={(isInLibrary(paperKey) || isInLibrary(paper.title)) ? 'In Library' : 'Add to Library'}
                      >
                        {(isInLibrary(paperKey) || isInLibrary(paper.title)) ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="result-card-title">{paper.title}</div>
                  <div className="result-card-meta">
                    {paper.authors.join(', ')} · {paper.published}
                  </div>
                  <p className="result-card-abstract">{paper.abstract}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      )}

      {searchResult?.error && (
        <div className="result-card" style={{ borderLeft: '4px solid var(--error)' }}>
          <p style={{ color: 'var(--error)' }}>{searchResult.error}</p>
        </div>
      )}

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="library-toast"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
