/**
 * ChangeIntelligenceHeader - 顶部标题 + 操作按钮
 * 抽取自 index.tsx (P2-9 Phase 119)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { ReloadOutlined, ThunderboltOutlined, BranchesOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ChangeIntelligenceState } from '../useChangeIntelligenceState';

const { Title, Text } = Typography;

interface ChangeIntelligenceHeaderProps {
  state: ChangeIntelligenceState;
}

export const ChangeIntelligenceHeader: React.FC<ChangeIntelligenceHeaderProps> = ({ state }) => {
  const { loading, loadData, setAnalyzeModalVisible } = state;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <BranchesOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          AI 变更智能
        </Title>
        <Text type="secondary">语义影响面分析与风险评分</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={() => setAnalyzeModalVisible(true)}
        >
          触发分析
        </Button>
      </Space>
    </div>
  );
};
