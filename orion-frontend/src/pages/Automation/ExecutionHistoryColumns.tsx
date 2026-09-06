/**
 * ExecutionHistoryColumns - 执行历史表格列配置
 */
import { Typography, Tag, Tooltip, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { JobExecutionRecord } from '@/api/automation';
import { colors } from '@/tokens';
import { EXEC_STATUS_MAP } from './constants';

const { Text } = Typography;

export const execColumns: ColumnsType<JobExecutionRecord> = [
  {
    title: '执行 ID',
    dataIndex: 'id',
    key: 'id',
    width: 120,
    render: (id: string) => (
      <Text code style={{ fontSize: 12 }}>
        {id}
      </Text>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (status: string) => {
      const s = EXEC_STATUS_MAP[status] || EXEC_STATUS_MAP.pending;
      return <Tag color={s.color}>{s.label}</Tag>;
    },
  },
  {
    title: '执行耗时',
    dataIndex: 'durationMs',
    key: 'durationMs',
    width: 100,
    align: 'center' as const,
    render: (ms: number | null) =>
      ms ? <Text>{(ms / 1000).toFixed(1)}s</Text> : <Text type="secondary">-</Text>,
  },
  {
    title: '操作人',
    dataIndex: 'startedBy',
    key: 'startedBy',
    width: 100,
    render: (by: string | null) => by || <Text type="secondary">系统</Text>,
  },
  {
    title: '开始时间',
    dataIndex: 'startedAt',
    key: 'startedAt',
    width: 150,
    render: (date: string) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {new Date(date).toLocaleString('zh-CN')}
      </Text>
    ),
  },
  {
    title: '结果',
    dataIndex: 'output',
    key: 'output',
    render: (output: string | null, record: JobExecutionRecord) => {
      if (record.status === 'failed' && record.error) {
        return <Alert message={record.error} type="error" showIcon style={{ fontSize: 12 }} />;
      }
      if (output) {
        return (
          <Tooltip title={output}>
            <Text style={{ fontSize: 12, color: colors.success[500] }} ellipsis>
              {output}
            </Text>
          </Tooltip>
        );
      }
      return (
        <Text type="secondary" style={{ fontSize: 12 }}>
          无输出
        </Text>
      );
    },
  },
];
