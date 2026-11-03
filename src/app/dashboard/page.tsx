'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import type { StatusData } from '@/lib/types';
import StatusBar from '@/components/StatusBar';
import AnalysisTab from '@/components/AnalysisTab';
import TrendsTab from '@/components/TrendsTab';
import CompareTab from '@/components/CompareTab';

function DashboardContent() {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const initialTab = rawTab === 'trends' ? 'trends' : rawTab === 'compare' ? 'compare' : 'analysis';

  const [activeTab, setActiveTab] = useState<'analysis' | 'trends' | 'compare'>(initialTab);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    apiFetch<StatusData>('/status')
      .then(setStatus)
      .catch(() => setStatus({ status: 'error', message: 'Backend unreachable' }));
  }, []);

  const statusDot = !status
    ? 'loading'
    : status.status === 'ready'
    ? 'ready'
    : status.status === 'error'
    ? 'error'
    : 'loading';

  const statusText = !status
    ? 'Connecting...'
    : status.status === 'ready'
    ? `${status.papers_loaded?.toLocaleString()} papers`
    : 'Offline';

  return (
    <div className="dash-layout">
      {/* ─── Mobile top bar ─── */}
      <div className="dash-mobile-bar">
        <Link href="/" className="sidebar-brand">
          <div className="sidebar-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>
          <span className="sidebar-brand-text">resembl</span>
        </Link>
        <button className="dash-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Close menu" : "Open menu"}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            ) : (
              <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
            )}
          </svg>
        </button>
      </div>

      {/* ─── Sidebar ─── */}
      <aside className={`dash-sidebar ${mobileOpen ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <Link href="/" className="sidebar-brand">
            <div className="sidebar-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </div>
            {!collapsed && <span className="sidebar-brand-text">resembl</span>}
          </Link>
        </div>

        {!collapsed && <div className="sidebar-section-label">Navigate</div>}

        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-btn ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analysis'); setMobileOpen(false); }}
            title="Paper Analysis"
          >
            <span className="sidebar-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </span>
            {!collapsed && <span className="sidebar-nav-text">Paper Analysis</span>}
            {activeTab === 'analysis' && (
              <motion.div
                className="sidebar-active-bg"
                layoutId="sidebarActive"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
          <button
            className={`sidebar-nav-btn ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => { setActiveTab('trends'); setMobileOpen(false); }}
            title="Research Trends"
          >
            <span className="sidebar-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </span>
            {!collapsed && <span className="sidebar-nav-text">Research Trends</span>}
            {activeTab === 'trends' && (
              <motion.div
                className="sidebar-active-bg"
                layoutId="sidebarActive"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
          <button
            className={`sidebar-nav-btn ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => { setActiveTab('compare'); setMobileOpen(false); }}
            title="Compare Papers"
          >
            <span className="sidebar-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="8" height="16" rx="1"/><rect x="14" y="4" width="8" height="16" rx="1"/>
                <path d="M10 10h4" /><path d="M10 14h4" />
              </svg>
            </span>
            {!collapsed && <span className="sidebar-nav-text">Compare Papers</span>}
            {activeTab === 'compare' && (
              <motion.div
                className="sidebar-active-bg"
                layoutId="sidebarActive"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className={`status-dot-sidebar ${statusDot}`} />
            {!collapsed && <span className="sidebar-status-text">{statusText}</span>}
          </div>
          <Link href="/" className="sidebar-home-link" title="Back to Home">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {!collapsed && <span>Back to Home</span>}
          </Link>
        </div>
      </aside>

      {/* Sidebar edge toggle */}
      <button
        className={`sidebar-edge-toggle ${collapsed ? 'collapsed' : ''}`}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d={collapsed ? 'M8 5l8 7-8 7z' : 'M16 5l-8 7 8 7z'} />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="dash-mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <StatusBar status={status} />

      {/* ─── Main Content ─── */}
      <main className={`dash-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="dash-main-bg" />
        <div className="dash-main-content">
          <AnimatePresence mode="wait">
            {activeTab === 'analysis' && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <AnalysisTab status={status} />
              </motion.div>
            )}
            {activeTab === 'trends' && (
              <motion.div
                key="trends"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <TrendsTab />
              </motion.div>
            )}
            {activeTab === 'compare' && (
              <motion.div
                key="compare"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <CompareTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="dash-layout">
          <div className="dash-loading">
            <div className="dash-loading-spinner" />
            <span>Loading dashboard...</span>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
