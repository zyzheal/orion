/**
 * ModelEvolution table columns
 * 抽取自 index.tsx (P2-9 Phase 199)
 */
import { Progress, Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';
import { CAPABILITY_COLORS, CAPABILITY_LABEL, STATUS_MAP } from './constants';
import type { ModelEntry } from './types';

const { Text } = Typography;

export const buildColumns: () => ColumnsType<ModelEntry> = () => [
  {
    title: '模型',
    key: 'name',
    width: 140,
    render: (_: unknown, r: ModelEntry) => (
      <Space>
        <Text strong>{r.name}</Text>
        <Tag color="blue">{r.version}</Tag>
      </Space>
    ),
  },
  {
    title: '供应商',
    dataIndex: 'provider',
    key: 'provider',
    width: 100,
    render: (v: string) => <Text>{v}</Text>,
  },
  {
    title: '能力',
    key: 'capability',
    width: 80,
    render: (_: unknown, r: ModelEntry) => (
      <Tag color={CAPABILITY_COLORS[r.capability]}>{CAPABILITY_LABEL[r.capability]}</Tag>
    ),
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render: (_: unknown, r: ModelEntry) => {
      const info = STATUS_MAP[r.status];
      return <Tag color={info.color}>{info.label}</Tag>;
    },
  },
  {
    title: '采用率',
    key: 'adoptedRate',
    width: 100,
    render: (_: unknown, r: ModelEntry) => (
      <Progress
        percent={r.adoptedRate}
        size="small"
        strokeColor={colors.success[500]}
        format={() => `${r.adoptedRate}%`}
      />
    ),
  },
  {
    title: '灰度流量',
    key: 'canaryTraffic',
    width: 100,
    render: (_: unknown, r: ModelEntry) => (
      <Tag color={r.canaryTraffic > 0 ? 'orange' : 'default'}>
        {r.canaryTraffic > 0 ? `${r.canaryTraffic}%` : '-'}
      </Tag>
    ),
  },
  {
    title: '请求数',
    dataIndex: 'requests',
    key: 'requests',
    width: 100,
    sorter: (a, b) => a.requests - b.requests,
    render: (v: number) => <Text>{v}</Text>,
  },
  {
    title: '成本',
    dataIndex: 'cost',
    key: 'cost',
    width: 100,
    sorter: (a, b) => a.cost - b.cost,
    render: (v: number) => <Text strong>${v.toFixed(2)}</Text>,
  },
];
