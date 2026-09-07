/**
 * Manager Dashboard Page
 * Team-level metrics for engineering managers, including member performance table,
 * week-over-week comparison, and transfer analysis.
 *
 * P0-3 Fix: Removed mock data fallback. Now uses real API data with proper
 * loading, error, and empty states. Mock data is kept only in test files.
 *
 * P2-9 Phase 181: Extracted to columns.tsx + Components/*.tsx (7 components).
 */
import React from 'react';
import { Result } from 'antd';
import { useBiDashboard } from '@/hooks/useBiDashboard';
import DataState from '@/components/DataState';
import type { ManagerDashboardData } from '@/types/pages';
import { PageHeader } from './Components/PageHeader';
import { TeamOverview } from './Components/TeamOverview';
import { WowSection } from './Components/WowSection';
import { MemberPerformanceChart } from './Components/MemberPerformanceChart';
import { MemberTable } from './Components/MemberTable';
import { TransferAnalysis } from './Components/TransferAnalysis';

const ManagerDashboard: React.FC = () => {
  const { data: apiData, loading, error } = useBiDashboard('manager');

  const handleRetry = () => window.location.reload();
  const data = apiData as ManagerDashboardData | undefined;

  if (!loading && !error && !apiData) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="info"
          title="暂无数据"
          subTitle="经理效能仪表盘 API 尚未返回数据，请确认后端服务已正确部署。"
        />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div style={{ padding: 0 }}>
      <DataState
        loading={loading}
        error={error}
        empty={false}
        loadingText="加载效能数据..."
        retry={handleRetry}
      >
        <PageHeader />
        <TeamOverview teamOverview={data.teamOverview} />
        <WowSection weekOverWeek={data.weekOverWeek} />
        <MemberPerformanceChart memberMetrics={data.memberMetrics} />
        <MemberTable memberMetrics={data.memberMetrics} />
        <TransferAnalysis transferAnalysis={data.transferAnalysis} />
      </DataState>
    </div>
  );
};

export default ManagerDashboard;
