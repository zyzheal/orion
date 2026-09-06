/**
 * DashboardColumns.tsx - DashboardNew 表格列配置
 * 抽取自 DashboardNew/index.tsx (P2-9 Phase 67)
 */
import { useMemo } from 'react';
import { Tag, Badge, Button, Space, Typography } from 'antd';
import { type ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';
import { statusColors, priorityColors } from './constants';
import type { TaskRecord, PipelineRecord } from './types';

const { Text } = Typography;

export const useTaskColumns = (): ColumnsType<TaskRecord> => {
  return useMemo<ColumnsType<TaskRecord>>(() => [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: TaskRecord) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Text strong>{text}</Text>
          <Space size={8} style={{ marginTop: 4 }}>
            <Tag color={priorityColors[record.priority]}>{record.priority.toUpperCase()}</Tag>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              截止：{record.due}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config: Record<string, { text: string; color: string }> = {
          'in-progress': { text: '进行中', color: 'blue' },
          todo: { text: '待开始', color: 'default' },
          done: { text: '已完成', color: 'green' },
        };
        const { text, color } = config[status] || { text: status, color: 'default' };
        return (
          <Badge
            status={color as 'success' | 'processing' | 'error' | 'default' | 'warning'}
            text={text}
          />
        );
      },
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      render: (assignee: string) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {assignee}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Button type="link" size="small">
          处理
        </Button>
      ),
    },
  ], []);
};

export const usePipelineColumns = ({
  navigate,
  handleRetry,
}: {
  navigate: (path: string) => void;
  handleRetry: (runId: string) => void;
}): ColumnsType<PipelineRecord> => {
  return useMemo<ColumnsType<PipelineRecord>>(() => [
    {
      title: 'Pipeline',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Text
          code
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => navigate(`/pipelines/${record.pipelineId}`)}
        >
          {name}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={
            statusColors[status] as 'success' | 'processing' | 'error' | 'default' | 'warning'
          }
          text={status}
        />
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
    },
    {
      title: '触发人',
      dataIndex: 'trigger',
      key: 'trigger',
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: PipelineRecord) => (
        <Space>
          <Button
            type="link"
            size="small"
            disabled={record.status === 'pending'}
            onClick={() => navigate(`/pipelines/${record.pipelineId}`)}
          >
            查看
          </Button>
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleRetry(record.runId || record.pipelineId)}
            >
              重试
            </Button>
          )}
        </Space>
      ),
    },
  ], [handleRetry, navigate]);
};
