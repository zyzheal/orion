/**
 * Type definitions for Code Ownership module
 *
 * 定义 CODEOWNERS 文件解析、所有权规则、审批人推荐相关类型
 */

/**
 * 单条所有权规则
 *
 * 示例: src/services/code-repo/    @team-backend    @tech-lead
 */
export interface OwnershipRule {
  /** 文件路径模式，如 *.go, src/services/** */
  pattern: string;
  /** 审批人/团队列表，如 ["@team-backend", "@tech-lead"] */
  owners: string[];
  /** 规则来源行号（用于错误报告） */
  line?: number;
  /** 是否为全局规则（覆盖所有子目录） */
  isGlobal?: boolean;
}

/**
 * 解析后的 CODEOWNERS 文件
 */
export interface CodeOwnersFile {
  /** 所属仓库 ID */
  repoId: string;
  /** CODEOWNERS 文件路径，如 .github/CODEOWNERS */
  filePath: string;
  /** 解析后的规则列表 */
  rules: OwnershipRule[];
  /** 最后更新时间 */
  lastUpdated: Date;
  /** 原始文件内容（用于回滚/展示） */
  rawContent: string;
}

/**
 * 审批人推荐结果
 */
export interface OwnerRecommendation {
  /** 文件路径 */
  filePath: string;
  /** 匹配的审批人 */
  owners: string[];
  /** 匹配的规则模式 */
  matchedPattern: string;
}

/**
 * PR 审批结果
 */
export interface PRApprovalResult {
  /** 所有变更文件的审批人汇总 */
  requiredApprovers: string[];
  /** 按文件分解的审批人 */
  fileApprovers: Array<{
    filePath: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    owners: string[];
    matchedPattern: string;
  }>;
  /** 缺少 CODEOWNERS 配置的文件 */
  unownedFiles: string[];
}

/**
 * 验证结果
 */
export interface CodeOwnershipValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: string[];
  /** 警告列表 */
  warnings: string[];
  /** 解析到的规则数量 */
  ruleCount: number;
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Branch Policy Types ====================

/**
 * 合并策略类型
 */
export type MergeStrategy = 'merge' | 'squash' | 'rebase' | 'fast-forward';

/**
 * 审批规则
 */
export interface ApprovalRule {
  id: string;
  name: string;
  requiredApprovals: number;
  approvers: string[];
  allowAuthorApproval?: boolean;
  requiredRoles?: string[];
}

/**
 * 分支保护策略
 */
export interface BranchPolicy extends BaseEntity {
  repoId: string;
  branchPattern: string;
  preventForcePush: boolean;
  preventDeletion: boolean;
  mergeStrategy: MergeStrategy;
  approvalRules: ApprovalRule[];
  requiredChecks: string[];
  requireCodeOwners: boolean;
  linearHistory: boolean;
  allowAdminOverride: boolean;
}

/**
 * 创建分支策略输入
 */
export interface CreateBranchPolicyInput {
  repoId: string;
  branchPattern: string;
  preventForcePush?: boolean;
  preventDeletion?: boolean;
  mergeStrategy?: MergeStrategy;
  approvalRules?: Array<Omit<ApprovalRule, 'id'>>;
  requiredChecks?: string[];
  requireCodeOwners?: boolean;
  linearHistory?: boolean;
  allowAdminOverride?: boolean;
}

/**
 * 更新分支策略输入
 */
export interface UpdateBranchPolicyInput {
  preventForcePush?: boolean;
  preventDeletion?: boolean;
  mergeStrategy?: MergeStrategy;
  approvalRules?: Array<Omit<ApprovalRule, 'id'>>;
  requiredChecks?: string[];
  requireCodeOwners?: boolean;
  linearHistory?: boolean;
  allowAdminOverride?: boolean;
}

// ==================== PR Mergeability Check Types ====================

/**
 * Pull Request 定义
 */
export interface PullRequest {
  id: string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  status: string;
}

/**
 * 合并检查选项
 */
export interface MergeCheckOptions {
  approvals?: Record<string, number>;
  checkResults?: Record<string, 'success' | 'failure' | 'pending'>;
  codeOwnersApproved?: boolean;
  isAdmin?: boolean;
}

/**
 * 合并检查结果
 */
export interface MergeCheckResult {
  canMerge: boolean;
  policy: BranchPolicy | null;
  blocks: MergeCheckBlock[];
  warnings: string[];
}

/**
 * 合并阻塞项
 */
export interface MergeCheckBlock {
  rule: string;
  reason: string;
  severity: 'error' | 'warning';
}
