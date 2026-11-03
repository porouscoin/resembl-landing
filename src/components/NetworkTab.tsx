'use client';

import { useState, useCallback } from 'react';
import type { ClusterData } from '@/lib/types';
import { apiJsonPost } from '@/lib/api';
import NetworkGraph from './NetworkGraph';

interface Props {
  clusterData: ClusterData[];
  paperTitle: string;
  clusterTopics: Record<string, string>;
  assignedCluster: number;
  wordclouds: Record<string, string>;
  onWordcloudsLoaded?: (wc: Record<string, string>) => void;
}

export default function NetworkTab({
  clusterData,
  paperTitle,
  clusterTopics,
  assignedCluster,
  wordclouds,
  onWordcloudsLoaded,
}: Props) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [localWordclouds, setLocalWordclouds] = useState(wordclouds);

  // Load remaining wordclouds in background
  const loadMore = useCallback(async () => {
    try {
      const res = await apiJsonPost<{ wordclouds: Record<string, string> }>('/load-wordclouds', {
        assigned_cluster: assignedCluster,
      });
      if (res.wordclouds) {
        setLocalWordclouds((prev) => ({ ...prev, ...res.wordclouds }));
        onWordcloudsLoaded?.(res.wordclouds);
      }
    } catch { /* ignore */ }
  }, [assignedCluster, onWordcloudsLoaded]);

  // Load wordclouds on first render
  useState(() => { loadMore(); });

  const handleClusterClick = (clusterId: string, _base64: string) => {
    setSelectedCluster((prev) => (prev === clusterId ? null : clusterId));
  };

  const sorted = [...clusterData].sort((a, b) => b.similarity - a.similarity);
  const selectedData = sorted.find((c) => String(c.cluster_id) === selectedCluster);
  const selectedTopic = selectedCluster
    ? clusterTopics[selectedCluster] || `Cluster ${selectedCluster}`
    : '';

  return (
    <div>
      {/* Network Graph */}
      <NetworkGraph
        clusterData={clusterData}
        paperTitle={paperTitle}
        clusterTopics={clusterTopics}
        assignedCluster={assignedCluster}
        wordclouds={localWordclouds}
        onWordcloudClick={handleClusterClick}
      />

      {/* Wordcloud display when a cluster is selected */}
      {selectedCluster && localWordclouds[selectedCluster] && (
        <div className="card" style={{ marginTop: '1rem', animation: 'fadeIn .25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <span className={`cluster-chip ${selectedData?.is_assigned ? 'assigned' : ''}`}>
                Cluster {selectedCluster}
              </span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                {selectedTopic}
              </h3>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: '.25rem .75rem', fontSize: '.8rem' }}
              onClick={() => setSelectedCluster(null)}
            >
              ✕ Close
            </button>
          </div>

          {selectedData && (
            <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap', fontSize: '.85rem' }}>
              <span className="similarity-badge">
                {(selectedData.similarity * 100).toFixed(0)}% similarity
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {selectedData.size} papers
              </span>
              {selectedData.is_assigned && (
                <span style={{ color: '#818cf8', fontWeight: 600 }}>★ Assigned cluster</span>
              )}
            </div>
          )}

          <img
            src={`data:image/png;base64,${localWordclouds[selectedCluster]}`}
            alt={`Wordcloud for ${selectedTopic}`}
            style={{
              width: '100%',
              maxWidth: '700px',
              borderRadius: 'var(--radius-sm)',
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>
      )}
    </div>
  );
}
