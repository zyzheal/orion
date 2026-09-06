/**
 * ObservabilityPage (Phase 2)
 * 全栈可观测性页 - 自定义告警规则、根因分析、静默规则管理
 *
 * 拆分结构（P2-9 Phase 27）:
 * - AlertRulesTab.tsx: 告警规则 Tab
 * - SilenceRulesTab.tsx: 静默规则 Tab
 * - RootCauseAnalysisTab.tsx: 根因分析 Tab
 * - ServiceHealthTab.tsx: 服务健康 Tab
 * - constants.ts: 颜色映射/标签映射
 */
import React, { useState, useEffect } from 'react';
import { Typography, Tabs } from 'antd';
import { spacing } from '@/tokens';
import {
  EyeOutlined,
  BellOutlined,
  SafetyOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import { AlertRulesTab } from './AlertRulesTab';
import { SilenceRulesTab } from './SilenceRulesTab';
import { RootCauseAnalysisTab } from './RootCauseAnalysisTab';
import { ServiceHealthTab } from './ServiceHealthTab';

const { Title, Text } = Typography;

const ObservabilityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('alert-rules');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <EyeOutlined style={{ marginRight: spacing.sm }} />
          全栈可观测性
        </Title>
        <Text type="secondary">自定义告警规则、根因分析和静默规则管理</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <BellOutlined />
              告警规则
            </span>
          }
          key="alert-rules"
        >
          <AlertRulesTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <SafetyOutlined />
              静默规则
            </span>
          }
          key="silence-rules"
        >
          <SilenceRulesTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <SearchOutlined />
              根因分析
            </span>
          }
          key="rca"
        >
          <RootCauseAnalysisTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <ThunderboltOutlined />
              服务健康
            </span>
          }
          key="health"
        >
          <ServiceHealthTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default ObservabilityPage;
