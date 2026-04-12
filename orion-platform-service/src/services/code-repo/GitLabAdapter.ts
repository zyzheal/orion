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
}

/**
 * GitLab API 客户端 (Mock 实现)
 *
 * 生产环境中应使用 @gitbeaker/rest 或自定义 HTTP 客户端调用 GitLab REST API
 */
class GitLabApiClient {
  private baseUrl: string;
  private token: string;
  private apiVersion: string;

  constructor(config: GitLabAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, ''); // 去除尾部斜杠
    this.token = config.token;
    this.apiVersion = config.apiVersion || 'v4';
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
  async get<T>(path: string): Promise<T> {
    // Mock 实现 - 生产环境使用真实 HTTP 请求
    // const response = await fetch(this.apiUrl(path), {
    //   method: 'GET',
    //   headers: this.getHeaders(),
    // });
    // return response.json();
    return {} as T;
  }

  /** POST 请求 */
  async post<T>(path: string, body?: Record<string, any>): Promise<T> {
    return {} as T;
  }

  /** PUT 请求 */
  async put<T>(path: string, body?: Record<string, any>): Promise<T> {
    return {} as T;
  }

  /** DELETE 请求 */
  async delete(path: string): Promise<void> {
    // Mock 实现
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
    // 生产实现:
    // const data = await this.client.get(`/projects/${encodeURIComponent(projectId)}`);
    // return this.mapGitLabProjectToRepository(data);

    // Mock 实现
    return {
      id: projectId,
      name: projectId.split('/').pop() || 'unknown',
      fullName: projectId,
      type: RepoType.GITLAB,
      url: `${this.baseUrl}/${projectId}`,
      sshUrl: `git@${new URL(this.baseUrl).hostname}:${projectId}.git`,
      httpUrl: `${this.baseUrl}/${projectId}.git`,
      defaultBranch: 'main',
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * 获取仓库列表
   *
   * GitLab API: GET /projects
   */
  async listRepositories(options?: {
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<Repository[]> {
    // 生产实现:
    // const params = new URLSearchParams();
    // if (options?.search) params.set('search', options.search);
    // if (options?.page) params.set('page', String(options.page));
    // if (options?.perPage) params.set('per_page', String(options.perPage));
    // const projects = await this.client.get(`/projects?${params}`);
    // return projects.map((p: any) => this.mapGitLabProjectToRepository(p));

    return [];
  }

  // ==================== 分支管理 ====================

  /**
   * 获取分支列表
   *
   * GitLab API: GET /projects/:id/repository/branches
   */
  async listBranches(repoId: string, options?: {
    page?: number;
    perPage?: number;
  }): Promise<Branch[]> {
    // 生产实现:
    // const branches = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/repository/branches`
    // );
    // return branches.map((b: any) => this.mapGitLabBranchToBranch(b));

    return [];
  }

  /**
   * 获取分支详情
   *
   * GitLab API: GET /projects/:id/repository/branches/:branch
   */
  async getBranch(repoId: string, branchName: string): Promise<Branch> {
    // 生产实现:
    // const branch = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/repository/branches/${encodeURIComponent(branchName)}`
    // );
    // return this.mapGitLabBranchToBranch(branch);

    return {
      name: branchName,
      isProtected: false,
      lastCommitSha: '',
      lastCommitMessage: '',
      lastCommitDate: new Date(),
      commitCount: 0,
    };
  }

  /**
   * 创建分支
   *
   * GitLab API: POST /projects/:id/repository/branches
   */
  async createBranch(repoId: string, branchName: string, sourceRef: string): Promise<Branch> {
    // 生产实现:
    // const branch = await this.client.post(
    //   `/projects/${encodeURIComponent(repoId)}/repository/branches`,
    //   { branch: branchName, ref: sourceRef }
    // );
    // return this.mapGitLabBranchToBranch(branch);

    return {
      name: branchName,
      isProtected: false,
      lastCommitSha: '',
      lastCommitMessage: '',
      lastCommitDate: new Date(),
      commitCount: 0,
    };
  }

  /**
   * 删除分支
   *
   * GitLab API: DELETE /projects/:id/repository/branches/:branch
   */
  async deleteBranch(repoId: string, branchName: string): Promise<void> {
    // 生产实现:
    // await this.client.delete(
    //   `/projects/${encodeURIComponent(repoId)}/repository/branches/${encodeURIComponent(branchName)}`
    // );
  }

  /**
   * 获取分支保护状态
   *
   * GitLab API: GET /projects/:id/protected_branches/:branch
   */
  async getBranchProtection(repoId: string, branchName: string): Promise<{
    isProtected: boolean;
    rules?: Record<string, any>;
  }> {
    // 生产实现:
    // try {
    //   const protectedBranch = await this.client.get(
    //     `/projects/${encodeURIComponent(repoId)}/protected_branches/${encodeURIComponent(branchName)}`
    //   );
    //   return {
    //     isProtected: true,
    //     rules: protectedBranch,
    //   };
    // } catch {
    //   return { isProtected: false };
    // }

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
    perPage?: number;
  }): Promise<Commit[]> {
    // 生产实现:
    // const params = new URLSearchParams();
    // if (options?.branch) params.set('ref_name', options.branch);
    // if (options?.page) params.set('page', String(options.page));
    // if (options?.perPage) params.set('per_page', String(options.perPage));
    // const commits = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/repository/commits?${params}`
    // );
    // return commits.map((c: any) => this.mapGitLabCommitToCommit(c));

    return [];
  }

  /**
   * 获取提交详情
   *
   * GitLab API: GET /projects/:id/repository/commits/:sha
   */
  async getCommit(repoId: string, sha: string): Promise<Commit> {
    // 生产实现:
    // const commit = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/repository/commits/${sha}`
    // );
    // return this.mapGitLabCommitToCommit(commit);

    return {
      sha,
      message: '',
      author: '',
      authorEmail: '',
      createdAt: new Date(),
    };
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
    // 生产实现:
    // const mr = await this.client.post(
    //   `/projects/${encodeURIComponent(repoId)}/merge_requests`,
    //   {
    //     title: input.title,
    //     description: input.description,
    //     source_branch: input.sourceBranch,
    //     target_branch: input.targetBranch,
    //     reviewer_ids: input.reviewers,
    //     labels: input.labels?.join(','),
    //   }
    // );
    // return this.mapGitLabMRToPullRequest(mr);

    return {
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
  }

  /**
   * 获取 Merge Request 详情
   *
   * GitLab API: GET /projects/:id/merge_requests/:iid
   */
  async getPullRequest(repoId: string, prId: string): Promise<PullRequest> {
    // 生产实现:
    // const mr = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}`
    // );
    // return this.mapGitLabMRToPullRequest(mr);

    return {
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
  }

  /**
   * 获取 Merge Request 列表
   *
   * GitLab API: GET /projects/:id/merge_requests
   */
  async listPullRequests(repoId: string, options?: {
    state?: PullRequestStatus;
    author?: string;
    page?: number;
    perPage?: number;
  }): Promise<PullRequest[]> {
    // 生产实现:
    // const params = new URLSearchParams();
    // if (options?.state) params.set('state', this.mapPullRequestStateToGitLab(options.state));
    // if (options?.author) params.set('author_username', options.author);
    // if (options?.page) params.set('page', String(options.page));
    // if (options?.perPage) params.set('per_page', String(options.perPage));
    // const mrs = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/merge_requests?${params}`
    // );
    // return mrs.map((mr: any) => this.mapGitLabMRToPullRequest(mr));

    return [];
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
    // 生产实现:
    // const body: Record<string, any> = {};
    // if (options?.commitMessage) body.merge_commit_message = options.commitMessage;
    // if (options?.strategy === MergeStrategy.SQUASH_MERGE) body.squash = true;
    // const mr = await this.client.put(
    //   `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}/merge`,
    //   body
    // );
    // return this.mapGitLabMRToPullRequest(mr);

    return {
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
  }

  /**
   * 关闭 Merge Request
   *
   * GitLab API: PUT /projects/:id/merge_requests/:iid (state_event=close)
   */
  async closePullRequest(repoId: string, prId: string): Promise<PullRequest> {
    // 生产实现:
    // const mr = await this.client.put(
    //   `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}`,
    //   { state_event: 'close' }
    // );
    // return this.mapGitLabMRToPullRequest(mr);

    return {
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
    // 生产实现:
    // const body: Record<string, any> = {};
    // if (input.title) body.title = input.title;
    // if (input.description !== undefined) body.description = input.description;
    // if (input.labels) body.labels = input.labels.join(',');
    // if (input.assignees) body.assignee_ids = input.assignees;
    // const mr = await this.client.put(
    //   `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}`,
    //   body
    // );
    // return this.mapGitLabMRToPullRequest(mr);

    return {
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
    // 生产实现:
    // GitLab 使用 Approvals API + Notes API 组合实现
    // const note = await this.client.post(
    //   `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}/notes`,
    //   { body: input.content }
    // );

    return {
      id: `review-${Date.now()}`,
      pullRequestId: prId,
      author: 'current-user',
      content: input.content,
      score: input.score,
      state: input.state || 'comment',
      createdAt: new Date(),
      fileComments: input.fileComments,
    };
  }

  /**
   * 获取 PR 的 Reviews
   *
   * GitLab API: GET /projects/:id/merge_requests/:iid/notes
   */
  async listReviews(repoId: string, prId: string): Promise<Review[]> {
    // 生产实现:
    // const notes = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/merge_requests/${prId}/notes`
    // );
    // return notes.map((note: any) => this.mapGitLabNoteToReview(note));

    return [];
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
    // 生产实现:
    // const body: Record<string, any> = {
    //   url: input.url,
    //   token: input.secret,
    //   merge_requests_events: input.events.includes('merge_requests'),
    //   push_events: input.events.includes('push'),
    //   enable_ssl_verification: true,
    // };
    // const hook = await this.client.post(
    //   `/projects/${encodeURIComponent(repoId)}/hooks`,
    //   body
    // );

    return {
      id: `hook-${Date.now()}`,
      repoId,
      url: input.url,
      events: input.events,
      secret: input.secret,
      isActive: true,
      createdAt: new Date(),
    };
  }

  /**
   * 获取 Webhook 列表
   *
   * GitLab API: GET /projects/:id/hooks
   */
  async listWebhooks(repoId: string): Promise<WebhookConfig[]> {
    // 生产实现:
    // const hooks = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/hooks`
    // );
    // return hooks.map((h: any) => this.mapGitLabHookToWebhookConfig(h));

    return [];
  }

  /**
   * 删除 Webhook
   *
   * GitLab API: DELETE /projects/:id/hooks/:hookId
   */
  async deleteWebhook(repoId: string, webhookId: string): Promise<void> {
    // 生产实现:
    // await this.client.delete(
    //   `/projects/${encodeURIComponent(repoId)}/hooks/${webhookId}`
    // );
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
      visibility: data.visibility,
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
}
