'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { apiFormPost, apiJsonPost } from '@/lib/api';
import type { Paper, SearchResult, MultiQAMessage, MultiQASource, MultiQAResult } from '@/lib/types';

/* ── tiny Paper-like shape for uploaded PDFs ──────────────────────── */
interface CompPaper {
  title: string;
  arxiv_id: string;
  pdf_url: string;
  authors: string[];
  published: string;
}

type SourceMode = 'upload' | 'search' | null;
type PrepStatus = 'idle' | 'processing' | 'ready' | 'error';

export default function CompareTab() {
  /* ── paper selection ────────────────────────────────────────────── */
  const [paperA, setPaperA] = useState<CompPaper | null>(null);
  const [paperB, setPaperB] = useState<CompPaper | null>(null);
  const [picking, setPicking] = useState<'A' | 'B' | null>(null);    // which slot we're filling
  const [sourceMode, setSourceMode] = useState<SourceMode>(null);     // how we're sourcing papers

  /* ── upload state ───────────────────────────────────────────────── */
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /* ── keyword search state ───────────────────────────────────────── */
  const [keywords, setKeywords] = useState('');
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);

  /* ── prep state ─────────────────────────────────────────────────── */
  const [statusA, setStatusA] = useState<PrepStatus>('idle');
  const [statusB, setStatusB] = useState<PrepStatus>('idle');

  /* ── chat state ─────────────────────────────────────────────────── */
  const [messages, setMessages] = useState<MultiQAMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const bothReady = statusA === 'ready' && statusB === 'ready';
  const bothSelected = !!paperA && !!paperB;

  /* ── scroll on new messages ─────────────────────────────────────── */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── prepare embeddings when both papers selected ───────────────── */
  useEffect(() => {
    if (!paperA || !paperB) return;
    const startPrep = async () => {
      try {
        const res = await apiJsonPost<{ statuses: Record<string, string> }>(
          '/paper-qa/multi/prepare',
          {
            paper_a: { arxiv_id: paperA.arxiv_id || null, pdf_url: paperA.pdf_url || null, title: paperA.title },
            paper_b: { arxiv_id: paperB.arxiv_id || null, pdf_url: paperB.pdf_url || null, title: paperB.title },
            question: '',
          },
        );
        for (const [key, val] of Object.entries(res.statuses)) {
          const status: PrepStatus = val === 'ready' ? 'ready' : val.startsWith('error') ? 'error' : 'processing';
          if (key === (paperA.arxiv_id || paperA.pdf_url)) setStatusA(status);
          if (key === (paperB.arxiv_id || paperB.pdf_url)) setStatusB(status);
          if (status === 'processing') schedulePoll(key);
        }
      } catch { /* ignore */ }
    };
    startPrep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperA, paperB]);

  const schedulePoll = useCallback((paperKey: string) => {
    if (pollRef.current[paperKey]) return;
    const poll = async () => {
      const ref = [paperA, paperB].find((p) => p && (p.arxiv_id || p.pdf_url) === paperKey);
      if (!ref) return;
      const otherRef = ref === paperA ? paperB : paperA;
      try {
        const res = await apiJsonPost<{ statuses: Record<string, string> }>(
          '/paper-qa/multi/prepare',
          {
            paper_a: { arxiv_id: ref.arxiv_id || null, pdf_url: ref.pdf_url || null, title: ref.title },
            paper_b: { arxiv_id: otherRef?.arxiv_id || null, pdf_url: otherRef?.pdf_url || null, title: otherRef?.title || '' },
            question: '',
          },
        );
        const val = res.statuses[paperKey];
        if (!val || val === 'ready') {
          const setter = paperKey === (paperA?.arxiv_id || paperA?.pdf_url) ? setStatusA : setStatusB;
          setter('ready');
          delete pollRef.current[paperKey];
        } else if (val.startsWith('error')) {
          const setter = paperKey === (paperA?.arxiv_id || paperA?.pdf_url) ? setStatusA : setStatusB;
          setter('error');
          delete pollRef.current[paperKey];
        } else {
          pollRef.current[paperKey] = setTimeout(poll, 5000);
        }
      } catch {
        pollRef.current[paperKey] = setTimeout(poll, 6000);
      }
    };
    pollRef.current[paperKey] = setTimeout(poll, 4000);
  }, [paperA, paperB]);

  useEffect(() => { return () => { Object.values(pollRef.current).forEach(clearTimeout); }; }, []);

  /* ── ask ─────────────────────────────────────────────────────────── */
  const handleAsk = useCallback(async () => {
    const question = input.trim();
    if (!question || loading || !bothReady || !paperA || !paperB) return;

    const userMsg: MultiQAMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await apiJsonPost<MultiQAResult>('/paper-qa/multi', {
        paper_a: { arxiv_id: paperA.arxiv_id || null, pdf_url: paperA.pdf_url || null, title: paperA.title },
        paper_b: { arxiv_id: paperB.arxiv_id || null, pdf_url: paperB.pdf_url || null, title: paperB.title },
        question,
        chat_history: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      if (res.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: res.answer, sources: res.sources }]);
      } else {
        setError(res.answer || 'Something went wrong.');
      }
    } catch { setError('Connection error. Please try again.'); }
    finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [input, loading, bothReady, paperA, paperB, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } };

  /* ── file upload handler ────────────────────────────────────────── */
  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Please upload a PDF file.'); return; }
    if (!picking) return;
    setUploading(true);
    setError('');
    try {
      const res = await apiFormPost<{ success: boolean; pdf_url?: string; title?: string; error?: string }>(
        '/upload-pdf', { pdf_file: file },
      );
      if (res.success && res.pdf_url) {
        const paper: CompPaper = { title: res.title || file.name, arxiv_id: '', pdf_url: res.pdf_url, authors: [], published: '' };
        if (picking === 'A') { setPaperA(paper); setStatusA('idle'); }
        else { setPaperB(paper); setStatusB('idle'); }
        setPicking(null);
        setSourceMode(null);
        setMessages([]);
      } else {
        setError(res.error || 'Upload failed');
      }
    } catch { setError('Upload failed. Please try again.'); }
    finally { setUploading(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  /* ── keyword search ─────────────────────────────────────────────── */
  const handleSearch = async () => {
    if (!keywords.trim()) return;
    setSearching(true);
    setError('');
    try {
      const res = await apiFormPost<SearchResult>('/search-keywords', {
        keywords, max_results: '10', sort_by: 'relevance', category: '',
      });
      if (res.papers) setSearchResults(res.papers);
      else if (res.error) setError(res.error);
    } catch { setError('Search failed.'); }
    finally { setSearching(false); }
  };

  const selectPaperFromSearch = (paper: Paper) => {
    const cp: CompPaper = { title: paper.title, arxiv_id: paper.arxiv_id, pdf_url: paper.pdf_url, authors: paper.authors, published: paper.published };
    if (picking === 'A') { setPaperA(cp); setStatusA('idle'); }
    else if (picking === 'B') { setPaperB(cp); setStatusB('idle'); }
    setPicking(null);
    setSourceMode(null);
    setSearchResults([]);
    setKeywords('');
    setMessages([]);
  };

  /* ── reset ──────────────────────────────────────────────────────── */
  const handleReset = () => {
    setPaperA(null); setPaperB(null);
    setStatusA('idle'); setStatusB('idle');
    setMessages([]); setInput(''); setError('');
    setPicking(null); setSourceMode(null);
    setSearchResults([]); setKeywords('');
  };

  /* ── presets ─────────────────────────────────────────────────────── */
  const presets = [
    { label: 'Compare methodology', q: 'Compare the methodology and approach used in these two papers.' },
    { label: 'Compare results', q: 'Compare the results and performance reported in these two papers.' },
    { label: 'Key differences', q: 'What are the key differences between these two papers?' },
    { label: 'Limitations', q: 'What are the limitations discussed in each paper?' },
  ];

  /* ── helpers ─────────────────────────────────────────────────────── */
  const statusDotClass = (s: PrepStatus) => `compare-status-dot ${s}`;
  const statusLabel = (s: PrepStatus) =>
    s === 'ready' ? 'Ready' : s === 'processing' ? 'Preparing…' : s === 'error' ? 'Error' : 'Waiting';

  /* ── render ─────────────────────────────────────────────────────── */
  return (
    <div className="compare-tab">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="compare-header">
        <h2 className="compare-title">Compare Papers</h2>
        {bothSelected && (
          <button className="btn btn-ghost compare-reset-btn" onClick={handleReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Start over
          </button>
        )}
      </div>

      {/* ── PAPER SLOTS ─────────────────────────────────────────── */}
      <div className="compare-slots">
        {/* Slot A */}
        <div
          className={`compare-slot compare-slot-a ${picking === 'A' ? 'active' : ''}`}
          onClick={() => { if (!paperA) { setPicking('A'); setSourceMode(null); } }}
        >
          <div className="compare-slot-badge compare-slot-badge-a">A</div>
          <div className="compare-slot-body">
            {paperA ? (
              <>
                <span className="compare-slot-title">{paperA.title}</span>
                <div className="compare-slot-meta">
                  <span className={statusDotClass(statusA)} /> {statusLabel(statusA)}
                  {paperA.authors.length > 0 && <span className="compare-slot-authors">{paperA.authors.slice(0, 2).join(', ')}{paperA.authors.length > 2 ? ' et al.' : ''}</span>}
                </div>
              </>
            ) : (
              <span className="compare-slot-placeholder">Click to select Paper A</span>
            )}
          </div>
          {paperA && (
            <button
              className="compare-slot-clear"
              onClick={(e) => { e.stopPropagation(); setPaperA(null); setStatusA('idle'); setMessages([]); }}
              title="Remove paper"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* VS divider */}
        <div className="compare-vs">VS</div>

        {/* Slot B */}
        <div
          className={`compare-slot compare-slot-b ${picking === 'B' ? 'active' : ''}`}
          onClick={() => { if (!paperB) { setPicking('B'); setSourceMode(null); } }}
        >
          <div className="compare-slot-badge compare-slot-badge-b">B</div>
          <div className="compare-slot-body">
            {paperB ? (
              <>
                <span className="compare-slot-title">{paperB.title}</span>
                <div className="compare-slot-meta">
                  <span className={statusDotClass(statusB)} /> {statusLabel(statusB)}
                  {paperB.authors.length > 0 && <span className="compare-slot-authors">{paperB.authors.slice(0, 2).join(', ')}{paperB.authors.length > 2 ? ' et al.' : ''}</span>}
                </div>
              </>
            ) : (
              <span className="compare-slot-placeholder">Click to select Paper B</span>
            )}
          </div>
          {paperB && (
            <button
              className="compare-slot-clear"
              onClick={(e) => { e.stopPropagation(); setPaperB(null); setStatusB('idle'); setMessages([]); }}
              title="Remove paper"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── SOURCE MODE PICKER (when a slot is being filled) ──── */}
      <AnimatePresence>
        {picking && !sourceMode && (
          <motion.div
            key="source-picker"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="compare-source-picker"
          >
            <p className="compare-source-label">How would you like to select Paper {picking}?</p>
            <div className="compare-source-options">
              <button className="compare-source-btn" onClick={() => setSourceMode('upload')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Upload PDF</span>
              </button>
              <button className="compare-source-btn" onClick={() => setSourceMode('search')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <span>Search by Keywords</span>
              </button>
              <button className="compare-source-btn" onClick={() => { setPicking(null); }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                <span>Cancel</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── UPLOAD PANEL ────────────────────────────────────────── */}
      <AnimatePresence>
        {picking && sourceMode === 'upload' && (
          <motion.div
            key="upload-panel"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="compare-panel"
          >
            <div className="compare-panel-header">
              <span>Upload PDF for Paper {picking}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSourceMode(null); }}>Back</button>
            </div>
            <div
              className={`compare-upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('compare-file-input')?.click()}
            >
              {uploading ? (
                <div className="compare-upload-spinner">
                  <span className="spinner" /> Uploading…
                </div>
              ) : (
                <>
                  <svg className="compare-upload-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="compare-upload-hint">
                    Drag & drop a PDF or <span className="compare-upload-browse">browse</span>
                  </p>
                </>
              )}
            </div>
            <input
              id="compare-file-input"
              type="file" accept=".pdf"
              className="compare-file-input-hidden"
              title="Upload PDF file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEARCH PANEL ────────────────────────────────────────── */}
      <AnimatePresence>
        {picking && sourceMode === 'search' && (
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="compare-panel"
          >
            <div className="compare-panel-header">
              <span>Search for Paper {picking}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSourceMode(null); setSearchResults([]); setKeywords(''); }}>Back</button>
            </div>
            <div className="compare-search-row">
              <input
                className="input compare-search-input"
                placeholder="Search keywords e.g. transformer attention"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className="btn btn-primary" onClick={handleSearch} disabled={searching || !keywords.trim()}>
                {searching ? <span className="spinner" /> : 'Search'}
              </button>
            </div>

            {/* search results */}
            {searchResults.length > 0 && (
              <div className="compare-search-results">
                {searchResults.map((paper) => {
                  const isA = paperA?.arxiv_id === paper.arxiv_id && paperA?.pdf_url === paper.pdf_url;
                  const isB = paperB?.arxiv_id === paper.arxiv_id && paperB?.pdf_url === paper.pdf_url;
                  return (
                    <div
                      key={paper.arxiv_id || paper.pdf_url}
                      className={`compare-search-item ${isA || isB ? 'selected' : ''}`}
                      onClick={() => selectPaperFromSearch(paper)}
                    >
                      <div className="compare-search-item-title">
                        {isA && <span className="compare-item-marker compare-item-marker-a">A</span>}
                        {isB && <span className="compare-item-marker compare-item-marker-b">B</span>}
                        {paper.title}
                      </div>
                      <div className="compare-search-item-meta">
                        {paper.authors.slice(0, 2).join(', ')}{paper.authors.length > 2 ? ' et al.' : ''} · {paper.published}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ERROR ───────────────────────────────────────────────── */}
      {error && (
        <div className="compare-error">
          {error}
          <button className="compare-error-close" onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* ── COMPARISON CHAT ─────────────────────────────────────── */}
      {bothSelected && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="compare-chat"
        >
          {/* status bar */}
          <div className="compare-chat-status">
            <span className="compare-chat-status-item">
              <span className={statusDotClass(statusA)} /> Paper A: {statusLabel(statusA)}
            </span>
            <span className="compare-chat-status-item">
              <span className={statusDotClass(statusB)} /> Paper B: {statusLabel(statusB)}
            </span>
          </div>

          {/* presets */}
          <div className="compare-chat-presets">
            {presets.map((p) => (
              <button
                key={p.label}
                className="compare-preset-btn"
                onClick={() => setInput(p.q)}
                disabled={!bothReady}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* messages */}
          <div className="compare-chat-messages">
            {messages.length === 0 && (
              <div className="compare-chat-empty">
                <svg className="compare-chat-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p>{bothReady ? 'Both papers are ready — ask a question to compare them.' : 'Preparing paper embeddings…'}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' && (
                  <div className="compare-msg-user">
                    <div className="compare-msg-user-bubble">{msg.content}</div>
                  </div>
                )}
                {msg.role === 'assistant' && (
                  <div className="compare-msg-assistant">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.sources && msg.sources.length > 0 && (
                      <details className="compare-sources-details">
                        <summary className="compare-sources-summary">
                          {msg.sources.length} source excerpt{msg.sources.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="compare-sources-list">
                          {msg.sources.map((s: MultiQASource, si: number) => (
                            <div key={si} className={`compare-source-excerpt ${s.paper_label === 'A' ? 'source-a' : 'source-b'}`}>
                              <span className="compare-source-citation">[{s.index}] p.{s.page}</span>{' '}
                              {s.snippet}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="compare-msg-loading">
                <span className="compare-dots">
                  <span /><span /><span />
                </span>
                Comparing papers…
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="compare-chat-input">
            <input
              ref={inputRef} type="text"
              placeholder={!bothReady ? 'Waiting for papers to be ready…' : 'Ask something to compare these papers…'}
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              disabled={!bothReady || loading}
              className={`input compare-chat-input-field ${!bothReady ? 'is-disabled' : ''}`}
            />
            <button
              onClick={handleAsk}
              disabled={!bothReady || loading || !input.trim()}
              className="btn btn-primary compare-chat-ask-btn"
            >
              {loading ? '…' : 'Ask'}
            </button>
          </div>
        </motion.div>
      )}

      {/* ── EMPTY STATE (no papers selected, no picker open) ──── */}
      {!bothSelected && !picking && (
        <div className="compare-empty">
          <svg className="compare-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="8" height="18" rx="1"/><rect x="14" y="3" width="8" height="18" rx="1"/>
            <path d="M10 9h4" /><path d="M10 15h4" />
          </svg>
          <p>Click on a paper slot above to start selecting papers for comparison.</p>
        </div>
      )}
    </div>
  );
}
