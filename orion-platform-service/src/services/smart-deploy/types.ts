/**
 * Smart Deployment - Type Definitions
 *
 * Types for intelligent deployment strategies, workflow orchestration,
 * verification, rollback, and deployment history/audit.
 *
 * TASK-701: Smart Deployment (智能部署)
 */

// ==================== Deployment Strategy Types ====================

/**
 * Deployment strategy type
 */
export type DeploymentStrategyType =
  | 'blue-green'
  | 'canary'
  | 'rolling'
  | 'recreate';

/**
 * Deployment strategy configuration
 */
export interface DeploymentStrategyConfig {
  /** Strategy type */
  type: DeploymentStrategyType;
  /** Canary traffic percentages (for canary strategy) */
  canarySteps?: number[]; // e.g. [10, 50, 100]
  /** Max unavailable instances (for rolling strategy) */
  maxUnavailable?: number;
  /** Surge capacity (for rolling strategy) */
  surge?: number;
  /** Timeout for each step (ms) */
  stepTimeoutMs?: number;
  /** Whether to auto-promote canary */
  autoPromote?: boolean;
  /** Traffic switch mode (for blue-green) */
  trafficSwitchMode?: 'instant' | 'gradual';
}

// ==================== Deployment Status Types ====================

/**
 * Overall deployment status
 */
export type DeploymentStatus =
  | 'pending'
  | 'preparing'
  | 'deploying'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

/**
 * Deployment stage status
 */
export type DeploymentStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Deployment step status
 */
export type DeploymentStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

// ==================== Deployment Core Types ====================

/**
 * Deployment stage - a major phase in the deployment workflow
 */
export interface DeploymentStage {
  /** Stage name */
  name: string;
  /** Stage status */
  status: DeploymentStageStatus;
  /** Steps within this stage */
  steps: DeploymentStep[];
  /** Stage start time */
  startedAt?: Date;
  /** Stage completion time */
  completedAt?: Date;
  /** Error message if failed */
  error?: string;
}

/**
 * Deployment step - an atomic operation within a stage
 */
export interface DeploymentStep {
  /** Step name */
  name: string;
  /** Step status */
  status: DeploymentStepStatus;
  /** Step result/message */
  message?: string;
  /** Step start time */
  startedAt?: Date;
  /** Step completion time */
  completedAt?: Date;
  /** Error message if failed */
  error?: string;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Health check endpoint URL */
  endpoint?: string;
  /** Expected HTTP status code */
  expectedStatus?: number;
  /** Timeout per check (ms) */
  timeoutMs?: number;
  /** Number of retries */
  retries?: number;
  /** Interval between retries (ms) */
  retryIntervalMs?: number;
  /** Expected response body pattern */
  expectedBodyPattern?: string;
}

/**
 * Rollback policy configuration
 */
export interface RollbackPolicy {
  /** Whether to enable automatic rollback */
  autoRollback: boolean;
  /** Trigger rollback on health check failure */
  rollbackOnHealthCheckFailure: boolean;
  /** Trigger rollback on error rate threshold */
  rollbackOnErrorRate?: number; // percentage (0-100)
  /** Trigger rollback on latency threshold (ms) */
  rollbackOnLatencyMs?: number;
  /** Maximum rollback attempts */
  maxRollbackAttempts?: number;
}

/**
 * Deployment configuration - input for starting a deployment
 */
export interface DeployConfig {
  /** Application name */
  appName: string;
  /** Target version to deploy */
  version: string;
  /** Target environment */
  environment: string;
  /** Deployment strategy */
  strategy?: DeploymentStrategyType;
  /** Strategy-specific configuration */
  strategyConfig?: DeploymentStrategyConfig;
  /** Health check configuration */
  healthCheck?: HealthCheckConfig;
  /** Rollback policy */
  rollbackPolicy?: RollbackPolicy;
  /** Image/tag to deploy */
  image?: string;
  /** Number of replicas */
  replicas?: number;
  /** Environment variables override */
  envOverrides?: Record<string, string>;
  /** Labels */
  labels?: Record<string, string>;
  /** Annotations */
  annotations?: Record<string, string>;
  /** Who initiated the deployment */
  initiatedBy: string;
  /** Change request ID (optional, for audit) */
  changeRequestId?: string;
  /** Deployment notes */
  notes?: string;
  /** Risk assessment ID (optional) */
  riskAssessmentId?: string;
}

/**
 * Rollback information
 */
export interface RollbackInfo {
  /** Rollback ID */
  id: string;
  /** Original deployment ID */
  deploymentId: string;
  /** Rollback reason */
  reason: string;
  /** Who triggered the rollback */
  triggeredBy: string;
  /** Rollback status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Target version to rollback to */
  targetVersion?: string;
  /** Rollback start time */
  startedAt: Date;
  /** Rollback completion time */
  completedAt?: Date;
  /** Error message if failed */
  error?: string;
}

/**
 * Main Deployment record
 */
export interface Deployment {
  /** Deployment ID (UUID) */
  id: string;
  /** Application name */
  appName: string;
  /** Version being deployed */
  version: string;
  /** Target environment */
  environment: string;
  /** Deployment strategy used */
  strategy: DeploymentStrategyType;
  /** Current deployment status */
  status: DeploymentStatus;
  /** Deployment stages */
  stages: DeploymentStage[];
  /** Current stage index */
  currentStageIndex: number;
  /** Rollback info if rolled back */
  rollbackInfo?: RollbackInfo;
  /** Risk assessment result */
  riskScore?: number;
  /** Risk level */
  riskLevel?: string;
  /** Deployment start time */
  startedAt: Date;
  /** Deployment completion time */
  completedAt?: Date;
  /** Who initiated the deployment */
  initiatedBy: string;
  /** Image/tag deployed */
  image?: string;
  /** Deployment notes */
  notes?: string;
  /** Change request ID */
  changeRequestId?: string;
  /** Risk assessment ID */
  riskAssessmentId?: string;
  /** Error message if failed */
  error?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

// ==================== Verification Types ====================

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Check ID */
  id: string;
  /** Endpoint checked */
  endpoint: string;
  /** Whether check passed */
  passed: boolean;
  /** HTTP status code */
  statusCode?: number;
  /** Response time (ms) */
  responseTimeMs?: number;
  /** Error message if failed */
  error?: string;
  /** Number of retries attempted */
  retries: number;
  /** Check timestamp */
  checkedAt: Date;
}

/**
 * Metric verification result
 */
export interface MetricVerificationResult {
  /** Metric name */
  metricName: string;
  /** Current value */
  currentValue: number;
  /** Threshold value */
  threshold: number;
  /** Whether metric is within acceptable range */
  passed: boolean;
  /** Previous deployment value for comparison */
  previousValue?: number;
  /** Timestamp */
  checkedAt: Date;
}

/**
 * Deployment comparison result
 */
export interface DeploymentComparisonResult {
  /** Current deployment ID */
  currentDeploymentId: string;
  /** Previous deployment ID */
  previousDeploymentId: string;
  /** Comparison timestamp */
  comparedAt: Date;
  /** Health check comparison */
  healthCheckComparison: {
    currentHealth: boolean;
    previousHealth: boolean;
  };
  /** Metric comparison */
  metricComparison: MetricVerificationResult[];
  /** Overall comparison result */
  isImprovement: boolean;
  /** Summary */
  summary: string;
}

/**
 * Verification report
 */
export interface VerificationReport {
  /** Deployment ID */
  deploymentId: string;
  /** Overall verification status */
  overallStatus: 'pass' | 'fail' | 'partial';
  /** Health check results */
  healthChecks: HealthCheckResult[];
  /** Metric verification results */
  metrics: MetricVerificationResult[];
  /** Comparison with previous deployment */
  comparison?: DeploymentComparisonResult;
  /** Verification timestamp */
  verifiedAt: Date;
  /** Summary message */
  summary: string;
}

// ==================== History & Audit Types ====================

/**
 * Deployment metrics summary
 */
export interface DeploymentMetrics {
  /** Total deployments */
  totalDeployments: number;
  /** Successful deployments */
  successfulDeployments: number;
  /** Failed deployments */
  failedDeployments: number;
  /** Rolled back deployments */
  rolledBackDeployments: number;
  /** Success rate (0-100) */
  successRate: number;
  /** Average deployment duration (ms) */
  averageDurationMs: number;
  /** Median deployment duration (ms) */
  medianDurationMs: number;
  /** Rollback rate (0-100) */
  rollbackRate: number;
  /** Deployments by strategy */
  byStrategy: Record<string, number>;
  /** Deployments by environment */
  byEnvironment: Record<string, number>;
  /** Deployments by status */
  byStatus: Record<string, number>;
}

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  /** Entry ID */
  id: string;
  /** Deployment ID */
  deploymentId: string;
  /** Action type */
  action: string;
  /** Who performed the action */
  performedBy: string;
  /** Action details */
  details: Record<string, any>;
  /** Timestamp */
  timestamp: Date;
}

/**
 * History query filters
 */
export interface HistoryQuery {
  /** Filter by app name */
  appName?: string;
  /** Filter by version */
  version?: string;
  /** Filter by environment */
  environment?: string;
  /** Filter by status */
  status?: DeploymentStatus;
  /** Filter by strategy */
  strategy?: DeploymentStrategyType;
  /** Filter by start date */
  startDate?: Date;
  /** Filter by end date */
  endDate?: Date;
  /** Filter by initiator */
  initiatedBy?: string;
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * History query response
 */
export interface HistoryQueryResponse {
  /** Deployment records */
  data: Deployment[];
  /** Total count */
  total: number;
  /** Limit */
  limit: number;
  /** Offset */
  offset: number;
}

// ==================== Events ====================

/**
 * Smart deployment event types
 */
export const DeployEvents = {
  /** Deployment started */
  DEPLOYMENT_STARTED: 'deployment.started',
  /** Deployment stage completed */
  DEPLOYMENT_STAGE_COMPLETED: 'deployment.stage_completed',
  /** Deployment completed successfully */
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  /** Deployment failed */
  DEPLOYMENT_FAILED: 'deployment.failed',
  /** Deployment rolled back */
  DEPLOYMENT_ROLLED_BACK: 'deployment.rolled_back',
  /** Rollback started */
  ROLLBACK_STARTED: 'deployment.rollback_started',
  /** Rollback completed */
  ROLLBACK_COMPLETED: 'deployment.rollback_completed',
  /** Deployment cancelled */
  DEPLOYMENT_CANCELLED: 'deployment.cancelled',
  /** Canary promotion */
  CANARY_PROMOTED: 'deployment.canary_promoted',
  /** Traffic switched */
  TRAFFIC_SWITCHED: 'deployment.traffic_switched',
} as const;

// ==================== EventBus Publisher Interface ====================

/**
 * Event publisher interface (shared with other services)
 */
export interface IEventPublisher {
  publish<T = any>(
    type: string,
    data: T,
    options?: { source?: string; extensions?: Record<string, any> }
  ): Promise<string>;
}
