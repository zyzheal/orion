/**
 * Orion Monitor Service - Type Definitions
 *
 * Shared types for monitoring, alerting, self-healing and oncall domains.
 */

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export interface BaseEntity {
  id: string;
  tenantId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type Severity = 'critical' | 'error' | 'warning' | 'info';
export type Status = 'active' | 'resolved' | 'muted' | 'acknowledged';
export type ExecutionStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type RuleType = 'threshold' | 'anomaly' | 'rate_of_change' | 'absence';
export type AggregationType = 'avg' | 'max' | 'min' | 'sum' | 'p95' | 'p99';

export interface MonitoringRule extends BaseEntity {
  name: string;
  description: string;
  ruleType: RuleType;
  metricName: string;
  metricType: MetricType;
  aggregation: AggregationType;
  threshold: number;
  comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  duration: number;          // seconds the condition must hold
  labels: Record<string, string>;
  enabled: boolean;
  alertPolicyId?: string;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  ruleType: RuleType;
  metricName: string;
  metricType?: MetricType;
  aggregation?: AggregationType;
  threshold: number;
  comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  duration?: number;
  labels?: Record<string, string>;
  alertPolicyId?: string;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface Alert extends BaseEntity {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  status: Status;
  triggeredAt: string;
  resolvedAt?: string;
  currentValue: number;
  threshold: number;
  message: string;
  ticketId?: string;
  assigneeId?: string;
}

export interface AlertSubscription {
  id: string;
  tenantId: string;
  userId: string;
  channels: NotificationChannel[];
  filters?: {
    severities?: Severity[];
    projectIds?: string[];
    ruleIds?: string[];
  };
  enabled: boolean;
}

export type NotificationChannel = 'email' | 'webhook' | 'slack' | 'dingtalk' | 'lark' | 'sms';

export interface SubscribeAlertInput {
  channels: NotificationChannel[];
  filters?: {
    severities?: Severity[];
    projectIds?: string[];
  };
  webhookUrl?: string;
}

// ---------------------------------------------------------------------------
// Self-Healing
// ---------------------------------------------------------------------------

export type ActionType =
  | 'restart_service'
  | 'scale_up'
  | 'scale_down'
  | 'run_script'
  | 'rollback'
  | 'notify'
  | 'custom';

export interface SelfHealingPolicy extends BaseEntity {
  name: string;
  description: string;
  ruleId: string;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  cooldownSeconds: number;
  maxRetries: number;
  enabled: boolean;
  approvalRequired: boolean;
}

export interface CreatePolicyInput {
  name: string;
  description?: string;
  ruleId: string;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  cooldownSeconds?: number;
  maxRetries?: number;
  approvalRequired?: boolean;
}

export interface SelfHealingRun extends BaseEntity {
  policyId: string;
  policyName: string;
  alertId: string;
  actionType: ActionType;
  status: ExecutionStatus;
  attempts: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// OnCall
// ---------------------------------------------------------------------------

export type RotationType = 'daily' | 'weekly' | 'monthly';
export type EscalationLevel = 'L1' | 'L2' | 'L3';

export interface OnCallSchedule extends BaseEntity {
  name: string;
  description: string;
  rotationType: RotationType;
  rotationStart: string;          // ISO-8601
  rotationDurationHours: number;
  layers: ScheduleLayer[];
  timeZone: string;               // IANA time zone, e.g. "Asia/Shanghai"
  enabled: boolean;
}

export interface ScheduleLayer {
  id: string;
  name: string;
  escalationLevel: EscalationLevel;
  users: string[];                // user IDs
  restrictions?: TimeRestriction[];
}

export interface TimeRestriction {
  startDayOfWeek: number;         // 0=Sunday
  startTime: string;              // "HH:MM"
  endDayOfWeek: number;
  endTime: string;
}

export interface CreateScheduleInput {
  name: string;
  description?: string;
  rotationType: RotationType;
  rotationStart: string;
  rotationDurationHours?: number;
  layers: ScheduleLayer[];
  timeZone?: string;
}

export interface OnCallDuty {
  scheduleId: string;
  scheduleName: string;
  layerId: string;
  escalationLevel: EscalationLevel;
  userId: string;
  userName: string;
  startAt: string;
  endAt: string;
}
