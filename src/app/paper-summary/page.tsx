'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import FuturisticHomeBackground from '@/components/FuturisticHomeBackground';
import SummaryPanel from '@/components/SummaryPanel';

function PaperSummaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const arxivId = searchParams.get('arxiv') || null;
  const pdfUrl = searchParams.get('pdf') || null;
  const title = useMemo(() => {
    const raw = searchParams.get('title');
    if (raw && raw.trim()) return raw;
    if (arxivId) return arxivId;
    if (pdfUrl) return decodeURIComponent(pdfUrl.split('/').pop() || 'Paper Summary');
    return 'Paper Summary';
  }, [searchParams, arxivId, pdfUrl]);

  if (!arxivId && !pdfUrl) {
    return (
      <div>
        <button className="btn btn-secondary analyze-back-btn" onClick={() => router.push('/library')}>
          ← Back to Library
        </button>
        <div className="result-card analyze-error-card">
          <p className="analyze-error-text">No paper selected for summarization.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-secondary analyze-back-btn" onClick={() => router.push('/library')}>
        ← Back to Library
      </button>
      <SummaryPanel arxivId={arxivId} pdfUrl={pdfUrl} title={title} autoStart />
    </div>
  );
}

export default function PaperSummaryPage() {
  return (
    <DashboardLayout>
      <div className="futuristic-page-shell">
        <div className="futuristic-bg-layer" aria-hidden="true">
          <FuturisticHomeBackground />
        </div>
        <Suspense fallback={<div className="dash-loading"><div className="dash-loading-spinner" /><span>Loading...</span></div>}>
          <PaperSummaryContent />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
