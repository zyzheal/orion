/**
 * Engineer Dashboard Page
 * 个人效能看板
 *
 * P2-9 Phase 129 重构: 501 → 43行 (-91.4%)
 * 拆分: constants.ts + activeTicketColumns.tsx + 6 Components
 */
import React from 'react';
import { Result } from 'antd';
import DataState from '@/components/DataState';
import { useBiDashboard } from '@/hooks/useBiDashboard';
import type { EngineerDashboardData } from '@/types/pages';
import { EngineerDashboardHeader } from './Components/EngineerDashboardHeader';
import { PersonalOverviewCard } from './Components/PersonalOverviewCard';
import { PersonalTrendChart } from './Components/PersonalTrendChart';
import { StrengthsAndWeaknesses } from './Components/StrengthsAndWeaknesses';
import { AbilityDistributionChart } from './Components/AbilityDistributionChart';
import { ActiveTicketsPanel } from './Components/ActiveTicketsPanel';

const EngineerDashboard: React.FC = () => {
  const { data: apiData, loading, error } = useBiDashboard('engineer');
  const handleRetry = () => window.location.reload();

  if (!loading && !error && !apiData) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="info"
          title="暂无数据"
          subTitle="个人效能仪表盘 API 尚未返回数据，请确认后端服务已正确部署。"
        />
      </div>
    );
  }

  const data = apiData as EngineerDashboardData | undefined;
  if (!data) return null;

  return (
    <div style={{ padding: 0 }}>
      <DataState
        loading={loading}
        error={error}
        empty={false}
        loadingText="加载效能数据..."
        retry={handleRetry}
      >
        <EngineerDashboardHeader data={data} />
        <PersonalOverviewCard data={data} />
        <PersonalTrendChart data={data} />
        <StrengthsAndWeaknesses data={data} />
        <AbilityDistributionChart data={data} />
        <ActiveTicketsPanel data={data} />
      </DataState>
    </div>
  );
};

export default EngineerDashboard;
