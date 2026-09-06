/**
 * RunMetadataCard - 运行元数据卡
 * 抽取自 index.tsx（P2-9 Phase 37）
 */
import React from 'react';
import { Card, Descriptions, Tag, Typography, Space, Badge } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import { formatDuration } from './constants';

const { Text } = Typography;

export interface RunMetadataCardProps {
  pipeline: any;
  runId: string | undefined;
  id: string | undefined;
  elapsedSeconds: number;
  completedStages: number;
  totalStages: number;
  progressPercent: number;
}

export const RunMetadataCard: React.FC<RunMetadataCardProps> = ({
  pipeline,
  runId,
  id,
  elapsedSeconds,
  completedStages,
  totalStages,
  progressPercent,
}) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Descriptions column={4} size="small" labelStyle={{ width: 80 }}>
      <Descriptions.Item label="Pipeline">
        <Text strong>{pipeline?.name || '-'}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="运行 ID">
        <Text code>{pipeline?.runNumber || runId || id}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="分支">
        {pipeline?.branch ? <Tag color="blue">{pipeline.branch}</Tag> : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="触发人">
        <Text code>{pipeline?.author || '-'}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="开始时间">
        <Space>
          <ClockCircleOutlined />
          <Text type="secondary">
            {pipeline?.startTime ? dayjs(pipeline.startTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Text>
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="耗时">
        {pipeline?.status === 'running' ? (
          <Text type="secondary">{formatDuration(elapsedSeconds)}</Text>
        ) : (
          <Text type="secondary">{formatDuration(pipeline?.duration)}</Text>
        )}
      </Descriptions.Item>
      <Descriptions.Item label="进度">
        <Space>
          <Badge
            status={
              pipeline?.status === 'success'
                ? 'success'
                : pipeline?.status === 'failed'
                  ? 'error'
                  : 'processing'
            }
            text={`${completedStages}/${totalStages} 阶段完成`}
          />
          <Text type="secondary">({progressPercent}%)</Text>
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="提交">
        {pipeline?.commit && (
          <Tag color="default" style={{ marginRight: spacing.sm }}>
            {pipeline.commit}
          </Tag>
        )}
      </Descriptions.Item>
    </Descriptions>
  </Card>
);
