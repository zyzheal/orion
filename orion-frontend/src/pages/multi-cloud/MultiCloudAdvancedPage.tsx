/**
 * Multi-Cloud Advanced Page
 * 多云进阶管理 - 合规检查、资源调度、跨区容灾、成本优化、网络编排
 *
 * P2-9 Phase 47 重构: 813 → 156 行 (-81%)
 * 拆分: useMultiCloudAdvancedState + StatsCards + 7 个 Tab + 复用现有 Columns/Modals/Config
 */
import React from 'react';
import { Button, Form, Space, Tabs, Typography } from 'antd';
import {
  CloudOutlined,
  PlusOutlined,
  ReloadOutlined,
  AuditOutlined,
  ScheduleOutlined,
  SafetyOutlined,
  GlobalOutlined,
  DollarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import { useMultiCloudAdvancedState } from './useMultiCloudAdvancedState';
import { StatsCards } from './StatsCards';
import { ComplianceTab } from './ComplianceTab';
import { SchedulingTab } from './SchedulingTab';
import { AccountsTab } from './AccountsTab';
import { ResourcesTab } from './ResourcesTab';
import { DisasterRecoveryTab } from './DisasterRecoveryTab';
import { CostOptimizationTab } from './CostOptimizationTab';
import { NetworkOrchestrationTab } from './NetworkOrchestrationTab';
import {
  RegisterCloudAccountModal,
  CreateDrPlanModal,
} from './MultiCloudAdvancedModals';

const { Title, Text } = Typography;

const MultiCloudAdvancedPage: React.FC = () => {
  const {
    accounts,
    resources,
    loading,
    accountModal,
    setAccountModal,
    drModal,
    setDrModal,
    setScheduleModal,
    complianceReport,
    complianceLoading,
    schedulingPolicies,
    scheduleResult,
    scheduleResultLoading,
    loadData,
    handleRunComplianceCheck,
    handleScheduleResource,
    handleRegisterAccount,
  } = useMultiCloudAdvancedState();

  const [accountForm] = Form.useForm();
  const [drForm] = Form.useForm();

  return (
    <div style={{ padding: spacing.lg, background: themeVars.bgSecondary, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CloudOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            多云进阶管理
          </Title>
          <Text type="secondary">合规检查、资源调度、跨区容灾、成本优化、网络编排</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAccountModal(true)}>
            注册账号
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <StatsCards accounts={accounts} resources={resources} />

      <Tabs
        items={[
          {
            key: 'compliance',
            label: (
              <>
                <AuditOutlined /> 合规检查
              </>
            ),
            children: (
              <ComplianceTab
                complianceReport={complianceReport}
                complianceLoading={complianceLoading}
                onRunComplianceCheck={handleRunComplianceCheck}
              />
            ),
          },
          {
            key: 'scheduling',
            label: (
              <>
                <ScheduleOutlined /> 资源调度
              </>
            ),
            children: (
              <SchedulingTab
                schedulingPolicies={schedulingPolicies}
                scheduleResult={scheduleResult}
                scheduleResultLoading={scheduleResultLoading}
                onCreateSchedule={() => setScheduleModal(true)}
                onSchedule={handleScheduleResource}
              />
            ),
          },
          {
            key: 'accounts',
            label: (
              <>
                <CloudOutlined /> Cloud Accounts
              </>
            ),
            children: (
              <AccountsTab
                accounts={accounts}
                loading={loading}
                onRegister={() => setAccountModal(true)}
                onRefresh={loadData}
              />
            ),
          },
          {
            key: 'resources',
            label: (
              <>
                <SafetyOutlined /> Cloud Resources
              </>
            ),
            children: (
              <ResourcesTab resources={resources} loading={loading} onRefresh={loadData} />
            ),
          },
          {
            key: 'disaster-recovery',
            label: (
              <>
                <GlobalOutlined /> Cross-Region DR
              </>
            ),
            children: <DisasterRecoveryTab onCreateDrPlan={() => setDrModal(true)} />,
          },
          {
            key: 'cost-optimization',
            label: (
              <>
                <DollarOutlined /> Cost Optimization
              </>
            ),
            children: <CostOptimizationTab />,
          },
          {
            key: 'network-orchestration',
            label: (
              <>
                <ThunderboltOutlined /> Network Orchestration
              </>
            ),
            children: <NetworkOrchestrationTab />,
          },
        ]}
      />

      {/* Register Cloud Account Modal */}
      <RegisterCloudAccountModal
        open={accountModal}
        form={accountForm}
        onCancel={() => setAccountModal(false)}
        onSubmit={handleRegisterAccount}
      />

      {/* Create DR Plan Modal */}
      <CreateDrPlanModal open={drModal} form={drForm} onCancel={() => setDrModal(false)} />
    </div>
  );
};

export default MultiCloudAdvancedPage;
