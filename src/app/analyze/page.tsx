'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressTracker from '@/components/ProgressTracker';
import AnalysisResults from '@/components/AnalysisResults';
import { apiFormPost } from '@/lib/api';
import type { AnalysisResult } from '@/lib/types';

function normalizeArxiv(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '')
    .replace(/\.pdf$/i, '')
    .replace(/v\d+$/i, '');
}

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawArxiv = searchParams.get('arxiv') || '';
  const rawPdf = searchParams.get('pdf') || '';
  const arxivId = normalizeArxiv(rawArxiv);
  const mode: 'arxiv' | 'pdf' = arxivId ? 'arxiv' : rawPdf ? 'pdf' : 'arxiv';

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const sessionId = useMemo(
    () => `analyze_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    [arxivId, rawPdf],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError('');
      setResult(null);

      if (!arxivId && !rawPdf) {
        setError('No paper was selected for analysis.');
        return;
      }

      setRunning(true);
      try {
        let res: (AnalysisResult & { error?: string }) | null = null;

        if (arxivId) {
          const paperUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
          res = await apiFormPost<AnalysisResult & { error?: string }>('/analyze', {
            paper_url: paperUrl,
            session_id: sessionId,
          });
        } else if (rawPdf) {
          const pdfResponse = await fetch(rawPdf);
          if (!pdfResponse.ok) {
            throw new Error('Could not load PDF file');
          }
          const blob = await pdfResponse.blob();
          const filename = decodeURIComponent(rawPdf.split('/').pop() || `library_${Date.now()}.pdf`);
          const pdfFile = new File([blob], filename, {
            type: blob.type || 'application/pdf',
          });

          res = await apiFormPost<AnalysisResult & { error?: string }>('/analyze-pdf', {
            pdf_file: pdfFile,
            session_id: sessionId,
          });
        }

        if (cancelled) return;

        if (!res || !res.success || res.error) {
          setError(res?.error || 'Analysis failed. Please try again.');
          return;
        }

        setResult(res);
      } catch {
        if (!cancelled) setError('Could not connect to the backend analysis service.');
      } finally {
        if (!cancelled) setRunning(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [arxivId, rawPdf, sessionId]);

  if (result) {
    return (
      <AnalysisResults
        result={result}
        onBack={() => router.push('/library')}
        onAnalyzePaper={(nextArxivId) => router.push(`/analyze?arxiv=${encodeURIComponent(nextArxivId)}`)}
      />
    );
  }

  return (
    <div>
      <button className="btn btn-secondary analyze-back-btn" onClick={() => router.push('/library')}>
        ← Back to Library
      </button>

      {(running || !error) && <ProgressTracker sessionId={sessionId} mode={mode} />}

      {error && (
        <div className="result-card analyze-error-card">
          <p className="analyze-error-text">{error}</p>
          <button className="btn btn-primary" onClick={() => router.push('/library')}>
            Go to Library
          </button>
        </div>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="dash-loading"><div className="dash-loading-spinner" /><span>Loading...</span></div>}>
        <AnalyzeContent />
      </Suspense>
    </DashboardLayout>
  );
}
