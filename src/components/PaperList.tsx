'use client';

import { useState } from 'react';
import { useLibrary } from '@/lib/LibraryContext';
import type { Paper } from '@/lib/types';

const PAGE_SIZE = 10;

interface Props {
  papers: Paper[];
}

export default function PaperList({ papers }: Props) {
  const { addPaper, isInLibrary } = useLibrary();
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(papers.length / PAGE_SIZE);
  const visible = papers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
        <h3 className="results-list-heading" style={{ margin: 0 }}>Similar Papers ({papers.length})</h3>
      </div>

      <div className="results-list">
      {visible.map((paper) => (
        <div key={paper.rank} className="result-card">
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
            {(paper.arxiv_id || paper.pdf_url) && (
              <button
                className={`corner-btn ${(isInLibrary(paper.arxiv_id || paper.pdf_url || '') || isInLibrary(paper.title)) ? 'corner-btn-done' : ''}`}
                onClick={() => {
                  if (paper.arxiv_id || paper.pdf_url) {
                    const key = paper.arxiv_id || paper.pdf_url;
                    if (key && !isInLibrary(key) && !isInLibrary(paper.title)) addPaper(paper);
                  }
                }}
                aria-label={(isInLibrary(paper.arxiv_id || paper.pdf_url || '') || isInLibrary(paper.title)) ? 'In Library' : 'Add to Library'}
                data-tooltip={(isInLibrary(paper.arxiv_id || paper.pdf_url || '') || isInLibrary(paper.title)) ? 'In Library' : 'Add to Library'}
              >
                {(isInLibrary(paper.arxiv_id || paper.pdf_url || '') || isInLibrary(paper.title)) ? (
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
          <div className="result-card-title">
            <span style={{ color: 'var(--text-light)', marginRight: '.5rem', fontWeight: 400 }}>#{paper.rank}</span>
            {paper.title}
          </div>
          <div className="result-card-meta">
            {paper.authors.join(', ')} · {paper.published}
            {paper.similarity !== undefined ? ` · ${(paper.similarity * 100).toFixed(0)}% match` : ''}
          </div>
          <p className="result-card-abstract">{paper.abstract}</p>
        </div>
      ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={() => setPage(0)} disabled={page === 0}>«</button>
          <button className="page-btn" onClick={() => setPage(page - 1)} disabled={page === 0}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} className={`page-btn ${i === page ? 'active' : ''}`} onClick={() => setPage(i)}>
              {i + 1}
            </button>
          )).slice(Math.max(0, page - 2), page + 3)}
          <button className="page-btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>›</button>
          <button className="page-btn" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
        </div>
      )}
    </div>
  );
}
