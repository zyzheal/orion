/**
 * AISecurityHeader - AI Security 页面头部
 * 抽取自 index.tsx (P2-9 Phase 118)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { AISecurityState } from '../useAISecurityState';

const { Title, Text } = Typography;

interface AISecurityHeaderProps {
  state: AISecurityState;
}

export const AISecurityHeader: React.FC<AISecurityHeaderProps> = ({ state }) => {
  const { loading, loadData, loadStats, setEvaluateModalVisible, setCreateModalVisible } = state;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[6],
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <SafetyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          AI Security
        </Title>
        <Text type="secondary">AI 安全策略</Text>
      </div>
      <Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            loadData();
            loadStats();
          }}
          loading={loading}
        >
          刷新
        </Button>
        <Button icon={<ThunderboltOutlined />} onClick={() => setEvaluateModalVisible(true)}>
          评估策略
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          创建策略
        </Button>
      </Space>
    </div>
  );
};
