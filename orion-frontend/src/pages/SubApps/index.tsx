/**
 * 子系统导航页面
 * 展示所有可用的子系统入口
 * 支持从 menuConfigStore 动态获取配置
 *
 * 拆分自 index.tsx (P2-9 Phase 225)
 * - constants.tsx: SubAppCard 类型 + iconMap + colorMap + defaultSubApps
 * - useSubAppsState.ts: state + loadSubApps useEffect + navigate handler
 * - Components/SubAppCardView.tsx: 单个子系统卡片
 * - Components/SubAppGrid.tsx: Row/Col 卡片网格
 * - Components/ArchitectureCard.tsx: 微前端架构说明卡
 * - index.tsx: 组合层
 */
import React from 'react';
import { Typography, Spin } from 'antd';
import { spacing } from '@/tokens';
import { useSubAppsState } from './useSubAppsState';
import { SubAppGrid } from './Components/SubAppGrid';
import { ArchitectureCard } from './Components/ArchitectureCard';

const { Title, Paragraph } = Typography;

const SubApps: React.FC = () => {
  const { subApps, loading, handleNavigate } = useSubAppsState();

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ marginBottom: spacing.xl }}>
        <Title level={2}>子系统导航</Title>
        <Paragraph type="secondary" style={{ fontSize: spacing[4] }}>
          Orion 平台采用微前端架构，以下为集成的子系统应用。点击卡片进入相应子系统。
        </Paragraph>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <SubAppGrid apps={subApps} onNavigate={handleNavigate} />
          <ArchitectureCard />
        </>
      )}
    </div>
  );
};

export default SubApps;
