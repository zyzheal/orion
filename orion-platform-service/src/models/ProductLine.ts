/**
 * ProductLine Types - 多分支产品线类型定义
 *
 * 基于 ADR-008 ProductLine-CRD 设计
 */

// ==================== 基础类型 ====================

export type BranchMode = 'gitflow' | 'github-flow' | 'trunk-based';
export type PatternType = 'exact' | 'glob' | 'regex';
export type GitProvider = 'github' | 'gitlab' | 'gitea' | 'azure-devops';
export type EnvironmentName = 'dev' | 'test' | 'staging' | 'preprod' | 'prod';
export type DeploymentStrategy = 'recreate' | 'rolling' | 'canary' | 'blue-green';
export type ProductLinePhase = 'Pending' | 'Active' | 'Suspended' | 'Error' | 'Terminating';
export type TeamRole = 'admin' | 'maintainer' | 'developer' | 'viewer';
export type NotificationType = 'slack' | 'dingtalk' | 'wechat' | 'email' | 'webhook';
export type MergeMethod = 'merge' | 'squash' | 'rebase' | 'fast-forward';

// ==================== Git 仓库配置 ====================

export interface GitCredentialRef {
  name: string;
  namespace?: string;
}

export interface SSHKeyRef {
  secretName: string;
  key?: string;
}

export interface CloneOptions {
  depth?: number;
  submodules?: boolean;
  lfs?: boolean;
}

export interface GitRepoConfig {
  url: string;
  provider?: GitProvider;
  defaultBranch?: string;
  credentialRef?: GitCredentialRef;
  sshKeyRef?: SSHKeyRef;
  cloneOptions?: CloneOptions;
}

// ==================== 分支策略 ====================

export interface ProtectedBranch {
  pattern: string;
  patternType?: PatternType;
  allowForcePush?: boolean;
  allowDelete?: boolean;
  requirePullRequest?: boolean;
  requiredReviewers?: number;
  requireCiPass?: boolean;
  requiredChecks?: string[];
  allowedMergeMethods?: MergeMethod[];
}

export interface CodeOwner {
  path: string;
  reviewers: string[];
  requiredReviews?: number;
  labels?: string[];
}

export interface CodeOwnership {
  enabled?: boolean;
  owners?: CodeOwner[];
  defaultReviewers?: string[];
  autoAssign?: boolean;
}

export interface NamingConvention {
  feature?: string;
  bugfix?: string;
  hotfix?: string;
  release?: string;
  enforce?: boolean;
}

export interface MergeStrategy {
  method?: MergeMethod;
  commitMessage?: {
    includePRTitle?: boolean;
    includePRBody?: boolean;
    includeCoAuthors?: boolean;
    prefix?: string;
  };
  deleteSourceBranch?: boolean;
}

export interface BranchPolicies {
  mode: BranchMode;
  protectedBranches?: ProtectedBranch[];
  codeOwnership?: CodeOwnership;
  namingConvention?: NamingConvention;
  mergeStrategy?: MergeStrategy;
}

// ==================== 环境映射 ====================

export interface ApprovalConfig {
  requiredApprovers?: number;
  approverRoles?: string[];
  approverUsers?: string[];
  timeoutSeconds?: number;
}

export interface BranchMappingCondition {
  type: 'path_change' | 'label' | 'file_exists';
  value: string;
  action: 'trigger' | 'skip' | 'require_approval';
}

export interface BranchEnvironmentMapping {
  branch: string;
  patternType: PatternType;
  environment: EnvironmentName;
  priority?: number;
  autoDeploy?: boolean;
  requireApproval?: boolean;
  approvalConfig?: ApprovalConfig;
  pipelineTemplate?: string;
  conditions?: BranchMappingCondition[];
}

export interface PromotionConfig {
  enabled?: boolean;
  chain?: EnvironmentName[];
  autoPromote?: Array<{
    from: EnvironmentName;
    to: EnvironmentName;
    conditions: string[];
  }>;
}

export interface EnvironmentMappings {
  defaultEnvironment?: EnvironmentName;
  mappings: BranchEnvironmentMapping[];
  promotion?: PromotionConfig;
}

// ==================== 环境配置 ====================

export interface ArgoCDConfig {
  application?: string;
  project?: string;
  repoURL?: string;
  path?: string;
  targetRevision?: string;
  syncPolicy?: {
    automated?: boolean;
    prune?: boolean;
    selfHeal?: boolean;
  };
}

export interface CanaryStep {
  weight: number;
  pause?: {
    duration?: string;
    enabled?: boolean;
  };
}

export interface CanaryMetric {
  name: string;
  threshold: string;
}

export interface CanaryConfig {
  steps?: CanaryStep[];
  metrics?: CanaryMetric[];
}

export interface EnvVarValueFrom {
  configMapKeyRef?: { name: string; key: string };
  secretKeyRef?: { name: string; key: string };
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: EnvVarValueFrom;
}

export interface SecretRef {
  name: string;
  mountPath?: string;
  items?: Array<{ key: string; path: string }>;
}

export interface ResourceQuota {
  maxPods?: number;
  maxCPU?: string;
  maxMemory?: string;
  maxStorage?: string;
}

export interface ReplicasConfig {
  min?: number;
  max?: number;
  target?: number;
}

export interface HPAConfig {
  enabled?: boolean;
  minReplicas?: number;
  maxReplicas?: number;
  targetCPUUtilization?: number;
  targetMemoryUtilization?: number;
}

export interface ClusterRef {
  name: string;
  apiServer?: string;
  credentialRef?: { name: string; namespace?: string };
}

export interface EnvironmentConfig {
  name: EnvironmentName;
  displayName?: string;
  namespace: string;
  cluster?: string;
  clusterRef?: ClusterRef;
  argocd?: ArgoCDConfig;
  deploymentStrategy?: DeploymentStrategy;
  canaryConfig?: CanaryConfig;
  env?: EnvVar[];
  secrets?: SecretRef[];
  resourceQuota?: ResourceQuota;
  replicas?: ReplicasConfig;
  hpa?: HPAConfig;
}

// ==================== 团队绑定 ====================

export interface TeamBinding {
  teamRef: string;
  role: TeamRole;
  permissions?: string[];
  environments?: EnvironmentName[];
}

// ==================== 通知配置 ====================

export interface NotificationChannel {
  type: NotificationType;
  target: string;
  secretRef?: { name: string; namespace?: string };
  events?: string[];
}

export interface NotificationRule {
  event: string;
  severity?: 'info' | 'warning' | 'error';
  channels?: string[];
}

export interface NotificationsConfig {
  channels?: NotificationChannel[];
  rules?: NotificationRule[];
}

// ==================== 流水线模板 ====================

export interface PipelineTemplate {
  name: string;
  type?: 'tekton' | 'argo-workflow' | 'jenkins' | 'custom';
  ref?: string;
  namespace?: string;
  params?: Array<{ name: string; value?: string; default?: string }>;
  workspaces?: Array<{ name: string; volumeClaimTemplate?: any; emptyDir?: any }>;
  when?: Array<{ input: string; operator: 'in' | 'notin'; values: string[] }>;
}

export interface PipelineTemplatesConfig {
  defaultTemplate?: string;
  templates?: PipelineTemplate[];
}

// ==================== 资源配额 ====================

export interface PipelineQuota {
  maxConcurrent?: number;
  maxDaily?: number;
  timeoutSeconds?: number;
}

export interface BuildQuota {
  maxCacheSize?: string;
  maxBuildTime?: number;
  maxParallelBuilds?: number;
}

export interface StorageQuota {
  maxArtifactSize?: string;
  maxRetentionDays?: number;
}

export interface ComputeQuota {
  maxCPU?: string;
  maxMemory?: string;
  maxEphemeralStorage?: string;
}

export interface ResourceQuotas {
  pipeline?: PipelineQuota;
  build?: BuildQuota;
  storage?: StorageQuota;
  compute?: ComputeQuota;
}

// ==================== ProductLine 主实体 ====================

export interface ProductLine {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  gitRepo: GitRepoConfig;
  branchPolicies: BranchPolicies;
  environmentMappings: EnvironmentMappings;
  environments?: EnvironmentConfig[];
  pipelineTemplates?: PipelineTemplatesConfig;
  teamBindings?: TeamBinding[];
  resourceQuotas?: ResourceQuotas;
  notifications?: NotificationsConfig;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  status: ProductLineStatus;
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string;
}

export interface ProductLineStatus {
  phase: ProductLinePhase;
  conditions?: ProductLineCondition[];
  statistics?: ProductLineStatistics;
  gitStatus?: GitSyncStatus;
  environments?: EnvironmentStatus[];
  observedGeneration?: number;
}

export interface ProductLineCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  reason?: string;
  message?: string;
  lastTransitionTime?: Date;
  lastUpdateTime?: Date;
}

export interface ProductLineStatistics {
  totalPipelines?: number;
  activePipelines?: number;
  successfulPipelines?: number;
  failedPipelines?: number;
  totalDeployments?: number;
  lastDeploymentTime?: Date;
}

export interface GitSyncStatus {
  lastSyncTime?: Date;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    time: Date;
  };
  branches?: Array<{
    name: string;
    lastCommit: string;
    protected: boolean;
  }>;
}

export interface EnvironmentStatus {
  name: string;
  phase: 'Pending' | 'Ready' | 'Error';
  lastDeployment?: {
    version: string;
    time: Date;
    status: string;
  };
}

// ==================== 创建/更新输入 ====================

export interface ProductLineCreateInput {
  name: string;
  displayName: string;
  description?: string;
  gitRepo: GitRepoConfig;
  branchPolicies: BranchPolicies;
  environmentMappings: EnvironmentMappings;
  environments?: EnvironmentConfig[];
  pipelineTemplates?: PipelineTemplatesConfig;
  teamBindings?: TeamBinding[];
  resourceQuotas?: ResourceQuotas;
  notifications?: NotificationsConfig;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  tenantId?: string;
}

export interface ProductLineUpdateInput {
  displayName?: string;
  description?: string;
  branchPolicies?: BranchPolicies;
  environmentMappings?: EnvironmentMappings;
  environments?: EnvironmentConfig[];
  pipelineTemplates?: PipelineTemplatesConfig;
  teamBindings?: TeamBinding[];
  resourceQuotas?: ResourceQuotas;
  notifications?: NotificationsConfig;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

// ==================== ReleaseTrain ====================

export interface ReleaseTrain {
  id: string;
  productLineId: string;
  name: string;
  schedule: string;  // Cron expression
  targetBranch?: string;
  sourceBranch?: string;
  autoPromote?: boolean;
  approvalRequired?: boolean;
  approvers?: string[];
  preChecks?: Array<{
    name: string;
    type: 'test' | 'security' | 'performance' | 'manual';
    required?: boolean;
  }>;
  postActions?: Array<{
    name: string;
    type: 'notify' | 'tag' | 'changelog' | 'sync';
    config?: Record<string, any>;
  }>;
  status: ReleaseTrainStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseTrainStatus {
  lastRun?: Date;
  nextRun?: Date;
  state: 'Idle' | 'Running' | 'Completed' | 'Failed' | 'Skipped';
  lastRelease?: string;
}

// ==================== HotfixChannel ====================

export interface HotfixChannel {
  id: string;
  productLineId: string;
  name: string;
  enabled?: boolean;
  branchPattern?: string;
  skipStages?: string[];
  requiredStages?: string[];
  approvalRequired?: boolean;
  approvalTimeout?: number;  // minutes
  autoMerge?: boolean;
  notifyOnCall?: boolean;
  maxDuration?: number;  // minutes
  status: HotfixChannelStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface HotfixChannelStatus {
  activeHotfixes?: number;
  lastHotfix?: string;
}