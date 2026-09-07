/**
 * MetricsDashboard service health columns
 * 抽取自 index.tsx (P2-9 Phase 145)
 */
import { Tag, Typography } from 'antd';
import { colors } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import type { ServiceHealthRow } from './types';
import { getStatusColor, getStatusLabel } from './helpers';

const { Text } = Typography;

export const buildServiceColumns = (): TableColumn<ServiceHealthRow>[] => [
  {
    key: 'serviceName',
    title: 'Service Name',
    dataIndex: 'serviceName',
    sortable: true,
    render: (value: unknown) => <Text strong>{String(value)}</Text>,
  },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    sortable: true,
    render: (_value: unknown, record?: ServiceHealthRow) =>
      record ? <Tag color={getStatusColor(record.status)}>{getStatusLabel(record.status)}</Tag> : null,
  },
  {
    key: 'requestRate',
    title: 'Request Rate',
    dataIndex: 'requestRate',
    sortable: true,
  },
  {
    key: 'errorRate',
    title: 'Error Rate',
    dataIndex: 'errorRate',
    sortable: true,
    render: (value: unknown) => {
      const rate = parseFloat(String(value).replace('%', '')) || 0;
      return (
        <Text
          style={{
            color:
              rate > 1
                ? colors.error[500]
                : rate > 0.5
                  ? colors.warning[500]
                  : colors.success[500],
          }}
        >
          {String(value)}
        </Text>
      );
    },
  },
  {
    key: 'latency',
    title: 'Latency',
    dataIndex: 'latency',
    sortable: true,
    render: (value: unknown) => {
      const ms = parseInt(String(value).replace('ms', ''), 10) || 0;
      return (
        <Text
          style={{
            color:
              ms > 500
                ? colors.error[500]
                : ms > 200
                  ? colors.warning[500]
                  : colors.success[500],
          }}
        >
          {String(value)}
        </Text>
      );
    },
  },
];
