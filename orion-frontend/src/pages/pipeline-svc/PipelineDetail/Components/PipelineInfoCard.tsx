/**
 * PipelineInfoCard.tsx - 流水线基本信息 Descriptions 卡片
 * 抽取自 pipeline-svc/PipelineDetail/index.tsx (P2-9 Phase 103)
 */
import React from 'react';
import { Descriptions, Space, Typography, Tag, Badge } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CardPanel from '@/components/CardPanel';
import StatusBadge, { StatusType } from '@/components/StatusBadge';
import type { PipelineDetailModel } from '../types';
import { triggerLabel } from '../constants';
import { formatDuration } from '../format';

const { Text } = Typography;

interface PipelineInfoCardProps {
  pipeline: PipelineDetailModel;
  completedStages: number;
  totalStages: number;
  progressPercent: number;
}

export const PipelineInfoCard: React.FC<PipelineInfoCardProps> = ({
  pipeline,
  completedStages,
  totalStages,
  progressPercent,
}) => (
  <CardPanel>
    <Descriptions column={4} size="small" bordered labelStyle={{ width: 120 }}>
      <Descriptions.Item label="状态">
        <StatusBadge status={pipeline.status as StatusType} size="small" />
      </Descriptions.Item>
      <Descriptions.Item label="分支">
        <Tag color="blue">{pipeline.branch}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="触发人">
        <Text code>{pipeline.author}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="触发方式">
        <Tag>{triggerLabel[pipeline.trigger || ''] || pipeline.trigger}</Tag>
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
          <Text type="secondary">{dayjs(pipeline.endTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        )}
      </Descriptions.Item>
      <Descriptions.Item label="耗时">
        {formatDuration(pipeline.duration)}
      </Descriptions.Item>
      <Descriptions.Item label="进度">
        <Space>
          <Badge status="processing" text={`${completedStages}/${totalStages} 阶段完成`} />
          <Text type="secondary">({progressPercent}%)</Text>
        </Space>
      </Descriptions.Item>
    </Descriptions>
  </CardPanel>
);
