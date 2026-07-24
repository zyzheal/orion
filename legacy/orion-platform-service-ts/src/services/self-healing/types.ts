/**
 * Self-Healing Engine - Type Definitions
 *
 * Types for configurable self-healing strategies, automated incident
 * recovery, decision making with confidence-based intervention,
 * and healing history with effectiveness scoring.
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 */

// ==================== Healing Strategy Types ====================

/**
 * Healing action types
 */
export type HealingActionType =
  | 'restart'
  | 'scale'
  | 'failover'
  | 'rollback';

/**
 * Incident severity levels
 */
export type IncidentSeverity = 'critical' | 'warning' | 'info';

/**
 * Incident type that triggers self-healing
 */
export type IncidentType =
  | 'high_cpu'
  | 'high_memory'
  | 'high_error_rate'
  | 'high_latency'
  | 'pod_crash'
  | 'node_failure'
  | 'service_down'
  | 'deployment_failure'
  | 'disk_full'
  | 'network_timeout'
  | 'custom';

/**
 * Strategy trigger type - what kind of incident activates this strategy
 */
export type StrategyTriggerType = IncidentType | 'any';

/**
 * Healing action definition
 */
export interface HealingAction {
  /** Action type */
  type: HealingActionType;
  /** Action-specific parameters */
  params: Record<string, any>;
  /** Action execution timeout (ms) */
  timeout?: number;
  /** Whether this action supports rollback */
  rollback?: boolean;
  /** Description of the action */
  description?: string;
}

/**
 * Condition that must be met for strategy to apply
 */
export interface HealingCondition {
  /** Field to check (e.g., 'severity', 'environment', 'metric') */
  field: string;
  /** Comparison operator */
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains';
  /** Value to compare against */
  value: any;
}

/**
 * Healing strategy configuration
 */
export interface HealingStrategy {
  /** Strategy ID (UUID) */
  id: string;
  /** Strategy name */
  name: string;
  /** What type of incident triggers this strategy */
  triggerType: StrategyTriggerType;
  /** Actions to execute in order */
  actions: HealingAction[];
  /** Conditions that must be met */
  conditions?: HealingCondition[];
  /** Confidence score (0-100) for auto-healing */
  confidence: number;
  /** Whether the strategy is enabled */
  enabled: boolean;
  /** Strategy description */
  description?: string;
  /** Which environments this applies to */
  environments?: string[];
  /** Max retries before giving up */
  maxRetries?: number;
  /** Cooldown between retries (ms) */
  retryCooldownMs?: number;
}

// ==================== Incident Types ====================

/**
 * Incident status
 */
export type IncidentStatus =
  | 'new'
  | 'evaluating'
  | 'healing'
  | 'healed'
  | 'failed'
  | 'escalated'
  | 'pending_approval'
  | 'cancelled';

/**
 * Healing incident - triggered by monitoring alerts
 */
export interface HealingIncident {
  /** Incident ID (UUID) */
  id: string;
  /** Source alert ID from monitoring */
  alertId?: string;
  /** Incident type */
  type: IncidentType;
  /** Incident severity */
  severity: IncidentSeverity;
  /** Affected application/service */
  appName: string;
  /** Affected environment */
  environment: string;
  /** Selected healing strategy */
  strategy?: HealingStrategy;
  /** Actions to execute */
  actions: HealingAction[];
  /** Current incident status */
  status: IncidentStatus;
  /** When the incident started */
  startedAt: Date;
  /** When healing completed */
  completedAt?: Date;
  /** Healing result */
  result?: HealingResult;
  /** Error message if failed */
  error?: string;
  /** Whether auto-healing was approved */
  approvalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected' | 'expired';
  /** Approval request ID if manual approval required */
  approvalRequestId?: string;
  /** Number of healing attempts */
  attempts: number;
  /** Incident tags */
  tags?: Record<string, string>;
}

// ==================== Healing Result Types ====================

/**
 * Result of a single healing action
 */
export interface HealingActionResult {
  /** Action type */
  type: HealingActionType;
  /** Whether the action succeeded */
  success: boolean;
  /** Action execution duration (ms) */
  durationMs: number;
  /** Action result message */
  message?: string;
  /** Error if action failed */
  error?: string;
  /** Whether rollback was needed */
  rollbackNeeded?: boolean;
  /** Whether rollback was successful */
  rollbackSuccess?: boolean;
  /** Verification result */
  verified?: boolean;
  /** Timestamp */
  executedAt: Date;
}

/**
 * Overall healing result
 */
export interface HealingResult {
  /** Whether the overall healing was successful */
  success: boolean;
  /** Total healing duration (ms) */
  duration: number;
  /** Actions that were executed */
  actionsExecuted: HealingActionResult[];
  /** Error message if healing failed */
  errorMessage?: string;
  /** Effectiveness score (0-100) */
  effectiveness?: number;
  /** Whether the issue recurred after healing */
  recurred?: boolean;
  /** Verification timestamp */
  verifiedAt?: Date;
}

// ==================== Decision Making Types ====================

/**
 * Decision outcome for auto vs manual healing
 */
export type DecisionType = 'auto' | 'manual' | 'disabled';

/**
 * Risk level assessment
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Decision made by the healing decision maker
 */
export interface HealingDecision {
  /** Decision type */
  type: DecisionType;
  /** Reasoning behind the decision */
  reason: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Whether approval is required */
  requiresApproval: boolean;
  /** Recommended actions */
  recommendedActions: HealingAction[];
}

/**
 * Approval request for manual intervention
 */
export interface ApprovalRequest {
  /** Request ID (UUID) */
  id: string;
  /** Associated incident ID */
  incidentId: string;
  /** Request title */
  title: string;
  /** Request description */
  description: string;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Recommended actions */
  recommendedActions: HealingAction[];
  /** Approval status */
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  /** Who requested the approval */
  requestedBy: string;
  /** Who approved/rejected */
  approvedBy?: string;
  /** Approval/rejection reason */
  approvalReason?: string;
  /** Request timestamp */
  requestedAt: Date;
  /** Approval/rejection timestamp */
  respondedAt?: Date;
  /** Expiration timestamp */
  expiresAt?: Date;
}

/**
 * Approval response
 */
export interface ApprovalResponse {
  /** Whether approved */
  approved: boolean;
  /** Reason for the decision */
  reason?: string;
  /** Who responded */
  respondedBy: string;
}

// ==================== History & Effectiveness Types ====================

/**
 * Healing history query filters
 */
export interface HealingHistoryQuery {
  /** Filter by app name */
  appName?: string;
  /** Filter by environment */
  environment?: string;
  /** Filter by incident type */
  type?: IncidentType;
  /** Filter by status */
  status?: IncidentStatus;
  /** Filter by strategy ID */
  strategyId?: string;
  /** Filter by severity */
  severity?: IncidentSeverity;
  /** Filter by start date */
  startDate?: Date;
  /** Filter by end date */
  endDate?: Date;
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Healing history query response
 */
export interface HealingHistoryResponse {
  /** Incident records */
  data: HealingIncident[];
  /** Total count */
  total: number;
  /** Limit */
  limit: number;
  /** Offset */
  offset: number;
}

/**
 * Effectiveness metrics for self-healing
 */
export interface HealingEffectiveness {
  /** Total incidents processed */
  totalIncidents: number;
  /** Successfully healed incidents */
  healedIncidents: number;
  /** Failed healing incidents */
  failedIncidents: number;
  /** Escalated incidents */
  escalatedIncidents: number;
  /** Overall success rate (0-100) */
  successRate: number;
  /** Average healing duration (ms) */
  averageDurationMs: number;
  /** Median healing duration (ms) */
  medianDurationMs: number;
  /** Average effectiveness score (0-100) */
  averageEffectiveness: number;
  /** Incidents that recurred after healing */
  recurredIncidents: number;
  /** Recurrence rate (0-100) */
  recurrenceRate: number;
  /** Effectiveness by incident type */
  byIncidentType: Record<string, { total: number; success: number; rate: number }>;
  /** Effectiveness by strategy */
  byStrategy: Record<string, { total: number; success: number; rate: number }>;
  /** Effectiveness by environment */
  byEnvironment: Record<string, { total: number; success: number; rate: number }>;
  /** Effectiveness by action type */
  byActionType: Record<string, { total: number; success: number; rate: number }>;
}

// ==================== NATS/Event Types ====================

/**
 * Self-healing event types for event bus publishing
 */
export const SelfHealingEvents = {
  /** Incident detected */
  INCIDENT_DETECTED: 'self-healing.incident_detected',
  /** Healing started */
  HEALING_STARTED: 'self-healing.healing_started',
  /** Action executed */
  ACTION_EXECUTED: 'self-healing.action_executed',
  /** Healing completed */
  HEALING_COMPLETED: 'self-healing.healing_completed',
  /** Healing failed */
  HEALING_FAILED: 'self-healing.healing_failed',
  /** Approval requested */
  APPROVAL_REQUESTED: 'self-healing.approval_requested',
  /** Approval responded */
  APPROVAL_RESPONDED: 'self-healing.approval_responded',
  /** Incident escalated */
  INCIDENT_ESCALATED: 'self-healing.incident_escalated',
} as const;

/**
 * Event publisher interface
 */
export interface IEventPublisher {
  publish<T = any>(
    type: string,
    data: T,
    options?: { source?: string; extensions?: Record<string, any> }
  ): Promise<string>;
}

/**
 * Monitoring alert event (consumed from NATS)
 */
export interface MonitoringAlertEvent {
  /** Alert ID */
  alertId: string;
  /** Alert metric name */
  metric: string;
  /** Alert severity */
  severity: IncidentSeverity;
  /** Current metric value */
  value: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Alert message */
  message: string;
  /** Alert tags */
  tags: Record<string, string>;
  /** When alert was triggered */
  triggeredAt: Date;
}

// ==================== Strategy Registry Types ====================

/**
 * Built-in strategy identifiers
 */
export type BuiltInStrategyId =
  | 'restart-on-crash'
  | 'scale-on-high-cpu'
  | 'scale-on-high-memory'
  | 'failover-on-node-failure'
  | 'rollback-on-deployment-failure'
  | 'restart-on-service-down'
  | 'scale-on-high-error-rate'
  | 'restart-on-network-timeout';
