'use client';

import type { ClusterData } from '@/lib/types';

interface Props {
  clusterData: ClusterData[];
  clusterTopics: Record<string, string>;
  wordclouds: Record<string, string>;
  assignedCluster: number;
  onWordcloudClick: (clusterId: string, base64: string) => void;
}

export default function ClusterPanel({ clusterData, clusterTopics, wordclouds, assignedCluster, onWordcloudClick }: Props) {
  const sorted = [...clusterData].sort((a, b) => b.similarity - a.similarity);

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {sorted.map((cluster) => (
          <div
            key={cluster.cluster_id}
            className="card"
            style={{
              borderColor: cluster.is_assigned ? 'var(--primary)' : undefined,
              borderWidth: cluster.is_assigned ? '2px' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
              <span className={`cluster-chip ${cluster.is_assigned ? 'assigned' : ''}`}>
                {cluster.is_assigned && <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1rem' }}>star</span>} Cluster {cluster.cluster_id}
              </span>
              <span className="similarity-badge">{(cluster.similarity * 100).toFixed(0)}%</span>
            </div>
            <h4 style={{ fontSize: '.95rem', fontWeight: 600, marginBottom: '.5rem' }}>
              {cluster.topic_name}
            </h4>
            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
              {cluster.size} papers
            </p>

            {/* Wordcloud */}
            {wordclouds[String(cluster.cluster_id)] && (
              <img
                className="wordcloud-img"
                src={`data:image/png;base64,${wordclouds[String(cluster.cluster_id)]}`}
                alt={`Wordcloud for ${cluster.topic_name}`}
                style={{ marginTop: '.75rem' }}
                onClick={() => onWordcloudClick(String(cluster.cluster_id), wordclouds[String(cluster.cluster_id)])}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
