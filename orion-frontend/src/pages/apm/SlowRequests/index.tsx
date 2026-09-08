/**
 * APM Slow Requests Page (Phase 3.5.3)
 * Slow request ranking and query pattern analysis
 *
 * P2-9 Phase 245 拆分:
 * - useApmSlowRequestsState.ts: state + useQuery + handlers
 * - Columns.tsx: queryColumns + patternColumns
 * - Components/PageHeader.tsx: 标题栏 + 阈值 InputNumber + 刷新
 * - Components/SlowQueriesCard.tsx: 慢请求排行 Card
 * - Components/PatternsCard.tsx: SQL 查询模式统计 Card
 */
import { Spin } from 'antd';
import { spacing } from '@/tokens';
import { useApmSlowRequestsState } from './useApmSlowRequestsState';
import { PageHeader } from './Components/PageHeader';
import { SlowQueriesCard } from './Components/SlowQueriesCard';
import { PatternsCard } from './Components/PatternsCard';

const ApmSlowRequestsPage: React.FC = () => {
  const { threshold, loading, slowQueries, patterns, handleThresholdChange, refetch } =
    useApmSlowRequestsState();

  return (
    <Spin spinning={loading}>
      <div style={{ padding: spacing.lg }}>
        <PageHeader
          threshold={threshold}
          loading={loading}
          onThresholdChange={handleThresholdChange}
          onRefresh={() => void refetch()}
        />
        <SlowQueriesCard slowQueries={slowQueries} />
        <PatternsCard patterns={patterns} />
      </div>
    </Spin>
  );
};

export default ApmSlowRequestsPage;
