'use client';

export default function WordcloudModal({
  clusterId,
  base64,
  topicName,
  onClose,
}: {
  clusterId: string;
  base64: string;
  topicName: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">×</button>
        <h3 style={{ marginBottom: '1rem' }}>Cluster {clusterId} — {topicName}</h3>
        <img
          src={`data:image/png;base64,${base64}`}
          alt={`Wordcloud for ${topicName}`}
          style={{ width: '100%', borderRadius: 'var(--radius-sm)' }}
        />
      </div>
    </div>
  );
}
