/**
 * constants.tsx - TicketList 常量与工具函数
 * 抽取自 TicketList/index.tsx (P2-9 Phase 62)
 */
import { colors } from '@/tokens';
import dayjs from 'dayjs';
import type { MockTicket } from './types';

export const priorityConfig: Record<string, { color: string; label: string; order: number }> = {
  critical: { color: colors.error[400], label: '紧急', order: 0 },
  high: { color: colors.warning[600], label: '高', order: 1 },
  medium: { color: colors.primary[500], label: '中', order: 2 },
  low: { color: colors.neutral[500], label: '低', order: 3 },
};

export const statusConfig: Record<string, { color: string; label: string }> = {
  open: { color: 'default', label: '待处理' },
  assigned: { color: 'processing', label: '已分配' },
  'in-progress': { color: 'blue', label: '处理中' },
  resolved: { color: 'success', label: '已解决' },
  closed: { color: 'default', label: '已关闭' },
};

export const categoryLabels: Record<string, string> = {
  infrastructure: '基础设施',
  application: '应用',
  database: '数据库',
  network: '网络',
  security: '安全',
  deployment: '部署',
  pipeline: '流水线',
  performance: '性能',
  cost: '成本',
  other: '其他',
};

export function calculateSLA(ticket: MockTicket): {
  percent: number;
  color: string;
  text: string;
  overdue: boolean;
} {
  const now = dayjs();
  const created = dayjs(ticket.createdAt);
  const due = dayjs(ticket.dueDate);
  const totalMs = due.diff(created);
  const remainingMs = due.diff(now);

  if (remainingMs <= 0) {
    return { percent: 0, color: colors.error[400], text: '已超时', overdue: true };
  }

  const percent = Math.max(0, Math.round((remainingMs / totalMs) * 100));

  if (percent < 25) {
    return {
      percent,
      color: colors.warning[600],
      text: `${Math.round(remainingMs / 3600000)}h`,
      overdue: false,
    };
  }

  return {
    percent,
    color: colors.success[500],
    text: `${Math.round(remainingMs / 3600000)}h`,
    overdue: false,
  };
}
