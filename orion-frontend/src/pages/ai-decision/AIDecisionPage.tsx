/**
 * AIDecisionPage (Phase 2)
 * AI 决策引擎页 - 决策解释、模型版本管理、A/B 测试
 * P2-9 Phase 84: 主页面拆分 (661→~70 行)，3 个 Tab 组件已抽取
 */
import React, { useState, useEffect } from 'react';
import { Typography, Tabs } from 'antd';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  ThunderboltOutlined,
  RobotOutlined,
  TrophyOutlined,
  ExperimentOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import { ModelVersionsTab } from './ModelVersionsTab';
import { ABTestingTab } from './ABTestingTab';
import { DecisionExplanationTab } from './DecisionExplanationTab';

const { Title, Text } = Typography;

export const AIDecisionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('models');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load indicator
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
          <RobotOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
          AI 决策引擎
        </Title>
        <Text type="secondary">决策解释、模型版本管理和 A/B 测试</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <TrophyOutlined />
              模型版本
            </span>
          }
          key="models"
        >
          <ModelVersionsTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <ExperimentOutlined />
              A/B 测试
            </span>
          }
          key="abtest"
        >
          <ABTestingTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <LineChartOutlined />
              决策解释
            </span>
          }
          key="explanation"
        >
          <DecisionExplanationTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default AIDecisionPage;
