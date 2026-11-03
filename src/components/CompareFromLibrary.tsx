'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { apiJsonPost } from '@/lib/api';
import { useLibrary } from '@/lib/LibraryContext';
import type { MultiQAMessage, MultiQASource, MultiQAResult } from '@/lib/types';

interface CompPaper {
  title: string;
  arxiv_id: string;
  pdf_url: string;
  authors: string[];
  published: string;
}

type PrepStatus = 'idle' | 'processing' | 'ready' | 'error';

const COLOR_A = '#4f8ef7';
const COLOR_B = '#f7a24f';

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api';

function pdfViewUrl(paper: CompPaper): string | null {
  if (!paper.pdf_url && !paper.arxiv_id) return null;
  const params = new URLSearchParams();
  if (paper.arxiv_id) params.set('arxiv_id', paper.arxiv_id);
  else if (paper.pdf_url) params.set('pdf_url', paper.pdf_url);
  return `${API_BASE}/pdf-proxy?${params.toString()}`;
}

export default function CompareFromLibrary() {
  const router = useRouter();
  const { papers: libraryPapers } = useLibrary();

  const [paperA, setPaperA] = useState<CompPaper | null>(null);
  const [paperB, setPaperB] = useState<CompPaper | null>(null);
  const [picking, setPicking] = useState<'A' | 'B' | null>(null);

  const [statusA, setStatusA] = useState<PrepStatus>('idle');
  const [statusB, setStatusB] = useState<PrepStatus>('idle');

  const [messages, setMessages] = useState<MultiQAMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const bothReady = statusA === 'ready' && statusB === 'ready';
  const bothSelected = !!paperA && !!paperB;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* prepare embeddings */
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

  /* ask */
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

  const selectFromLibrary = (paper: typeof libraryPapers[0]) => {
    const cp: CompPaper = { title: paper.title, arxiv_id: paper.arxiv_id, pdf_url: paper.pdf_url, authors: paper.authors, published: paper.published };
    if (picking === 'A') { setPaperA(cp); setStatusA('idle'); }
    else if (picking === 'B') { setPaperB(cp); setStatusB('idle'); }
    setPicking(null);
    setMessages([]);
  };

  const handleReset = () => {
    setPaperA(null); setPaperB(null);
    setStatusA('idle'); setStatusB('idle');
    setMessages([]); setInput(''); setError('');
    setPicking(null);
  };

  const presets = [
    { label: 'Compare methodology', q: 'Compare the methodology and approach used in these two papers.' },
    { label: 'Compare results', q: 'Compare the results and performance reported in these two papers.' },
    { label: 'Key differences', q: 'What are the key differences between these two papers?' },
    { label: 'Limitations', q: 'What are the limitations discussed in each paper?' },
  ];

  const statusClass = (s: PrepStatus) =>
    `compare-status-dot ${s === 'ready' ? 'ready' : s === 'error' ? 'error' : s === 'processing' ? 'processing' : 'idle'}`;
  const statusLabel = (s: PrepStatus) =>
    s === 'ready' ? 'Ready' : s === 'processing' ? 'Preparing...' : s === 'error' ? 'Error' : 'Waiting';

  return (
    <div className="compare-tab">
      {/* Header */}
      <div className="compare-header">
        <h2 className="compare-title">Compare Papers</h2>
        {bothSelected && (
          <button className="btn btn-ghost compare-reset-btn" onClick={handleReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Start over
          </button>
        )}
      </div>

      {/* Paper Slots */}
      <div className="compare-slots">
        {/* Slot A */}
        <div
          className={`compare-slot compare-slot-a ${picking === 'A' ? 'is-picking' : ''} ${paperA ? 'has-paper' : 'is-empty'}`}
          onClick={() => { if (!paperA) { setPicking('A'); } }}
        >
          <div className="compare-slot-badge compare-slot-badge-a">A</div>
          <div className="compare-slot-body">
            {paperA ? (
              <>
                <span className="compare-slot-title">{paperA.title}</span>
                <div className="compare-slot-meta">
                  <span className={statusClass(statusA)} /> {statusLabel(statusA)}
                  {paperA.authors.length > 0 && <span className="compare-slot-authors">{paperA.authors.slice(0, 2).join(', ')}{paperA.authors.length > 2 ? ' et al.' : ''}</span>}
                </div>
              </>
            ) : (
              <span className="compare-slot-placeholder">Click to select Paper A</span>
            )}
          </div>
          {paperA && (
            <div className="compare-slot-actions">
              {pdfViewUrl(paperA) && (
                <a
                  className="compare-slot-pdf-btn"
                  href={pdfViewUrl(paperA)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open PDF"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </a>
              )}
              <button
                className="compare-slot-clear"
                onClick={(e) => { e.stopPropagation(); setPaperA(null); setStatusA('idle'); setMessages([]); }}
                title="Remove paper"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}
        </div>

        <div className="compare-vs">VS</div>

        {/* Slot B */}
        <div
          className={`compare-slot compare-slot-b ${picking === 'B' ? 'is-picking' : ''} ${paperB ? 'has-paper' : 'is-empty'}`}
          onClick={() => { if (!paperB) { setPicking('B'); } }}
        >
          <div className="compare-slot-badge compare-slot-badge-b">B</div>
          <div className="compare-slot-body">
            {paperB ? (
              <>
                <span className="compare-slot-title">{paperB.title}</span>
                <div className="compare-slot-meta">
                  <span className={statusClass(statusB)} /> {statusLabel(statusB)}
                  {paperB.authors.length > 0 && <span className="compare-slot-authors">{paperB.authors.slice(0, 2).join(', ')}{paperB.authors.length > 2 ? ' et al.' : ''}</span>}
                </div>
              </>
            ) : (
              <span className="compare-slot-placeholder">Click to select Paper B</span>
            )}
          </div>
          {paperB && (
            <div className="compare-slot-actions">
              {pdfViewUrl(paperB) && (
                <a
                  className="compare-slot-pdf-btn"
                  href={pdfViewUrl(paperB)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open PDF"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </a>
              )}
              <button
                className="compare-slot-clear"
                onClick={(e) => { e.stopPropagation(); setPaperB(null); setStatusB('idle'); setMessages([]); }}
                title="Remove paper"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Library paper picker */}
      <AnimatePresence>
        {picking && (
          <motion.div
            key="library-picker"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="compare-panel"
          >
            <div className="compare-panel-header">
              <span>Select Paper {picking} from Library</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPicking(null)}>Cancel</button>
            </div>
            {libraryPapers.length === 0 ? (
              <div className="compare-empty-library">
                <p>Your library is empty. Add papers from the Home page first.</p>
                <button className="library-add-btn" onClick={() => router.push('/search')}>Go to Home</button>
              </div>
            ) : (
              <div className="compare-search-results">
                {libraryPapers.map((paper) => {
                  const isA = paperA?.arxiv_id === paper.arxiv_id;
                  const isB = paperB?.arxiv_id === paper.arxiv_id;
                  const isDisabled = isA || isB;
                  return (
                    <div
                      key={paper.arxiv_id}
                      className={`compare-search-item ${isDisabled ? 'selected is-disabled' : ''}`}
                      onClick={() => { if (!isDisabled) selectFromLibrary(paper); }}
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

      {/* Error */}
      {error && (
        <div className="compare-error">
          {error}
          <button onClick={() => setError('')} className="compare-error-close">x</button>
        </div>
      )}

      {/* Chat */}
      {bothSelected && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="compare-chat"
        >
          <div className="compare-chat-status">
            <span className="compare-chat-status-item">
              <span className={statusClass(statusA)} /> Paper A: {statusLabel(statusA)}
            </span>
            <span className="compare-chat-status-item">
              <span className={statusClass(statusB)} /> Paper B: {statusLabel(statusB)}
            </span>
          </div>

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

          <div className="compare-chat-messages">
            {messages.length === 0 && (
              <div className="compare-chat-empty">
                <svg className="compare-chat-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p>{bothReady ? 'Both papers are ready — ask a question to compare them.' : 'Preparing paper embeddings...'}</p>
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
                          {msg.sources.map((s: MultiQASource, si: number) => {
                            const paper = s.paper_label === 'A' ? paperA : paperB;
                            const pdfUrl = paper ? pdfViewUrl(paper) : null;
                            return (
                              <div key={si} className={`compare-source-excerpt source-${s.paper_label?.toLowerCase() || 'a'}`}>
                                <div className="compare-source-header">
                                  <span className="compare-source-citation">[{s.index}]</span>
                                  <span className="compare-source-title">{s.title}</span>
                                  <span className="compare-source-page">Page {s.page}</span>
                                  {pdfUrl && (
                                    <a
                                      className="compare-source-pdf-link"
                                      href={`${pdfUrl}#page=${s.page}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={`Open PDF at page ${s.page}`}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
                                    </a>
                                  )}
                                </div>
                                <div className="compare-source-text">{s.snippet}</div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="compare-msg-loading">
                <span className="compare-dots"><span /><span /><span /></span>
                Comparing papers...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="compare-chat-input">
            <input
              ref={inputRef} type="text"
              placeholder={!bothReady ? 'Waiting for papers to be ready...' : 'Ask something to compare these papers...'}
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              disabled={!bothReady || loading}
              className={`input compare-chat-input-field ${!bothReady ? 'is-disabled' : ''}`}
            />
            <button
              onClick={handleAsk}
              disabled={!bothReady || loading || !input.trim()}
              className="btn btn-primary"
            >
              {loading ? '...' : 'Ask'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!bothSelected && !picking && (
        <div className="compare-empty">
          {libraryPapers.length < 2 ? (
            <>
              <svg className="compare-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <p>You need at least 2 papers in your library to compare. Add papers from the Home page.</p>
              <button className="library-add-btn compare-empty-action" onClick={() => router.push('/search')}>Go to Home</button>
            </>
          ) : (
            <>
              <svg className="compare-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="8" height="18" rx="1"/><rect x="14" y="3" width="8" height="18" rx="1"/>
                <path d="M10 9h4" /><path d="M10 15h4" />
              </svg>
              <p>Click on a paper slot above to select papers from your library for comparison.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
