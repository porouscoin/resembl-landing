'use client';

import { useEffect, useState } from 'react';
import { apiFormPost } from '@/lib/api';
import type { SearchResult } from '@/lib/types';

interface Props {
  disabled: boolean;
  onResult: (r: SearchResult) => void;
  onAnalyze: (url: string) => void;
  onKeywordsChange?: (value: string) => void;
}

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'cs.AI', label: 'cs.AI — Artificial Intelligence' },
  { value: 'cs.LG', label: 'cs.LG — Machine Learning' },
  { value: 'cs.CV', label: 'cs.CV — Computer Vision' },
  { value: 'cs.CL', label: 'cs.CL — Computation & Language (NLP)' },
  { value: 'cs.NE', label: 'cs.NE — Neural & Evolutionary Computing' },
  { value: 'cs.RO', label: 'cs.RO — Robotics' },
  { value: 'cs.IR', label: 'cs.IR — Information Retrieval' },
  { value: 'cs.SE', label: 'cs.SE — Software Engineering' },
  { value: 'stat.ML', label: 'stat.ML — Statistics / Machine Learning' },
  { value: 'eess.IV', label: 'eess.IV — Image & Video Processing' },
  { value: 'q-bio.QM', label: 'q-bio.QM — Quantitative Biology' },
];

const currentYear = new Date().getFullYear();

export default function KeywordSearch({ disabled, onResult, onKeywordsChange }: Props) {
  const [keywords, setKeywords] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [sortBy, setSortBy]     = useState('relevance');
  const [category, setCategory] = useState('');

  const activeFilterCount = [dateFrom, dateTo, sortBy !== 'relevance' ? '1' : '', category].filter(Boolean).length;

  useEffect(() => {
    onKeywordsChange?.(keywords);
  }, [keywords, onKeywordsChange]);

  const handleSearch = async () => {
    if (!keywords.trim()) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        keywords,
        max_results: String(maxResults),
        sort_by: sortBy,
        category,
      };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;

      const res = await apiFormPost<SearchResult>('/search-keywords', params);
      onResult(res);
    } catch (err: any) {
      console.error('Search error:', err);
      onResult({ error: 'Could not connect to the server. Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="keyword-search-root">
      {/* Search bar row */}
      <div className="search-bar-row">
        <input
          className="search-bar-input"
          placeholder="Search..."
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          disabled={disabled}
        />
        <button className="search-bar-btn" onClick={handleSearch} disabled={disabled || loading || !keywords.trim()}>
          {loading ? <span className="spinner" /> : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          )}
        </button>
      </div>

      {/* Filters + Results count row */}
      <div className="keyword-toolbar-row">
        <div className="keyword-results-wrap">
          <label className="keyword-field-label" htmlFor="keyword-max-results">Results</label>
          <input
            id="keyword-max-results"
            className="input"
            type="number" min={1} max={25}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            disabled={disabled}
            title="Maximum number of results"
          />
        </div>
        <button
          className="btn btn-secondary keyword-filter-toggle"
          onClick={() => setShowFilters((v) => !v)}
          disabled={disabled}
          title="Toggle filters"
        >
          <svg className={`keyword-filter-icon ${activeFilterCount > 0 ? 'has-count' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          {activeFilterCount > 0 && (
            <span className="keyword-filter-count">{activeFilterCount}</span>
          )}
          Filters
        </button>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="keyword-filter-panel">
          {/* Date from */}
          <div>
            <label className="keyword-field-label" htmlFor="keyword-date-from">Year from</label>
            <input
              id="keyword-date-from"
              className="input" type="number"
              min={1990} max={currentYear}
              placeholder="e.g. 2020"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={disabled}
              title="Filter papers from year"
            />
          </div>
          {/* Date to */}
          <div>
            <label className="keyword-field-label" htmlFor="keyword-date-to">Year to</label>
            <input
              id="keyword-date-to"
              className="input" type="number"
              min={1990} max={currentYear}
              placeholder={String(currentYear)}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={disabled}
              title="Filter papers to year"
            />
          </div>
          {/* Sort by */}
          <div>
            <label className="keyword-field-label" htmlFor="keyword-sort-by">Sort by</label>
            <select
              id="keyword-sort-by"
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              disabled={disabled}
              title="Sort search results"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Newest first</option>
            </select>
          </div>
          {/* Category */}
          <div className="keyword-category-field">
            <label className="keyword-field-label" htmlFor="keyword-category">Subject category</label>
            <select
              id="keyword-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={disabled}
              title="Filter by subject category"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <div className="keyword-clear-row">
              <button
                className="btn btn-ghost"
                title="Clear all filters"
                onClick={() => { setDateFrom(''); setDateTo(''); setSortBy('relevance'); setCategory(''); }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
