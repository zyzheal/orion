// Type definitions for deployment domain

/**
 * Deployment status enum
 */
export enum DeploymentStatus {
  PENDING = "pending",
  QUEUED = "queued",
  DEPLOYING = "deploying",
  DEPLOYED = "deployed",
  FAILED = "failed",
  ROLLED_BACK = "rolled_back",
  CANCELLED = "cancelled",
}

/**
 * Deployment strategy
 */
export enum DeploymentStrategy {
  ROLLING = "rolling",
  BLUE_GREEN = "blue_green",
  CANARY = "canary",
  RECREATE = "recreate",
}

/**
 * Target environment type
 */
export enum EnvironmentType {
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production",
  CANARY = "canary",
}

/**
 * Represents a deployment record
 */
export interface Deployment {
  id: string;
  tenantId: string;
  projectId: string;
  environmentId: string;
  pipelineId?: string;
  strategy: DeploymentStrategy;
  status: DeploymentStatus;
  imageTag: string;
  commitSha?: string;
  branch?: string;
  deployedBy: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
  /** ISO 8601 timestamp or null */
  completedAt: string | null;
  errorMessage?: string;
  rollbackTargetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request body for creating a deployment
 */
export interface CreateDeploymentRequest {
  projectId: string;
  environmentId: string;
  strategy?: DeploymentStrategy;
  imageTag: string;
  commitSha?: string;
  branch?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request body for rollback
 */
export interface RollbackRequest {
  reason?: string;
  targetDeploymentId?: string;
}

/**
 * Canary analysis result
 */
export interface CanaryAnalysisResult {
  deploymentId: string;
  status: "passing" | "failing" | "inconclusive";
  metrics: CanaryMetric[];
  analyzedAt: string;
}

/**
 * Individual metric from canary analysis
 */
export interface CanaryMetric {
  name: string;
  baseline: number;
  canary: number;
  threshold: number;
  passed: boolean;
}

/**
 * Query parameters for listing deployments
 */
export interface ListDeploymentsQuery {
  tenantId?: string;
  projectId?: string;
  environmentId?: string;
  status?: DeploymentStatus;
  limit?: number;
  offset?: number;
}
