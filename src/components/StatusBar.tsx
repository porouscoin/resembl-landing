'use client';

import type { StatusData } from '@/lib/types';

export default function StatusBar({ status }: { status: StatusData | null }) {
  if (!status) {
    return (
      <div className="status-bar">
        <span className="status-dot loading" />
        <span>Connecting to backend...</span>
      </div>
    );
  }

  if (status.status === 'ready') {
    return (
      <div className="status-bar">
        <span className="status-dot ready" />
        <span>
          System Ready — {status.papers_loaded} papers loaded, {status.clusters} clusters
        </span>
      </div>
    );
  }

  if (status.status === 'error') {
    return (
      <div className="status-bar">
        <span className="status-dot error" />
        <span>Error: {status.message || 'Could not reach backend'}</span>
      </div>
    );
  }

  return (
    <div className="status-bar">
      <span className="status-dot loading" />
      <span>Loading data...</span>
    </div>
  );
}
