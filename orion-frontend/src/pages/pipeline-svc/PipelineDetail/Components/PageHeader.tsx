/**
 * PageHeader.tsx - 顶部返回列表+标题+状态+重新运行按钮
 * 抽取自 pipeline-svc/PipelineDetail/index.tsx (P2-9 Phase 103)
 */
import React from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, ApiOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import StatusBadge, { StatusType } from '@/components/StatusBadge';
import type { PipelineDetailModel } from '../types';

const { Title, Text } = Typography;

interface PageHeaderProps {
  pipeline: PipelineDetailModel;
  loading: boolean;
  isRerunning: boolean;
  onBack: () => void;
  onRerun: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  pipeline,
  loading,
  isRerunning,
  onBack,
  onRerun,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    }}
  >
    <Button
      type="text"
      icon={<ArrowLeftOutlined />}
      onClick={onBack}
      disabled={loading}
    >
      返回列表
    </Button>
    <div>
      <Title
        level={2}
        style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
      >
        <ApiOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        {pipeline.name} #{pipeline.runNumber}
      </Title>
      <Text type="secondary">
        {pipeline.commit && (
          <Tag color="default" style={{ marginRight: spacing.sm }}>
            {pipeline.commit}
          </Tag>
        )}
        分支: {pipeline.branch}
      </Text>
    </div>
    <div style={{ marginLeft: 'auto' }}>
      <Space>
        <StatusBadge status={pipeline.status as StatusType} size="medium" />
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={isRerunning}
          onClick={onRerun}
          disabled={loading || (pipeline.status as StatusType) === 'running'}
        >
          {isRerunning ? '触发中...' : '重新运行'}
        </Button>
      </Space>
    </div>
  </div>
);
