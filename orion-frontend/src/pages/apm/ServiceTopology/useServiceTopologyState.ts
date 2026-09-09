/**
 * useServiceTopologyState.ts - APM Service Topology 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 218)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { apmApi, type ServiceDependency } from '@/api/apm';
import {
  type Node,
  type Edge,
  MarkerType,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
} from 'reactflow';
import { colors } from '@/tokens/colors';

interface TopologyData {
  dependencies: ServiceDependency[];
  serviceStats: Map<string, { calls: number; avgLatency: number; errorRate: number }>;
  nodes: Node[];
  edges: Edge[];
}

export function useServiceTopologyState() {
  const {
    data: topology = {} as TopologyData,
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<TopologyData>({
    queryKey: ['apm-service-topology'],
    queryFn: async () => {
      const result = await apmApi.getServiceTopology();
      const deps: ServiceDependency[] = result.data ?? [];

      // Aggregate per-service stats
      const stats = new Map<
        string,
        {
          calls: number;
          latencySum: number;
          latencyCount: number;
          errorRateSum: number;
          errorRateCount: number;
        }
      >();
      deps.forEach((d) => {
        if (!stats.has(d.source_service)) {
          stats.set(d.source_service, {
            calls: 0,
            latencySum: 0,
            latencyCount: 0,
            errorRateSum: 0,
            errorRateCount: 0,
          });
        }
        const s = stats.get(d.source_service)!;
        s.calls += d.call_count;
        s.latencySum += d.avg_latency_ms;
        s.latencyCount += 1;
        if (d.error_rate) {
          s.errorRateSum += d.error_rate;
          s.errorRateCount += 1;
        }
      });

      const finalStats = new Map<
        string,
        { calls: number; avgLatency: number; errorRate: number }
      >();
      stats.forEach((v, k) => {
        finalStats.set(k, {
          calls: v.calls,
          avgLatency: v.latencyCount > 0 ? Math.round(v.latencySum / v.latencyCount) : 0,
          errorRate:
            v.errorRateCount > 0 ? Math.round((v.errorRateSum / v.errorRateCount) * 100) / 100 : 0,
        });
      });

      // Convert to ReactFlow nodes
      const uniqueServices = Array.from(
        new Set(deps.flatMap((d) => [d.source_service, d.target_service]))
      );
      const flowNodes: Node[] = uniqueServices.map((name, i) => {
        const stat = finalStats.get(name);
        const isError = (stat?.errorRate ?? 0) > 5;
        const col = i % 4;
        const row = Math.floor(i / 4);
        return {
          id: name,
          position: { x: 100 + col * 280, y: 50 + row * 150 },
          data: {
            label: name,
            calls: stat?.calls ?? 0,
            avgLatency: stat?.avgLatency ?? 0,
            errorRate: stat?.errorRate ?? 0,
            isError,
          },
          style: {
            padding: '12px 16px',
            borderRadius: '12px',
            border: `2px solid ${isError ? colors.error[500] : colors.primary[500]}`,
            background: colors.neutral[0],
            minWidth: 180,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };
      });

      // Convert to ReactFlow edges
      const flowEdges: Edge[] = deps.map((d) => ({
        id: `${d.source_service}-${d.target_service}`,
        source: d.source_service,
        target: d.target_service,
        label: `${d.call_count} calls`,
        animated: true,
        style: {
          stroke: d.error_rate > 5 ? colors.error[500] : colors.neutral[400],
          strokeWidth: Math.max(1, Math.min(4, d.call_count / 100)),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: d.error_rate > 5 ? colors.error[500] : colors.neutral[400],
        },
      }));

      return {
        dependencies: deps,
        serviceStats: finalStats,
        nodes: flowNodes,
        edges: flowEdges,
      };
    },
    staleTime: 30_000,
  });

  const dependencies = topology?.dependencies ?? [];
  const serviceStats = topology?.serviceStats ?? new Map();

  // nodes/edges 需要本地 state 以支持 ReactFlow 交互（拖拽/平移）
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // 数据加载完成后同步到本地 state
  useEffect(() => {
    setNodes(topology.nodes ?? []);
    setEdges(topology.edges ?? []);
  }, [topology.nodes, topology.edges]);

  // 错误反馈
  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error ? error.message : '加载服务拓扑失败');
  }, [isError, error]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const totalCalls = dependencies.reduce((sum, d) => sum + d.call_count, 0);
  const highErrorCount = Array.from(serviceStats.values()).filter((s) => s.errorRate > 5).length;
  const hasHighError = Array.from(serviceStats.values()).some((s) => s.errorRate > 5);

  return {
    loading,
    dependencies,
    serviceStats,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    totalCalls,
    highErrorCount,
    hasHighError,
    refetch,
  };
}
