/**
 * Pipeline Detail Header
 * 页面头部 + 状态卡片（抽取自 index.tsx）
 */
import React from 'react';
import { Typography, Button, Space, Tag, Card, Descriptions, Badge } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, ClockCircleOutlined, ApiOutlined } from '@ant-design/icons';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import { triggerLabel } from './constants';
import type { PipelineDisplay } from './types';

const { Title, Text } = Typography;

export interface PipelineHeaderProps {
  pipeline: PipelineDisplay;
  isRerunning: boolean;
  loading: boolean;
  totalStages: number;
  completedStages: number;
  progressPercent: number;
  formatDuration: (value?: number | string) => string;
  onBack: () => void;
  onRerun: () => void;
}

export const PipelineHeader: React.FC<PipelineHeaderProps> = ({
  pipeline,
  isRerunning,
  loading,
  totalStages,
  completedStages,
  progressPercent,
  formatDuration,
  onBack,
  onRerun,
}) => (
  <>
    {/* 页面头部 - 与列表页 space-between 布局一致 */}
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <Title
          level={2}
          style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
        >
          <ApiOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          {pipeline.name}
        </Title>
        <Space size="middle" wrap>
          <Tag color="default" style={{ fontSize: 12 }}>
            #{pipeline.runNumber}
          </Tag>
          <StatusBadge status={pipeline.status as StatusType} size="small" />
          <Text type="secondary" style={{ fontSize: 13 }}>
            分支:{' '}
            <Text code style={{ fontSize: 12 }}>
              {pipeline.branch}
            </Text>
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            触发: {triggerLabel[pipeline.trigger] || pipeline.trigger}
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            由 {pipeline.author || '-'} 触发
          </Text>
          {pipeline.commit && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              Commit:{' '}
              <Text code style={{ fontSize: 12 }}>
                {pipeline.commit.slice(0, 7)}
              </Text>
            </Text>
          )}
        </Space>
      </div>
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          返回列表
        </Button>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={isRerunning}
          onClick={onRerun}
          disabled={!pipeline || pipeline.status === 'running' || loading}
        >
          {isRerunning ? '触发中...' : '重新运行'}
        </Button>
      </Space>
    </div>

    {/* Pipeline info card */}
    <Card style={{ marginBottom: spacing.lg }}>
      <Descriptions column={3} size="small" bordered labelStyle={{ width: 100 }}>
        <Descriptions.Item label="状态">
          <StatusBadge status={pipeline.status as StatusType} size="small" />
        </Descriptions.Item>
        <Descriptions.Item label="开始时间">
          <Space>
            <ClockCircleOutlined />
            <Text type="secondary">
              {dayjs(pipeline.startTime).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {pipeline.endTime ? (
            <Text type="secondary">
              {dayjs(pipeline.endTime).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          ) : (
            <Text type="secondary">-</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="耗时">{formatDuration(pipeline.duration)}</Descriptions.Item>
        <Descriptions.Item label="进度">
          <Space>
            <Badge status="processing" text={`${completedStages}/${totalStages} 阶段完成`} />
            <Text type="secondary">({progressPercent}%)</Text>
          </Space>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  </>
);
