/**
 * Service Topology Page
 *
 * Displays service dependency topology using table + tag visualization.
 * - Full topology graph in a Card with node/edge counts
 * - Service selector to inspect a specific service's dependencies
 * - Dependency table with color-coded dependency types
 *
 * API: /api/v1/service-topology
 *
 * 拆分自 index.tsx (P2-9 Phase 226)
 * - constants.ts: DEPENDENCY_TYPE_COLORS + DEPENDENCY_DESCRIPTIONS
 * - useServiceTopologyState.ts: state + 2 useQuery + isError useEffect + handlers + subGraphEdges/nodeOptions memos
 * - columns.tsx: buildDependencyColumns 4 列 source/target/type/description
 * - Components/PageHeader.tsx: 标题 + 刷新按钮
 * - Components/TopologyOverviewCard.tsx: 拓扑总览 + 服务选择
 * - Components/DependenciesCard.tsx: 依赖表卡
 * - index.tsx: 组合层
 */
import React from 'react';
import { useServiceTopologyState } from './useServiceTopologyState';
import { PageHeader } from './Components/PageHeader';
import { TopologyOverviewCard } from './Components/TopologyOverviewCard';
import { DependenciesCard } from './Components/DependenciesCard';

const ServiceTopologyPage: React.FC = () => {
  const {
    selectedServiceId,
    loading,
    topology,
    subGraphEdges,
    nodeOptions,
    handleRefresh,
    handleServiceChange,
  } = useServiceTopologyState();

  return (
    <div style={{ padding: 0 }} data-testid="service-topology-page">
      <PageHeader loading={loading} onRefresh={handleRefresh} />
      <TopologyOverviewCard
        topology={topology}
        loading={loading}
        nodeOptions={nodeOptions}
        onServiceChange={handleServiceChange}
      />
      <DependenciesCard
        subGraphEdges={subGraphEdges}
        selectedServiceId={selectedServiceId}
        loading={loading}
      />
    </div>
  );
};

export default ServiceTopologyPage;
