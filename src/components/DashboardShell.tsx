'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import type { StatusData } from '@/lib/types';
import StatusBar from './StatusBar';

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/search',
    label: 'Home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/library',
    label: 'Library',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    href: '/compare',
    label: 'Compare',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="8" height="16" rx="1"/><rect x="14" y="4" width="8" height="16" rx="1"/>
        <path d="M10 10h4" /><path d="M10 14h4" />
      </svg>
    ),
  },
];

const TRENDS_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const TRENDS_SUB_ITEMS = [
  {
    href: '/trends/topics',
    label: 'Topics',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>
      </svg>
    ),
  },
  {
    href: '/trends/papers',
    label: 'Papers',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    href: '/trends/venues',
    label: 'Venues',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
];

interface Props {
  children: ReactNode;
  status: StatusData | null;
}

export default function DashboardShell({ children, status }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(searchParams.get('nav') === 'open');
  const [trendsOpen, setTrendsOpen] = useState(false);

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

  const activeHref = NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.href ?? '/search';
  const onTrends = pathname.startsWith('/trends');

  return (
    <div className="dash-layout">
      {/* Mobile top bar */}
      <div className="dash-mobile-bar">
        <Link href="/" className="sidebar-brand">
          <div className="sidebar-logo-icon">
            <Image src="/resembl.png" alt="resembl logo" width={46} height={46} className="sidebar-logo-img" />
          </div>
          <span className="sidebar-brand-text">resembl</span>
        </Link>
        <button className="dash-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            ) : (
              <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar — hover to expand */}
      <aside
        className={`dash-sidebar ${mobileOpen ? 'mobile-open' : ''} ${sidebarOpen ? 'open' : ''}`}
        onMouseEnter={() => setSidebarOpen(true)}
      >
        {/* Brand */}
        <div className="sidebar-header">
          <Link href="/" className="sidebar-brand" onClick={() => setMobileOpen(false)}>
            <div className="sidebar-logo-icon">
              <Image src="/resembl.png" alt="resembl logo" width={46} height={46} className="sidebar-logo-img" />
            </div>
            <span className="sidebar-brand-text">resembl</span>
          </Link>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 19l-7-7 7-7"/>
              <path d="M18 19l-7-7 7-7"/>
            </svg>
          </button>
        </div>

        <div className="sidebar-section-label">Navigate</div>

        {/* Nav items */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.slice(0, 2).map((item) => {
            const isActive = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                title={item.label}
                onClick={() => setMobileOpen(false)}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-text">{item.label}</span>
                {isActive && (
                  <motion.div
                    className="sidebar-active-bg"
                    layoutId="sidebarActive"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {/* Trends group with sub-items */}
          <div className={`sidebar-trends-group ${trendsOpen ? 'open' : ''}`}>
            <button
              type="button"
              className={`sidebar-nav-btn ${onTrends ? 'active' : ''}`}
              title="Trends"
              onClick={() => {
                setTrendsOpen((current) => !current);
                setMobileOpen(false);
                setSidebarOpen(true);
              }}
            >
              <span className="sidebar-nav-icon">{TRENDS_ICON}</span>
              <span className="sidebar-nav-text">Trends</span>
              <motion.span
                className="sidebar-nav-text sidebar-trends-chevron"
                animate={{ rotate: trendsOpen ? 180 : 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </motion.span>
              {onTrends && (
                <motion.div
                  className="sidebar-active-bg"
                  layoutId="sidebarActive"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
            <div className="sidebar-sub-nav">
              <div className="sidebar-sub-nav-inner">
                <div className="sidebar-sub-cards">
                  {TRENDS_SUB_ITEMS.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`sidebar-sub-btn ${pathname.startsWith(sub.href) ? 'active' : ''}`}
                      title={sub.label}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="sidebar-sub-icon">{sub.icon}</span>
                      <span className="sidebar-nav-text sidebar-sub-label">{sub.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Remaining nav items (Compare…) */}
          {NAV_ITEMS.slice(2).map((item) => {
            const isActive = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                title={item.label}
                onClick={() => setMobileOpen(false)}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-text">{item.label}</span>
                {isActive && (
                  <motion.div
                    className="sidebar-active-bg"
                    layoutId="sidebarActive"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer / status */}
        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className={`status-dot-sidebar ${statusDot}`} />
            <span className="sidebar-status-text">{statusText}</span>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="dash-mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <StatusBar status={status} />

      {/* Main Content */}
      <main className="dash-main">
        <div className="dash-main-bg" />
        <div className="dash-main-content">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
