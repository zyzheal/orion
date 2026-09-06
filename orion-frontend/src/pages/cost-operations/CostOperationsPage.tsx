/**
 * CostOperationsPage (Phase 2)
 * 成本运营页 - 预算门禁、成本趋势、异常检测、优化建议
 *
 * 拆分结构（P2-9 Phase 25）:
 * - CostOverviewTab.tsx: 总览 Tab
 * - AnomalyDetectionTab.tsx: 异常检测 Tab
 * - OptimizationTab.tsx: 优化建议 Tab
 * - BudgetTab.tsx: 预算管理 Tab
 * - constants.ts: 颜色映射/标签映射
 */
import React, { useState, useEffect } from 'react';
import { Typography, Tabs } from 'antd';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  DollarOutlined,
  WarningOutlined,
  BulbOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import { CostOverviewTab } from './CostOverviewTab';
import { AnomalyDetectionTab } from './AnomalyDetectionTab';
import { OptimizationTab } from './OptimizationTab';
import { BudgetTab } from './BudgetTab';

const { Title, Text } = Typography;

const CostOperationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
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
          <DollarOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
          成本运营
        </Title>
        <Text type="secondary">预算门禁、成本趋势分析、异常检测与优化建议</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <DollarOutlined /> 总览
            </span>
          }
          key="overview"
        >
          <CostOverviewTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <WarningOutlined /> 异常检测
            </span>
          }
          key="anomalies"
        >
          <AnomalyDetectionTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <BulbOutlined /> 优化建议
            </span>
          }
          key="optimization"
        >
          <OptimizationTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <SafetyOutlined /> 预算管理
            </span>
          }
          key="budget"
        >
          <BudgetTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default CostOperationsPage;
