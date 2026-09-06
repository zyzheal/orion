/**
 * RunColumns.tsx - 金丝雀分析表格列配置 + 筛选定义
 * 抽取自 CanaryAnalysis/index.tsx (P2-9 Phase 80)
 */
import { Typography, Space, Tag, Button } from 'antd';
import { spacing } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import type { CanaryAnalysisRun } from '@/api/canary-analysis';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const makeRunColumns = (
  handleViewRun: (run: CanaryAnalysisRun) => void,
): TableColumn<CanaryAnalysisRun>[] => [
  {
    key: 'deploymentId',
    title: '部署',
    dataIndex: 'deploymentId',
    width: 200,
    sortable: true,
    render: (_value: unknown, record: CanaryAnalysisRun) => (
      <Space direction="vertical" size={0}>
        <Text strong>Deployment #{record.deploymentId}</Text>
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          Run #{record.runNumber}
        </Text>
      </Space>
    ),
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 140,
    render: (value: unknown) => {
      const statusMap: Record<string, string> = {
        running: 'running',
        promote: 'success',
        rollback: 'failed',
        inconclusive: 'warning',
      };
      return (
        <StatusBadge status={(statusMap[String(value)] || 'unknown') as StatusType} size="small" />
      );
    },
  },
  {
    key: 'trafficSplit',
    title: '流量分布',
    dataIndex: 'trafficSplit',
    width: 160,
    render: (value: unknown) => {
      const split = value as { canary: number; baseline: number };
      if (!split) return '-';
      return (
        <Space>
          <Tag color="green">C: {split.canary}%</Tag>
          <Tag color="blue">B: {split.baseline}%</Tag>
        </Space>
      );
    },
  },
  {
    key: 'confidence',
    title: '置信度',
    dataIndex: 'confidence',
    width: 100,
    sortable: true,
    render: (value: unknown) => {
      if (!value) return <Text type="secondary">-</Text>;
      const conf = Number(value);
      return <Text>{(conf * 100).toFixed(1)}%</Text>;
    },
  },
  {
    key: 'decision',
    title: '决策',
    dataIndex: 'decision',
    width: 120,
    render: (value: unknown) => {
      const colorMap: Record<string, string> = {
        promote: 'green',
        rollback: 'red',
        continue: 'gold',
      };
      return value ? (
        <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>
      ): (
        <Text type="secondary">-</Text>
      );
    },
  },
  {
    key: 'startedAt',
    title: '开始时间',
    dataIndex: 'startedAt',
    width: 160,
    sortable: true,
    render: (value: unknown) => (
      <Text type="secondary" style={{ fontSize: spacing[3] }}>
        {dayjs(String(value)).fromNow()}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    render: (_: unknown, record: CanaryAnalysisRun) => (
      <Button type="link" size="small" onClick={() => handleViewRun(record)}>
        详情
      </Button>
    ),
  },
];

export const canaryFilterDefs: FilterDefinition[] = [
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: 'Running', value: 'running' },
      { label: 'Promote', value: 'promote' },
      { label: 'Rollback', value: 'rollback' },
      { label: 'Inconclusive', value: 'inconclusive' },
    ],
  },
];
