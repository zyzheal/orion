/**
 * AuditLogs columns
 * 抽取自 index.tsx (P2-9 Phase 186)
 */
import { Button, Tag, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { PipelineAuditLog, AuditAction, AuditOutcome } from '@/api/audit-logs';
import { actionColor, outcomeIcon } from './constants';
import dayjs from 'dayjs';

const { Text } = Typography;

export const buildLogColumns = (onViewDetail: (log: PipelineAuditLog) => void) => [
  {
    title: 'Time',
    dataIndex: 'createdAt',
    width: 160,
    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    title: 'Action',
    dataIndex: 'action',
    width: 140,
    render: (a: AuditAction) => <Tag color={actionColor[a] || 'default'}>{a}</Tag>,
  },
  {
    title: 'Outcome',
    dataIndex: 'outcome',
    width: 90,
    render: (o: AuditOutcome) => (
      <Tag color={o === 'success' ? 'green' : o === 'failed' ? 'red' : 'orange'}>
        {outcomeIcon[o]} {o}
      </Tag>
    ),
  },
  {
    title: 'Actor',
    dataIndex: 'actor',
    width: 120,
  },
  {
    title: 'Run ID',
    dataIndex: 'runId',
    width: 100,
    render: (v: string) => (
      <Text code style={{ fontSize: 11 }}>
        {v.slice(0, 12)}...
      </Text>
    ),
  },
  {
    title: 'Error',
    dataIndex: 'errorMessage',
    ellipsis: true,
    render: (v: string) =>
      v ? (
        <Text type="danger" style={{ fontSize: 12 }}>
          {v}
        </Text>
      ) : (
        '-'
      ),
  },
  {
    title: 'Duration',
    dataIndex: 'durationMs',
    width: 90,
    render: (v: number) => (v ? `${v}ms` : '-'),
  },
  {
    title: '操作',
    width: 100,
    render: (_: unknown, r: PipelineAuditLog) => (
      <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewDetail(r)}>
        详情
      </Button>
    ),
  },
];
