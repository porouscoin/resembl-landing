'use client';

import { useState } from 'react';
import { apiFormPost } from '@/lib/api';
import type { SearchResult } from '@/lib/types';

interface Props {
  disabled: boolean;
  onResult: (result: SearchResult) => void;
}

export default function ArxivAnalyze({ disabled, onResult }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    try {
      const res = await apiFormPost<SearchResult>('/arxiv-info', { paper_url: url });
      onResult(res);
    } catch (err: any) {
      console.error('Lookup error:', err);
      onResult({ error: 'Could not connect to the server. Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="arxiv-search-root">
      <div className="arxiv-search-row">
        <div className="search-bar-row arxiv-search-bar-row">
          <input
            className="search-bar-input arxiv-search-input"
            placeholder="e.g., 2301.00001 or https://arxiv.org/abs/2301.00001"
            aria-label="ArXiv URL or ID"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            disabled={disabled || loading}
          />
          <button
            className="search-bar-btn arxiv-submit-btn"
            onClick={handleLookup}
            disabled={disabled || !url.trim() || loading}
            aria-label="Look up ArXiv paper"
          >
            {loading ? <span className="spinner" /> : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
