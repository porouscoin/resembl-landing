'use client';

import { useState } from 'react';
import { apiFormPost } from '@/lib/api';
import type { SearchResult } from '@/lib/types';

interface Props {
  disabled: boolean;
  onResult: (r: SearchResult) => void;
}

interface ParsedParams {
  keywords?: string;
  date_from?: number | null;
  date_to?: number | null;
  sort_by?: string;
}

export default function QuerySearch({ disabled, onResult }: Props) {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedParams | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setParsed(null);
    try {
      const res = await apiFormPost<SearchResult & { parsed?: ParsedParams }>('/search-query', {
        query: query.trim(),
        max_results: String(maxResults),
      });
      if (res.parsed) setParsed(res.parsed);
      onResult(res);
    } catch (err: any) {
      console.error('Query search error:', err);
      onResult({ error: 'Could not connect to the server. Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="query-search-root">
      {/* Search row + results + action */}
      <div className="query-search-controls-row">
        <div className="query-search-bar-wrap">
          <div className="search-bar-row query-search-bar-row">
            <input
              id="query-search-text"
              className="search-bar-input query-search-input"
              placeholder="e.g., I want papers about transformer models for medical imaging, published after 2021"
              aria-label="AI query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={disabled || loading}
            />
            <button
              className="search-bar-btn"
              onClick={handleSearch}
              disabled={disabled || loading || !query.trim()}
              aria-label="Search with AI query"
            >
              {loading ? <span className="spinner" /> : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="query-results-box">
          <label className="query-field-label" htmlFor="query-max-results">
            Results
          </label>
          <input
            id="query-max-results"
            className="input query-results-input"
            type="number"
            min={1}
            max={100}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            disabled={disabled || loading}
          />
        </div>
      </div>

      {/* Parsed parameters chip row */}
      {parsed && !loading && (
        <div className="query-parsed-row">
          <span className="query-parsed-label">Interpreted as:</span>
          {parsed.keywords && (
            <span className="query-parsed-chip query-parsed-chip-keyword">🔑 {parsed.keywords}</span>
          )}
          {(parsed.date_from || parsed.date_to) && (
            <span className="query-parsed-chip query-parsed-chip-date">
              📅 {parsed.date_from ?? '…'} – {parsed.date_to ?? 'present'}
            </span>
          )}
          {parsed.sort_by && (
            <span className="query-parsed-chip query-parsed-chip-sort">
              {parsed.sort_by === 'date' ? '🕒 sorted by date' : '⭐ sorted by relevance'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
