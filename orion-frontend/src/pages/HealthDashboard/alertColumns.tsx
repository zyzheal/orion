/**
 * HealthDashboard alert columns
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import { Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { HealthAlert } from '@/api/health';
import { severityTag, statusTag } from './tagRenderers';

const { Text } = Typography;

export const alertColumns: ColumnsType<HealthAlert> = [
  {
    title: '服务',
    dataIndex: 'serviceName',
    key: 'serviceName',
    width: 160,
    render: (name: string) => <Text strong>{name}</Text>,
  },
  {
    title: '严重级别',
    dataIndex: 'severity',
    key: 'severity',
    width: 100,
    render: (s: string) => severityTag(s),
  },
  {
    title: '描述',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    filters: [
      { text: '活跃', value: 'active' },
      { text: '已确认', value: 'acknowledged' },
      { text: '已解决', value: 'resolved' },
    ],
    onFilter: (value, record: HealthAlert) => record.status === value,
    render: (s: string) => statusTag(s),
  },
  {
    title: '触发时间',
    dataIndex: 'triggeredAt',
    key: 'triggeredAt',
    width: 170,
    sorter: (a: HealthAlert, b: HealthAlert) =>
      dayjs(a.triggeredAt).unix() - dayjs(b.triggeredAt).unix(),
    render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm'),
  },
];
