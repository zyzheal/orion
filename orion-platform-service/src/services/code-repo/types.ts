/**
 * Code Repository Integration - 类型定义与接口
 *
 * 统一抽象代码仓库适配器，支持 GitLab、Gerrit、GitHub 等多种后端。
 * 适配器模式实现，易于扩展新的代码仓库类型。
 */

// ==================== 通用类型 ====================

/** 代码仓库类型 */
export enum RepoType {
  GITLAB = 'gitlab',
  GERRIT = 'gerrit',
  GITHUB = 'github',
}

/** 仓库基本信息 */
export interface Repository {
  id: string;
  name: string;
  fullName: string;        // group/project 或 owner/repo
  type: RepoType;
  url: string;
  sshUrl: string;
  httpUrl: string;
  defaultBranch: string;
  description?: string;
  visibility: 'public' | 'private' | 'internal';
  createdAt: Date;
  updatedAt: Date;
}

/** 分支信息 */
export interface Branch {
  name: string;
  isProtected: boolean;
  lastCommitSha: string;
  lastCommitMessage: string;
  lastCommitDate: Date;
  commitCount: number;
}

/** 提交信息 */
export interface Commit {
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  createdAt: Date;
  branch?: string;
}

/** 提交状态 */
export enum CommitStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/** Git 提供商 */
export enum GitProvider {
  GITLAB = 'gitlab',
  GITHUB = 'github',
  GERRIT = 'gerrit'
}

// ==================== Merge Request / Change 类型 ====================

/** PR/MR 状态 */
export enum PullRequestStatus {
  OPEN = 'opened',
  CLOSED = 'closed',
  MERGED = 'merged',
  DRAFT = 'draft',
}

/** Merge Request (GitLab) / Change (Gerrit) */
export interface PullRequest {
  id: string;
  /** GitLab: IID, Gerrit: Change-Id */
  externalId: string;
  repoId: string;
  repoName: string;
  title: string;
  description?: string;
  status: PullRequestStatus;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  assignees: string[];
  reviewers: string[];
  labels: string[];
  /** 是否通过所有检查 */
  isMergeable: boolean;
  /** 合并冲突信息 */
  mergeConflict?: string;
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  closedAt?: Date;
  /** 关联的提交 */
  commits?: Commit[];
}

/** Review 评论 */
export interface Review {
  id: string;
  pullRequestId: string;
  author: string;
  content: string;
  score?: number;        // Gerrit: Code-Review score (-2 to +2)
  state: 'comment' | 'approve' | 'request_changes' | 'dismiss';
  createdAt: Date;
  /** 文件级评论 */
  fileComments?: FileComment[];
}

/** 文件级评论 */
export interface FileComment {
  id: string;
  filePath: string;
  line?: number;
  content: string;
  author: string;
  createdAt: Date;
}

// ==================== Webhook 类型 ====================

/** Webhook 事件类型 */
export enum WebhookEventType {
  PR_OPENED = 'code.pr.opened',
  PR_UPDATED = 'code.pr.updated',
  PR_MERGED = 'code.pr.merged',
  PR_CLOSED = 'code.pr.closed',
  PR_REVIEWED = 'code.pr.reviewed',
  PUSH = 'code.push',
  BRANCH_CREATED = 'code.branch.created',
  BRANCH_DELETED = 'code.branch.deleted',
  TAG_CREATED = 'code.tag.created',
}

/** Webhook 事件载荷 - 统一格式 */
export interface CodeRepoWebhookPayload {
  /** 事件类型 */
  eventType: WebhookEventType;
  /** 仓库类型 */
  repoType: RepoType;
  /** 仓库信息 */
  repository: {
    id: string;
    name: string;
    fullName: string;
    url: string;
  };
  /** PR/MR 信息 (如果适用) */
  pullRequest?: {
    id: string;
    externalId: string;
    title: string;
    sourceBranch: string;
    targetBranch: string;
    author: string;
    status: PullRequestStatus;
    url?: string;
  };
  /** 提交信息 (push 事件) */
  push?: {
    ref: string;
    sha: string;
    author: string;
    message: string;
  };
  /** 分支信息 (branch 事件) */
  branch?: {
    name: string;
    action: 'created' | 'deleted';
  };
  /** 额外元数据 */
  metadata?: Record<string, any>;
  /** 原始 Webhook 数据 */
  rawPayload: Record<string, any>;
}

// ==================== Branch Policy 类型 ====================

/** 合并策略 */
export enum MergeStrategy {
  MERGE_COMMIT = 'merge_commit',     // 创建合并提交
  SQUASH_MERGE = 'squash_merge',     // 压缩合并
  REBASE_MERGE = 'rebase_merge',     // 变基合并
  FAST_FORWARD = 'fast_forward',     // 快进合并
}

/** 审批规则 */
export interface ApprovalRule {
  id: string;
  /** 规则名称 */
  name: string;
  /** 需要的审批人数 */
  requiredApprovals: number;
  /** 审批人/组列表 */
  approvers: string[];
  /** 是否允许作者自审 */
  allowAuthorApproval: boolean;
  /** 是否需要特定角色的审批 */
  requiredRoles?: string[];
}

/** 分支保护规则 */
export interface BranchPolicy {
  id: string;
  /** 仓库 ID */
  repoId: string;
  /** 分支名称模式 (支持通配符) */
  branchPattern: string;
  /** 是否禁止强制推送 */
  preventForcePush: boolean;
  /** 是否禁止删除分支 */
  preventDeletion: boolean;
  /** 合并策略 */
  mergeStrategy: MergeStrategy;
  /** 审批规则 */
  approvalRules: ApprovalRule[];
  /** 需要通过的 CI 检查名称列表 */
  requiredChecks: string[];
  /** 是否需要 CODEOWNERS 审批 */
  requireCodeOwners: boolean;
  /** 是否只允许线性历史 (禁用合并提交) */
  linearHistory: boolean;
  /** 是否允许跳过规则 (管理员) */
  allowAdminOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Code Ownership 类型 ====================

/** 代码所有者规则 */
export interface OwnershipRule {
  /** 文件路径模式 (glob 语法) */
  pattern: string;
  /** 所有者 (用户名或组名) */
  owners: string[];
  /** 是否需要审批 */
  isRequired: boolean;
}

/** CODEOWNERS 文件解析结果 */
export interface CodeOwnersFile {
  /** 文件路径 */
  filePath: string;
  /** 仓库 ID */
  repoId: string;
  /** 解析出的规则列表 */
  rules: OwnershipRule[];
  /** 最后更新时间 */
  lastUpdated: Date;
  /** 原始内容 */
  rawContent: string;
}

/** 文件审批推荐 */
export interface OwnershipRecommendation {
  /** 文件路径 */
  filePath: string;
  /** 推荐的所有者 */
  recommendedOwners: string[];
  /** 匹配的规则 */
  matchedRules: OwnershipRule[];
}

// ==================== 适配器接口 ====================

/** 代码仓库适配器统一接口 */
export interface ICodeRepoAdapter {
  /** 适配器类型 */
  readonly type: RepoType;

  // ----- 仓库管理 -----

  /** 获取仓库信息 */
  getRepository(projectId: string): Promise<Repository>;

  /** 获取仓库列表 */
  listRepositories(options?: {
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<Repository[]>;

  // ----- 分支管理 -----

  /** 获取分支列表 */
  listBranches(repoId: string, options?: {
    page?: number;
    perPage?: number;
  }): Promise<Branch[]>;

  /** 获取分支详情 */
  getBranch(repoId: string, branchName: string): Promise<Branch>;

  /** 创建分支 */
  createBranch(repoId: string, branchName: string, sourceRef: string): Promise<Branch>;

  /** 删除分支 */
  deleteBranch(repoId: string, branchName: string): Promise<void>;

  /** 获取分支保护状态 */
  getBranchProtection(repoId: string, branchName: string): Promise<{
    isProtected: boolean;
    rules?: Record<string, any>;
  }>;

  // ----- 提交管理 -----

  /** 获取提交列表 */
  listCommits(repoId: string, options?: {
    branch?: string;
    page?: number;
    perPage?: number;
  }): Promise<Commit[]>;

  /** 获取提交详情 */
  getCommit(repoId: string, sha: string): Promise<Commit>;

  // ----- Pull Request / Change 管理 -----

  /** 创建 MR/Change */
  createPullRequest(repoId: string, input: {
    title: string;
    description?: string;
    sourceBranch: string;
    targetBranch: string;
    reviewers?: string[];
    labels?: string[];
  }): Promise<PullRequest>;

  /** 获取 PR/Change 详情 */
  getPullRequest(repoId: string, prId: string): Promise<PullRequest>;

  /** 获取 PR/Change 列表 */
  listPullRequests(repoId: string, options?: {
    state?: PullRequestStatus;
    author?: string;
    page?: number;
    perPage?: number;
  }): Promise<PullRequest[]>;

  /** 合并 PR/Change */
  mergePullRequest(repoId: string, prId: string, options?: {
    strategy?: MergeStrategy;
    commitMessage?: string;
  }): Promise<PullRequest>;

  /** 关闭 PR/Change */
  closePullRequest(repoId: string, prId: string): Promise<PullRequest>;

  /** 更新 PR/Change */
  updatePullRequest(repoId: string, prId: string, input: {
    title?: string;
    description?: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<PullRequest>;

  // ----- Review 管理 -----

  /** 添加 Review 评论 */
  addReview(repoId: string, prId: string, input: {
    content: string;
    score?: number;
    state?: 'comment' | 'approve' | 'request_changes';
    fileComments?: FileComment[];
  }): Promise<Review>;

  /** 获取 PR 的 Reviews */
  listReviews(repoId: string, prId: string): Promise<Review[]>;

  // ----- Webhook 管理 -----

  /** 创建 Webhook */
  createWebhook(repoId: string, input: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<WebhookConfig>;

  /** 获取 Webhook 列表 */
  listWebhooks(repoId: string): Promise<WebhookConfig[]>;

  /** 删除 Webhook */
  deleteWebhook(repoId: string, webhookId: string): Promise<void>;
}

/** Webhook 配置 */
export interface WebhookConfig {
  id: string;
  repoId: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  createdAt: Date;
}

// ==================== Webhook 处理类型 ====================

/** Webhook 处理结果 */
export interface WebhookProcessResult {
  /** 是否处理成功 */
  success: boolean;
  /** 发布的事件 ID */
  eventId?: string;
  /** 事件类型 */
  eventType?: WebhookEventType;
  /** 错误信息 */
  error?: string;
}
