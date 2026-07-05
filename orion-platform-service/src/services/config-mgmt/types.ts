/**
 * Configuration Management & GitOps - Type Definitions
 *
 * Types for centralized config management, GitOps sync, approval workflows,
 * and config diff/rollback functionality.
 */

// ==================== Environment ====================
import type { JsonSchema } from './ConfigValidationService';

export type ConfigEnvironment = 'dev' | 'staging' | 'prod';

export type ConfigStatus = 'active' | 'inactive' | 'deprecated';

export type ConfigChangeStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'rolled_back';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type GitOpsStatus = 'enabled' | 'disabled' | 'syncing' | 'error' | 'drift_detected';

export type SyncDirection = 'git_to_platform' | 'platform_to_git';

// ==================== Config Item ====================

export interface ConfigItem {
  id: string;
  key: string;
  value: string;
  environment: ConfigEnvironment;
  version: number;
  status: ConfigStatus;
  description?: string;
  encrypted: boolean;
  tags?: string[];
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface CreateConfigInput {
  key: string;
  value: string;
  environment: ConfigEnvironment;
  description?: string;
  encrypted?: boolean;
  tags?: string[];
  createdBy: string;
}

export interface UpdateConfigInput {
  value: string;
  description?: string;
  status?: ConfigStatus;
  tags?: string[];
  updatedBy: string;
}

export interface ListConfigsFilter {
  environment?: ConfigEnvironment;
  status?: ConfigStatus;
  keyPrefix?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// ==================== Config Version ====================

export interface ConfigVersion {
  id: string;
  configId: string;
  key: string;
  value: string;
  version: number;
  environment: ConfigEnvironment;
  changeLog: string;
  createdBy: string;
  createdAt: Date;
}

// ==================== GitOps Config ====================

export interface GitOpsConfig {
  id: string;
  repoUrl: string;
  branch: string;
  configPath: string;
  syncInterval: number; // in seconds
  lastSync?: Date;
  status: GitOpsStatus;
  syncDirection: SyncDirection;
  autoApply: boolean;
  createdBy: string;
  createdAt: Date;
  lastError?: string;
}

export interface CreateGitOpsInput {
  repoUrl: string;
  branch: string;
  configPath?: string;
  syncInterval?: number;
  syncDirection?: SyncDirection;
  autoApply?: boolean;
  createdBy: string;
}

export interface SyncStatus {
  id: string;
  gitOpsConfigId: string;
  status: 'success' | 'failure' | 'partial';
  itemsSynced: number;
  itemsFailed: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  driftDetected: boolean;
  driftItems?: ConfigDiff[];
}

// ==================== Config Change Request ====================

export interface ConfigChangeRequest {
  id: string;
  configId: string;
  configKey: string;
  environment: ConfigEnvironment;
  oldValue: string;
  newValue: string;
  reason: string;
  requester: string;
  status: ConfigChangeStatus;
  approvals: ApprovalRecord[];
  requiredApprovals: number;
  appliedAt?: Date;
  appliedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChangeRequestInput {
  configId: string;
  newValue: string;
  reason: string;
  requester: string;
  requiredApprovals?: number;
}

export interface ApprovalRecord {
  id: string;
  changeRequestId: string;
  approver: string;
  status: ApprovalStatus;
  comment?: string;
  approvedAt: Date;
}

export interface ApproveChangeInput {
  approver: string;
  comment?: string;
}

// ==================== Config Diff ====================

export interface ConfigDiff {
  key: string;
  environment: ConfigEnvironment;
  oldValue?: string;
  newValue?: string;
  changeType: 'added' | 'removed' | 'modified';
}

export interface DiffReport {
  sourceEnvironment: ConfigEnvironment;
  targetEnvironment: ConfigEnvironment;
  diffs: ConfigDiff[];
  totalChanges: number;
  added: number;
  removed: number;
  modified: number;
  generatedAt: Date;
}

export interface VersionDiffReport {
  configId: string;
  key: string;
  environment: ConfigEnvironment;
  fromVersion: number;
  toVersion: number;
  oldValue: string;
  newValue: string;
  generatedAt: Date;
}

// ==================== Events ====================

export const ConfigEvents = {
  CONFIG_CHANGED: 'config.changed',
  CONFIG_SYNCED: 'config.synced',
  CONFIG_ROLLED_BACK: 'config.rolled_back',
  CONFIG_APPROVED: 'config.approved',
  CONFIG_REJECTED: 'config.rejected',
  CONFIG_DRIFT_DETECTED: 'config.drift_detected',
} as const;

// ==================== EventBus Publisher Interface ====================

export interface IEventPublisher {
  publish<T = any>(
    type: string,
    data: T,
    options?: { source?: string; extensions?: Record<string, any> }
  ): Promise<string>;
}

// ==================== Config Schema ====================

export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

export type SchemaFormat = 'email' | 'url' | 'uuid' | 'date-time' | 'date' | 'time' | 'ipv4' | 'ipv6' | 'uri';

export interface ConfigSchema {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  schema: JsonSchema;
  config_key?: string;
  version: number;
  is_active: boolean;
  created_by: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateConfigSchemaInput {
  name: string;
  description?: string;
  schema: JsonSchema;
  configKey?: string;
  createdBy: string;
}

export interface UpdateConfigSchemaInput {
  name?: string;
  description?: string;
  schema?: JsonSchema;
  configKey?: string;
  isActive?: boolean;
  updatedBy: string;
}

export interface ListConfigSchemasFilter {
  configKey?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

// ==================== Config Template ====================

export interface ConfigTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  category?: string;
  configData: Record<string, any>;
  targetEnvironment: ConfigEnvironment;
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConfigTemplateInput {
  name: string;
  description?: string;
  category?: string;
  configData: Record<string, any>;
  targetEnvironment?: ConfigEnvironment;
  createdBy: string;
}

export interface UpdateConfigTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  configData?: Record<string, any>;
  targetEnvironment?: ConfigEnvironment;
  isActive?: boolean;
  updatedBy: string;
}

// ==================== Config Template Version ====================

export interface ConfigTemplateVersion {
  id: string;
  templateId: string;
  tenant_id: string;
  configData: Record<string, any>;
  version: number;
  changeLog?: string;
  createdBy: string;
  createdAt: Date;
}

export interface CreateConfigTemplateVersionInput {
  templateId: string;
  configData: Record<string, any>;
  changeLog?: string;
  createdBy: string;
}

// ==================== Canary Deployment ====================

export type CanaryDeploymentStatus = 'pending' | 'running' | 'promoted' | 'rolled_back' | 'failed';

export interface CanaryDeployment {
  id: string;
  tenant_id: string;
  configId: string;
  configKey: string;
  environment: ConfigEnvironment;
  percentage: number;
  status: CanaryDeploymentStatus;
  oldValue?: Record<string, any>;
  canaryValue: Record<string, any>;
  targetValue: Record<string, any>;
  promotedAt?: Date;
  rolledBackAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCanaryDeploymentInput {
  configId: string;
  configKey: string;
  environment: ConfigEnvironment;
  percentage: number;
  canaryValue: Record<string, any>;
  targetValue: Record<string, any>;
  createdBy: string;
}

export interface UpdateCanaryPercentageInput {
  percentage: number;
}

// ==================== Canary Deployment History ====================

export interface CanaryDeploymentHistory {
  id: string;
  deploymentId: string;
  tenant_id: string;
  oldPercentage: number;
  newPercentage: number;
  action: string;
  performedBy: string;
  createdAt: Date;
}

// ==================== Config Dependency ====================

export type DependencyType = 'hard' | 'soft';

export interface ConfigDependency {
  id: string;
  tenant_id: string;
  configId: string;
  dependsOnConfigId: string;
  dependencyType: DependencyType;
  description?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConfigDependencyInput {
  configId: string;
  dependsOnConfigId: string;
  dependencyType?: DependencyType;
  description?: string;
  createdBy: string;
}

export interface DependencyGraphNode {
  configId: string;
  configKey: string;
  dependencies: DependencyGraphNode[];
  dependents: DependencyGraphNode[];
}
