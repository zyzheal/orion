/**
 * HealthDashboard service columns
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import { Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors } from '@/tokens';
import type { ServiceHealthRow } from '@/api/health';
import { serviceStatusTag } from './tagRenderers';

const { Text } = Typography;

export const serviceColumns: ColumnsType<ServiceHealthRow> = [
  {
    title: '服务',
    dataIndex: 'serviceName',
    key: 'serviceName',
    width: 180,
    render: (name: string) => <Text strong>{name}</Text>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    filters: [
      { text: '健康', value: 'healthy' },
      { text: '降级', value: 'degraded' },
      { text: '异常', value: 'unhealthy' },
    ],
    onFilter: (value, record: ServiceHealthRow) => record.status === value,
    render: (s: string) => serviceStatusTag(s),
  },
  {
    title: '平均延迟',
    dataIndex: 'latencyMs',
    key: 'latencyMs',
    width: 120,
    sorter: (a: ServiceHealthRow, b: ServiceHealthRow) => a.latencyMs - b.latencyMs,
    render: (v: number) => (
      <Text
        style={{ color: v > 500 ? colors.error[500] : v > 200 ? colors.warning[500] : undefined }}
      >
        {v} ms
      </Text>
    ),
  },
  {
    title: '错误率',
    dataIndex: 'errorRate',
    key: 'errorRate',
    width: 120,
    sorter: (a: ServiceHealthRow, b: ServiceHealthRow) => a.errorRate - b.errorRate,
    render: (v: number) => (
      <Text
        style={{
          color: v > 5 ? colors.error[500] : v > 1 ? colors.warning[500] : colors.success[500],
        }}
      >
        {v.toFixed(2)}%
      </Text>
    ),
  },
  {
    title: '可用性',
    dataIndex: 'uptimePercent',
    key: 'uptimePercent',
    width: 120,
    sorter: (a: ServiceHealthRow, b: ServiceHealthRow) => a.uptimePercent - b.uptimePercent,
    render: (v: number) => (
      <Text style={{ color: v < 99 ? colors.warning[500] : colors.success[500] }}>
        {v.toFixed(2)}%
      </Text>
    ),
  },
  {
    title: '最近检测',
    dataIndex: 'lastChecked',
    key: 'lastChecked',
    width: 160,
    render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
  },
];
