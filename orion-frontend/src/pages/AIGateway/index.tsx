/**
 * AI Gateway Management Page
 * AI model routing, degradation handling, and rule engine monitoring
 *
 * 拆分自 index.tsx (P2-9 Phase 219)
 * - useAIGatewayState.ts: state + loadData + Promise.all 4 API calls
 * - Components/PageHeader.tsx: title + refresh/config buttons
 * - Components/SummaryCards.tsx: 4 Statistic cards (总数/健康/熔断/降级)
 * - Components/GatewayStatusCard.tsx: gateway status + cache + audit
 * - Components/HealthTable.tsx: health monitoring table with circuitStateColor
 * - Components/RulesInfo.tsx: rules engine scenarios display
 * - index.tsx: DashboardLayout composition + Spin
 */
import { Spin } from 'antd';
import DashboardLayout from '@/components/DashboardLayout';
import { useAIGatewayState } from './useAIGatewayState';
import { PageHeader } from './Components/PageHeader';
import { SummaryCards } from './Components/SummaryCards';
import { GatewayStatusCard } from './Components/GatewayStatusCard';
import { HealthTable } from './Components/HealthTable';
import { RulesInfo } from './Components/RulesInfo';

const AIGatewayPage = () => {
  const { loading, healthData, gatewayStatus, engineStatus, rules, loadData } =
    useAIGatewayState();

  return (
    <DashboardLayout padding={24} columns={4}>
      <Spin spinning={loading}>
        <PageHeader loading={loading} onRefresh={loadData} />

        <SummaryCards healthData={healthData} />

        <GatewayStatusCard gatewayStatus={gatewayStatus} engineStatus={engineStatus} />

        <HealthTable healthData={healthData} loading={loading} />

        <RulesInfo rules={rules} loading={loading} />
      </Spin>
    </DashboardLayout>
  );
};

export default AIGatewayPage;
