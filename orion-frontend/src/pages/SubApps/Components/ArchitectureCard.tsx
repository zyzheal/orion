/**
 * ArchitectureCard.tsx - 微前端架构说明卡
 * 抽取自 index.tsx (P2-9 Phase 225)
 */
import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Paragraph } = Typography;
import { colors, spacing } from '@/tokens';

export const ArchitectureCard: React.FC = () => (
  <Card
    style={{
      marginTop: 32,
      background: colors.neutral[50],
      border: 'none',
    }}
  >
    <Title level={5}>🏗️ 微前端架构说明</Title>
    <Paragraph style={{ fontSize: spacing[4], color: colors.neutral[500] }}>
      <ul style={{ paddingLeft: 20 }}>
        <li>
          采用 <strong>Wujie（无界）</strong> 微前端框架，实现子系统间完全隔离
        </li>
        <li>支持子系统独立开发、独立部署、技术栈无关</li>
        <li>
          通过 <strong>eventBus</strong> 实现主子应用通信
        </li>
        <li>共享用户认证状态、主题配置等全局状态</li>
        <li>支持子应用预加载和保活模式，提升切换体验</li>
      </ul>
    </Paragraph>
  </Card>
);
