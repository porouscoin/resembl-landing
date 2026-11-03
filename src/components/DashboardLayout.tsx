'use client';

import { Suspense, useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import type { StatusData } from '@/lib/types';
import DashboardShell from '@/components/DashboardShell';

const StatusContext = createContext<StatusData | null>(null);
export const useStatus = () => useContext(StatusContext);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    apiFetch<StatusData>('/status')
      .then(setStatus)
      .catch(() => setStatus({ status: 'error', message: 'Backend unreachable' }));
  }, []);

  return (
    <StatusContext.Provider value={status}>
      <Suspense fallback={<div className="dash-loading"><div className="dash-loading-spinner" /><span>Loading...</span></div>}>
        <DashboardShell status={status}>
          {children}
        </DashboardShell>
      </Suspense>
    </StatusContext.Provider>
  );
}
