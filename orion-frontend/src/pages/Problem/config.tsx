/**
 * Problem page configuration constants.
 *
 * Severity, status, and KEDB status lookups used across list, detail,
 * filter bars, and form Select options.  All entries are plain data
 * (no component state / hook dependencies).
 */
import React from 'react';
import {
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

export type SeverityKey = 'critical' | 'high' | 'medium' | 'low';
export type ProblemStatusKey = 'known' | 'investigating' | 'resolved' | 'closed';
export type KnownErrorStatusKey = 'active' | 'resolved' | 'archived';

/** Severity configuration with color coding */
export const severityConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> =
  {
    critical: { color: 'red', label: '严重', icon: <ExclamationCircleOutlined /> },
    high: { color: 'orange', label: '高', icon: <WarningOutlined /> },
    medium: { color: 'blue', label: '中', icon: <InfoCircleOutlined /> },
    low: { color: 'green', label: '低', icon: <InfoCircleOutlined /> },
  };

/** Problem status configuration */
export const statusConfig: Record<string, { color: string; label: string }> = {
  known: { color: 'purple', label: '已知' },
  investigating: { color: 'orange', label: '调查中' },
  resolved: { color: 'green', label: '已解决' },
  closed: { color: 'default', label: '已关闭' },
};

/** Known error status configuration */
export const knownErrorStatusConfig: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '活跃' },
  resolved: { color: 'blue', label: '已解决' },
  archived: { color: 'default', label: '已归档' },
};

/** Status transition map: current -> next available statuses */
export const statusTransitions: Record<
  string,
  { status: string; label: string; icon: React.ReactNode }[]
> = {
  known: [{ status: 'investigating', label: '开始调查', icon: <SyncOutlined /> }],
  investigating: [{ status: 'resolved', label: '标记解决', icon: <CheckCircleOutlined /> }],
  resolved: [{ status: 'closed', label: '关闭问题', icon: <CloseCircleOutlined /> }],
  closed: [],
};

export const KEDB_DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Select options derived from config lookups
// ---------------------------------------------------------------------------

/** Severity options for Select fields (create / edit forms) */
export const severityOptions = Object.entries(severityConfig).map(([value, { label }]) => ({
  label,
  value,
}));

/** Problem status options for filter Select */
export const problemStatusOptions = Object.entries(statusConfig).map(([value, { label }]) => ({
  label,
  value,
}));

/** Known error status options for filter Select and edit form */
export const knownErrorStatusOptions = Object.entries(knownErrorStatusConfig).map(
  ([value, { label }]) => ({ label, value }),
);
