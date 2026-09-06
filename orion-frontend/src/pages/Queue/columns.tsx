/**
 * columns.tsx - 队列任务表格列定义
 * 抽取自 Queue/index.tsx (P2-9 Phase 87)
 */
import React from 'react';
import { Typography, Button, Space, Tag, Popconfirm, Tooltip } from 'antd';
import { EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { QueueJob, JobStatus } from '@/api/queue';
import { statusColorMap, statusLabelMap, statusIconMap } from './constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const makeQueueJobColumns = (
  openDetail: (job: QueueJob) => void,
  handleComplete: (id: string) => void,
  handleFail: (id: string) => void
): Array<{
  title: string;
  dataIndex?: string;
  key: string;
  width?: number;
  ellipsis?: boolean;
  render: (value: unknown, record: QueueJob) => React.ReactNode;
}> => [
  {
    title: '任务 ID',
    dataIndex: 'id',
    key: 'id',
    width: 120,
    render: (v) => <Text code style={{ fontSize: 12 }}>{String(v)}</Text>,
  },
  {
    title: '队列名称',
    dataIndex: 'queue',
    key: 'queue',
    width: 150,
    render: (v) => <Tag color="blue">{String(v)}</Tag>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v) => (
      <Tag color={statusColorMap[v as JobStatus]} icon={statusIconMap[v as JobStatus]}>
        {statusLabelMap[v as JobStatus]}
      </Tag>
    ),
  },
  {
    title: '重试次数',
    dataIndex: 'attempts',
    key: 'attempts',
    width: 80,
    render: (v) => <Text type={(v as number) > 2 ? 'danger' : 'secondary'}>{String(v)}</Text>,
  },
  {
    title: 'Payload',
    dataIndex: 'payload',
    key: 'payload',
    ellipsis: true,
    render: (v) => (
      <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
        {JSON.stringify(v).substring(0, 60)}...
      </Text>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 140,
    render: (v) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(String(v)).fromNow()}
      </Text>
    ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    render: (_: unknown, record: QueueJob) => (
      <Space size="small" wrap>
        <Tooltip title="详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
        </Tooltip>
        {record.status === 'processing' && (
          <>
            <Tooltip title="标记完成">
              <Popconfirm title="确认标记为完成?" onConfirm={() => handleComplete(record.id)}>
                <Button type="link" size="small" icon={<CheckCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
            <Tooltip title="标记失败">
              <Popconfirm title="确认标记为失败?" onConfirm={() => handleFail(record.id)}>
                <Button type="link" size="small" danger icon={<CloseCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          </>
        )}
        {record.status === 'failed' && record.attempts < 5 && (
          <Tooltip title="重试队列功能开发中，预计 Q4 交付">
            <Button type="link" size="small" danger icon={<SyncOutlined />} disabled />
          </Tooltip>
        )}
      </Space>
    ),
  },
];
