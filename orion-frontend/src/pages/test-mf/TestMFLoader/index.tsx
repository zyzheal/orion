/**
 * Orion-MF 测试页面
 *
 * 用于验证 orion-mf 框架加载子应用的能力
 * 迁移阶段：Phase 0 - 并行运行验证
 *
 * 拆分自 index.tsx (P2-9 Phase 229)
 * - constants.ts: TestResult/TestSubApp 类型 + TEST_SUBAPPS 3 项
 * - useTestMFLoaderState.ts: 动态加载 orion-mf + state + handleLoadSubApp + handleClear
 * - Components/Alert.tsx: 简单 Alert 组件替代
 * - Components/InstructionsCard.tsx: 测试说明 + 步骤 + Alert
 * - Components/TestAreaCard.tsx: 子应用加载按钮 + 测试结果
 * - Components/ContainerCard.tsx: 容器区域 ref
 * - index.tsx: 组合层
 */
import React from 'react';
import { Typography } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useTestMFLoaderState } from './useTestMFLoaderState';
import { InstructionsCard } from './Components/InstructionsCard';
import { TestAreaCard } from './Components/TestAreaCard';
import { ContainerCard } from './Components/ContainerCard';

const { Title, Paragraph } = Typography;

const TestMFLoader: React.FC = () => {
  const { containerRef, testResults, loading, handleLoadSubApp, handleClear } =
    useTestMFLoaderState();

  return (
    <div style={{ padding: spacing.lg, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>
        <RocketOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        Orion-MF 微前端框架测试
      </Title>

      <Paragraph>Phase 0: 并行运行验证 - 验证 orion-mf 框架加载子应用的能力</Paragraph>

      <InstructionsCard />
      <TestAreaCard
        testResults={testResults}
        loading={loading}
        onLoadSubApp={handleLoadSubApp}
        onClear={handleClear}
      />
      <ContainerCard containerRef={containerRef} hasResults={testResults.length > 0} />
    </div>
  );
};

export default TestMFLoader;
