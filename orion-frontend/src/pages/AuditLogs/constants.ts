/**
 * AuditLogs constants
 * 抽取自 index.tsx (P2-9 Phase 186)
 */
import type { AuditAction, AuditOutcome } from '@/api/audit-logs';

export const actionColor: Record<string, string> = {
  'stage.start': 'blue',
  'stage.complete': 'green',
  'stage.fail': 'red',
  'stage.skip': 'orange',
  'task.start': 'blue',
  'task.complete': 'green',
  'task.fail': 'red',
  'task.skip': 'orange',
  'approval.request': 'purple',
  'approval.approve': 'green',
  'approval.reject': 'red',
  'trigger.fire': 'cyan',
  'run.create': 'blue',
  'run.cancel': 'red',
  'run.complete': 'green',
};

export const outcomeIcon: Record<string, string> = {
  success: '✓',
  failed: '✗',
  pending: '⋯',
};

export const ALL_ACTIONS: { value: AuditAction; label: string }[] = [
  { value: 'stage.start', label: 'Stage Start' },
  { value: 'stage.complete', label: 'Stage Complete' },
  { value: 'stage.fail', label: 'Stage Fail' },
  { value: 'task.start', label: 'Task Start' },
  { value: 'task.complete', label: 'Task Complete' },
  { value: 'task.fail', label: 'Task Fail' },
  { value: 'approval.request', label: 'Approval Request' },
  { value: 'approval.approve', label: 'Approval Approve' },
  { value: 'approval.reject', label: 'Approval Reject' },
  { value: 'trigger.fire', label: 'Trigger Fire' },
  { value: 'run.create', label: 'Run Create' },
  { value: 'run.cancel', label: 'Run Cancel' },
  { value: 'run.complete', label: 'Run Complete' },
];

export const ALL_OUTCOMES: { value: AuditOutcome; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

export const PAGE_SIZE = 20;
