/**
 * RootCausePage - RCA Analysis Dashboard
 * Phase 2: 根因分析、依赖图、时间线、时间关联分析
 * 6 文件拆分: constants.ts + RCAAnalysisTab.tsx + DependencyGraphTab.tsx
 *           + TemporalCorrelationTab.tsx + TimelineTab.tsx + RootCausePage.tsx
 * 抽取自 698 行原始文件 (P2-9 Phase 70)
 */
import React, { useState } from 'react';
import { Typography, Tabs } from 'antd';
import {
  SearchOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import RCAAnalysisTab from './RCAAnalysisTab';
import DependencyGraphTab from './DependencyGraphTab';
import TimelineTab from './TimelineTab';
import TemporalCorrelationTab from './TemporalCorrelationTab';

const { Title, Text } = Typography;

const RootCausePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('rca');

  return (
    <div>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
          根因分析中心
        </Title>
        <Text type="secondary">根因分析、服务依赖图分析、时间线追踪和时间关联分析</Text>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <SearchOutlined />
              根因分析
            </span>
          }
          key="rca"
        >
          <RCAAnalysisTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <BranchesOutlined />
              依赖图
            </span>
          }
          key="dependency"
        >
          <DependencyGraphTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <ClockCircleOutlined />
              时间线
            </span>
          }
          key="timeline"
        >
          <TimelineTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <ThunderboltOutlined />
              时间关联
            </span>
          }
          key="temporal"
        >
          <TemporalCorrelationTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default RootCausePage;
