'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { AnalysisResult, Paper } from '@/lib/types';
import { apiJsonPost } from '@/lib/api';
import PaperList from './PaperList';
import NetworkGraph from './NetworkGraph';
import PaperSimilarityGraph from './PaperSimilarityGraph';
import WordcloudModal from './WordcloudModal';

export default function AnalysisResults({
  result,
  onBack,
  onAnalyzePaper,
}: {
  result: AnalysisResult;
  onBack: () => void;
  onAnalyzePaper?: (arxivId: string) => void;
}) {
  const [activeSection, setActiveSection] = useState<'papers' | 'similarity' | 'graph'>('papers');
  const [wordcloudModal, setWordcloudModal] = useState<{ clusterId: string; base64: string } | null>(null);
  const [wordclouds, setWordclouds] = useState(result.wordclouds);

  // Background load remaining wordclouds
  const loadMore = useCallback(async () => {
    try {
      const res = await apiJsonPost<{ wordclouds: Record<string, string> }>('/load-wordclouds', {
        assigned_cluster: result.assigned_cluster,
      });
      if (res.wordclouds) {
        setWordclouds((prev) => ({ ...prev, ...res.wordclouds }));
      }
    } catch { /* ignore */ }
  }, [result.assigned_cluster]);

  return (
    <div className="analyze-results-root">
      {/* Back button */}
      <motion.button
        className="btn btn-secondary analyze-back-btn"
        onClick={onBack}
        style={{ marginBottom: '1.5rem' }}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ x: -3 }}
      >
        ← Back to Library
      </motion.button>

      {/* Paper Info */}
      <motion.div
        className="card analyze-results-main-card"
        style={{ marginBottom: '1.5rem' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '.5rem', lineHeight: 1.3 }}>{result.paper_title}</h2>
        <div className="paper-meta" style={{ marginBottom: '1rem' }}>
          {result.authors.join(', ')} · {result.published}
          {result.arxiv_id && (
            <>
              {' · '}
              <a href={`https://arxiv.org/abs/${result.arxiv_id}`} target="_blank" rel="noopener noreferrer">
                ArXiv: {result.arxiv_id}
              </a>
            </>
          )}
          {!result.arxiv_id && result.pdf_url && (
            <>
              {' · '}
              <a href={`${window.location.protocol}//${window.location.hostname}:8000${result.pdf_url}`} target="_blank" rel="noopener noreferrer">
                View PDF
              </a>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span className="cluster-chip assigned">
            {result.cluster_topics[String(result.assigned_cluster)] || `Cluster ${result.assigned_cluster}`}
          </span>
          <span className="similarity-badge">
            {(result.cluster_similarity * 100).toFixed(0)}% match
          </span>
          <span className="cluster-chip">
            {result.top_similar_papers.length} similar papers
          </span>
        </div>
      </motion.div>

      {/* Section Navigation */}
      <motion.div
        className="section-nav"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <button className={`section-nav-btn ${activeSection === 'papers' ? 'active' : ''}`} onClick={() => setActiveSection('papers')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Similar Papers</span>
        </button>
        <button className={`section-nav-btn ${activeSection === 'similarity' ? 'active' : ''}`} onClick={() => setActiveSection('similarity')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>
          <span>Similarity Graph</span>
        </button>
        <button className={`section-nav-btn ${activeSection === 'graph' ? 'active' : ''}`} onClick={() => { setActiveSection('graph'); loadMore(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span>Network</span>
        </button>
      </motion.div>

      {/* Content */}
      {activeSection === 'papers' && (
        <PaperList
          papers={result.top_similar_papers}
        />
      )}
      {activeSection === 'similarity' && (
        <PaperSimilarityGraph
          papers={result.top_similar_papers}
          centralTitle={result.paper_title}
          centralAuthors={result.authors}
          centralPublished={result.published}
          centralPdfUrl={result.pdf_url}
          centralArxivId={result.arxiv_id}
        />
      )}
      {activeSection === 'graph' && (
        <NetworkGraph
          clusterData={result.cluster_data}
          paperTitle={result.paper_title}
          clusterTopics={result.cluster_topics}
          assignedCluster={result.assigned_cluster}
          wordclouds={wordclouds}
          onWordcloudClick={(cid, b64) => setWordcloudModal({ clusterId: cid, base64: b64 })}
        />
      )}
      {/* Wordcloud Modal */}
      {wordcloudModal && (
        <WordcloudModal
          clusterId={wordcloudModal.clusterId}
          base64={wordcloudModal.base64}
          topicName={result.cluster_topics[wordcloudModal.clusterId] || `Cluster ${wordcloudModal.clusterId}`}
          onClose={() => setWordcloudModal(null)}
        />
      )}
    </div>
  );
}
