'use client';

import DashboardLayout, { useStatus } from '@/components/DashboardLayout';
import AnalysisTab from '@/components/AnalysisTab';

function SearchContent() {
  const status = useStatus();
  return <AnalysisTab status={status} showFuturisticBackground />;
}

export default function SearchPage() {
  return (
    <DashboardLayout>
      <SearchContent />
    </DashboardLayout>
  );
}
