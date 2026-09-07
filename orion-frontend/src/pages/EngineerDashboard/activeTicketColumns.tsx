/**
 * EngineerDashboard active ticket columns
 * 抽取自 index.tsx (P2-9 Phase 129)
 */
import { Typography, Tag, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { EngineerDashboardData } from '@/types/pages';
import { COLORS, priorityColor, priorityName, statusName } from './constants';

const { Text } = Typography;

type ActiveTicket = EngineerDashboardData['activeTickets'][number];

export const activeTicketColumns: ColumnsType<ActiveTicket> = [
  {
    title: '工单号',
    dataIndex: 'ticketId',
    key: 'ticketId',
    width: 100,
    render: (text: string) => (
      <Text strong style={{ color: COLORS.info }}>
        {text}
      </Text>
    ),
  },
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
  },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    width: 80,
    render: (priority: string) => (
      <Tag color={priorityColor(priority)} style={{ fontWeight: 600 }}>
        {priorityName(priority)}
      </Tag>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (status: string) => <Tag>{statusName(status)}</Tag>,
  },
  {
    title: '已耗时',
    dataIndex: 'elapsedHours',
    key: 'elapsedHours',
    width: 80,
    render: (hours: number) => `${hours}h`,
  },
  {
    title: 'SLA剩余',
    dataIndex: 'slaRemainingHours',
    key: 'slaRemainingHours',
    width: 100,
    render: (hours: number) => (
      <Text
        style={{
          color: hours < 0 ? COLORS.error : hours < 4 ? COLORS.warning : 'inherit',
          fontWeight: hours < 4 ? 600 : 400,
        }}
      >
        {hours < 0 ? `超时 ${Math.abs(hours)}h` : `${hours}h`}
      </Text>
    ),
  },
  {
    title: '状态',
    key: 'overdue',
    width: 80,
    render: (_: unknown, record?: ActiveTicket) =>
      record?.isOverdue ? (
        <Badge status="error" text="超期" />
      ) : (
        <Badge status="success" text="正常" />
      ),
  },
];
