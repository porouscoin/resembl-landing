'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* ─── helpers ─── */
function formatInsightText(text: string) {
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function heatmapColor(value: number) {
  if (value === 0) return { bg: 'rgba(148,163,184,.05)', text: '#94a3b8' };
  if (value < 10) return { bg: 'rgba(99,102,241,.06)', text: '#6366f1' };
  if (value < 20) return { bg: 'rgba(99,102,241,.12)', text: '#6366f1' };
  if (value < 30) return { bg: 'rgba(99,102,241,.22)', text: '#4f46e5' };
  if (value < 40) return { bg: 'rgba(99,102,241,.35)', text: '#fff' };
  if (value < 50) return { bg: 'rgba(99,102,241,.50)', text: '#fff' };
  if (value < 60) return { bg: 'rgba(99,102,241,.65)', text: '#fff' };
  return { bg: 'rgba(99,102,241,.82)', text: '#fff' };
}

const BAR_COLORS = ['#6366f1', '#0891b2', '#8b5cf6', '#0d9488', '#ec4899', '#f59e0b', '#10b981'];

const CLUSTER_ICONS = [
  <svg key="0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  <svg key="1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  <svg key="2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  <svg key="3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  <svg key="4" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  <svg key="5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  <svg key="6" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
];

/* ─── component ─── */
export default function TrendsTab({ view }: { view?: 'trends' | 'momentum' | 'venues' } = {}) {
  const [subTab, setSubTab] = useState<'trends' | 'momentum' | 'venues'>(view ?? 'trends');

  const [loading, setLoading] = useState(true);
  const [trendsAvailable, setTrendsAvailable] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [wordclouds, setWordclouds] = useState<Record<string, string>>({});
  const [clusterLabels, setClusterLabels] = useState<Record<string, string>>({});
  const [wordcloudModal, setWordcloudModal] = useState<{ clusterId: string; label: string } | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);

  const [momentumLoading, setMomentumLoading] = useState(false);
  const [momentum, setMomentum] = useState<any>(null);
  const [momentumError, setMomentumError] = useState('');

  const [venueStatus, setVenueStatus] = useState<any>(null);
  const [venueData, setVenueData] = useState<any>(null);
  const [venueTopicAnalysis, setVenueTopicAnalysis] = useState<any>(null);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venuesError, setVenuesError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState({ progress: 0, total: 0 });
  const [venueTopicLoading, setVenueTopicLoading] = useState(false);

  /* ─── Load initial trends data ─── */
  useEffect(() => {
    (async () => {
      try {
        const status = await apiFetch<any>('/trends/status');
        if (!status.available) {
          setTrendsAvailable(false);
          setErrorMsg(status.reason || 'Trends data not available');
          setLoading(false);
          return;
        }
        setTrendsAvailable(true);
        const [chartRes, summaryRes, wcRes] = await Promise.all([
          apiFetch<any>('/trends/data'),
          apiFetch<any>('/trends/summary'),
          apiFetch<any>('/trends/wordclouds'),
        ]);
        if (summaryRes.success) setSummary(summaryRes.summary);
        if (chartRes.success) setChartData(chartRes.chart_data);
        if (wcRes.success) {
          setWordclouds(wcRes.wordclouds || {});
          setClusterLabels(wcRes.cluster_labels || {});
        }
      } catch {
        setTrendsAvailable(false);
        setErrorMsg('Failed to load trends data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (subTab !== 'momentum' || momentum) return;
    setMomentumLoading(true);
    setMomentumError('');
    apiFetch<any>('/trends/topic-momentum')
      .then((r) => { if (r.success) setMomentum(r.data); else setMomentumError(r.error || 'No data'); })
      .catch(() => setMomentumError('Failed to load momentum data'))
      .finally(() => setMomentumLoading(false));
  }, [subTab, momentum]);

  useEffect(() => {
    if (subTab !== 'venues' || venueStatus) return;
    setVenuesLoading(true);
    apiFetch<any>('/trends/venues/status')
      .then((s) => {
        setVenueStatus(s);
        if (s.is_extracting) {
          setExtracting(true);
          setExtractionProgress({ progress: s.progress || 0, total: s.total || 0 });
          pollExtraction();
        }
      })
      .catch(() => setVenuesError('Failed to check venue status'))
      .finally(() => setVenuesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  const loadVenueData = useCallback(async () => {
    setVenuesLoading(true);
    setVenuesError('');
    try {
      const res = await apiFetch<any>('/trends/venues/data');
      if (res.success) setVenueData(res.data);
      else setVenuesError(res.error || 'No venue data');
    } catch { setVenuesError('Failed to load venue data'); }
    finally { setVenuesLoading(false); }
  }, []);

  const loadVenueTopicAnalysis = useCallback(async () => {
    setVenueTopicLoading(true);
    try {
      const res = await apiFetch<any>('/trends/venues/topic-analysis');
      if (res.success) setVenueTopicAnalysis(res.data);
    } catch { /* ignore */ }
    finally { setVenueTopicLoading(false); }
  }, []);

  useEffect(() => {
    if (venueStatus?.available && !venueData) {
      loadVenueData().then(() => loadVenueTopicAnalysis());
    }
  }, [venueStatus, venueData, loadVenueData, loadVenueTopicAnalysis]);

  const pollExtraction = useCallback(() => {
    const interval = setInterval(async () => {
      try {
        const s = await apiFetch<any>('/trends/venues/status');
        setExtractionProgress({ progress: s.progress || 0, total: s.total || 0 });
        if (s.available && !s.is_extracting) {
          clearInterval(interval);
          setExtracting(false);
          setVenueStatus(s);
        }
      } catch { /* retry */ }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const startExtraction = async () => {
    setExtracting(true);
    try {
      const res = await apiFetch<any>('/trends/venues/extract', { method: 'POST' });
      if (res.already_exists) {
        setVenueStatus({ available: true });
        setExtracting(false);
        return;
      }
      pollExtraction();
    } catch {
      setExtracting(false);
      setVenuesError('Failed to start extraction');
    }
  };

  /* ─── Chart options ─── */
  const chartOptions = (yLabel: string) => ({
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          color: '#64748b',
          font: { size: 11 },
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(15, 23, 42, .95)',
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        padding: 14,
        cornerRadius: 12,
        callbacks: {
          label: (ctx: any) => {
            let label = ctx.dataset.label || '';
            if (label) label += ': ';
            if (ctx.parsed.y !== null) label += ctx.parsed.y + ' papers';
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Year', color: '#94a3b8', font: { size: 12, weight: 'bold' as const } },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        title: { display: true, text: yLabel, color: '#94a3b8', font: { size: 12, weight: 'bold' as const } },
        beginAtZero: true,
        ticks: { color: '#94a3b8', font: { size: 11 } },
        grid: { color: 'rgba(226,232,240,.4)' },
      },
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
  });

  /* ═══ RENDER ═══ */

  if (loading) {
    return (
      <div className="trends-loading-state">
        <div className="trends-loading-pulse" />
        <div className="trends-loading-pulse" />
        <div className="trends-loading-pulse" />
      </div>
    );
  }

  if (!trendsAvailable) {
    return (
      <div className="trends-empty-state">
        <div className="trends-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <h3>No Trends Data Available</h3>
        <p>{errorMsg || 'Run prepare_data.py to generate trends data first.'}</p>
      </div>
    );
  }

  const venueStats = venueData?.venue_stats;
  const topVenues = venueStats?.top_venues;

  return (
    <div className="trends-page">
      {/* ── Page heading (sub-page view) ── */}
      {view && (
        <motion.div
          className="trends-page-header"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="trends-page-title">
            {view === 'trends' ? 'Topics' : view === 'momentum' ? 'Papers' : 'Venues'}
          </h1>
        </motion.div>
      )}

      {/* ── Hero Banner (legacy full /trends page only) ── */}
      {!view && (
        <motion.div
          className="trends-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="trends-hero-bg" />
          <div className="trends-hero-content">
            <div className="trends-hero-left">
              <h1 className="trends-hero-title">Research Trends</h1>
              <p className="trends-hero-subtitle">Discover publication patterns, momentum shifts, and venue analytics across topics</p>
            </div>
            {summary && (
              <div className="trends-hero-stats">
                <div className="trends-hero-stat">
                  <span className="trends-hero-stat-val">{summary.num_clusters}</span>
                  <span className="trends-hero-stat-label">Clusters</span>
                </div>
                <div className="trends-hero-stat-divider" />
                <div className="trends-hero-stat">
                  <span className="trends-hero-stat-val">{summary.year_range}</span>
                  <span className="trends-hero-stat-label">Year Range</span>
                </div>
                <div className="trends-hero-stat-divider" />
                <div className="trends-hero-stat">
                  <span className="trends-hero-stat-val">cs.CL</span>
                  <span className="trends-hero-stat-label">Domain</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Tab Switcher (legacy full /trends page only) ── */}
      {!view && (
        <motion.div
          className="trends-tab-bar"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          {[
            { id: 'trends' as const, label: 'Publication Trends', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
            { id: 'momentum' as const, label: 'Topic Momentum', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
            { id: 'venues' as const, label: 'Venue Analytics', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`trends-tab-btn ${subTab === tab.id ? 'active' : ''}`}
              onClick={() => setSubTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {subTab === tab.id && (
                <motion.div className="trends-tab-indicator" layoutId="trendsTabIndicator" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
            </button>
          ))}
        </motion.div>
      )}

      {/* ═══ PUBLICATION TRENDS ═══ */}
      <AnimatePresence mode="wait">
        {subTab === 'trends' && (
          <motion.div key="trends" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            {/* Chart */}
            {chartData && (
              <div className="trends-chart-card">
                <div className="trends-chart-header">
                  <div>
                    <h3 className="trends-chart-title">Publications per Year</h3>
                    <p className="trends-chart-subtitle">Cluster distribution over time</p>
                  </div>
                  <div className="trends-chart-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
                    Live Data
                  </div>
                </div>
                <div className="trends-chart-body">
                  <Line
                    data={{
                      labels: chartData.labels || [],
                      datasets: (chartData.datasets || []).map((ds: any) => ({
                        ...ds,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        borderWidth: 2.5,
                      })),
                    }}
                    options={chartOptions('Number of Publications')}
                  />
                </div>
              </div>
            )}

            {/* Cluster cards */}
            {summary?.cluster_stats && summary.cluster_stats.length > 0 && (
              <div className="trends-clusters-section">
                <div className="trends-section-header">
                  <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
                    Research Clusters
                  </h3>
                  <span className="trends-section-count">{summary.cluster_stats.length} clusters</span>
                </div>
                <div className="trends-cluster-grid-v2">
                  {summary.cluster_stats.map((cs: any, i: number) => {
                    const isExpanded = expandedCluster === i;
                    const hasWc = !!wordclouds[String(cs.cluster_id)];
                    return (
                      <motion.div
                        key={cs.cluster_id}
                        className={`trends-cluster-card-v2 ${isExpanded ? 'expanded' : ''}`}
                        layout
                        onClick={() => setExpandedCluster(isExpanded ? null : i)}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: i * 0.04 }}
                      >
                        <div className="tcc-top-accent" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                        <div className="tcc-header">
                          <div className="tcc-icon" style={{ background: `${BAR_COLORS[i % BAR_COLORS.length]}15`, color: BAR_COLORS[i % BAR_COLORS.length] }}>
                            {CLUSTER_ICONS[i % CLUSTER_ICONS.length]}
                          </div>
                          <div className="tcc-info">
                            <span className="tcc-label">{cs.label}</span>
                            <span className="tcc-years">{cs.year_range}</span>
                          </div>
                          <span className="tcc-count">{cs.paper_count}</span>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              className="tcc-expanded"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                            >
                              <div className="tcc-expand-inner">
                                {hasWc && (
                                  <button
                                    className="tcc-wordcloud-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setWordcloudModal({ clusterId: String(cs.cluster_id), label: cs.label });
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    View Word Cloud
                                  </button>
                                )}
                                <div className="tcc-mini-stats">
                                  <div className="tcc-mini-stat">
                                    <span className="tcc-mini-val">{cs.paper_count}</span>
                                    <span className="tcc-mini-label">Papers</span>
                                  </div>
                                  <div className="tcc-mini-stat">
                                    <span className="tcc-mini-val">#{cs.cluster_id}</span>
                                    <span className="tcc-mini-label">Cluster ID</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div className="tcc-expand-hint">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isExpanded ? 'rotated' : ''}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Wordcloud modal */}
            <AnimatePresence>
              {wordcloudModal && wordclouds[wordcloudModal.clusterId] && (
                <motion.div
                  className="modal-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={(e) => { if (e.target === e.currentTarget) setWordcloudModal(null); }}
                >
                  <motion.div
                    className="trends-wc-modal"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <div className="trends-wc-modal-header">
                      <div>
                        <h2 className="trends-wc-modal-title">{wordcloudModal.label}</h2>
                        <p className="trends-wc-modal-sub">Cluster #{wordcloudModal.clusterId} Word Cloud</p>
                      </div>
                      <button className="trends-wc-modal-close" onClick={() => setWordcloudModal(null)} aria-label="Close word cloud modal">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div className="trends-wc-modal-body">
                      <img
                        src={`data:image/png;base64,${wordclouds[wordcloudModal.clusterId]}`}
                        alt="Wordcloud"
                        className="trends-wc-img"
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ TOPIC MOMENTUM ═══ */}
        {subTab === 'momentum' && (
          <motion.div key="momentum" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            {momentumLoading && (
              <div className="trends-loading-state">
                <div className="trends-loading-pulse" />
                <div className="trends-loading-pulse" />
              </div>
            )}

            {momentumError && !momentumLoading && (
              <div className="trends-empty-state" style={{ padding: '2rem' }}>
                <p style={{ color: '#ef4444' }}>{momentumError}</p>
              </div>
            )}

            {momentum && !momentumLoading && (
              <>
                {/* Forecast chart */}
                {momentum.chart_data && (
                  <div className="trends-chart-card">
                    <div className="trends-chart-header">
                      <div>
                        <h3 className="trends-chart-title">5-Year Topic Forecast</h3>
                        <p className="trends-chart-subtitle">Historical data with projected trends</p>
                      </div>
                      <div className="trends-chart-badge forecast">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Forecast
                      </div>
                    </div>
                    <div className="trends-chart-body">
                      <Line
                        data={{
                          labels: momentum.chart_data.labels || [],
                          datasets: (momentum.chart_data.datasets || []).map((ds: any) => ({
                            ...ds,
                            tension: 0.4,
                            pointRadius: ds.borderDash ? 0 : 3,
                            pointHoverRadius: 5,
                            borderWidth: 2.5,
                          })),
                        }}
                        options={{
                          ...chartOptions('Number of Publications'),
                          plugins: {
                            ...chartOptions('Number of Publications').plugins,
                            legend: {
                              ...chartOptions('Number of Publications').plugins.legend,
                              labels: {
                                ...chartOptions('Number of Publications').plugins.legend.labels,
                                filter: (item: any) => !item.text?.includes('(Forecast)'),
                              },
                            },
                          },
                        }}
                      />
                    </div>
                    <div className="trends-chart-legend">
                      <div className="trends-legend-item">
                        <div className="trends-legend-line solid" />
                        <span>Historical Data</span>
                      </div>
                      <div className="trends-legend-item">
                        <div className="trends-legend-line dashed" />
                        <span>5-Year Forecast</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Momentum cards */}
                {momentum.insights && momentum.insights.length > 0 && (
                  <div className="trends-clusters-section">
                    <div className="trends-section-header">
                      <h3>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Momentum Insights
                      </h3>
                    </div>
                    <div className="momentum-grid-v2">
                      {momentum.insights.map((ins: any, i: number) => {
                        const trendClass = ins.trend_direction === 'rising' ? 'rising' : ins.trend_direction === 'declining' ? 'declining' : 'stable';
                        const growthSign = ins.growth_percentage >= 0 ? '+' : '';
                        return (
                          <motion.div
                            key={i}
                            className={`momentum-card-v2 ${trendClass}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: i * 0.05 }}
                          >
                            <div className="mc2-trend-icon">{ins.trend_icon}</div>
                            <h4 className="mc2-title">{ins.label}</h4>
                            <div className="mc2-growth">
                              <span className={`mc2-growth-val ${ins.growth_percentage >= 0 ? 'positive' : 'negative'}`}>
                                {growthSign}{ins.slope?.toFixed(1)}/yr
                              </span>
                            </div>
                            <div className="mc2-stats-row">
                              <div className="mc2-stat">
                                <span className="mc2-stat-num">{ins.total_historical}</span>
                                <span className="mc2-stat-label">Historical</span>
                              </div>
                              <div className="mc2-stat">
                                <span className="mc2-stat-num">{ins.total_predicted_5yr}</span>
                                <span className="mc2-stat-label">5yr Forecast</span>
                              </div>
                              <div className="mc2-stat">
                                <span className="mc2-stat-num">{(ins.r_squared * 100).toFixed(0)}%</span>
                                <span className="mc2-stat-label">R² Fit</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ═══ VENUES ═══ */}
        {subTab === 'venues' && (
          <motion.div key="venues" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            {venuesLoading && !extracting && (
              <div className="trends-loading-state">
                <div className="trends-loading-pulse" />
                <div className="trends-loading-pulse" />
              </div>
            )}

            {venuesError && (
              <div className="trends-empty-state" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                <p style={{ color: '#ef4444' }}>{venuesError}</p>
              </div>
            )}

            {venueStatus && !venueStatus.available && !extracting && !venuesLoading && (
              <div className="trends-empty-state">
                <div className="trends-empty-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3>Venue Data Not Available</h3>
                <p>Publication venue information hasn&apos;t been extracted yet.</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={startExtraction}>Extract Venues</button>
              </div>
            )}

            {extracting && (
              <div className="trends-extracting-card">
                <span className="spinner" />
                <p className="trends-extracting-text">Extracting venue data...</p>
                <div className="trends-extracting-bar">
                  <motion.div
                    className="trends-extracting-fill"
                    animate={{ width: `${extractionProgress.total > 0 ? (extractionProgress.progress / extractionProgress.total) * 100 : 0}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="trends-extracting-pct">
                  {extractionProgress.progress} / {extractionProgress.total} papers
                  ({extractionProgress.total > 0 ? Math.round((extractionProgress.progress / extractionProgress.total) * 100) : 0}%)
                </p>
              </div>
            )}

            {venueData && !venuesLoading && (
              <>
                {/* Stats */}
                {venueStats && (
                  <div className="trends-venue-stats">
                    {[
                      { val: venueStats.total_papers, label: 'Total Papers', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
                      { val: venueStats.unique_venues, label: 'Unique Venues', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> },
                      { val: venueStats.known_venues, label: 'Known', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
                      { val: venueStats.unknown_venues, label: 'Unknown', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
                    ].map((s, i) => (
                      <motion.div key={i} className="trends-venue-stat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                        <div className="tvs-icon">{s.icon}</div>
                        <span className="tvs-val">{s.val}</span>
                        <span className="tvs-label">{s.label}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Venue chart */}
                {venueData.chart_data && (
                  <div className="trends-chart-card">
                    <div className="trends-chart-header">
                      <div>
                        <h3 className="trends-chart-title">Publications per Year by Venue</h3>
                        <p className="trends-chart-subtitle">Top venue publication timelines</p>
                      </div>
                    </div>
                    <div className="trends-chart-body">
                      <Line
                        data={{
                          labels: venueData.chart_data.labels || [],
                          datasets: (venueData.chart_data.datasets || []).map((ds: any) => ({
                            ...ds,
                            tension: 0.4,
                            pointRadius: 3,
                            borderWidth: 2.5,
                          })),
                        }}
                        options={chartOptions('Number of Publications')}
                      />
                    </div>
                  </div>
                )}

                {/* Top venues */}
                {topVenues && topVenues.length > 0 && (
                  <div className="trends-venue-ranking">
                    <div className="trends-section-header">
                      <h3>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        Top Venues
                      </h3>
                    </div>
                    <div className="trends-venue-list-v2">
                      {topVenues.map((v: any, i: number) => (
                        <motion.div
                          key={i}
                          className="tvl2-item"
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <span className="tvl2-rank" style={{ background: i < 3 ? BAR_COLORS[i] : undefined }}>
                            {i + 1}
                          </span>
                          <span className="tvl2-name">{v.venue}</span>
                          <div className="tvl2-bar-wrap">
                            <motion.div
                              className="tvl2-bar"
                              initial={{ width: 0 }}
                              animate={{ width: `${(v.count / topVenues[0].count) * 100}%` }}
                              transition={{ duration: 0.6, delay: i * 0.04 }}
                              style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                            />
                          </div>
                          <span className="tvl2-count">{v.count}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Venue-Topic Analysis */}
                <div className="trends-chart-card">
                  <div className="trends-chart-header">
                    <div>
                      <h3 className="trends-chart-title">Venue-Topic Specialization</h3>
                      <p className="trends-chart-subtitle">Which venues focus on specific research topics</p>
                    </div>
                  </div>

                  {venueTopicLoading && (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <span className="spinner" style={{ margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '.85rem' }}>Analyzing venue-topic relationships...</p>
                    </div>
                  )}

                  {venueTopicAnalysis && !venueTopicLoading && (
                    <div style={{ padding: '0 1.5rem 1.5rem' }}>
                      {/* Insights */}
                      {venueTopicAnalysis.insights && venueTopicAnalysis.insights.length > 0 && (
                        <div className="trends-insights-grid">
                          {venueTopicAnalysis.insights.map((ins: any, i: number) => (
                            <motion.div key={i} className="trends-insight-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                              <div className="tic-icon">{ins.icon}</div>
                              <div className="tic-body">
                                <span className="tic-title">{ins.title}</span>
                                <span className="tic-text" dangerouslySetInnerHTML={{ __html: formatInsightText(ins.text) }} />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Heatmap */}
                      {venueTopicAnalysis.heatmap?.matrix?.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                          <h4 className="trends-section-subhead">Topic Distribution Heatmap</h4>
                          <div className="heatmap-scroll">
                            <table className="heatmap-table">
                              <thead>
                                <tr>
                                  <th className="heatmap-venue-header">Venue</th>
                                  {venueTopicAnalysis.heatmap.topics.map((t: string, ti: number) => (
                                    <th key={ti} title={t}>{t}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {venueTopicAnalysis.heatmap.matrix.map((row: number[], ri: number) => (
                                  <tr key={ri}>
                                    <td className="heatmap-venue-name" title={venueTopicAnalysis.heatmap.venues[ri]}>
                                      {venueTopicAnalysis.heatmap.venues[ri]}
                                    </td>
                                    {row.map((val: number, ci: number) => {
                                      const c = heatmapColor(val);
                                      return (
                                        <td key={ci}>
                                          <span className="heatmap-cell" style={{ background: c.bg, color: c.text }}>
                                            {val > 0 ? `${val.toFixed(0)}%` : '-'}
                                          </span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Venue specialization cards */}
                      {venueTopicAnalysis.venue_topic_data?.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                          <h4 className="trends-section-subhead">Venue Specializations</h4>
                          <div className="venue-cards-grid">
                            {venueTopicAnalysis.venue_topic_data.slice(0, 8).map((vd: any, i: number) => (
                              <motion.div key={i} className="venue-topic-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                <div className="vtc-header">
                                  <span className="vtc-name" title={vd.venue}>{vd.display_name}</span>
                                  <span className="vtc-count">{vd.total_papers} papers</span>
                                </div>
                                {vd.primary_topic && (
                                  <div className="vtc-primary">
                                    <div className="vtc-primary-label">Primary Focus</div>
                                    <div className="vtc-primary-row">
                                      <span className="vtc-primary-topic">{vd.primary_topic.topic}</span>
                                      <span className="vtc-primary-pct">{vd.primary_topic.percentage}%</span>
                                    </div>
                                  </div>
                                )}
                                <div className="vtc-bars">
                                  {vd.topic_breakdown.slice(0, 4).map((tb: any, bi: number) => (
                                    <div key={bi} className="vtc-bar-row">
                                      <span className="vtc-bar-label" title={tb.topic}>{tb.topic}</span>
                                      <div className="vtc-bar-wrapper">
                                        <motion.div
                                          className="vtc-bar-fill"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${tb.percentage}%` }}
                                          transition={{ duration: 0.5, delay: bi * 0.08 }}
                                          style={{ background: BAR_COLORS[bi % BAR_COLORS.length] }}
                                        />
                                      </div>
                                      <span className="vtc-bar-val">{tb.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
