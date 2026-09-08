/**
 * TaskTimeouts columns
 * 抽取自 index.tsx (P2-9 Phase 200)
 */
import { Space, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { ClockCircleOutlined } from '@ant-design/icons';
import type { TimedOutTask } from '@/api/task-timeout';
import { colors } from '@/tokens/colors';
import { ACTION_DESCRIPTIONS, getActionTag } from './constants';

const { Text } = Typography;

export function buildColumns(): ColumnsType<TimedOutTask> {
  return [
    {
      title: '任务ID',
      dataIndex: ['task', 'id'],
      key: 'taskId',
      width: 100,
      ellipsis: true,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text code style={{ fontSize: 12 }}>
            {id.slice(0, 8)}...
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '任务标题',
      dataIndex: ['task', 'title'],
      key: 'title',
      ellipsis: true,
      render: (title: string, record: TimedOutTask) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          {record.task.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.task.description.length > 50
                ? record.task.description.slice(0, 50) + '...'
                : record.task.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '负责人',
      dataIndex: ['task', 'assigneeName'],
      key: 'assigneeName',
      width: 120,
      render: (name: string | undefined, record: TimedOutTask) =>
        name || record.task.assigneeId || '-',
    },
    {
      title: '超时时长',
      dataIndex: 'overdueHours',
      key: 'overdueHours',
      width: 100,
      sorter: (a: TimedOutTask, b: TimedOutTask) => b.overdueHours - a.overdueHours,
      render: (hours: number) => {
        const isCritical = hours > 24;
        const isWarning = hours > 4;
        return (
          <Space>
            <ClockCircleOutlined
              style={{
                color: isCritical
                  ? colors.error[500]
                  : isWarning
                    ? colors.warning[500]
                    : colors.neutral[500],
              }}
            />
            <Text
              style={{
                color: isCritical ? colors.error[500] : isWarning ? colors.warning[500] : 'inherit',
              }}
            >
              {hours.toFixed(1)}h
            </Text>
          </Space>
        );
      },
    },
    {
      title: '处理动作',
      dataIndex: 'timeoutAction',
      key: 'timeoutAction',
      width: 120,
      render: (action: string) => (
        <Tooltip title={ACTION_DESCRIPTIONS[action] || ''}>{getActionTag(action)}</Tooltip>
      ),
    },
    {
      title: '截止日期',
      dataIndex: ['task', 'dueDate'],
      key: 'dueDate',
      width: 180,
      render: (date: string | undefined) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ];
}
