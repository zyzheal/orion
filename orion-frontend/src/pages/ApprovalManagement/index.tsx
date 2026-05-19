/**
 * 审批流程管理入口
 *
 * 三个 Tab：审批流程配置、审批记录、超时管理
 */
import React, { useState } from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  SettingOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import FlowConfigForm from './FlowConfigForm';
import ApprovalRecordTable from './ApprovalRecordTable';
import TimeoutConfig from './TimeoutConfig';
import { colors } from '@/tokens';

const { Title, Paragraph } = Typography;

const ApprovalManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('config');

  const tabItems = [
    {
      key: 'config',
      label: (
        <span>
          <SettingOutlined />
          流程配置
        </span>
      ),
      children: <FlowConfigForm />,
    },
    {
      key: 'records',
      label: (
        <span>
          <HistoryOutlined />
          审批记录
        </span>
      ),
      children: <ApprovalRecordTable />,
    },
    {
      key: 'timeout',
      label: (
        <span>
          <ClockCircleOutlined />
          超时管理
        </span>
      ),
      children: <TimeoutConfig />,
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
