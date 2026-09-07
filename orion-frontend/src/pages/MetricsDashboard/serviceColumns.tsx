/**
 * MetricsDashboard service health table columns
 * 抽取自 index.tsx (P2-9 Phase 128)
 */
import { Typography, Tag } from 'antd';
import { colors } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import type { ServiceHealthRow } from './types';

const { Text } = Typography;

export function getStatusColor(status: ServiceHealthRow['status']): string {
  switch (status) {
    case 'healthy':
      return colors.success[500];
    case 'degraded':
      return colors.warning[500];
    case 'unhealthy':
      return colors.error[500];
  }
}

export function getStatusLabel(status: ServiceHealthRow['status']): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'unhealthy':
      return 'Unhealthy';
  }
}

export const serviceColumns: TableColumn<ServiceHealthRow>[] = [
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
      record ? (
        <Tag color={getStatusColor(record.status)}>{getStatusLabel(record.status)}</Tag>
      ) : null,
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
