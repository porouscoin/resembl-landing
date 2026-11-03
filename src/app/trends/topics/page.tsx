'use client';

import DashboardLayout from '@/components/DashboardLayout';
import TrendsTab from '@/components/TrendsTab';
import FuturisticHomeBackground from '@/components/FuturisticHomeBackground';

export default function TrendsTopicsPage() {
  return (
    <DashboardLayout>
      <div className="futuristic-page-shell">
        <div className="futuristic-bg-layer" aria-hidden="true">
          <FuturisticHomeBackground />
        </div>
        <TrendsTab view="trends" />
      </div>
    </DashboardLayout>
  );
}
