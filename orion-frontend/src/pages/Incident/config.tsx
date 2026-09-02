/**
 * Incident page configuration constants.
 * Extracted from index.tsx to reduce line count and improve readability.
 *
 * Includes: severity/status/priority/event-type display configs,
 * status transition rules, form option lists.
 */
import React from 'react';
import {
  CheckCircleOutlined,
  SearchOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

export interface DisplayConfig {
  color: string;
  label: string;
}

export interface StatusTransition {
  status: string;
  label: string;
  icon: React.ReactNode;
}

/** Severity display config: color + Chinese label */
export const severityConfig: Record<string, DisplayConfig> = {
  critical: { color: 'red', label: '严重' },
  high: { color: 'orange', label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: 'green', label: '低' },
};

/** Status display config: tag color + Chinese label */
export const statusConfig: Record<string, DisplayConfig> = {
  open: { color: 'blue', label: '待处理' },
  acknowledged: { color: 'cyan', label: '已确认' },
  investigating: { color: 'orange', label: '调查中' },
  on_hold: { color: 'default', label: '挂起' },
  resolved: { color: 'green', label: '已解决' },
  closed: { color: 'default', label: '已关闭' },
};

/** Priority display config: tag color + Chinese label */
export const priorityConfig: Record<string, DisplayConfig> = {
  p1: { color: 'red', label: 'P1' },
  p2: { color: 'orange', label: 'P2' },
  p3: { color: 'blue', label: 'P3' },
  p4: { color: 'default', label: 'P4' },
};

/** Timeline event type display config */
export const eventTypeConfig: Record<string, DisplayConfig> = {
  created: { color: 'blue', label: '创建' },
  status_change: { color: 'orange', label: '状态变更' },
  assignment: { color: 'cyan', label: '分配' },
  escalation: { color: 'red', label: '升级' },
  update: { color: 'default', label: '更新' },
  comment: { color: 'purple', label: '备注' },
  resolution: { color: 'green', label: '解决' },
  postmortem: { color: 'magenta', label: '复盘' },
};

/** Status transition map: current status -> allowed next statuses */
export const statusTransitions: Record<string, StatusTransition[]> = {
  open: [{ status: 'acknowledged', label: '确认', icon: <CheckCircleOutlined /> }],
  acknowledged: [
    { status: 'investigating', label: '开始调查', icon: <SearchOutlined /> },
  ],
  investigating: [
    { status: 'resolved', label: '解决', icon: <CheckCircleOutlined /> },
    { status: 'on_hold', label: '挂起', icon: <ClockCircleOutlined /> },
  ],
  on_hold: [
    { status: 'investigating', label: '恢复调查', icon: <SearchOutlined /> },
  ],
  resolved: [
    { status: 'closed', label: '关闭', icon: <CheckCircleOutlined /> },
  ],
  closed: [],
};

// ============================================================================
// Form option definitions
// ============================================================================

/** Severity options for Select components */
export const severityOptions = [
  { label: '严重', value: 'critical' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
] as const;

/** Incident type options for Select components */
export const incidentTypeOptions = [
  { label: '事件', value: 'incident' },
  { label: '中断', value: 'outage' },
  { label: '降级', value: 'degradation' },
  { label: '安全', value: 'security' },
] as const;

/** Urgency options for Select components */
export const urgencyOptions = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
] as const;

/** Priority options for Select components */
export const priorityOptions = [
  { label: 'P1', value: 'p1' },
  { label: 'P2', value: 'p2' },
  { label: 'P3', value: 'p3' },
  { label: 'P4', value: 'p4' },
] as const;

/** Escalation level options for Select components */
export const escalationLevelOptions = [
  { label: 'L1 - 一线支持', value: 1 },
  { label: 'L2 - 二线支持', value: 2 },
  { label: 'L3 - 专家团队', value: 3 },
  { label: 'L4 - 管理层', value: 4 },
] as const;

/** Severity filter options (with "全部" option) */
export const severityFilterOptions = [
  { label: '全部', value: 'all' },
  ...severityOptions,
];

/** Status filter options (with "全部" option) */
export const statusFilterOptions = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'open' },
  { label: '已确认', value: 'acknowledged' },
  { label: '调查中', value: 'investigating' },
  { label: '挂起', value: 'on_hold' },
  { label: '已解决', value: 'resolved' },
  { label: '已关闭', value: 'closed' },
];

/** Postmortem status display config */
export const postmortemStatusConfig: Record<string, { color: string; label: string }> = {
  published: { color: 'green', label: '已发布' },
  draft: { color: 'orange', label: '草稿' },
  archived: { color: 'default', label: '已归档' },
};
