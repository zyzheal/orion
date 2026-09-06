/**
 * EfficiencyDashboard Page (TASK-402)
 * 效能看板 - DORA 指标可视化
 * P2-9 Phase 79: 拆分为 state hook + types + columns + 3 tab + onboarding modal
 */
import React from 'react';
import { Typography, Tabs, Tooltip, Button } from 'antd';
import { spacing } from '@/tokens';
import { ThunderboltOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import MetricCard from '@/components/MetricCard';
import { DORA_TOOLTIPS } from '@/constants/dora-guidance';
import { useEfficiencyDashboardState } from './useEfficiencyDashboardState';
import { OverviewTab } from './OverviewTab';
import { TeamsTab } from './TeamsTab';
import { TrendTab } from './TrendTab';
import { OnboardingModal } from './OnboardingModal';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const EfficiencyDashboard: React.FC = () => {
  const {
    loading,
    activeTab,
    setActiveTab,
    benchmarks,
    dashboardData,
    clickHouseStatus,
    showOnboarding,
    setShowOnboarding,
    teams,
    trendData,
    deploymentByTeam,
    doraMetricsData,
    handleCloseOnboarding,
  } = useEfficiencyDashboardState();

  return (
    <div>
      {/* 页面标题 */}
      <div
        style={{
          marginBottom: spacing.lg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
            效能看板
          </Title>
          <Text type="secondary">DORA 指标追踪与团队效能分析</Text>
        </div>
        <Tooltip title="查看帮助">
          <Button
            type="text"
            icon={<QuestionCircleOutlined />}
            onClick={() => setShowOnboarding(true)}
            style={{ fontSize: 18 }}
          />
        </Tooltip>
      </div>

      {/* DORA 指标卡片 */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={5}>核心指标</Title>
        <DashboardLayout columns={4} gap={16}>
          <MetricCard
            title="发布频率"
            value={dashboardData?.dora?.deploymentFrequency || '-'}
            unit="次/周"
            trend="up"
            trendPercent={12.5}
            previousValue={156}
            loading={loading}
            tooltip={DORA_TOOLTIPS.deploymentFrequency.description}
          />
          <MetricCard
            title="变更前置时间"
            value={dashboardData?.dora?.leadTime || '-'}
            unit="小时"
            trend="down"
            trendPercent={18.2}
            previousValue={28}
            loading={loading}
            tooltip={DORA_TOOLTIPS.leadTimeForChanges.description}
          />
          <MetricCard
            title="服务恢复时间"
            value={dashboardData?.dora?.mttr || '-'}
            unit="分钟"
            trend="down"
            trendPercent={25.0}
            previousValue={60}
            loading={loading}
            tooltip={DORA_TOOLTIPS.meanTimeToRecovery.description}
          />
          <MetricCard
            title="变更失败率"
            value={dashboardData?.dora?.changeFailureRate || '-'}
            unit="%"
            trend="down"
            trendPercent={2.1}
            previousValue={8.5}
            loading={loading}
            tooltip={DORA_TOOLTIPS.changeFailureRate.description}
          />
        </DashboardLayout>
      </div>

      {/* Tab 切换 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="总览" key="overview">
          <OverviewTab
            doraMetricsData={doraMetricsData}
            benchmarks={benchmarks}
            clickHouseStatus={clickHouseStatus}
            dashboardData={dashboardData}
            loading={loading}
          />
        </TabPane>

        <TabPane tab="团队对比" key="teams">
          <TeamsTab teams={teams} />
        </TabPane>

        <TabPane tab="趋势分析" key="trend">
          <TrendTab trendData={trendData} deploymentByTeam={deploymentByTeam} loading={loading} />
        </TabPane>
      </Tabs>

      {/* 新手引导 Modal */}
      <OnboardingModal visible={showOnboarding} onClose={handleCloseOnboarding} />
    </div>
  );
};

export default EfficiencyDashboard;
