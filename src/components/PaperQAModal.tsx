'use client';

import dynamic from 'next/dynamic';

interface Props {
  arxivId: string | null;
  pdfUrl: string | null;
  title: string;
  onClose: () => void;
}

// Lazy-load the actual implementation to avoid SSR issues with react-pdf
const PaperQAModalInner = dynamic(() => import('./PaperQAModalInner'), { ssr: false });

export default function PaperQAModal(props: Props) {
  return <PaperQAModalInner {...props} />;
}
