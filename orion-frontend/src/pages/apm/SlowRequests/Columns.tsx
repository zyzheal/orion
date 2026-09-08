/**
 * Columns.tsx - APM 慢请求 表格列
 * 抽取自 index.tsx (P2-9 Phase 245)
 */
import { Tag } from 'antd';
import { colors } from '@/tokens/colors';

export const queryColumns: any[] = [
  {
    title: '排名',
    key: 'rank',
    render: (_: unknown, __: unknown, index: number) => (
      <Tag
        color={
          index < 3 ? colors.error[500] : index < 10 ? colors.warning[500] : colors.neutral[400]
        }
      >
        #{index + 1}
      </Tag>
    ),
  },
  {
    title: 'SQL 语句',
    dataIndex: 'normalized_query',
    key: 'normalized_query',
    ellipsis: true,
    render: (v: string) => <code style={{ fontSize: 12 }}>{v?.slice(0, 80) || '-'}</code>,
  },
  {
    title: '耗时',
    dataIndex: 'duration_ms',
    key: 'duration_ms',
    render: (ms: number) => (
      <span
        style={{
          color:
            ms > 5000 ? colors.error[500] : ms > 2000 ? colors.warning[500] : colors.neutral[900],
          fontWeight: 600,
        }}
      >
        {ms} ms
      </span>
    ),
  },
  {
    title: '参数数',
    dataIndex: 'params_count',
    key: 'params_count',
    render: (v: number) => v ?? '-',
  },
  {
    title: '错误',
    dataIndex: 'error',
    key: 'error',
    render: (v: string) => (v ? <Tag color={colors.error[500]}>{v}</Tag> : '-'),
  },
  {
    title: '时间',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (v: string) => new Date(v).toLocaleString(),
  },
];

export const patternColumns: any[] = [
  {
    title: 'SQL 模式',
    dataIndex: 'normalized_query',
    key: 'normalized_query',
    ellipsis: true,
    render: (v: string) => <code style={{ fontSize: 12 }}>{v?.slice(0, 60) || '-'}</code>,
  },
  { title: '执行次数', dataIndex: 'execution_count', key: 'execution_count' },
  {
    title: '平均耗时',
    dataIndex: 'avg_duration_ms',
    key: 'avg_duration_ms',
    render: (ms: number) => `${ms.toFixed(0)} ms`,
  },
  {
    title: 'P95 耗时',
    dataIndex: 'p95_duration_ms',
    key: 'p95_duration_ms',
    render: (ms: number) => (
      <span style={{ color: ms > 2000 ? colors.error[500] : colors.neutral[900] }}>
        {ms.toFixed(0)} ms
      </span>
    ),
  },
  {
    title: '错误次数',
    dataIndex: 'error_count',
    key: 'error_count',
    render: (v: number) => (v > 0 ? <Tag color={colors.error[500]}>{v}</Tag> : '-'),
  },
  {
    title: '最近执行',
    dataIndex: 'last_executed',
    key: 'last_executed',
    render: (v: string) => new Date(v).toLocaleString(),
  },
];
