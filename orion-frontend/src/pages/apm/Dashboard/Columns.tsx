/**
 * Columns.tsx - APM Dashboard 表格列定义
 * 抽取自 index.tsx (P2-9 Phase 246)
 */
import type { ColumnsType } from 'antd/es/table';
import { Tag } from 'antd';
import type { TraceSummary, ServiceInfo } from '@/api/apm';
import { colors } from '@/tokens/colors';

export const traceColumns: ColumnsType<TraceSummary> = [
  {
    title: 'Trace ID',
    dataIndex: 'traceId',
    key: 'traceId',
    ellipsis: true,
    render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 16)}...</code>,
  },
  { title: '服务', dataIndex: 'root_service', key: 'root_service' },
  { title: '操作', dataIndex: 'root_operation', key: 'root_operation' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (s: string) => (
      <Tag color={s === 'error' ? colors.error[500] : colors.success[500]}>{s}</Tag>
    ),
  },
  {
    title: '耗时',
    dataIndex: 'duration_ms',
    key: 'duration_ms',
    render: (ms: number) => (
      <span
        style={{
          color:
            ms > 1000 ? colors.error[500] : ms > 500 ? colors.warning[500] : colors.neutral[900],
        }}
      >
        {ms} ms
      </span>
    ),
  },
  { title: 'Span 数', dataIndex: 'span_count', key: 'span_count' },
  {
    title: '时间',
    dataIndex: 'start_time',
    key: 'start_time',
    render: (v: string) => new Date(v).toLocaleString(),
  },
];

export const serviceColumns: ColumnsType<ServiceInfo> = [
  { title: '服务名称', dataIndex: 'service_name', key: 'service_name' },
  { title: 'Trace 数', dataIndex: 'trace_count', key: 'trace_count' },
  {
    title: '最大耗时',
    dataIndex: 'max_duration_ms',
    key: 'max_duration_ms',
    render: (ms: number) => `${ms} ms`,
  },
];
