/**
 * EfficiencyPage.tsx - 效能运营页
 * P2-9 Phase 76: 拆分为 3 个独立 Tab 组件 + 精简主页面
 *
 * Note: This is a focused version complementing EfficiencyDashboard, emphasizing
 * developer profiles and bottleneck analysis.
 */
import React, { useState, useEffect } from 'react';
import { Typography, Tabs } from 'antd';
import {
  ThunderboltOutlined,
  UserOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import DORAMetricsTab from './DORAMetricsTab';
import DeveloperProfileTab from './DeveloperProfileTab';
import BottleneckAnalysisTab from './BottleneckAnalysisTab';

const { Title, Text } = Typography;

const EfficiencyPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dora');
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
          <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          效能运营
        </Title>
        <Text type="secondary">DORA 指标面板、开发者画像和效能瓶颈分析</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <ThunderboltOutlined />
              DORA 指标
            </span>
          }
          key="dora"
        >
          <DORAMetricsTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <UserOutlined />
              开发者画像
            </span>
          }
          key="profiles"
        >
          <DeveloperProfileTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <LineChartOutlined />
              瓶颈分析
            </span>
          }
          key="bottlenecks"
        >
          <BottleneckAnalysisTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default EfficiencyPage;
