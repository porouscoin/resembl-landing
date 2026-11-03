'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { ClusterData } from '@/lib/types';

// ── Color tokens matching PaperSimilarityGraph ──────────────────────────────
const COLOR_CENTER    = '#f8fafc';                 // white  – Your Paper node
const COLOR_ASSIGNED  = '#0f766e';                 // dark teal-green – assigned cluster
const COLOR_OTHER     = '#99f6e4';                 // light teal-green – other clusters
const COLOR_CENTER_STROKE   = 'rgba(94,234,212,0.75)';
const COLOR_ASSIGNED_STROKE = 'rgba(20,184,166,0.55)';
const COLOR_OTHER_STROKE    = 'rgba(94,234,212,0.18)';

const CENTER_R = 28;

interface Props {
  clusterData: ClusterData[];
  paperTitle: string;
  clusterTopics: Record<string, string>;
  assignedCluster: number;
  wordclouds: Record<string, string>;
  onWordcloudClick?: (clusterId: string, base64: string) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'paper' | 'cluster';
  label: string;
  topicName?: string;
  r: number;
  fill: string;
  stroke: string;
  similarity: number;
  papersCount?: number;
  isAssigned: boolean;
  clusterId?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  weight: number;
  strokeWidth: number;
  opacity: number;
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export default function NetworkGraph({
  clusterData,
  paperTitle,
  clusterTopics,
  assignedCluster,
  wordclouds,
  onWordcloudClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || clusterData.length === 0) return;

    const W = containerRef.current.clientWidth || 800;
    const H = 520;

    // ── Build nodes ──────────────────────────────────────────────────────────
    const similarities = clusterData.map((c) => c.similarity);
    const maxSim = Math.max(...similarities);
    const minSim = Math.min(...similarities);
    const simRange = maxSim - minSim || 1;

    const nodes: GraphNode[] = [];

    nodes.push({
      id: 'paper',
      type: 'paper',
      label: 'Your Paper',
      topicName: paperTitle,
      r: CENTER_R,
      fill: COLOR_CENTER,
      stroke: COLOR_CENTER_STROKE,
      similarity: 1,
      isAssigned: false,
    });

    clusterData.forEach((cluster) => {
      const topicName =
        clusterTopics[String(cluster.cluster_id)] || cluster.topic_name || `Cluster ${cluster.cluster_id}`;
      const normalised = (cluster.similarity - minSim) / simRange;
      const r = Math.max(12, Math.min(26, 12 + normalised * 14));
      nodes.push({
        id: `cluster_${cluster.cluster_id}`,
        type: 'cluster',
        label: `Cluster ${cluster.cluster_id}`,
        topicName,
        r,
        fill: cluster.is_assigned ? COLOR_ASSIGNED : COLOR_OTHER,
        stroke: cluster.is_assigned ? COLOR_ASSIGNED_STROKE : COLOR_OTHER_STROKE,
        similarity: cluster.similarity,
        papersCount: cluster.size,
        isAssigned: cluster.is_assigned,
        clusterId: cluster.cluster_id,
      });
    });

    // ── Build links ──────────────────────────────────────────────────────────
    const links: GraphLink[] = clusterData.map((cluster) => {
      const normalised = (cluster.similarity - minSim) / simRange;
      return {
        source: 'paper',
        target: `cluster_${cluster.cluster_id}`,
        weight: cluster.similarity,
        strokeWidth: 1.5 + normalised * 7,
        opacity: 0.25 + normalised * 0.55,
      };
    });

    // ── D3 render ────────────────────────────────────────────────────────────
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${W} ${H}`);

    // ── Defs / glow filters ──
    const defs = svg.append('defs');

    const glowFilter = defs
      .append('filter').attr('id', 'ng-glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    glowFilter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '5').attr('result', 'blur');
    const m1 = glowFilter.append('feMerge');
    m1.append('feMergeNode').attr('in', 'blur');
    m1.append('feMergeNode').attr('in', 'SourceGraphic');

    const centerGlow = defs
      .append('filter').attr('id', 'ng-center-glow')
      .attr('x', '-80%').attr('y', '-80%')
      .attr('width', '260%').attr('height', '260%');
    centerGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '8').attr('result', 'blur');
    const m2 = centerGlow.append('feMerge');
    m2.append('feMergeNode').attr('in', 'blur');
    m2.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g').attr('class', 'ng-root');

    // ── Zoom ──
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (e) => g.attr('transform', e.transform)),
    );

    // ── Tooltip (fixed, matching PSG style) ──
    const ttId = 'ng-tooltip';
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
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            const lk = d as GraphLink;
            return 110 + (1 - lk.weight) * 90;
          }),
      )
      .force('charge', d3.forceManyBody().strength(-320))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => d.r + 12));

    // ── Links ──
    const linkSel = g
      .append('g')
      .attr('class', 'ng-links')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => {
        const tid = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        return nodes.find((n) => n.id === tid)?.fill ?? '#64748b';
      })
      .attr('stroke-opacity', (d) => d.opacity)
      .attr('stroke-width', (d) => d.strokeWidth)
      .attr('stroke-linecap', 'round');

    // ── Link similarity labels ──
    const linkLabelSel = g
      .append('g')
      .attr('class', 'ng-link-labels')
      .selectAll<SVGTextElement, GraphLink>('text')
      .data(links)
      .join('text')
      .text((d) => `${(d.weight * 100).toFixed(0)}%`)
      .attr('font-size', '9px')
      .attr('fill', 'rgba(148,163,184,0.7)')
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none');

    // ── Nodes ──
    const nodeSel = g
      .append('g')
      .attr('class', 'ng-nodes')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => d.fill)
      .attr('stroke', (d) => d.stroke)
      .attr('stroke-width', (d) => (d.type === 'paper' || d.isAssigned ? 3 : 1.5))
      .attr('filter', (d) => (d.type === 'paper' ? 'url(#ng-center-glow)' : null))
      .style('cursor', (d) => (d.type === 'cluster' ? 'pointer' : 'default'))
      .on('mouseover', function (ev, d) {
        d3.select(this).transition().duration(120).attr('r', d.r + 5);
        if (d.type === 'paper') {
          tt.html(
            `<div style="font-weight:700;margin-bottom:4px;line-height:1.35">${truncate(paperTitle, 68)}</div>` +
            `<div style="font-size:11px;font-weight:700;color:#5eead4">📍 Your Paper</div>`,
          ).style('opacity', '1').style('left', `${ev.clientX + 16}px`).style('top', `${ev.clientY - 12}px`);
        } else {
          tt.html(
            `<div style="font-weight:700;margin-bottom:4px;line-height:1.35">${truncate(d.topicName ?? d.label, 68)}</div>` +
            `<div style="color:#94a3b8;font-size:11px;margin-bottom:2px">Papers: ${d.papersCount}</div>` +
            `<div style="font-size:11px;font-weight:700;color:${d.fill}">Similarity: ${(d.similarity * 100).toFixed(1)}%</div>` +
            (d.isAssigned ? `<div style="font-size:11px;color:#5eead4;margin-top:3px">★ Assigned cluster</div>` : '') +
            (wordclouds[String(d.clusterId)] ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;font-style:italic">Click to view wordcloud</div>` : ''),
          ).style('opacity', '1').style('left', `${ev.clientX + 16}px`).style('top', `${ev.clientY - 12}px`);
        }
      })
      .on('mousemove', function (ev) {
        tt.style('left', `${ev.clientX + 16}px`).style('top', `${ev.clientY - 12}px`);
      })
      .on('mouseout', function (_, d) {
        d3.select(this)
          .transition().duration(120)
          .attr('r', d.r)
          .attr('filter', d.type === 'paper' ? 'url(#ng-center-glow)' : null);
        tt.style('opacity', '0');
      })
      .on('click', function (_, d) {
        if (d.type === 'cluster' && d.clusterId !== undefined) {
          const cid = String(d.clusterId);
          const b64 = wordclouds[cid];
          if (b64 && onWordcloudClick) onWordcloudClick(cid, b64);
        }
      })
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on('start', (ev, d) => {
            if (!ev.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
          .on('end', (ev, d) => {
            if (!ev.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          }),
      );

    // ── Node labels ──
    const labelSel = g
      .append('g')
      .attr('class', 'ng-labels')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .join('text')
      .text((d) => (d.type === 'paper' ? 'Your Paper' : truncate(d.topicName ?? d.label, 18)))
      .attr('font-size', (d) => (d.type === 'paper' ? '11px' : '9px'))
      .attr('font-weight', (d) => (d.type === 'paper' || d.isAssigned ? '700' : '500'))
      .attr('fill', '#cbd5e1')
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none');

    // ── Tick ──
    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);

      linkLabelSel
        .attr('x', (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr('y', (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2 - 4);

      nodeSel
        .attr('cx', (d) => Math.max(d.r, Math.min(W - d.r, d.x!)))
        .attr('cy', (d) => Math.max(d.r, Math.min(H - d.r, d.y!)));

      labelSel
        .attr('x', (d) => Math.max(d.r, Math.min(W - d.r, d.x!)))
        .attr('y', (d) => Math.max(d.r, Math.min(H - d.r, d.y!)) + d.r + 14);
    });

    // ── Entrance animation ──
    nodeSel
      .attr('opacity', 0)
      .transition().duration(550).delay((_, i) => i * 35)
      .attr('opacity', 1);
    linkSel.attr('opacity', 0).transition().duration(700).delay(150).attr('opacity', 1);

    return () => {
      simulation.stop();
      d3.select(`#${ttId}`).remove();
    };
  }, [clusterData, paperTitle, clusterTopics, assignedCluster, wordclouds, onWordcloudClick]);

  return (
    <div className="card psg-root-card" style={{ position: 'relative', overflow: 'visible' }}>
      <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>🕸️ Cluster Network</h3>

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
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_CENTER, border: `1.5px solid ${COLOR_CENTER_STROKE}`, display: 'inline-block', flexShrink: 0 }} />
          Your Paper
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_ASSIGNED, border: `1.5px solid ${COLOR_ASSIGNED_STROKE}`, display: 'inline-block', flexShrink: 0 }} />
          Assigned Cluster
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_OTHER, border: `1.5px solid rgba(94,234,212,0.35)`, display: 'inline-block', flexShrink: 0 }} />
          Other Clusters
        </span>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic', opacity: 0.7 }}>
          Line thickness = similarity · Click cluster for wordcloud
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
        {clusterData.length === 0 && (
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
            <span>No cluster data available.</span>
          </div>
        )}
      </div>
    </div>
  );
}
