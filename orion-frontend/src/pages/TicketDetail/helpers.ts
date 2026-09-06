/**
 * helpers.ts - TicketDetail 工具函数
 * 抽取自 TicketDetail/index.tsx (P2-9 Phase 58)
 */
import dayjs from 'dayjs';
import type { Ticket } from './types';

export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分钟`;
}

export function calculateSLA(ticket: Ticket): {
  percent: number;
  elapsed: string;
  total: string;
  status: 'normal' | 'warning' | 'danger';
  overdue: boolean;
} {
  const now = dayjs();
  const created = dayjs(ticket.createdAt);
  const due = dayjs(ticket.dueDate);
  const totalMs = due.diff(created);
  const elapsedMs = Math.max(0, now.diff(created));
  const remainingMs = due.diff(now);
  const percent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  if (remainingMs <= 0) {
    return {
      percent: 100,
      elapsed: formatDuration(elapsedMs),
      total: formatDuration(totalMs),
      status: 'danger',
      overdue: true,
    };
  }

  const status: 'normal' | 'warning' | 'danger' =
    percent > 75 ? 'danger' : percent > 50 ? 'warning' : 'normal';

  return {
    percent,
    elapsed: formatDuration(elapsedMs),
    total: formatDuration(totalMs),
    status,
    overdue: false,
  };
}
