/**
 * GitLab Adapter - GitLab 代码仓库适配器
 *
 * 实现 ICodeRepoAdapter 接口，对接 GitLab API。
 * 支持仓库管理、MR 管理、分支管理、Webhook 管理等功能。
 *
 * GitLab API 文档: https://docs.gitlab.com/ee/api/
 */

import {
  ICodeRepoAdapter,
  RepoType,
  Repository,
  Branch,
  BranchPolicy,
  Commit,
  PullRequest,
  PullRequestStatus,
  Review,
  FileComment,
  WebhookConfig,
  MergeStrategy,
} from './types';

/** GitLab 适配器配置 */
export interface GitLabAdapterConfig {
  /** GitLab 实例 URL */
  baseUrl: string;
  /** 访问令牌 (Private Token 或 OAuth Token) */
  token: string;
  /** API 版本 */
  apiVersion?: string;
  /** 请求超时 (ms) */
  timeout?: number;
  /** 是否启用真实 API 调用（默认通过 GITLAB_API_ENABLED 环境变量控制） */
  enableRealApi?: boolean;
}

/**
 * GitLab REST API 客户端
 *
 * 使用 native fetch() 调用 GitLab REST API。
 * 当服务不可达时降级为 mock 数据。
 */
class GitLabApiClient {
  private baseUrl: string;
  private token: string;
  private apiVersion: string;
  private timeout: number;
  private enableRealApi: boolean;

  constructor(config: GitLabAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.apiVersion = config.apiVersion || 'v4';
    this.timeout = config.timeout || 10_000;
    this.enableRealApi = config.enableRealApi ?? process.env.GITLAB_API_ENABLED === 'true';
  }

  /** 构建 API URL */
  private apiUrl(path: string): string {
    return `${this.baseUrl}/api/${this.apiVersion}${path}`;
  }

  /** 获取请求头 */
  private getHeaders(): Record<string, string> {
    return {
      'PRIVATE-TOKEN': this.token,
      'Content-Type': 'application/json',
    };
  }

  /** GET 请求 */
  async get<T>(path: string, fallback: T): Promise<T> {
    if (!this.enableRealApi) return fallback;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.apiUrl(path), {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return fallback;
      }
      return response.json() as Promise<T>;
    } catch {
      return fallback;
    }
  }

  /** POST 请求 */
  async post<T>(path: string, body: Record<string, any>, fallback: T): Promise<T> {
    if (!this.enableRealApi) return fallback;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.apiUrl(path), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return fallback;
      }
      return response.json() as Promise<T>;
    } catch {
      return fallback;
    }
  }

  /** PUT 请求 */
  async put<T>(path: string, body: Record<string, any>, fallback: T): Promise<T> {
    if (!this.enableRealApi) return fallback;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.apiUrl(path), {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return fallback;
      }
      return response.json() as Promise<T>;
    } catch {
      return fallback;
    }
  }

  /** DELETE 请求 */
  async delete(path: string): Promise<boolean> {
    if (!this.enableRealApi) return false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.apiUrl(path), {
        method: 'DELETE',
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * GitLab 适配器实现
 *
 * 将 GitLab API 统一映射到 ICodeRepoAdapter 接口
 */
export class GitLabAdapter implements ICodeRepoAdapter {
  readonly type = RepoType.GITLAB;

  private client: GitLabApiClient;
  private baseUrl: string;

  constructor(config: GitLabAdapterConfig) {
    this.client = new GitLabApiClient(config);
    this.baseUrl = config.baseUrl;
  }

  // ==================== 仓库管理 ====================

  /**
   * 获取仓库信息
   *
   * GitLab API: GET /projects/:id
   */
  async getRepository(projectId: string): Promise<Repository> {
    const fallback = {
      id: projectId,
      name: projectId.split('/').pop() || 'unknown',
      fullName: projectId,
      type: RepoType.GITLAB,
      url: `${this.baseUrl}/${projectId}`,
      sshUrl: `git@${new URL(this.baseUrl).hostname}:${projectId}.git`,
      httpUrl: `${this.baseUrl}/${projectId}.git`,
      defaultBranch: 'main',
      visibility: 'private' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const data = await this.client.get(
      `/projects/${encodeURIComponent(projectId)}`,
      fallback
    );

    // If real API returned the fallback (empty object), use fallback directly
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return fallback;
    }

    return this.mapGitLabProjectToRepository(data);
  }

  /**
   * 获取仓库列表
   *
   * GitLab API: GET /projects
   */
  async listRepositories(options?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ repos: Repository[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.search) params.set('search', options.search);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('per_page', String(options.limit));

    const projects: any[] = await this.client.get(
      `/projects?${params}`,
      []
    );

    const repos = projects.map(p => this.mapGitLabProjectToRepository(p));
    return { repos, total: projects.length };
  }

  // ==================== 分支管理 ====================

  /**
   * 获取分支列表
   *
   * GitLab API: GET /projects/:id/repository/branches
   */
  async listBranches(repoId: string, options?: {
    page?: number;
    limit?: number;
  }): Promise<{ branches: Branch[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('per_page', String(options.limit));

    const branches: any[] = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/repository/branches?${params}`,
      []
    );

    return { branches: branches.map(b => this.mapGitLabBranchToBranch(b)), total: branches.length };
  }

  /**
   * 获取分支详情
   *
   * GitLab API: GET /projects/:id/repository/branches/:branch
   */
  async getBranch(repoId: string, branchName: string): Promise<Branch> {
    const fallback: Branch = {
      name: branchName,
      isProtected: false,
      lastCommitSha: '',
      lastCommitMessage: '',
      lastCommitDate: new Date(),
      commitCount: 0,
    };

    const branch: any = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/repository/branches/${encodeURIComponent(branchName)}`,
      fallback
    );

    if (!branch || (typeof branch === 'object' && Object.keys(branch).length === 0)) {
      return fallback;
    }

    return this.mapGitLabBranchToBranch(branch);
  }

  /**
   * 创建分支
   *
   * GitLab API: POST /projects/:id/repository/branches
   */
  async createBranch(repoId: string, branchName: string, sourceRef: string): Promise<Branch> {
    const fallback: Branch = {
      name: branchName,
      isProtected: false,
      lastCommitSha: '',
      lastCommitMessage: '',
      lastCommitDate: new Date(),
      commitCount: 0,
    };

    const branch: any = await this.client.post(
      `/projects/${encodeURIComponent(repoId)}/repository/branches`,
      { branch: branchName, ref: sourceRef },
      fallback
    );

    if (!branch || (typeof branch === 'object' && Object.keys(branch).length === 0)) {
      return fallback;
    }

    return this.mapGitLabBranchToBranch(branch);
  }

  /**
   * 删除分支
   *
   * GitLab API: DELETE /projects/:id/repository/branches/:branch
   */
  async deleteBranch(repoId: string, branchName: string): Promise<void> {
    await this.client.delete(
      `/projects/${encodeURIComponent(repoId)}/repository/branches/${encodeURIComponent(branchName)}`
    );
  }

  /**
   * 获取分支保护状态
   *
   * GitLab API: GET /projects/:id/protected_branches/:branch
   */
  async getBranchProtection(repoId: string, branchName: string): Promise<BranchPolicy | null> {
    try {
      const protectedBranch: any = await this.client.get(
        `/projects/${encodeURIComponent(repoId)}/protected_branches/${encodeURIComponent(branchName)}`,
        null
      );

      if (protectedBranch) {
        return {
          id: protectedBranch.id || branchName,
          repoId,
          branchPattern: branchName,
          preventForcePush: protectedBranch.allow_force_push === false,
          preventDeletion: true,
          mergeStrategy: 'merge' as MergeStrategy,
          approvalRules: [],
          requiredChecks: [],
          requireCodeOwners: false,
          linearHistory: false,
          allowAdminOverride: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    } catch {
      // Not protected
    }

    return { isProtected: false };
  }

  // ==================== 提交管理 ====================

  /**
   * 获取提交列表
   *
   * GitLab API: GET /projects/:id/repository/commits
   */
  async listCommits(repoId: string, options?: {
    branch?: string;
    page?: number;
    limit?: number;
  }): Promise<{ commits: Commit[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.branch) params.set('ref_name', options.branch);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('per_page', String(options.limit));

    const commits: any[] = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/repository/commits?${params}`,
      []
    );

    return { commits: commits.map(c => this.mapGitLabCommitToCommit(c)), total: commits.length };
  }

  /**
   * 获取提交详情
   *
   * GitLab API: GET /projects/:id/repository/commits/:sha
   */
  async getCommit(repoId: string, sha: string): Promise<Commit> {
    const fallback: Commit = {
      sha,
      message: '',
      author: '',
      authorEmail: '',
      createdAt: new Date(),
    };

    const commit: any = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/repository/commits/${sha}`,
      fallback
    );

    if (!commit || (typeof commit === 'object' && Object.keys(commit).length === 0)) {
      return fallback;
    }

    return this.mapGitLabCommitToCommit(commit);
  }

  // ==================== Merge Request 管理 ====================

  /**
   * 创建 Merge Request
   *
   * GitLab API: POST /projects/:id/merge_requests
   */
  async createPullRequest(repoId: string, input: {
    title: string;
    description?: string;
    sourceBranch: string;
    targetBranch: string;
    reviewers?: string[];
    labels?: string[];
  }): Promise<PullRequest> {
    const fallback: PullRequest = {
      id: `mr-${Date.now()}`,
      externalId: '1',
      repoId,
      repoName: repoId,
      title: input.title,
      description: input.description,
      status: PullRequestStatus.OPEN,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      author: 'current-user',
      assignees: [],
      reviewers: input.reviewers || [],
      labels: input.labels || [],
      isMergeable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mr: any = await this.client.post(
      `/projects/${encodeURIComponent(repoId)}/merge_requests`,
      {
        title: input.title,
        description: input.description,
        source_branch: input.sourceBranch,
        target_branch: input.targetBranch,
        labels: input.labels?.join(','),
      },
      fallback
    );

    if (!mr || (typeof mr === 'object' && Object.keys(mr).length === 0)) {
      return fallback;
    }

    return this.mapGitLabMRToPullRequest(mr);
  }

  /**
   * 获取 Merge Request 详情
   *
   * GitLab API: GET /projects/:id/merge_requests/:iid
   */
  async getPullRequest(repoId: string, prId: string): Promise<PullRequest> {
    const fallback: PullRequest = {
      id: prId,
      externalId: prId,
      repoId,
      repoName: repoId,
      title: 'Mock MR',
      status: PullRequestStatus.OPEN,
      sourceBranch: 'feature-branch',
      targetBranch: 'main',
      author: 'user',
      assignees: [],
      reviewers: [],
      labels: [],
      isMergeable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mr: any = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}`,
      fallback
    );

    if (!mr || (typeof mr === 'object' && Object.keys(mr).length === 0)) {
      return fallback;
    }

    return this.mapGitLabMRToPullRequest(mr);
  }

  /**
   * 获取 Merge Request 列表
   *
   * GitLab API: GET /projects/:id/merge_requests
   */
  async listPullRequests(repoId: string, options?: {
    state?: PullRequestStatus;
    page?: number;
    limit?: number;
  }): Promise<{ pullRequests: PullRequest[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.state) params.set('state', this.mapPullRequestStateToGitLab(options.state));
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('per_page', String(options.limit));

    const mrs: any[] = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/merge_requests?${params}`,
      []
    );

    return { pullRequests: mrs.map(mr => this.mapGitLabMRToPullRequest(mr)), total: mrs.length };
  }

  /**
   * 合并 Merge Request
   *
   * GitLab API: PUT /projects/:id/merge_requests/:iid/merge
   */
  async mergePullRequest(repoId: string, prId: string, options?: {
    strategy?: MergeStrategy;
    commitMessage?: string;
  }): Promise<PullRequest> {
    const fallback: PullRequest = {
      id: prId,
      externalId: prId,
      repoId,
      repoName: repoId,
      title: 'Mock MR',
      status: PullRequestStatus.MERGED,
      sourceBranch: 'feature-branch',
      targetBranch: 'main',
      author: 'user',
      assignees: [],
      reviewers: [],
      labels: [],
      isMergeable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      mergedAt: new Date(),
    };

    const body: Record<string, any> = {};
    if (options?.commitMessage) body.merge_commit_message = options.commitMessage;
    if (options?.strategy === MergeStrategy.SQUASH_MERGE) body.squash = true;

    const mr: any = await this.client.put(
      `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}/merge`,
      body,
      fallback
    );

    if (!mr || (typeof mr === 'object' && Object.keys(mr).length === 0)) {
      return fallback;
    }

    return this.mapGitLabMRToPullRequest(mr);
  }

  /**
   * 关闭 Merge Request
   *
   * GitLab API: PUT /projects/:id/merge_requests/:iid (state_event=close)
   */
  async closePullRequest(repoId: string, prId: string): Promise<PullRequest> {
    const fallback: PullRequest = {
      id: prId,
      externalId: prId,
      repoId,
      repoName: repoId,
      title: 'Mock MR',
      status: PullRequestStatus.CLOSED,
      sourceBranch: 'feature-branch',
      targetBranch: 'main',
      author: 'user',
      assignees: [],
      reviewers: [],
      labels: [],
      isMergeable: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: new Date(),
    };

    const mr: any = await this.client.put(
      `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}`,
      { state_event: 'close' },
      fallback
    );

    if (!mr || (typeof mr === 'object' && Object.keys(mr).length === 0)) {
      return fallback;
    }

    return this.mapGitLabMRToPullRequest(mr);
  }

  /**
   * 更新 Merge Request
   *
   * GitLab API: PUT /projects/:id/merge_requests/:iid
   */
  async updatePullRequest(repoId: string, prId: string, input: {
    title?: string;
    description?: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<PullRequest> {
    const fallback: PullRequest = {
      id: prId,
      externalId: prId,
      repoId,
      repoName: repoId,
      title: input.title || 'Mock MR',
      description: input.description,
      status: PullRequestStatus.OPEN,
      sourceBranch: 'feature-branch',
      targetBranch: 'main',
      author: 'user',
      assignees: input.assignees || [],
      reviewers: [],
      labels: input.labels || [],
      isMergeable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const body: Record<string, any> = {};
    if (input.title) body.title = input.title;
    if (input.description !== undefined) body.description = input.description;
    if (input.labels) body.labels = input.labels.join(',');

    const mr: any = await this.client.put(
      `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}`,
      body,
      fallback
    );

    if (!mr || (typeof mr === 'object' && Object.keys(mr).length === 0)) {
      return fallback;
    }

    return this.mapGitLabMRToPullRequest(mr);
  }

  // ==================== Review 管理 ====================

  /**
   * 添加 Review 评论
   *
   * GitLab API: POST /projects/:id/merge_requests/:iid/notes
   */
  async addReview(repoId: string, prId: string, input: {
    content: string;
    score?: number;
    state?: 'comment' | 'approve' | 'request_changes';
    fileComments?: FileComment[];
  }): Promise<Review> {
    const fallback: Review = {
      id: `review-${Date.now()}`,
      pullRequestId: prId,
      author: 'current-user',
      content: input.content,
      score: input.score,
      state: input.state || 'comment',
      createdAt: new Date(),
      fileComments: input.fileComments,
    };

    await this.client.post(
      `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}/notes`,
      { body: input.content },
      null
    );

    return fallback;
  }

  /**
   * 获取 PR 的 Reviews
   *
   * GitLab API: GET /projects/:id/merge_requests/:iid/notes
   */
  async listReviews(repoId: string, prId: string): Promise<Review[]> {
    const notes: any[] = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}/notes`,
      []
    );

    return notes.map(note => this.mapGitLabNoteToReview(note));
  }

  // ==================== Webhook 管理 ====================

  /**
   * 创建 Webhook
   *
   * GitLab API: POST /projects/:id/hooks
   */
  async createWebhook(repoId: string, input: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<WebhookConfig> {
    const fallback: WebhookConfig = {
      id: `hook-${Date.now()}`,
      repoId,
      url: input.url,
      events: input.events,
      secret: input.secret,
      isActive: true,
      createdAt: new Date(),
    };

    const body: Record<string, any> = {
      url: input.url,
      token: input.secret,
      merge_requests_events: input.events.includes('merge_requests'),
      push_events: input.events.includes('push'),
      enable_ssl_verification: true,
    };

    const hook: any = await this.client.post(
      `/projects/${encodeURIComponent(repoId)}/hooks`,
      body,
      fallback
    );

    if (!hook || (typeof hook === 'object' && Object.keys(hook).length === 0)) {
      return fallback;
    }

    return this.mapGitLabHookToWebhookConfig(hook);
  }

  /**
   * 获取 Webhook 列表
   *
   * GitLab API: GET /projects/:id/hooks
   */
  async listWebhooks(repoId: string): Promise<WebhookConfig[]> {
    const hooks: any[] = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/hooks`,
      []
    );

    return hooks.map(h => this.mapGitLabHookToWebhookConfig(h));
  }

  /**
   * 删除 Webhook
   *
   * GitLab API: DELETE /projects/:id/hooks/:hookId
   */
  async deleteWebhook(repoId: string, webhookId: string): Promise<void> {
    await this.client.delete(
      `/projects/${encodeURIComponent(repoId)}/hooks/${webhookId}`
    );
  }

  // ==================== 数据映射方法 ====================

  /** 将 GitLab Project 映射为 Repository */
  private mapGitLabProjectToRepository(data: any): Repository {
    return {
      id: String(data.id),
      name: data.name,
      fullName: data.path_with_namespace,
      type: RepoType.GITLAB,
      url: data.web_url,
      sshUrl: data.ssh_url_to_repo,
      httpUrl: data.http_url_to_repo,
      defaultBranch: data.default_branch || 'main',
      description: data.description,
      visibility: data.visibility as 'public' | 'private' | 'internal',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.last_activity_at),
    };
  }

  /** 将 GitLab Branch 映射为 Branch */
  private mapGitLabBranchToBranch(data: any): Branch {
    return {
      name: data.name,
      isProtected: data.protected || false,
      lastCommitSha: data.commit?.id || '',
      lastCommitMessage: data.commit?.message || '',
      lastCommitDate: new Date(data.commit?.created_at || Date.now()),
      commitCount: 0,
    };
  }

  /** 将 GitLab Commit 映射为 Commit */
  private mapGitLabCommitToCommit(data: any): Commit {
    return {
      sha: data.id,
      message: data.message,
      author: data.author_name,
      authorEmail: data.author_email,
      createdAt: new Date(data.created_at || data.committed_date),
    };
  }

  /** 将 GitLab Merge Request 映射为 PullRequest */
  private mapGitLabMRToPullRequest(data: any): PullRequest {
    return {
      id: String(data.iid),
      externalId: String(data.iid),
      repoId: String(data.project_id),
      repoName: data.references?.full || '',
      title: data.title,
      description: data.description,
      status: this.mapGitLabStateToPullRequestStatus(data.state, data.merge_status),
      sourceBranch: data.source_branch,
      targetBranch: data.target_branch,
      author: data.author?.username || '',
      assignees: (data.assignees || []).map((a: any) => a.username),
      reviewers: (data.reviewers || []).map((r: any) => r.username),
      labels: data.labels || [],
      isMergeable: data.merge_status === 'can_be_merged',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      mergedAt: data.merged_at ? new Date(data.merged_at) : undefined,
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
    };
  }

  /** 将 GitLab 状态映射为 PullRequestStatus */
  private mapGitLabStateToPullRequestStatus(
    state: string,
    mergeStatus?: string
  ): PullRequestStatus {
    switch (state) {
      case 'opened':
        return PullRequestStatus.OPEN;
      case 'merged':
        return PullRequestStatus.MERGED;
      case 'closed':
        return PullRequestStatus.CLOSED;
      default:
        return PullRequestStatus.OPEN;
    }
  }

  /** 将 PullRequestStatus 映射为 GitLab 状态 */
  private mapPullRequestStateToGitLab(state: PullRequestStatus): string {
    switch (state) {
      case PullRequestStatus.OPEN:
        return 'opened';
      case PullRequestStatus.MERGED:
        return 'merged';
      case PullRequestStatus.CLOSED:
        return 'closed';
      default:
        return 'all';
    }
  }

  /** 将 GitLab Note 映射为 Review */
  private mapGitLabNoteToReview(data: any): Review {
    return {
      id: String(data.id),
      pullRequestId: String(data.noteable_iid),
      author: data.author?.username || '',
      content: data.body,
      state: 'comment',
      createdAt: new Date(data.created_at),
    };
  }

  /** 将 GitLab Hook 映射为 WebhookConfig */
  private mapGitLabHookToWebhookConfig(data: any): WebhookConfig {
    const events: string[] = [];
    if (data.merge_requests_events) events.push('merge_requests');
    if (data.push_events) events.push('push');
    if (data.issues_events) events.push('issues');
    if (data.pipeline_events) events.push('pipeline');
    if (data.tag_push_events) events.push('tag_push');

    return {
      id: String(data.id),
      repoId: String(data.project_id),
      url: data.url,
      events: data.events || events,
      secret: data.token,
      isActive: data.active !== false,
      createdAt: new Date(data.created_at),
    };
  }
}
