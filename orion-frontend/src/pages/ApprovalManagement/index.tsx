/**
 * 审批流程管理入口
 *
 * 三个 Tab：审批流程配置、审批记录、超时管理
 */
import React, { useState } from 'react';
import { Card, Tabs, Typography } from 'antd';
import { SettingOutlined, HistoryOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@/providers/QueryProvider';
import FlowConfigForm from './FlowConfigForm';
import ApprovalRecordTable from './ApprovalRecordTable';
import TimeoutConfig from './TimeoutConfig';
import { getApprovalFlows, getApprovals, getTimeoutConfigs } from '@/api/approval';
import type { ApprovalFlowConfig, ApprovalChainInfo, ApprovalTimeoutConfig } from '@/api/approval';
import { colors, spacing } from '@/tokens';

const { Title, Paragraph } = Typography;

const ApprovalManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('config');

  const { data: flows = [], refetch: fetchFlows } = useQuery<ApprovalFlowConfig[]>({
    queryKey: ['approval', 'flows'],
    queryFn: async () => {
      const res = await getApprovalFlows();
      return res.data || [];
    },
    staleTime: 30_000,
  });

  const {
    data: records = [],
    isLoading: loading,
    refetch: fetchRecords,
  } = useQuery<ApprovalChainInfo[]>({
    queryKey: ['approval', 'records'],
    queryFn: async () => {
      const res = await getApprovals();
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30_000,
  });

  const { data: timeoutConfigs = [], refetch: fetchTimeoutConfigs } = useQuery<
    ApprovalTimeoutConfig[]
  >({
    queryKey: ['approval', 'timeout-configs'],
    queryFn: async () => {
      const res = await getTimeoutConfigs();
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30_000,
  });

  const tabItems = [
    {
      key: 'config',
      label: (
        <span>
          <SettingOutlined />
          流程配置
        </span>
      ),
      children: <FlowConfigForm flows={flows} onRefresh={fetchFlows} />,
    },
    {
      key: 'records',
      label: (
        <span>
          <HistoryOutlined />
          审批记录
        </span>
      ),
      children: (
        <ApprovalRecordTable records={records} loading={loading} onRefresh={fetchRecords} />
      ),
    },
    {
      key: 'timeout',
      label: (
        <span>
          <ClockCircleOutlined />
          超时管理
        </span>
      ),
      children: (
        <TimeoutConfig configs={timeoutConfigs} loading={false} onRefresh={fetchTimeoutConfigs} />
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <SettingOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
          审批流程管理
        </Title>
        <Paragraph type="secondary">配置审批流程、查看审批记录和管理超时策略</Paragraph>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  );
};

export default ApprovalManagement;