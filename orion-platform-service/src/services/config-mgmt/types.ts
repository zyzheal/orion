/**
 * Configuration Management & GitOps - Type Definitions
 *
 * Types for centralized config management, GitOps sync, approval workflows,
 * and config diff/rollback functionality.
 */

// ==================== Environment ====================

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
