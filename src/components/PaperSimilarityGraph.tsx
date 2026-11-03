'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import type { Paper } from '@/lib/types';

// ─────────────────────────── Types ──────────────────────────────────────────

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'center' | 'paper';
  paper?: Paper;
  title: string;
  authors: string[];
  published: string;
  similarity: number;
  pdfUrl?: string;
  arxivId?: string;
  r: number;
  fill: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  similarity: number;
  strokeW: number;
  opacity: number;
}

export interface PaperSimilarityGraphProps {
  papers: Paper[];
  centralTitle: string;
  centralAuthors: string[];
  centralPublished: string;
  centralPdfUrl?: string | null;
  centralArxivId?: string | null;
}

// ─────────────────────────── Helpers ────────────────────────────────────────

const MIN_R = 8;
const MAX_R = 26;
const CENTER_R = 32;

function nodeRadius(sim: number): number {
  return MIN_R + Math.max(0, Math.min(1, sim)) * (MAX_R - MIN_R);
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ─────────────────────────── Component ──────────────────────────────────────

export default function PaperSimilarityGraph({
  papers,
  centralTitle,
  centralAuthors,
  centralPublished,
  centralPdfUrl,
  centralArxivId,
}: PaperSimilarityGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // ── Controls ──────────────────────────────────────────────────────────────
  const [topK, setTopK] = useState<10 | 25 | 50>(10);
  const [threshold, setThreshold] = useState(30);
  const [search, setSearch] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  // Reset focus when filters change so highlighted nodes from old view don't persist
  useEffect(() => {
    setFocusId(null);
    setSelected(null);
  }, [topK, threshold]);

  // ── Derived papers ────────────────────────────────────────────────────────
  const activePapers = useMemo(
    () => papers.filter((p) => (p.similarity ?? 0) * 100 >= threshold).slice(0, topK),
    [papers, topK, threshold],
  );

  // ── Build graph data ──────────────────────────────────────────────────────
  const buildGraph = useCallback(() => {
    // Compute normalized color scale: most similar → darkest, least similar → lightest
    const sims = activePapers.map((p) => p.similarity ?? 0);
    const minSim = sims.length > 0 ? Math.min(...sims) : 0;
    const maxSim = sims.length > 0 ? Math.max(...sims) : 1;
    const simRange = maxSim - minSim;
    const nodeColor = (sim: number): string => {
      const t = simRange > 0 ? (sim - minSim) / simRange : 0.5;
      return d3.interpolateRgb('#99f6e4', '#0f766e')(t); // lightest → darkest teal
    };

    const nodes: GraphNode[] = [
      {
        id: '__center__',
        type: 'center',
        title: centralTitle,
        authors: centralAuthors,
        published: centralPublished,
        similarity: 1,
        pdfUrl: centralPdfUrl ?? undefined,
        arxivId: centralArxivId ?? undefined,
        r: CENTER_R,
        fill: '#f8fafc',
      },
    ];

    activePapers.forEach((p) => {
      const sim = p.similarity ?? 0;
      nodes.push({
        id: p.arxiv_id || p.title,
        type: 'paper',
        paper: p,
        title: p.title,
        authors: p.authors,
        published: p.published,
        similarity: sim,
        pdfUrl: p.pdf_url,
        arxivId: p.arxiv_id,
        r: nodeRadius(sim),
        fill: nodeColor(sim),
      });
    });

    const links: GraphLink[] = activePapers.map((p) => {
      const sim = p.similarity ?? 0;
      return {
        source: '__center__',
        target: p.arxiv_id || p.title,
        similarity: sim,
        strokeW: 1.5 + sim * 7,
        opacity: 0.25 + sim * 0.55,
      };
    });

    return { nodes, links };
  }, [activePapers, centralTitle, centralAuthors, centralPublished, centralPdfUrl, centralArxivId]);

  // ── Main D3 render ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const W = containerRef.current.clientWidth || 820;
    const H = 520;
    const { nodes, links } = buildGraph();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${W} ${H}`);

    // ── Defs ──
    const defs = svg.append('defs');
    const glowFilter = defs
      .append('filter')
      .attr('id', 'psg-glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    glowFilter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '5').attr('result', 'blur');
    const merge = glowFilter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const centerGlow = defs
      .append('filter')
      .attr('id', 'psg-center-glow')
      .attr('x', '-80%').attr('y', '-80%')
      .attr('width', '260%').attr('height', '260%');
    centerGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '8').attr('result', 'blur');
    const merge2 = centerGlow.append('feMerge');
    merge2.append('feMergeNode').attr('in', 'blur');
    merge2.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g').attr('class', 'psg-root');

    // ── Zoom ──
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (e) => g.attr('transform', e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    // ── Tooltip ──
    const ttId = 'psg-tooltip';
    d3.select(`#${ttId}`).remove();
    const tt = d3
      .select('body')
      .append('div')
      .attr('id', ttId)
      .style('position', 'fixed')
      .style('padding', '10px 14px')
      .style('background', 'rgba(5,15,35,0.97)')
      .style('border', '1px solid rgba(148,163,184,0.35)')
      .style('border-radius', '10px')
      .style('color', '#e2e8f0')
      .style('font-size', '12px')
      .style('line-height', '1.55')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('z-index', '9999')
      .style('max-width', '250px')
      .style('box-shadow', '0 8px 24px rgba(0,0,0,0.5)')
      .style('transition', 'opacity .15s');

    // ── Simulation ──
    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            const lk = d as GraphLink;
            return grouped ? 0 : 110 + (1 - lk.similarity) * 90;
          }),
      )
      .force('charge', d3.forceManyBody().strength(-320))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => d.r + 12));

    if (grouped) {
      sim
        .force(
          'ring-high',
          d3
            .forceRadial<GraphNode>(130, W / 2, H / 2)
            .strength((d) => (d.type !== 'center' && d.similarity >= 0.7 ? 0.7 : 0)),
        )
        .force(
          'ring-mid',
          d3
            .forceRadial<GraphNode>(215, W / 2, H / 2)
            .strength((d) =>
              d.type !== 'center' && d.similarity >= 0.5 && d.similarity < 0.7 ? 0.7 : 0,
            ),
        )
        .force(
          'ring-low',
          d3
            .forceRadial<GraphNode>(305, W / 2, H / 2)
            .strength((d) => (d.type !== 'center' && d.similarity < 0.5 ? 0.7 : 0)),
        );
    }

    // ── Rings (grouped mode decoration) ──
    if (grouped) {
      const ringG = g.append('g').attr('class', 'psg-rings').style('pointer-events', 'none');
      [
        { r: 130, label: 'High ≥70%', color: '#5eead4' },
        { r: 215, label: 'Medium 50–70%', color: '#14b8a6' },
        { r: 305, label: 'Low <50%', color: '#0f766e' },
      ].forEach(({ r, label, color }) => {
        ringG
          .append('circle')
          .attr('cx', W / 2).attr('cy', H / 2)
          .attr('r', r).attr('fill', 'none')
          .attr('stroke', color).attr('stroke-opacity', 0.15).attr('stroke-dasharray', '5,5');
        ringG
          .append('text')
          .attr('x', W / 2 + r - 8).attr('y', H / 2 - 8)
          .attr('font-size', '9px').attr('fill', color)
          .attr('opacity', 0.65).attr('text-anchor', 'end')
          .text(label);
      });
    }

    // ── Links ──
    const linkG = g.append('g').attr('class', 'links');
    const linkSel = linkG
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => {
        const tid = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        return nodes.find((n) => n.id === tid)?.fill ?? '#64748b';
      })
      .attr('stroke-opacity', (d) => d.opacity)
      .attr('stroke-width', (d) => d.strokeW)
      .attr('stroke-linecap', 'round');

    // ── Link similarity labels ──
    const linkLabelG = g.append('g').attr('class', 'psg-link-labels');
    const linkLabelSel = linkLabelG
      .selectAll<SVGTextElement, GraphLink>('text')
      .data(links)
      .join('text')
      .text((d) => `${(d.similarity * 100).toFixed(0)}%`)
      .attr('font-size', '9px')
      .attr('fill', 'rgba(148,163,184,0.7)')
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none');

    // ── Nodes ──
    const nodeG = g.append('g').attr('class', 'nodes');
    const nodeSel = nodeG
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => d.fill)
      .attr('stroke', (d) => (d.type === 'center' ? 'rgba(94,234,212,0.75)' : 'rgba(94,234,212,0.18)'))
      .attr('stroke-width', (d) => (d.type === 'center' ? 3 : 1.5))
      .attr('filter', (d) => (d.type === 'center' ? 'url(#psg-center-glow)' : null))
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on('start', (ev, d) => {
            if (!ev.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (ev, d) => {
            d.fx = ev.x;
            d.fy = ev.y;
          })
          .on('end', (ev, d) => {
            if (!ev.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on('mouseover', function (ev, d) {
        d3.select(this).transition().duration(120).attr('r', d.r + 5);
        const year = d.published?.slice(0, 4) ?? 'Unknown';
        const auth =
          d.authors.slice(0, 2).join(', ') + (d.authors.length > 2 ? ' et al.' : '');
        const simPct = d.type === 'center' ? '100' : `${(d.similarity * 100).toFixed(1)}`;
        tt.html(
          `<div style="font-weight:700;margin-bottom:4px;line-height:1.35">${truncate(d.title, 68)}</div>` +
            `<div style="color:#94a3b8;font-size:11px;margin-bottom:2px">${auth || 'Unknown'}</div>` +
            `<div style="color:#94a3b8;font-size:11px;margin-bottom:4px">Year: ${year}</div>` +
            (d.type === 'center'
              ? `<div style="font-size:11px;font-weight:700;color:#5eead4">📍 Your Paper</div>`
              : `<div style="font-size:11px;font-weight:700;color:${d.fill}">Similarity: ${simPct}%</div>`),
        )
          .style('opacity', '1')
          .style('left', `${ev.clientX + 16}px`)
          .style('top', `${ev.clientY - 12}px`);
      })
      .on('mousemove', function (ev) {
        tt.style('left', `${ev.clientX + 16}px`).style('top', `${ev.clientY - 12}px`);
      })
      .on('mouseout', function (_, d) {
        d3.select(this)
          .transition()
          .duration(120)
          .attr('r', d.r)
          .attr('filter', d.type === 'center' ? 'url(#psg-center-glow)' : null);
        tt.style('opacity', '0');
      })
      .on('click', function (_, d) {
        setSelected(d);
        setFocusId((prev) => (prev === d.id ? null : d.id));
      });

    // ── Node labels ──
    const labelG = g.append('g').attr('class', 'psg-labels');
    const labelSel = labelG
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .join('text')
      .text((d) => (d.type === 'center' ? 'Your Paper' : truncate(d.title, 18)))
      .attr('font-size', (d) => (d.type === 'center' ? '11px' : '9px'))
      .attr('font-weight', (d) => (d.type === 'center' ? '700' : '500'))
      .attr('fill', '#cbd5e1')
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none');

    // ── Tick ──
    sim.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);

      linkLabelSel
        .attr(
          'x',
          (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2,
        )
        .attr(
          'y',
          (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2 - 4,
        );

      nodeSel
        .attr('cx', (d) => Math.max(d.r, Math.min(W - d.r, d.x!)))
        .attr('cy', (d) => Math.max(d.r, Math.min(H - d.r, d.y!)));

      labelSel
        .attr('x', (d) => Math.max(d.r, Math.min(W - d.r, d.x!)))
        .attr(
          'y',
          (d) => Math.max(d.r, Math.min(H - d.r, d.y!)) + d.r + 14,
        );
    });

    // ── Entrance animation ──
    nodeSel
      .attr('opacity', 0)
      .transition()
      .duration(550)
      .delay((_, i) => i * 35)
      .attr('opacity', 1);
    linkSel.attr('opacity', 0).transition().duration(700).delay(150).attr('opacity', 1);

    return () => {
      sim.stop();
      d3.select(`#${ttId}`).remove();
    };
  }, [buildGraph, grouped, renderKey]);

  // ── Focus + Search combined visual update ─────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const hasSearch = search.trim().length > 0;
    const hasFocus = !!focusId;
    const q = search.toLowerCase();

    svg
      .selectAll<SVGCircleElement, GraphNode>('.nodes circle')
      .attr('filter', (d: GraphNode) => {
        if (d.type === 'center') return 'url(#psg-center-glow)';
        if (d.id === focusId) return 'url(#psg-glow)';
        if (hasSearch && d.title.toLowerCase().includes(q)) return 'url(#psg-glow)';
        return null;
      })
      .attr('opacity', (d: GraphNode) => {
        if (!hasFocus && !hasSearch) return 1;
        if (hasFocus) return d.id === focusId || d.id === '__center__' ? 1 : 0.1;
        if (hasSearch)
          return d.title.toLowerCase().includes(q) || d.id === '__center__' ? 1 : 0.1;
        return 1;
      });

    svg
      .selectAll<SVGLineElement, GraphLink>('.links line')
      .attr('stroke-opacity', (d: GraphLink) => {
        if (!hasFocus && !hasSearch) return d.opacity;
        if (hasFocus) {
          const tid =
            typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
          const sid =
            typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
          return tid === focusId || sid === focusId ? d.opacity : 0.04;
        }
        return d.opacity;
      });

    svg
      .selectAll<SVGTextElement, GraphNode>('.psg-labels text')
      .attr('opacity', (d: GraphNode) => {
        if (!hasFocus && !hasSearch) return 1;
        if (hasFocus) return d.id === focusId || d.id === '__center__' ? 1 : 0.15;
        if (hasSearch)
          return d.title.toLowerCase().includes(q) || d.id === '__center__' ? 1 : 0.15;
        return 1;
      });
  }, [focusId, search]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFocusId(null);
    setSelected(null);
    setSearch('');
    setThreshold(30);
    setTopK(10);
    setGrouped(false);
    setRenderKey((k) => k + 1);
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="card psg-root-card" style={{ position: 'relative', overflow: 'visible' }}>
      <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>
        🔍 Paper Similarity Network
      </h3>

      {/* ── Control Bar ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          alignItems: 'flex-end',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 180px', minWidth: 140 }}>
          <label
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: 3,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Search Paper
          </label>
          <div style={{ position: 'relative' }}>
            <svg
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--text-muted)',
              }}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Highlight nodes by title…"
              style={{
                width: '100%',
                padding: '7px 10px 7px 28px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'rgba(15,23,42,0.5)',
                fontSize: '12px',
                color: '#fff',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Top-K */}
        <div>
          <label
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: 3,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Show Top
          </label>
          <div style={{ display: 'flex', gap: 3 }}>
            {([10, 25, 50] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTopK(k)}
                style={{
                  padding: '6px 13px',
                  borderRadius: 7,
                  border: '1px solid var(--border)',
                  background:
                    topK === k ? 'var(--primary)' : 'rgba(15,23,42,0.5)',
                  color: topK === k ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: topK === k ? 700 : 500,
                  transition: 'all .15s',
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Group by Tier toggle */}
        <div>
          <label
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: 3,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Layout
          </label>
          <button
            onClick={() => setGrouped((g) => !g)}
            style={{
              padding: '6px 13px',
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: grouped ? 'var(--primary)' : 'rgba(15,23,42,0.5)',
              color: grouped ? '#fff' : 'var(--text-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: grouped ? 700 : 500,
              transition: 'all .15s',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1" />
            </svg>
            {grouped ? 'Radial' : 'Free'}
          </button>
        </div>

        {/* Reset */}
        <button
          onClick={handleReset}
          title="Reset graph to default view"
          style={{
            padding: '7px 15px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'rgba(15,23,42,0.5)',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all .15s',
            alignSelf: 'flex-end',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset
        </button>
      </div>

      {/* ── Threshold Slider ── */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            alignItems: 'center',
          }}
        >
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Show papers with similarity ≥{' '}
            <strong style={{ color: 'var(--text)' }}>{threshold}%</strong>
          </label>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'rgba(15,23,42,0.6)',
              padding: '2px 8px',
              borderRadius: 20,
              border: '1px solid var(--border)',
            }}
          >
            {activePapers.length} paper{activePapers.length !== 1 ? 's' : ''}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          aria-label={`Similarity threshold: ${threshold}%`}
          title={`Similarity threshold: ${threshold}%`}
          style={{
            width: '100%',
            accentColor: 'var(--primary)',
            height: 4,
            cursor: 'pointer',
          }}
        />
      </div>

      {/* ── Legend ── */}
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          marginBottom: '0.875rem',
          flexWrap: 'wrap',
          fontSize: '11px',
          color: 'var(--text-muted)',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(15,23,42,0.4)',
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        {/* Your Paper marker */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#f8fafc',
              border: '1.5px solid rgba(94,234,212,0.75)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          Your Paper
        </span>

        {/* Gradient rectangle */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Less Similar</span>
          <span
            style={{
              width: 120,
              height: 10,
              borderRadius: 4,
              background: 'linear-gradient(to right, #99f6e4, #0f766e)',
              display: 'inline-block',
              flexShrink: 0,
              border: '1px solid rgba(148,163,184,0.2)',
            }}
          />
          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Most Similar</span>
        </span>

        <span style={{ marginLeft: 'auto', fontStyle: 'italic', opacity: 0.7 }}>
          Click node for details
        </span>
      </div>

      {/* ── Graph SVG ── */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'rgba(5,15,35,0.6)',
          border: '1px solid rgba(148,163,184,0.18)',
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.3)',
        }}
      >
        <svg ref={svgRef} style={{ width: '100%', height: 520, display: 'block' }} />
        {activePapers.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
              gap: 8,
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="19.07" x2="19.07" y2="4.93" />
            </svg>
            <span>No papers match the current filters.</span>
            <span style={{ fontSize: '11px', opacity: 0.6 }}>
              Try lowering the similarity threshold or increasing the top-K count.
            </span>
          </div>
        )}
      </div>

      {/* ── Side Panel ── */}
      {selected && (
        <>
          {/* Transparent overlay to close panel by clicking outside */}
          <div
            onClick={() => {
              setSelected(null);
              setFocusId(null);
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 498 }}
          />
          {/* Panel */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 350,
              height: '100vh',
              background: 'rgba(5,12,32,0.97)',
              borderLeft: '1px solid rgba(148,163,184,0.25)',
              padding: '1.5rem',
              overflowY: 'auto',
              zIndex: 499,
              boxShadow: '-8px 0 40px rgba(0,0,0,0.45)',
              animation: 'psgSlideIn .22s cubic-bezier(0.25,0.46,0.45,0.94)',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setSelected(null);
                setFocusId(null);
              }}
              aria-label="Close panel"
              style={{
                position: 'absolute',
                top: 14,
                right: 16,
                background: 'rgba(148,163,184,0.1)',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                cursor: 'pointer',
                color: '#94a3b8',
                transition: 'all .15s',
              }}
            >
              ✕
            </button>

            <div style={{ marginTop: 4 }}>
              {/* Similarity badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: 20,
                  background:
                    selected.type === 'center'
                      ? 'rgba(248,250,252,0.08)'
                      : 'rgba(20,184,166,0.12)',
                  border: `1px solid ${
                    selected.type === 'center'
                      ? 'rgba(248,250,252,0.2)'
                      : 'rgba(20,184,166,0.3)'
                  }`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: selected.fill,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    color: selected.fill,
                    fontWeight: 700,
                  }}
                >
                  {selected.type === 'center'
                    ? 'Your Selected Paper'
                    : `${(selected.similarity * 100).toFixed(1)}% Similarity`}
                </span>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  lineHeight: 1.45,
                  marginBottom: '0.5rem',
                  color: '#e2e8f0',
                }}
              >
                {selected.title}
              </h3>

              {/* Authors */}
              {selected.authors.length > 0 && (
                <p
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 5,
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {selected.authors.slice(0, 4).join(', ')}
                  {selected.authors.length > 4 ? ' et al.' : ''}
                </p>
              )}

              {/* Publication date */}
              <p
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {selected.published || 'Unknown date'}
              </p>



              {/* Abstract */}
              {selected.paper?.abstract && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        marginBottom: 7,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Abstract
                    </div>
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      {selected.paper.abstract.length > 380
                        ? selected.paper.abstract.slice(0, 380) + '…'
                        : selected.paper.abstract}
                    </p>
                  </div>
                )}

              {/* Action button */}
              {selected.arxivId && (
                <a
                  href={`https://arxiv.org/abs/${selected.arxivId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    padding: '9px 0',
                    background: 'rgba(20,184,166,0.14)',
                    color: '#2dd4bf',
                    borderRadius: 8,
                    fontSize: '13px',
                    textDecoration: 'none',
                    fontWeight: 600,
                    border: '1px solid rgba(20,184,166,0.35)',
                    transition: 'opacity .15s',
                  }}
                >
                  View on ArXiv
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 17L17 7" />
                    <path d="M7 7h10v10" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </>
      )}

      {/* Slide-in animation keyframe */}
      <style>{`
        @keyframes psgSlideIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
