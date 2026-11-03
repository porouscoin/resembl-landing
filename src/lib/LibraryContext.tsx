'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Paper } from './types';

export interface LibraryPaper extends Paper {
  addedAt: number; // timestamp
}

interface LibraryContextType {
  papers: LibraryPaper[];
  addPaper: (paper: Paper) => void;
  removePaper: (id: string) => void;
  isInLibrary: (id: string) => boolean;
}

const LibraryContext = createContext<LibraryContextType>({
  papers: [],
  addPaper: () => {},
  removePaper: () => {},
  isInLibrary: () => false,
});

export const useLibrary = () => useContext(LibraryContext);

const STORAGE_KEY = 'resembl_library';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [papers, setPapers] = useState<LibraryPaper[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPapers(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
    } catch { /* ignore */ }
  }, [papers]);

  const addPaper = useCallback((paper: Paper) => {
    const key = paper.arxiv_id || paper.pdf_url;
    if (!key) return;
    setPapers((prev) => {
      if (prev.some((p) => (p.arxiv_id || p.pdf_url) === key)) return prev;
      // Also check by title (case-insensitive) to prevent duplicate uploaded papers
      const titleLower = paper.title?.toLowerCase();
      if (titleLower && prev.some((p) => p.title?.toLowerCase() === titleLower)) return prev;
      return [...prev, { ...paper, addedAt: Date.now() }];
    });
  }, []);

  const removePaper = useCallback((id: string) => {
    setPapers((prev) => prev.filter((p) => (p.arxiv_id || p.pdf_url) !== id));
  }, []);

  const isInLibrary = useCallback(
    (id: string) => {
      const idLower = id.toLowerCase();
      return papers.some((p) => (p.arxiv_id || p.pdf_url) === id || p.title?.toLowerCase() === idLower);
    },
    [papers],
  );

  return (
    <LibraryContext.Provider value={{ papers, addPaper, removePaper, isInLibrary }}>
      {children}
    </LibraryContext.Provider>
  );
}
