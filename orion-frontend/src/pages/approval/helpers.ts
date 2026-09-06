/**
 * helpers.ts - approvalProgress / getSLAStatus
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 */
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { ApprovalRequest } from '@/api/approvals';

dayjs.extend(relativeTime);

export const approvalProgress = (record: ApprovalRequest): number => {
  if (record.status === 'approved') return 100;
  if (record.status === 'rejected') return 100;
  return Math.round((record.approvals.length / record.requiredApprovals) * 100);
};

export const getSLAStatus = (
  record: ApprovalRequest
): { label: string; color: string; expired: boolean } => {
  if (record.status !== 'pending') return { label: '已完成', color: 'success', expired: false };
  const createdAt = dayjs(record.createdAt);
  const now = dayjs();
  const hours = now.diff(createdAt, 'hours');
  if (hours > 24) return { label: '已超时', color: 'error', expired: true };
  if (hours > 12) return { label: '即将超时', color: 'warning', expired: false };
  return { label: `${hours}h`, color: 'processing', expired: false };
};
