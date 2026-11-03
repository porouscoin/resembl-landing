/* Shared TypeScript interfaces */

export interface Paper {
  rank: number;
  title: string;
  similarity?: number;
  authors: string[];
  published: string;
  pdf_url: string;
  abstract: string;
  arxiv_id: string;
  arxiv_url?: string;
}

export interface ClusterData {
  cluster_id: number;
  size: number;
  similarity: number;
  is_assigned: boolean;
  topic_name: string;
}

export interface AnalysisResult {
  success: boolean;
  error?: string;
  paper_title: string;
  assigned_cluster: number;
  cluster_similarity: number;
  top_similar_papers: Paper[];
  wordclouds: Record<string, string>;
  total_clusters: number;
  authors: string[];
  published: string;
  cluster_data: ClusterData[];
  cluster_topics: Record<string, string>;
  arxiv_id: string | null;
  pdf_url: string | null;
}

export interface SearchResult {
  success?: boolean;
  error?: string;
  papers?: Paper[];
  total_results?: number;
  keywords?: string;
  search_info?: string;
  suggestions?: string[];
}

export interface StatusData {
  status: string;
  papers_loaded?: number;
  clusters?: number;
  cached_wordclouds?: number;
  message?: string;
}

export interface ProgressEvent {
  step: string;
  message: string;
  completed: boolean;
  heartbeat?: boolean;
  timeout_warning?: boolean;
  error?: string;
  progress?: number;
}

export interface SectionSummary {
  title: string;
  summary: string;
  index?: number;
}

export interface SummarizeResult {
  success: boolean;
  message?: string;
  sections?: SectionSummary[];
}

export interface QAMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: QASource[];
}

export interface QASource {
  text: string;
  page: number;
  snippet: string;
  score?: number;
}

export interface QAResult {
  success: boolean;
  answer: string;
  sources?: QASource[];
}

/* ── Multi-paper comparison Q&A ─────────────────────────────────── */

export interface MultiQASource extends QASource {
  paper_label: string;
  title: string;
  index: string;  // "A-1", "B-2", etc.
}

export interface MultiQAResult {
  success: boolean;
  answer: string;
  sources: MultiQASource[];
}

export interface MultiQAMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: MultiQASource[];
}
