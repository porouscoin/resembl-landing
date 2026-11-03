'use client';

import { useState } from 'react';
import { apiJsonPost } from '@/lib/api';
import type { SearchResult } from '@/lib/types';

interface Props {
  disabled: boolean;
  onResult: (r: SearchResult) => void;
}

export default function SemanticSearch({ disabled, onResult }: Props) {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await apiJsonPost<SearchResult>('/semantic-search', {
        query: query.trim(),
        max_results: maxResults,
      });
      onResult(res);
    } catch (err: any) {
      onResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '.75rem' }}>
        <label
          style={{
            display: 'block',
            fontSize: '.85rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            marginBottom: '.5rem',
          }}
        >
          Describe what you're looking for in plain English
        </label>
        <textarea
          className="input"
          placeholder="e.g., papers about using graph neural networks for drug discovery"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSearch();
            }
          }}
          disabled={disabled || loading}
          rows={2}
          style={{ resize: 'vertical', minHeight: '3rem' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-end' }}>
        <div style={{ width: '100px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '.85rem',
              fontWeight: 500,
              color: 'var(--text-muted)',
              marginBottom: '.5rem',
            }}
          >
            Results
          </label>
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            disabled={disabled || loading}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={disabled || loading || !query.trim()}
        >
          {loading ? <span className="spinner" /> : 'Search'}
        </button>
      </div>

      <p
        style={{
          fontSize: '.78rem',
          color: 'var(--text-muted)',
          marginTop: '.5rem',
          lineHeight: 1.4,
        }}
      >
        Searches across your loaded paper corpus using semantic similarity.
      </p>
    </div>
  );
}
