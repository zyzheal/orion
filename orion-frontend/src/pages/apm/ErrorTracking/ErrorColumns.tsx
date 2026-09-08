/**
 * ErrorColumns.tsx - ErrorTracking 表格列定义
 * 抽取自 index.tsx (P2-9 Phase 223)
 */
import { Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import type { TraceSummary } from '@/api/apm';

interface Props {
  onViewDetail: (record: TraceSummary) => void;
}

export const buildErrorColumns = ({ onViewDetail }: Props) => [
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
  { title: 'Span 数', dataIndex: 'span_count', key: 'span_count' },
  {
    title: '发生时间',
    dataIndex: 'start_time',
    key: 'start_time',
    render: (v: string) => new Date(v).toLocaleString(),
  },
  {
    title: '操作',
    key: 'actions',
    render: (_: unknown, record: TraceSummary) => (
      <Button
        size="small"
        type="link"
        icon={<EyeOutlined />}
        onClick={(): void => onViewDetail(record)}
      >
        查看详情
      </Button>
    ),
  },
];
