/**
 * RunnerColumns.tsx - Runner 表格列定义
 * 抽取自 RunnerManagement/index.tsx (P2-9 Phase 59)
 */
import { useMemo } from 'react';
import { Space, Tag, Button, Popconfirm, Tooltip } from 'antd';
import { CloudServerOutlined, EditOutlined, EyeOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { colors } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import type { Runner, RunnerStatus } from '@/api/runners';
import { STATUS_CONFIG, isHeartbeatStale } from './constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

export interface RunnerColumnHandlers {
  handleDeregister: (id: string) => void;
  handleViewDetail: (runner: Runner) => void;
  handleEditRunner: (runner: Runner) => void;
}

export const useRunnerColumns = (
  handlers: RunnerColumnHandlers,
): TableColumn<Runner>[] => {
  const { handleDeregister, handleViewDetail, handleEditRunner } = handlers;

  return useMemo<TableColumn<Runner>[]>(
    () => [
      {
        key: 'name',
        title: 'Runner',
        dataIndex: 'name',
        width: 220,
        sortable: true,
        filterable: true,
        render: (_value: unknown, record) => (
          <Space direction="vertical" size={0}>
            <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }}>
              <CloudServerOutlined style={{ marginRight: 6, color: colors.neutral[500] }} />
              {record.name}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {record.id.slice(0, 8)}...
            </Text>
          </Space>
        ),
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value: unknown, record) => {
          const status = value as RunnerStatus;
          const cfg = STATUS_CONFIG[status];
          const stale = isHeartbeatStale(record.lastHeartbeat);
          return (
            <Space>
              <Tag color={cfg.color}>{cfg.label}</Tag>
              {stale && (
                <Tooltip title="心跳超时（> 5 分钟）">
                  <ClockCircleOutlined style={{ color: colors.warning[500], fontSize: 14 }} />
                </Tooltip>
              )}
            </Space>
          );
        },
      },
      {
        key: 'labels',
        title: '标签',
        dataIndex: 'labels',
        width: 200,
        render: (value: unknown) => {
          const labels = value as string[];
          return (
            <div style={{ maxWidth: 200 }}>
              {labels.slice(0, 3).map((label) => (
                <Tag key={label} color="blue" style={{ marginBottom: 2 }}>
                  {label}
                </Tag>
              ))}
              {labels.length > 3 && <Tag color="default">+{labels.length - 3}</Tag>}
              {labels.length === 0 && <Text type="secondary">-</Text>}
            </div>
          );
        },
      },
      {
        key: 'jobs',
        title: '任务',
        dataIndex: 'currentJobs',
        width: 120,
        sortable: true,
        render: (_value: unknown, record) => (
          <Text>
            {record.currentJobs} / {record.maxConcurrent}
          </Text>
        ),
      },
      {
        key: 'osArch',
        title: 'OS / 架构',
        width: 130,
        render: (_value: unknown, record) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.metadata?.os || '-'} / {record.metadata?.arch || '-'}
          </Text>
        ),
      },
      {
        key: 'lastHeartbeat',
        title: '最后心跳',
        dataIndex: 'lastHeartbeat',
        width: 140,
        sortable: true,
        render: (value: unknown) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(String(value)).fromNow()}
          </Text>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 160,
        render: (_: unknown, record) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditRunner(record)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            <Popconfirm
              title="确认注销"
              description={`确定要注销 Runner "${record.name}" 吗？此操作不可撤销。`}
              onConfirm={() => handleDeregister(record.id)}
              okText="确认注销"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                注销
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDeregister, handleViewDetail, handleEditRunner],
  );
};
