'use client';

import DashboardLayout from '@/components/DashboardLayout';
import CompareFromLibrary from '@/components/CompareFromLibrary';
import FuturisticHomeBackground from '@/components/FuturisticHomeBackground';

export default function ComparePage() {
  return (
    <DashboardLayout>
      <div className="futuristic-page-shell">
        <div className="futuristic-bg-layer" aria-hidden="true">
          <FuturisticHomeBackground />
        </div>
        <CompareFromLibrary />
      </div>
    </DashboardLayout>
  );
}
