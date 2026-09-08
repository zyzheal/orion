/**
 * useServiceTopologyState.ts - ServiceTopology 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 226)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  serviceTopologyApi,
  type TopologyGraph,
  type TopologyEdge,
  type ServiceDependencies,
} from '@/api/service-topology';

export function useServiceTopologyState() {
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);

  const {
    data: topologyData,
    isLoading: topologyLoading,
    isError: topologyError,
    error: topologyErrorMsg,
    refetch: refetchTopology,
  } = useQuery<TopologyGraph | null>({
    queryKey: ['service-topology/topology'],
    queryFn: async () => {
      const response = await serviceTopologyApi.getTopology();
      return response.data ?? null;
    },
    retry: 0,
    staleTime: 30_000,
  });

  const {
    data: depsData,
    isLoading: depsLoading,
    isError: depsError,
    error: depsErrorMsg,
    refetch: refetchDeps,
  } = useQuery<ServiceDependencies | null>({
    queryKey: ['service-topology/dependencies', selectedServiceId],
    queryFn: async () => {
      const response = await serviceTopologyApi.getServiceDependencies(selectedServiceId!);
      return response.data ?? null;
    },
    enabled: !!selectedServiceId,
    retry: 0,
    staleTime: 30_000,
  });

  const topology = topologyData ?? null;
  const dependencies = depsData ?? null;
  const loading = topologyLoading || depsLoading;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (topologyError) {
      message.error(
        topologyErrorMsg instanceof Error ? topologyErrorMsg.message : '加载服务拓扑失败'
      );
    }
  }, [topologyError, topologyErrorMsg]);

  useEffect(() => {
    if (depsError) {
      message.error(
        depsErrorMsg instanceof Error ? depsErrorMsg.message : '加载服务依赖关系失败'
      );
    }
  }, [depsError, depsErrorMsg]);

  const handleRefresh = useCallback(() => {
    if (selectedServiceId) {
      void refetchDeps();
    } else {
      void refetchTopology();
    }
  }, [selectedServiceId, refetchDeps, refetchTopology]);

  const handleServiceChange = useCallback((value: string) => {
    setSelectedServiceId(value);
  }, []);

  // Sub graph edges: 选中的服务则用其出向依赖，否则用整体拓扑依赖
  const subGraphEdges = useMemo(() => {
    if (dependencies) {
      return dependencies.outgoingDependencies
        .filter((e) => e.direction === 'outgoing')
        .map((e) => ({
          key: `${e.source}-${e.target}-${e.type}`,
          source: e.source,
          target: e.target,
          type: e.type,
        }));
    }
    return (topology?.edges ?? []) as TopologyEdge[];
  }, [dependencies, topology]);

  // Node options for service selector
  const nodeOptions = useMemo(() => {
    if (!topology) return [];
    return topology.nodes.map((node) => ({
      label: node.name || node.id,
      value: node.id,
    }));
  }, [topology]);

  return {
    // State
    selectedServiceId,
    loading,
    topology,
    dependencies,
    subGraphEdges,
    nodeOptions,
    // Actions
    handleRefresh,
    handleServiceChange,
  };
}
