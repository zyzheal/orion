/**
 * APM Service Topology Page (Phase 3.5.3)
 * Service dependency visualization using ReactFlow
 * - Shows service-to-service call relationships
 * - Color-coded edges by error rate
 * - Node hover shows call metrics
 *
 * 拆分自 index.tsx (P2-9 Phase 218)
 * - useServiceTopologyState.ts: state + useQuery + aggregation + local nodes/edges
 * - Components/PageHeader.tsx: title + subtitle + refresh button
 * - Components/StatsRow.tsx: 4 Statistic cards
 * - Components/TopologyGraph.tsx: ReactFlow + Background/Controls/MiniMap + nodeTypes
 * - Components/Legend.tsx: legend
 * - index.tsx: composition + loading Spin
 */
import { Spin } from 'antd';
import { spacing } from '@/tokens';
import { useServiceTopologyState } from './useServiceTopologyState';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { TopologyGraph } from './Components/TopologyGraph';
import { Legend } from './Components/Legend';

const ServiceTopologyPage = () => {
  const {
    loading,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    totalCalls,
    highErrorCount,
    hasHighError,
    refetch,
  } = useServiceTopologyState();

  return (
    <Spin spinning={loading}>
      <div style={{ padding: spacing.lg }}>
        <PageHeader loading={loading} onRefresh={() => refetch()} />

        <StatsRow
          serviceCount={nodes.length}
          relationCount={edges.length}
          totalCalls={totalCalls}
          highErrorCount={highErrorCount}
          hasHighError={hasHighError}
        />

        <TopologyGraph
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />

        <Legend />
      </div>
    </Spin>
  );
};

export default ServiceTopologyPage;
