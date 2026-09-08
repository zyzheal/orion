/**
 * ContainerCard.tsx - 容器区域卡
 * 抽取自 index.tsx (P2-9 Phase 229)
 */
import React, { type RefObject } from 'react';
import { Card, Typography } from 'antd';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  containerRef: RefObject<HTMLDivElement>;
  hasResults: boolean;
}

export const ContainerCard: React.FC<Props> = ({ containerRef, hasResults }) => (
  <Card>
    <Title level={4}>容器区域</Title>
    <Text type="secondary">子应用将渲染到下方容器中（使用 Shadow DOM 隔离）</Text>
    <div
      ref={containerRef}
      style={{
        marginTop: spacing.md,
        minHeight: 200,
        border: `1px dashed ${colors.neutral[300]}`,
        borderRadius: 8,
        padding: spacing.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.neutral[500],
      }}
    >
      {hasResults ? '' : '点击上方按钮加载子应用'}
    </div>
  </Card>
);
