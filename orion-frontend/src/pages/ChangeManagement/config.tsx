/**
 * Change Management — Configuration Maps
 *
 * All display configuration for change requests, RFCs, CAB meetings,
 * status transitions, and timeline events. Pure data — zero runtime dependencies.
 */
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

// ============================================================================
// Display Config Maps
// ============================================================================

export type ConfigMap = Record<string, { color: string; label: string }>;

/** Change type display config */
export const typeConfig: ConfigMap = {
  standard: { color: 'blue', label: '标准' },
  normal: { color: 'cyan', label: '普通' },
  emergency: { color: 'red', label: '紧急' },
};

/** Priority display config */
export const priorityConfig: ConfigMap = {
  critical: { color: 'red', label: '严重' },
  high: { color: 'orange', label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: 'green', label: '低' },
};

/** Risk level display config */
export const riskConfig: ConfigMap = {
  high: { color: 'red', label: '高风险' },
  medium: { color: 'orange', label: '中风险' },
  low: { color: 'green', label: '低风险' },
};

/** Change request status display config */
export const statusConfig: ConfigMap = {
  draft: { color: 'default', label: '草稿' },
  submitted: { color: 'blue', label: '已提交' },
  approved: { color: 'green', label: '已批准' },
  rejected: { color: 'red', label: '已拒绝' },
  in_progress: { color: 'orange', label: '实施中' },
  completed: { color: 'cyan', label: '已完成' },
  cancelled: { color: 'default', label: '已取消' },
  closed: { color: 'default', label: '已关闭' },
};

/** RFC status display config */
export const rfcStatusConfig: ConfigMap = {
  draft: { color: 'default', label: '草稿' },
  pending_review: { color: 'orange', label: '待审核' },
  approved: { color: 'green', label: '已批准' },
  rejected: { color: 'red', label: '已拒绝' },
};

/** CAB meeting status display config */
export const cabStatusConfig: ConfigMap = {
  scheduled: { color: 'blue', label: '已安排' },
  in_progress: { color: 'orange', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  cancelled: { color: 'default', label: '已取消' },
};

// ============================================================================
// Status Transition Map
// ============================================================================

export interface StatusTransition {
  status: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
}

export const statusTransitions: Record<string, StatusTransition[]> = {
  draft: [{ status: 'submitted', label: '提交审批', icon: <SendOutlined /> }],
  submitted: [
    { status: 'approved', label: '批准', icon: <CheckCircleOutlined /> },
    { status: 'rejected', label: '拒绝', icon: <CloseCircleOutlined />, danger: true },
  ],
  approved: [{ status: 'in_progress', label: '开始实施', icon: <PlayCircleOutlined /> }],
  in_progress: [{ status: 'completed', label: '完成', icon: <CheckCircleOutlined /> }],
  completed: [{ status: 'closed', label: '关闭', icon: <StopOutlined /> }],
  rejected: [],
  cancelled: [],
  closed: [],
};

// ============================================================================
// Timeline Event Type Display Config
// ============================================================================

export const eventTypeConfig: ConfigMap = {
  created: { color: 'blue', label: '创建' },
  submitted: { color: 'cyan', label: '提交' },
  approved: { color: 'green', label: '批准' },
  rejected: { color: 'red', label: '拒绝' },
  started: { color: 'orange', label: '开始实施' },
  completed: { color: 'green', label: '完成' },
  closed: { color: 'default', label: '关闭' },
  cancelled: { color: 'default', label: '取消' },
  update: { color: 'blue', label: '更新' },
  comment: { color: 'purple', label: '备注' },
  risk_change: { color: 'orange', label: '风险变更' },
};
