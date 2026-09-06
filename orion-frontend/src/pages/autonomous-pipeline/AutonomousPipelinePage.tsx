/**
 * AutonomousPipelinePage (Phase 2)
 * 自治流水线页 - 错误分类、自适应超时、重试统计
 * 抽取自 Phase 73 (P2-9): Tabs 编排 + 3 Tab 组件
 */
import React, { useState, useEffect } from 'react';
import { Typography, Tabs } from 'antd';
import { spacing } from '@/tokens';
import {
  RobotOutlined,
  ClockCircleOutlined,
  RedoOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ErrorClassificationTab from './ErrorClassificationTab';
import AdaptiveTimeoutTab from './AdaptiveTimeoutTab';
import AutoRetryTab from './AutoRetryTab';

const { Title, Text } = Typography;

const AutonomousPipelinePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('errors');

  useEffect(() => {
    const timer = setTimeout(() => {}, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <RobotOutlined style={{ marginRight: spacing.sm }} />
          自治流水线
        </Title>
        <Text type="secondary">错误分类、自适应超时配置和自动重试管理</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <WarningOutlined />
              错误分类
            </span>
          }
          key="errors"
        >
          <ErrorClassificationTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <ClockCircleOutlined />
              自适应超时
            </span>
          }
          key="timeout"
        >
          <AdaptiveTimeoutTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <RedoOutlined />
              自动重试
            </span>
          }
          key="retry"
        >
          <AutoRetryTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default AutonomousPipelinePage;
