/**
 * useDataLineageState.ts - DataLineage 状态 Hook
 * 抽取自 DataLineagePage.tsx (P2-9 Phase 61)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import {
  getLineageGraph,
  getUpstream,
  getDownstream,
  getImpactAnalysis,
  type LineageNode as ApiLineageNode,
  type LineageEdge,
  type LineageStats,
  type ImpactAnalysis as ApiImpact,
} from '@/api/data-lineage';
import { getAllPipelineRuns } from '@/api/pipelineRuns';
import type { DisplayNode } from './types';

export const useDataLineageState = () => {
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<DisplayNode[]>([]);
  const [edges, setEdges] = useState<LineageEdge[]>([]);
  const [stats, setStats] = useState<LineageStats | null>(null);

  const [search, setSearch] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);

  // Detail & impact
  const [selectedNode, setSelectedNode] = useState<ApiLineageNode | null>(null);
  const [impactData, setImpactData] = useState<ApiImpact | null>(null);
  const [upstreamNodes, setUpstreamNodes] = useState<ApiLineageNode[]>([]);
  const [downstreamNodes, setDownstreamNodes] = useState<ApiLineageNode[]>([]);

  // Pipeline list for filter
  const [pipelineList, setPipelineList] = useState<{ key: string; label: string }[]>([]);

  // Edge mapping modal
  const [edgeMapping, setEdgeMapping] = useState<LineageEdge | null>(null);

  useEffect(() => {
    fetchLineage();
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      const res = await getAllPipelineRuns({ limit: 50 });
      const runs = (res.data as { runs?: unknown[] })?.runs ?? res.data;
      if (Array.isArray(runs)) {
        const ids = new Set<string>();
        const list: { key: string; label: string }[] = [];
        runs.forEach((r) => {
          const run = r as { pipelineId?: string; pipelineName?: string };
          if (run.pipelineId && !ids.has(run.pipelineId)) {
            ids.add(run.pipelineId);
            list.push({ key: run.pipelineId, label: `${run.pipelineName || run.pipelineId}` });
          }
        });
        setPipelineList(list);
      }
    } catch {
      // Pipeline list optional
    }
  };

  const fetchLineage = async () => {
    setLoading(true);
    try {
      const result = await getLineageGraph();
      const graph = result.graph;
      const displayEdges = graph.edges;

      // Build adjacency for upstream/downstream
      const adj: Record<string, { from: string[]; to: string[] }> = {};
      graph.nodes.forEach((n) => {
        adj[n.id] = { from: [], to: [] };
      });
      displayEdges.forEach((e) => {
        if (adj[e.from]) adj[e.from].to.push(e.to);
        if (adj[e.to]) adj[e.to].from.push(e.from);
      });

      const displayNodes = graph.nodes.map((n) => ({
        ...n,
        upstreamIds: adj[n.id]?.from || [],
        downstreamIds: adj[n.id]?.to || [],
      }));

      setNodes(displayNodes);
      setEdges(displayEdges);
      setStats(result.stats);
    } catch {
      message.error('获取数据血缘失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredNodes = nodes.filter((n) => {
    const matchSearch = !search || n.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !nodeTypeFilter || n.type === nodeTypeFilter;
    const matchPipeline = !pipelineFilter || n.pipelineId === pipelineFilter;
    return matchSearch && matchType && matchPipeline;
  });

  const openNodeDetail = async (node: ApiLineageNode) => {
    setSelectedNode(node);
    setImpactData(null);
    setUpstreamNodes([]);
    setDownstreamNodes([]);

    try {
      const [impact, upstream, downstream] = await Promise.all([
        getImpactAnalysis(node.id).catch(() => ({
          upstreamCount: 0,
          downstreamCount: 0,
          affectedPipelines: [],
        })),
        getUpstream(node.id).catch(() => []),
        getDownstream(node.id).catch(() => []),
      ]);
      setImpactData(impact);
      setUpstreamNodes(upstream);
      setDownstreamNodes(downstream);
    } catch {
      message.error('获取影响分析失败');
    }
  };

  const openEdgeMapping = (edge: LineageEdge) => {
    setEdgeMapping(edge);
  };

  return {
    loading,
    nodes, edges, stats,
    search, setSearch,
    nodeTypeFilter, setNodeTypeFilter,
    pipelineFilter, setPipelineFilter,
    selectedNode, setSelectedNode,
    impactData,
    upstreamNodes, downstreamNodes,
    pipelineList,
    edgeMapping, setEdgeMapping,
    filteredNodes,
    fetchLineage,
    openNodeDetail,
    openEdgeMapping,
  };
};
