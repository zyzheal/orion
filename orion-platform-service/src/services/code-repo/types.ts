/**
 * Type definitions for Code Ownership module
 *
 * 定义 CODEOWNERS 文件解析、所有权规则、审批人推荐相关类型
 */

export enum RepoType {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  GERRIT = 'gerrit',
  BITBUCKET = 'bitbucket',
}

export enum PullRequestStatus {
  OPEN = 'open',
  MERGED = 'merged',
  CLOSED = 'closed',
}

export enum WebhookEventType {
  PR_OPENED = 'pr_opened',
  PR_MERGED = 'pr_merged',
  PR_CLOSED = 'pr_closed',
  PR_UPDATED = 'pr_updated',
  PR_REVIEWED = 'pr_reviewed',
  PUSH = 'push',
}

// ==================== Code Repository Types ====================

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  url: string;
  type: RepoType;
  defaultBranch: string;
  isPrivate: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
  lastCommitDate?: Date;
}

export interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
  url: string;
}

export interface Review {
  id: string;
  body?: string;
  state: 'pending' | 'approved' | 'changes_requested';
  author: string;
  createdAt: Date;
}

export interface FileComment {
  id: string;
  path: string;
  line: number;
  body: string;
  author: string;
  createdAt: Date;
}

/**
 * 文件 diff 的单个变更块
 */
export interface DiffHunk {
  /** 变更块在旧文件中的起始行 */
  oldStart: number;
  /** 变更块在旧文件中的行数 */
  oldLines: number;
  /** 变更块在新文件中的起始行 */
  newStart: number;
  /** 变更块在新文件中的行数 */
  newLines: number;
  /** 变更内容（行级 diff） */
  lines: string[];
  /** 变更块头部描述 */
  header?: string;
}

/**
 * 文件 diff 结果
 */
export interface FileDiff {
  /** 文件路径 */
  path: string;
  /** 旧文件 blob ID */
  oldBlobId?: string;
  /** 新文件 blob ID */
  newBlobId?: string;
  /** 是否为新文件 */
  isNew: boolean;
  /** 是否为删除文件 */
  isDeleted: boolean;
  /** 是否为重命名 */
  isRenamed: boolean;
  /** 变更 hunks */
  hunks: DiffHunk[];
  /** 变更统计 */
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

/**
 * PR/MR 评论（行级或整体）
 */
export interface PRComment {
  id: string;
  prId: string;
  /** 关联的文件路径（行级评论） */
  path?: string;
  /** 关联的行号 */
  line?: number;
  /** 评论内容 */
  body: string;
  /** 评论作者 */
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: WebhookEventType[];
  active: boolean;
  secret?: string;
}

// ==================== Webhook Payload Types ====================

export interface CodeRepoWebhookPayload {
  eventId?: string;
  eventType: string;
  repoType?: string;
  repositoryId: string;
  repository?: string | { id: string; name: string; fullName: string; url: string };
  repositoryName: string;
  repositoryUrl: string;
  sender: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
  pullRequest?: Record<string, unknown>;
  push?: Record<string, unknown>;
}

export interface WebhookProcessResult {
  success: boolean;
  message?: string;
  processed?: boolean;
  error?: string;
  eventId?: string;
  eventType?: string;
}

// ==================== ICodeRepoAdapter Interface ====================

/**
 * 代码仓库适配器接口
 */
export interface ICodeRepoAdapter {
  /** 适配器类型 */
  readonly type: RepoType;
  /** 获取单个仓库信息 */
  getRepository(repoId: string): Promise<Repository>;
  /** 列出仓库列表 */
  listRepositories(options?: { page?: number; limit?: number; search?: string }): Promise<{ repos: Repository[]; total: number }>;
  /** 列出分支 */
  listBranches(repoId: string, options?: { page?: number; limit?: number }): Promise<{ branches: Branch[]; total: number }>;
  /** 获取分支信息 */
  getBranch(repoId: string, branchName: string): Promise<Branch>;
  /** 创建分支 */
  createBranch(repoId: string, branchName: string, sourceRef: string): Promise<Branch>;
  /** 删除分支 */
  deleteBranch(repoId: string, branchName: string): Promise<void>;
  /** 获取分支保护设置 */
  getBranchProtection(repoId: string, branchName: string): Promise<BranchPolicy | null>;
  /** 列出提交历史 */
  listCommits(repoId: string, options?: { branch?: string; page?: number; limit?: number }): Promise<{ commits: Commit[]; total: number }>;
  /** 获取单个提交 */
  getCommit(repoId: string, sha: string): Promise<Commit>;
  /** 创建 Pull Request */
  createPullRequest(repoId: string, input: { title: string; body?: string; sourceBranch: string; targetBranch: string }): Promise<PullRequest>;
  /** 获取 Pull Request */
  getPullRequest(repoId: string, prId: string): Promise<PullRequest>;
  /** 列出 Pull Requests */
  listPullRequests(repoId: string, options?: { state?: PullRequestStatus; page?: number; limit?: number }): Promise<{ pullRequests: PullRequest[]; total: number }>;
  /** 合并 Pull Request */
  mergePullRequest(repoId: string, prId: string, options?: { method?: MergeStrategy | undefined; commitMessage?: string | undefined; } | undefined): Promise<PullRequest>;
  /** 关闭 Pull Request */
  closePullRequest(repoId: string, prId: string): Promise<PullRequest>;
  /** 更新 Pull Request */
  updatePullRequest(repoId: string, prId: string, input: { title?: string; body?: string }): Promise<PullRequest>;
  /** 添加 Review */
  addReview(repoId: string, prId: string, input: { content?: string; score?: number | undefined; state?: "comment" | "approve" | "request_changes" | undefined; fileComments?: FileComment[] | undefined; } | { body?: string | undefined; event?: "comment" | "approve" | "request_changes" | undefined; }): Promise<Review>;
  /** 列出 Reviews */
  listReviews(repoId: string, prId: string): Promise<Review[]>;
  /** 创建 Webhook */
  createWebhook(repoId: string, input: { url: string; events: WebhookEventType[]; active?: boolean; secret?: string }): Promise<WebhookConfig>;
  /** 列出 Webhooks */
  listWebhooks(repoId: string): Promise<WebhookConfig[]>;
  /** 更新 Webhook */
  updateWebhook(repoId: string, webhookId: string, input: { url?: string; events?: WebhookEventType[]; active?: boolean; secret?: string }): Promise<WebhookConfig>;
  /** 删除 Webhook */
  deleteWebhook(repoId: string, webhookId: string): Promise<void>;
  /** 列出标签 */
  listTags(repoId: string): Promise<{ tags: string[]; total: number }>;
  /** 获取文件 diff（两个提交/分支之间） */
  getFileDiff(repoId: string, fromRef: string, toRef: string, options?: { path?: string }): Promise<FileDiff[]>;
  /** 列出 PR/MR 评论 */
  listComments(repoId: string, prId: string): Promise<PRComment[]>;
  /** 添加 PR/MR 评论 */
  addComment(repoId: string, prId: string, input: { body: string; path?: string; line?: number }): Promise<PRComment>;
}

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
  /** 记录 ID */
  id: string;
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
