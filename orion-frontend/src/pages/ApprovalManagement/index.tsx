/**
 * 审批流程管理入口
 *
 * 三个 Tab：审批流程配置、审批记录、超时管理
 */
import React, { useState, useEffect } from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  SettingOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import FlowConfigForm from './FlowConfigForm';
import ApprovalRecordTable from './ApprovalRecordTable';
import TimeoutConfig from './TimeoutConfig';
import { getApprovalFlows, getApprovals, getTimeoutConfigs } from '@/api/approval';
import type { ApprovalFlowConfig, ApprovalChainInfo, ApprovalTimeoutConfig } from '@/api/approval';
import { colors } from '@/tokens';

const { Title, Paragraph } = Typography;

const ApprovalManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('config');
  const [flows, setFlows] = useState<ApprovalFlowConfig[]>([]);
  const [records, setRecords] = useState<ApprovalChainInfo[]>([]);
  const [timeoutConfigs, setTimeoutConfigs] = useState<ApprovalTimeoutConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFlows = async () => {
    try {
      const res = await getApprovalFlows();
      setFlows(res.data || []);
    } catch {
      // API may not be fully ready
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await getApprovals();
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch {
      // API may not be fully ready
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeoutConfigs = async () => {
    try {
      const res = await getTimeoutConfigs();
      setTimeoutConfigs(Array.isArray(res.data) ? res.data : []);
    } catch {
      // API may not be fully ready
    }
  };

  useEffect(() => {
    fetchFlows();
    fetchRecords();
    fetchTimeoutConfigs();
  }, []);

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
      children: <ApprovalRecordTable records={records} loading={loading} onRefresh={fetchRecords} />,
    },
    {
      key: 'timeout',
      label: (
        <span>
          <ClockCircleOutlined />
          超时管理
        </span>
      ),
      children: <TimeoutConfig configs={timeoutConfigs} loading={false} onRefresh={fetchTimeoutConfigs} />,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <SettingOutlined style={{ marginRight: 8, color: colors.purple[500] }} />
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
