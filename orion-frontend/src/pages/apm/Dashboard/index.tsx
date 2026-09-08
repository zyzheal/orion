/**
 * APM Dashboard (Phase 3.5.3)
 * Application performance overview with metrics and trace visualization
 *
 * P2-9 Phase 246 拆分:
 * - useApmDashboardState.ts: useQuery + stats + error effect
 * - Columns.tsx: traceColumns + serviceColumns
 * - Components/PageHeader.tsx: 标题 + Refresh
 * - Components/StatsRow.tsx: 4 张 Statistic Card
 * - Components/TracesCard.tsx: 最近链路 Card
 * - Components/ServicesCard.tsx: 服务列表 Card
 */
import { Spin } from 'antd';
import { spacing } from '@/tokens';
import { useApmDashboardState } from './useApmDashboardState';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { TracesCard } from './Components/TracesCard';
import { ServicesCard } from './Components/ServicesCard';

const ApmDashboardPage: React.FC = () => {
  const { loading, traces, services, errorCount, avgDuration, refetch } =
    useApmDashboardState();

  return (
    <Spin spinning={loading}>
      <div style={{ padding: spacing.lg }}>
        <PageHeader loading={loading} onRefresh={() => void refetch()} />
        <StatsRow
          tracesCount={traces.length}
          avgDuration={avgDuration}
          errorCount={errorCount}
          servicesCount={services.length}
        />
        <TracesCard traces={traces} />
        <ServicesCard services={services} />
      </div>
    </Spin>
  );
};

export default ApmDashboardPage;
