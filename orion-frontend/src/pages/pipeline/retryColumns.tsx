/**
 * Pipeline 重试与回滚表格列定义
 * 抽取自 PipelineRetryRollback.tsx (P2-9 Phase 111)
 */
import React from 'react';
import { Space, Tag, Button, Popconfirm, Typography } from 'antd';
import {
  ReloadOutlined,
  RollbackOutlined,
  StopOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import type { PipelineRunItem } from './types';
import {
  formatDuration,
  statusColorMap,
  statusIconMap,
  statusLabelMap,
} from './runRetryConstants';

const { Text } = Typography;

export interface BuildRetryColumnsDeps {
  handleRetry: (run: PipelineRunItem) => void;
  handleRollback: (run: PipelineRunItem) => void;
  handleCancel: (run: PipelineRunItem) => void;
}

export const buildRetryColumns = ({
  handleRetry,
  handleRollback,
  handleCancel,
}: BuildRetryColumnsDeps): Array<{
  title: string;
  dataIndex?: string;
  key: string;
  width?: number;
  render?: (value: any, record: PipelineRunItem) => React.ReactNode;
}> => [
  {
    title: 'Pipeline 名称',
    dataIndex: 'pipelineName',
    key: 'pipelineName',
    render: (_value: any, record: PipelineRunItem) => (
      <Space>
        <Text strong>{record.pipelineName}</Text>
        <Text type="secondary">#{record.runNumber}</Text>
      </Space>
    ),
  },
  {
    title: 'Run ID',
    dataIndex: 'id',
    key: 'id',
    render: (_value: any, record: PipelineRunItem) => (
      <Text code style={{ fontSize: 12 }}>
        {record.id}
      </Text>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (_value: any, record: PipelineRunItem) => {
      const color = statusColorMap[record.status] || colors.neutral[500];
      const icon = statusIconMap[record.status] || <InfoCircleOutlined />;
      return (
        <Tag color={color} style={{ marginRight: 0 }}>
          <span style={{ marginRight: 4 }}>{icon}</span>
          {statusLabelMap[record.status] || record.status}
        </Tag>
      );
    },
  },
  {
    title: '耗时',
    dataIndex: 'duration',
    key: 'duration',
    render: (_value: any, record: PipelineRunItem) => formatDuration(record.duration || 0),
  },
  {
    title: '时间',
    dataIndex: 'startTime',
    key: 'startTime',
    render: (_value: any, record: PipelineRunItem) => {
      const formatted = dayjs(record.startTime).format('MM-DD HH:mm');
      const relative = dayjs(record.startTime).fromNow();
      return (
        <Space direction="vertical" size={0}>
          <Text>{formatted}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {relative}
          </Text>
        </Space>
      );
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (_value: any, record: PipelineRunItem) => {
      const isFailed = record.status === 'failed';
      const isRunning = record.status === 'running';
      const isSuccess = record.status === 'success';

      return (
        <Space>
          {isFailed && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleRetry(record)}
              icon={<ReloadOutlined />}
              style={{ borderColor: colors.warning[500], color: colors.warning[500] }}
            >
              重试
            </Button>
          )}
          {(isFailed || isSuccess) && (
            <Popconfirm
              title="确认回滚"
              description={`确定要回滚 ${record.pipelineName} Run #${record.runNumber}？`}
              onConfirm={() => handleRollback(record)}
              okText="确认回滚"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                danger
                icon={<RollbackOutlined />}
                style={{ color: colors.error[500], borderColor: colors.error[500] }}
              >
                回滚
              </Button>
            </Popconfirm>
          )}
          {isRunning && (
            <Popconfirm
              title="确认取消"
              description={`确定要取消正在运行的 ${record.pipelineName} Run #${record.runNumber}？`}
              onConfirm={() => handleCancel(record)}
              okText="确认取消"
              cancelText="继续运行"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<StopOutlined />}>
                取消
              </Button>
            </Popconfirm>
          )}
          {record.status === 'cancelled' && (
            <Button
              size="small"
              type="text"
              disabled
              icon={<ClockCircleOutlined />}
              style={{ color: colors.neutral[500] }}
            >
              已取消
            </Button>
          )}
          {record.status === 'pending' && (
            <Button
              size="small"
              type="text"
              disabled
              icon={<ClockCircleOutlined />}
              style={{ color: colors.warning[500] }}
            >
              等待中
            </Button>
          )}
        </Space>
      );
    },
  },
];
