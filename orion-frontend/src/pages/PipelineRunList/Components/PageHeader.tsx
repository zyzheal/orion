/**
 * PipelineRunList PageHeader
 * 抽取自 index.tsx (P2-9 Phase 180)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  pipelineName: string | null;
  pipelineId: string | undefined;
  totalCount: number;
  loading: boolean;
  onRefresh: () => void;
  onBackToList: () => void;
}

export const PageHeader = ({
  pipelineName,
  pipelineId,
  totalCount,
  loading,
  onRefresh,
  onBackToList,
}: PageHeaderProps) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}>
        <PlayCircleOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        {pipelineName ? `${pipelineName} - 运行历史` : 'Pipeline 运行历史'}
      </Title>
      <Text type="secondary">
        {pipelineId ? `Pipeline ID: ${pipelineId}` : '全部 Pipeline'}
        {' · '}共 {totalCount} 条运行记录
      </Text>
    </div>
    <Space>
      {pipelineId && (
        <Button icon={<ArrowLeftOutlined />} onClick={onBackToList}>
          返回列表
        </Button>
      )}
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
