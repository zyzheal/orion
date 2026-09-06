/**
 * MetricColumns.tsx - DORA 指标表格列配置
 * 抽取自 EfficiencyDashboard/index.tsx (P2-9 Phase 79)
 */
import { Typography, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';
import type { MetricRow } from './types';
import type { DoraBenchmarks, DoraBenchmarkCategory } from './types';

const { Text } = Typography;

export const makeMetricColumns = (benchmarks: DoraBenchmarks | null): ColumnsType<MetricRow> => [
  {
    title: '指标',
    dataIndex: 'name',
    key: 'name',
    render: (text: string, record: MetricRow) => (
      <Space>
        {record.icon}
        <Text strong>{text}</Text>
      </Space>
    ),
  },
  {
    title: '当前值',
    dataIndex: 'currentValue',
    key: 'currentValue',
    render: (value: unknown, record: MetricRow) => (
      <Text
        strong
        style={{ color: record.trend === 'up' ? colors.success[500] : colors.warning[500] }}
      >
        {String(value)}
      </Text>
    ),
  },
  {
    title: '等级',
    dataIndex: 'level',
    key: 'level',
    render: (level: string) => {
      const colorMap: Record<string, string> = {
        Elite: colors.success[500],
        High: colors.primary[500],
        Medium: colors.warning[500],
        Low: colors.error[400],
      };
      return <Tag color={colorMap[level]}>{level}</Tag>;
    },
  },
  {
    title: 'Benchmark',
    key: 'benchmark',
    render: (_: unknown, record: MetricRow) => {
      if (!benchmarks) return '-';
      const benchmarkKey = record.benchmarkKey;
      const category = (benchmarks as unknown as Record<string, DoraBenchmarkCategory>)[
        benchmarkKey
      ];
      if (!category) return '-';
      return (
        <Space direction="vertical" size={0}>
          <Text>
            <Tag color="colors.success[500]">Elite</Tag> {category.elite}
          </Text>
          <Text>
            <Tag color="colors.primary[500]">High</Tag> {category.high}
          </Text>
          <Text>
            <Tag color="colors.warning[500]">Med</Tag> {category.medium}
          </Text>
        </Space>
      );
    },
  },
];
