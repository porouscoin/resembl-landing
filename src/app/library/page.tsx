'use client';

import DashboardLayout from '@/components/DashboardLayout';
import LibraryTab from '@/components/LibraryTab';
import FuturisticHomeBackground from '@/components/FuturisticHomeBackground';

export default function LibraryPage() {
  return (
    <DashboardLayout>
      <div className="futuristic-page-shell">
        <div className="futuristic-bg-layer" aria-hidden="true">
          <FuturisticHomeBackground />
        </div>
        <LibraryTab />
      </div>
    </DashboardLayout>
  );
}
