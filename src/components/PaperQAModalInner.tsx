'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { apiJsonPost } from '@/lib/api';
import type { QAMessage, QAResult, QASource } from '@/lib/types';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface Props {
  arxivId: string | null;
  pdfUrl: string | null;
  title: string;
  onClose: () => void;
}

export default function PaperQAModalInner({ arxivId, pdfUrl, title, onClose }: Props) {
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'concise' | 'detailed'>('concise');
  const [embeddingsReady, setEmbeddingsReady] = useState(false);
  const [embeddingsLoading, setEmbeddingsLoading] = useState(true);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfError, setPdfError] = useState('');
  const [highlightPages, setHighlightPages] = useState<Set<number>>(new Set());
  const [activeSources, setActiveSources] = useState<QASource[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfScrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const pdfProxyUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (arxivId) params.set('arxiv_id', arxivId);
    if (pdfUrl) params.set('pdf_url', pdfUrl);
    const base = `${window.location.protocol}//${window.location.hostname}:8000`;
    return `${base}/api/pdf-proxy?${params.toString()}`;
  }, [arxivId, pdfUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const root = pdfScrollRef.current;
    if (!root || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage = currentPage;
        let bestRatio = 0;

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          const id = target.id || '';
          const page = Number(id.replace('qa-page-', ''));
          if (!Number.isFinite(page)) continue;

          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestPage = page;
          }
        }

        if (bestRatio > 0 && bestPage !== currentPage) {
          setCurrentPage(bestPage);
        }
      },
      {
        root,
        threshold: [0.25, 0.5, 0.75],
      },
    );

    for (const [, el] of pageRefs.current) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [numPages, currentPage]);

  // Pre-generate embeddings as soon as the modal opens (polling approach)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    setEmbeddingsLoading(true);
    setEmbeddingsReady(false);
    setError('');

    const poll = async () => {
      try {
        const res = await apiJsonPost<{ status: string; error?: string }>('/paper-qa/prepare', {
          arxiv_id: arxivId,
          pdf_url: pdfUrl,
          title,
        });
        if (cancelled) return;

        if (res.status === 'ready') {
          setEmbeddingsReady(true);
          setEmbeddingsLoading(false);
        } else if (res.status === 'processing') {
          // Progressive backoff: 4s → 6s → 8s → cap at 10s
          attempt++;
          const delay = Math.min(4000 + (attempt - 1) * 2000, 10000);
          timer = setTimeout(poll, delay);
        } else {
          setError(res.error || 'Failed to prepare paper embeddings.');
          setEmbeddingsLoading(false);
        }
      } catch {
        if (!cancelled) {
          // Network error — retry after a short delay
          timer = setTimeout(poll, 5000);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [arxivId, pdfUrl, title]);

  const scrollToPage = useCallback((page: number) => {
    setCurrentPage(page);
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const highlightTextInPage = useCallback((pageNum: number, sources: QASource[]) => {
    /**
     * Concatenate + fuzzy-substring approach:
     * 1. Collect all pdfjs <span>s on the page into one big string,
     *    tracking the character offset range each span owns.
     * 2. Normalize both the concatenated page text and each source text
     *    (lowercase, collapse whitespace, strip non-alphanumeric except spaces).
     * 3. Find the best fuzzy match position of the source text inside the
     *    page text using an n-gram sliding window.
     * 4. Map the matched character range back to the original spans and
     *    highlight them.
     */
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

    /**
     * Build a set of word-level n-grams (shingles) from a string.
     * Using 3-word shingles for good balance of precision and recall.
     */
    const buildShingles = (text: string, n = 3): Set<string> => {
      const words = text.split(' ').filter(Boolean);
      const shingles = new Set<string>();
      for (let i = 0; i <= words.length - n; i++) {
        shingles.add(words.slice(i, i + n).join(' '));
      }
      return shingles;
    };

    /**
     * Compute Jaccard similarity between two shingle sets.
     */
    const jaccard = (a: Set<string>, b: Set<string>): number => {
      let intersection = 0;
      a.forEach((shingle) => {
        if (b.has(shingle)) intersection++;
      });
      const union = a.size + b.size - intersection;
      return union === 0 ? 0 : intersection / union;
    };

    setTimeout(() => {
      const pageEl = pageRefs.current.get(pageNum);
      if (!pageEl) return;

      // Remove old highlights — never replace DOM nodes
      pageEl.querySelectorAll('.qa-text-highlight').forEach((el) => {
        el.classList.remove('qa-text-highlight');
      });

      const textLayer = pageEl.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) return;
      const spans = Array.from(textLayer.querySelectorAll('span'));
      const pageSources = sources.filter((s) => s.page === pageNum);
      if (pageSources.length === 0 || spans.length === 0) return;

      // Step 1: Build concatenated page text with offset-to-span mapping
      interface SpanRange { span: HTMLSpanElement; start: number; end: number; }
      const spanRanges: SpanRange[] = [];
      let concat = '';
      for (const span of spans) {
        const raw = span.textContent || '';
        if (!raw.trim()) continue;
        const start = concat.length;
        concat += raw + ' ';
        spanRanges.push({ span, start, end: concat.length });
      }

      const normalizedPage = normalize(concat);
      const pageWords = normalizedPage.split(' ').filter(Boolean);

      // For each source chunk, find its best matching region in the page
      for (const source of pageSources) {
        const normalizedSource = normalize(source.text);
        const sourceShingles = buildShingles(normalizedSource, 3);
        if (sourceShingles.size === 0) continue;

        // Sliding window: use a window roughly the size of the source text
        // (in word count), slide across the page words, find the best Jaccard
        const sourceWordCount = normalizedSource.split(' ').filter(Boolean).length;
        const windowSize = Math.min(sourceWordCount, pageWords.length);
        if (windowSize === 0) continue;

        let bestScore = 0;
        let bestStart = 0;
        let bestEnd = 0;

        // Build initial window
        for (let i = 0; i <= pageWords.length - windowSize; i++) {
          const windowText = pageWords.slice(i, i + windowSize).join(' ');
          const windowShingles = buildShingles(windowText, 3);
          const score = jaccard(sourceShingles, windowShingles);
          if (score > bestScore) {
            bestScore = score;
            // Map word index back to character index in normalizedPage
            const before = pageWords.slice(0, i).join(' ');
            bestStart = before.length > 0 ? before.length + 1 : 0;
            bestEnd = bestStart + windowText.length;
          }
        }

        // Threshold: only highlight if the match quality is reasonable
        if (bestScore < 0.08) continue;

        // Map character range in normalizedPage back to character range in
        // the original (un-normalized) concat string.
        // Since normalization preserves rough proportions, scale linearly.
        const ratio = concat.length / (normalizedPage.length || 1);
        const matchStartOrig = Math.floor(bestStart * ratio);
        const matchEndOrig = Math.ceil(bestEnd * ratio);

        // Highlight all spans that overlap with the matched region
        for (const sr of spanRanges) {
          if (sr.end > matchStartOrig && sr.start < matchEndOrig) {
            sr.span.classList.add('qa-text-highlight');
          }
        }
      }
    }, 300);
  }, []);

  const handleAsk = useCallback(async (overrideQuestion?: string, displayText?: string) => {
    const question = (overrideQuestion || input).trim();
    if (!question || loading) return;
    const userMsg: QAMessage = { role: 'user', content: displayText || question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const res = await apiJsonPost<QAResult>('/paper-qa', {
        question, arxiv_id: arxivId, pdf_url: pdfUrl, title, mode,
        chat_history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      if (res.success) {
        const sources = res.sources || [];
        const assistantMsg: QAMessage = { role: 'assistant', content: res.answer, sources };
        setMessages((prev) => [...prev, assistantMsg]);
        const pages = new Set(sources.map((s) => s.page));
        setHighlightPages(pages);
        setActiveSources(sources);
        if (sources.length > 0) {
          const firstPage = Math.min(...sources.map((s) => s.page));
          scrollToPage(firstPage);
          sources.forEach((s) => highlightTextInPage(s.page, sources));
        }
      } else { setError(res.answer || 'Failed to get answer.'); }
    } catch { setError('Connection error. Please try again.'); }
    finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [input, loading, arxivId, pdfUrl, title, messages, mode, scrollToPage, highlightTextInPage]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } };
  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => { setNumPages(n); setPdfError(''); };
  const onDocumentLoadError = () => { setPdfError('Failed to load PDF. The paper may not be available for viewing.'); };
  const onPageTextLoadSuccess = useCallback((pageNum: number) => {
    if (activeSources.length > 0) highlightTextInPage(pageNum, activeSources);
  }, [activeSources, highlightTextInPage]);

  const suggestions = [
    { label: 'Main contribution?', display: 'What is the main contribution of this paper?', q: 'What is the main contribution or novelty proposed in this paper? Summarize the key idea from the abstract and introduction.' },
    { label: 'Methods used?', display: 'What methods are used?', q: 'What methodology, models, or techniques does this paper propose or use? Describe the approach and architecture from the methods section.' },
    { label: 'Key results?', display: 'What are the key results?', q: 'What are the key experimental results, metrics, and performance numbers reported in this paper? Summarize the main findings from the results section.' },
    { label: 'Limitations?', display: 'What are the limitations of this work?', q: 'What limitations, weaknesses, or future work does this paper mention? Include any challenges or open problems discussed by the authors.' },
  ];

  return (
    <motion.div
      className="qa-split-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="qa-split-container">
        {/* ════ LEFT: PDF Viewer ════ */}
        <div className="qa-pdf-panel">
          <div className="qa-pdf-toolbar">
            <div className="qa-pdf-nav">
              <button className="qa-pdf-nav-btn" disabled={currentPage <= 1} onClick={() => scrollToPage(Math.max(1, currentPage - 1))} aria-label="Previous page">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="qa-pdf-page-info">
                Page <strong>{currentPage}</strong> of {numPages || '—'}
              </span>
              <button className="qa-pdf-nav-btn" disabled={currentPage >= numPages} onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))} aria-label="Next page">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            {highlightPages.size > 0 && (
              <div className="qa-pdf-source-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                {highlightPages.size} source page{highlightPages.size > 1 ? 's' : ''} highlighted
              </div>
            )}
          </div>

          <div className="qa-pdf-scroll" ref={pdfScrollRef}>
            {pdfError ? (
              <div className="qa-pdf-error">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <p>{pdfError}</p>
              </div>
            ) : (
              <Document
                file={pdfProxyUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<div className="qa-pdf-loading"><span className="spinner" /> Loading PDF...</div>}
              >
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <div
                    key={pageNum}
                    ref={(el) => { if (el) pageRefs.current.set(pageNum, el); }}
                    className={`qa-pdf-page-wrapper ${highlightPages.has(pageNum) ? 'qa-page-highlighted' : ''}`}
                    id={`qa-page-${pageNum}`}
                  >
                    {highlightPages.has(pageNum) && (
                      <div className="qa-page-source-badge">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Source &middot; Page {pageNum}
                      </div>
                    )}
                    <Page
                      pageNumber={pageNum}
                      width={550}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      onRenderSuccess={() => onPageTextLoadSuccess(pageNum)}
                    />
                  </div>
                ))}
              </Document>
            )}
          </div>
        </div>

        {/* ════ RIGHT: Chat Panel ════ */}
        <div className="qa-chat-panel">
          <div className="qa-chat-header">
            <div className="qa-chat-header-main">
              <div className="qa-chat-header-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="qa-chat-header-title">Ask Questions</h3>
                <p className="qa-chat-header-sub">AI-powered Q&A with source citations</p>
                <div className="qa-mode-toggle">
                  <button
                    className={`qa-mode-btn ${mode === 'concise' ? 'active' : ''}`}
                    onClick={() => setMode('concise')}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h6"/></svg>
                    Concise
                  </button>
                  <button
                    className={`qa-mode-btn ${mode === 'detailed' ? 'active' : ''}`}
                    onClick={() => setMode('detailed')}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
                    Detailed
                  </button>
                </div>
              </div>
            </div>
            <button className="qa-chat-close" onClick={onClose} aria-label="Close Q&A">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="qa-chat-area">
            {messages.length === 0 && !loading && (
              <div className="qa-empty">
                <div className="qa-empty-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <p className="qa-empty-title">Ask anything about this paper</p>
                <p className="qa-empty-subtitle">Get AI answers grounded in the paper content</p>
                <div className="qa-suggestions">
                  {suggestions.map((s, i) => (
                    <button key={i} className="qa-suggestion-chip" onClick={() => handleAsk(s.q, s.display)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  className={`qa-message qa-message-${msg.role}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="qa-message-avatar">
                    {msg.role === 'user' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    )}
                  </div>
                  <div className="qa-message-body">
                    <div className="qa-message-label">{msg.role === 'user' ? 'You' : 'AI Assistant'}</div>
                    <div className="qa-message-content">
                      {msg.role === 'assistant' ? (
                        <div className="qa-markdown"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                      ) : (
                        msg.content
                      )}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="qa-sources">
                        <div className="qa-sources-label">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          Sources ({msg.sources.length})
                        </div>
                        {msg.sources.map((src, j) => (
                          <button
                            key={j}
                            className="qa-source-chip"
                            onClick={() => {
                              setHighlightPages(new Set(msg.sources!.map((s) => s.page)));
                              setActiveSources(msg.sources!);
                              scrollToPage(src.page);
                              highlightTextInPage(src.page, msg.sources!);
                            }}
                          >
                            <span className="qa-source-page">p.{src.page}</span>
                            {src.score != null && <span className="qa-source-score">{Math.round(src.score * 100)}%</span>}
                            <span className="qa-source-snippet">{src.snippet}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                className="qa-message qa-message-assistant"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="qa-message-avatar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <div className="qa-message-body">
                  <div className="qa-message-label">AI Assistant</div>
                  <div className="qa-message-content">
                    <span className="qa-typing"><span className="qa-dot" /><span className="qa-dot" /><span className="qa-dot" /></span>
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <div className="qa-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            {embeddingsLoading && messages.length === 0 && (
              <motion.div
                className="qa-embedding-status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="spinner" style={{ width: 16, height: 16 }} />
                <span>Preparing paper for Q&A — indexing content...</span>
              </motion.div>
            )}

            {embeddingsReady && !embeddingsLoading && messages.length === 0 && !loading && (
              <motion.div
                className="qa-embedding-status ready"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Ready — ask your first question!</span>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="qa-input-area">
            <div className="qa-input-wrapper">
              <input
                ref={inputRef}
                className="qa-input"
                type="text"
                placeholder={embeddingsLoading ? 'Preparing paper...' : 'Ask a question about this paper...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || embeddingsLoading}
              />
              <button
                className="qa-send-btn"
                onClick={() => handleAsk()}
                disabled={!input.trim() || loading || !embeddingsReady}
                aria-label="Send question"
              >
                {loading ? (
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </div>
            <p className="qa-input-hint">Press Enter to send</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
