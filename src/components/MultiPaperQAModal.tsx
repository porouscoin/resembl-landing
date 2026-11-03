'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { apiJsonPost } from '@/lib/api';
import type { Paper, MultiQAMessage, MultiQASource, MultiQAResult } from '@/lib/types';

interface Props {
  papers: Paper[];          // pool of papers to choose from
  onClose: () => void;
}

type PrepStatus = 'idle' | 'processing' | 'ready' | 'error';

const COLOR_A = '#4f8ef7';
const COLOR_B = '#f7a24f';

export default function MultiPaperQAModal({ papers, onClose }: Props) {
  /* ── selection state ────────────────────────────────────────────── */
  const [paperA, setPaperA] = useState<Paper | null>(null);
  const [paperB, setPaperB] = useState<Paper | null>(null);
  const [picking, setPicking] = useState<'A' | 'B' | null>(null);
  const [search, setSearch] = useState('');

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

  const filtered = papers.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.authors.join(' ').toLowerCase().includes(search.toLowerCase()),
  );

  const bothReady = statusA === 'ready' && statusB === 'ready';

  /* ── scroll on new messages ─────────────────────────────────────── */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── prepare embeddings whenever selection changes ──────────────── */
  useEffect(() => {
    if (!paperA || !paperB) return;

    const refs = {
      paper_a: { arxiv_id: paperA.arxiv_id || null, pdf_url: paperA.pdf_url || null, title: paperA.title },
      paper_b: { arxiv_id: paperB.arxiv_id || null, pdf_url: paperB.pdf_url || null, title: paperB.title },
      question: '',  // dummy, not used for prepare (we reuse the multi endpoint model)
    };

    const startPrep = async () => {
      try {
        const res = await apiJsonPost<{ statuses: Record<string, string> }>(
          '/paper-qa/multi/prepare', refs,
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
      // find which ref this is
      const ref = [paperA, paperB].find((p) => p && (p.arxiv_id || p.pdf_url) === paperKey);
      if (!ref) return;
      const otherRef = ref === paperA ? paperB : paperA;
      try {
        const res = await apiJsonPost<{ statuses: Record<string, string> }>(
          '/paper-qa/multi/prepare',
          {
            paper_a: { arxiv_id: ref.arxiv_id || null, pdf_url: ref.pdf_url || null, title: ref.title },
            paper_b: { arxiv_id: (otherRef?.arxiv_id) || null, pdf_url: (otherRef?.pdf_url) || null, title: otherRef?.title || '' },
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

  /* ── ask ────────────────────────────────────────────────────────── */
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

  /* ── preset questions ───────────────────────────────────────────── */
  const presets = [
    { label: 'Compare methodology', q: 'Compare the methodology and approach used in these two papers.' },
    { label: 'Compare results', q: 'Compare the results and performance reported in these two papers.' },
    { label: 'Key differences', q: 'What are the key differences between these two papers?' },
    { label: 'Limitations', q: 'What are the limitations discussed in each paper?' },
  ];

  /* ── helpers ────────────────────────────────────────────────────── */
  const selectPaper = (paper: Paper) => {
    if (picking === 'A') { setPaperA(paper); setStatusA('idle'); }
    if (picking === 'B') { setPaperB(paper); setStatusB('idle'); }
    setPicking(null);
    setSearch('');
    setMessages([]);
  };

  const statusDot = (s: PrepStatus) => ({
    width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block',
    background: s === 'ready' ? '#4fd18e' : s === 'error' ? '#f74f4f' : s === 'processing' ? '#f7a24f' : 'var(--border)',
  });

  const statusText = (s: PrepStatus) =>
    s === 'ready' ? 'Ready' : s === 'processing' ? 'Preparing…' : s === 'error' ? 'Error' : 'Not selected';

  /* ── render ─────────────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column' }}
    >
      {/* ── top bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', height: '52px', flexShrink: 0, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>Compare Papers</span>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', padding: '.35rem .75rem', cursor: 'pointer', fontSize: '.82rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Close
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT panel: paper selector ──────────────────────────── */}
        <div style={{ width: '310px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Slots */}
          <div style={{ padding: '.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', margin: 0 }}>Select two papers to compare</p>

            {/* Paper A slot */}
            <div
              onClick={() => setPicking('A')}
              style={{
                display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .7rem', borderRadius: '8px', cursor: 'pointer',
                border: picking === 'A' ? `2px solid ${COLOR_A}` : `1px solid var(--border)`,
                background: picking === 'A' ? `${COLOR_A}10` : 'var(--bg)',
                transition: 'all .15s',
              }}
            >
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: COLOR_A, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.75rem', color: '#fff', flexShrink: 0 }}>A</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {paperA
                  ? <span style={{ fontSize: '.8rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{paperA.title}</span>
                  : <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Click to select Paper A</span>
                }
              </div>
              {paperA && <span style={statusDot(statusA)} title={statusText(statusA)} />}
            </div>

            {/* Paper B slot */}
            <div
              onClick={() => setPicking('B')}
              style={{
                display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .7rem', borderRadius: '8px', cursor: 'pointer',
                border: picking === 'B' ? `2px solid ${COLOR_B}` : `1px solid var(--border)`,
                background: picking === 'B' ? `${COLOR_B}10` : 'var(--bg)',
                transition: 'all .15s',
              }}
            >
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: COLOR_B, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.75rem', color: '#fff', flexShrink: 0 }}>B</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {paperB
                  ? <span style={{ fontSize: '.8rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{paperB.title}</span>
                  : <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Click to select Paper B</span>
                }
              </div>
              {paperB && <span style={statusDot(statusB)} title={statusText(statusB)} />}
            </div>
          </div>

          {/* Search + paper list (visible only while picking) */}
          {picking && (
            <>
              <div style={{ padding: '.5rem 1rem', borderBottom: '1px solid var(--border)' }}>
                <input
                  type="text" placeholder="Search papers…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '.4rem .6rem', fontSize: '.82rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '.25rem 0' }}>
                {filtered.map((paper) => {
                  const isA = paperA?.rank === paper.rank;
                  const isB = paperB?.rank === paper.rank;
                  return (
                    <div
                      key={paper.rank}
                      onClick={() => selectPaper(paper)}
                      style={{
                        padding: '.55rem 1rem', cursor: 'pointer',
                        background: isA || isB ? 'var(--bg)' : 'transparent',
                        borderLeft: isA ? `3px solid ${COLOR_A}` : isB ? `3px solid ${COLOR_B}` : '3px solid transparent',
                        transition: 'background .12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isA || isB ? 'var(--bg)' : 'transparent')}
                    >
                      <div style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1.35 }}>
                        {isA && <span style={{ color: COLOR_A, fontWeight: 700, marginRight: '.3rem' }}>A</span>}
                        {isB && <span style={{ color: COLOR_B, fontWeight: 700, marginRight: '.3rem' }}>B</span>}
                        {paper.title}
                      </div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>
                        {paper.authors.slice(0, 2).join(', ')}{paper.authors.length > 2 ? ' et al.' : ''} · {paper.published}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && <p style={{ padding: '1rem', fontSize: '.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>No papers match.</p>}
              </div>
            </>
          )}

          {/* Status summary when not picking */}
          {!picking && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!paperA || !paperB ? (
                <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  Click the slots above to pick two papers.
                </p>
              ) : !bothReady ? (
                <p style={{ fontSize: '.82rem', color: '#f7a24f', textAlign: 'center', padding: '1rem' }}>
                  ⏳ Preparing paper embeddings…
                </p>
              ) : (
                <p style={{ fontSize: '.82rem', color: '#4fd18e', textAlign: 'center', padding: '1rem' }}>
                  ✓ Both papers ready
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT panel: chat ───────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
          {/* Presets */}
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', padding: '.65rem 1.25rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setInput(p.q)}
                style={{
                  fontSize: '.75rem', padding: '.25rem .6rem', borderRadius: '20px',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer', transition: 'border-color .15s, color .15s',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--accent)'; (e.target as HTMLElement).style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '.75rem', color: 'var(--text-muted)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .35 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p style={{ fontSize: '.88rem' }}>Select two papers and ask a question to compare them.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.5rem' }}>
                    <div style={{ maxWidth: '70%', background: 'var(--accent)', color: '#fff', padding: '.55rem .9rem', borderRadius: '12px 12px 2px 12px', fontSize: '.88rem', lineHeight: 1.5 }}>
                      {msg.content}
                    </div>
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '.85rem 1rem', fontSize: '.85rem', color: 'var(--text)', lineHeight: 1.7 }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>

                    {msg.sources && msg.sources.length > 0 && (
                      <details style={{ marginTop: '.75rem' }}>
                        <summary style={{ fontSize: '.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          {msg.sources.length} source excerpt{msg.sources.length !== 1 ? 's' : ''}
                        </summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginTop: '.5rem' }}>
                          {msg.sources.map((s: MultiQASource, si: number) => (
                            <div key={si} style={{
                              fontSize: '.75rem', color: 'var(--text-muted)', background: 'var(--bg)',
                              borderRadius: '6px', padding: '.4rem .6rem',
                              borderLeft: `3px solid ${s.paper_label === 'A' ? COLOR_A : COLOR_B}`,
                            }}>
                              <span style={{ fontWeight: 600, color: 'var(--text)' }}>[{s.index}] p.{s.page}</span>{' '}
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
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '.75rem 1rem', fontSize: '.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <span style={{ display: 'flex', gap: '4px' }}>
                    {[0, 1, 2].map((d) => (
                      <span key={d} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${d * 0.2}s` }} />
                    ))}
                  </span>
                  Comparing papers…
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: '#f74f4f18', border: '1px solid #f74f4f40', borderRadius: '8px', padding: '.6rem .9rem', fontSize: '.82rem', color: '#f74f4f' }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '.75rem 1.25rem', background: 'var(--card-bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: '.6rem', alignItems: 'center' }}>
            <input
              ref={inputRef} type="text"
              placeholder={!paperA || !paperB ? 'Select two papers first…' : !bothReady ? 'Waiting for papers to be ready…' : 'Ask something to compare these papers…'}
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              disabled={!bothReady || loading}
              style={{ flex: 1, padding: '.55rem .85rem', fontSize: '.88rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', outline: 'none', opacity: bothReady ? 1 : 0.5, transition: 'border-color .15s' }}
            />
            <button
              onClick={handleAsk}
              disabled={!bothReady || loading || !input.trim()}
              style={{
                padding: '.55rem 1.1rem', borderRadius: '8px', border: 'none',
                background: bothReady && input.trim() && !loading ? 'var(--accent)' : 'var(--border)',
                color: bothReady && input.trim() && !loading ? '#fff' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '.88rem', cursor: bothReady && !loading ? 'pointer' : 'not-allowed',
                transition: 'all .15s', flexShrink: 0,
              }}
            >
              {loading ? '…' : 'Ask'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
