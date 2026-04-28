/**
 * Shared constants for AgentDashboard
 */

// Role options for agent profiles
export const ROLE_OPTIONS = [
  { label: 'BugFixer', value: 'bug_fixer' },
  { label: 'CodeFixer', value: 'code_fixer' },
  { label: 'TestWriter', value: 'test_writer' },
  { label: 'PRSubmitter', value: 'pr_submitter' },
  { label: 'SecurityPatcher', value: 'security_patcher' },
  { label: 'DocWriter', value: 'doc_writer' },
];

// Trigger event options
export const TRIGGER_EVENT_OPTIONS = [
  { label: 'Issue Created', value: 'issue_created' },
  { label: 'Build Failed', value: 'build_failed' },
  { label: 'Security Alert', value: 'security_alert' },
  { label: 'PR Requested', value: 'pr_requested' },
  { label: 'Manual', value: 'manual' },
];

// Status to badge mapping
export const statusToBadge: Record<
  string,
  'running' | 'pending' | 'success' | 'failed' | 'warning' | 'cancelled' | 'unknown'
> = {
  running: 'running',
  completed: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
  waiting_approval: 'warning',
};
