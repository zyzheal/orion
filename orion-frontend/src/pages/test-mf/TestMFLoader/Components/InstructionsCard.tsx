/**
 * InstructionsCard.tsx - 测试说明卡
 * 抽取自 index.tsx (P2-9 Phase 229)
 */
import React from 'react';
import { Card, Divider, Typography } from 'antd';
import { spacing } from '@/tokens';
import { Alert } from './Alert';

const { Title, Paragraph, Text } = Typography;

export const InstructionsCard: React.FC = () => (
  <Card style={{ marginBottom: spacing.lg }}>
    <Title level={4}>测试说明</Title>
    <Paragraph>
      本页面用于验证 orion-mf 框架能否正常加载子应用。 当前阶段为{' '}
      <Text strong>并行运行验证</Text>，wujie 和 orion-mf 共存。
    </Paragraph>
    <Divider />

    <Title level={4}>测试步骤</Title>
    <ol>
      <li>点击下方按钮尝试加载对应子应用</li>
      <li>观察控制台日志和页面结果</li>
      <li>预期：子应用需要先完成 Module Federation 改造才能成功加载</li>
    </ol>

    <Alert type="info" showIcon>
      注意：当前 3 个子应用（dba/knowledge/visor）尚未改造为 Module Federation，
      预计会出现加载失败。这是正常的迁移阶段状态。
    </Alert>
  </Card>
);
