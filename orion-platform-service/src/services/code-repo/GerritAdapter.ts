/**
 * Gerrit Adapter - Gerrit 代码仓库适配器
 *
 * 实现 ICodeRepoAdapter 接口，对接 Gerrit REST API。
 * Gerrit 使用 Change 概念代替 Merge Request。
 *
 * Gerrit REST API 文档: https://gerrit-review.googlesource.com/Documentation/rest-api.html
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

/** Gerrit 适配器配置 */
export interface GerritAdapterConfig {
  /** Gerrit 实例 URL */
  baseUrl: string;
  /** 用户名 */
  username: string;
  /** HTTP 密码或 API Token */
  password: string;
  /** 请求超时 (ms) */
  timeout?: number;
}

/**
 * Gerrit REST API 客户端 (Mock 实现)
 *
 * 生产环境中应使用 HTTP 客户端调用 Gerrit REST API
 * 注意: Gerrit REST API 响应以 ")]}'" 魔法前缀开头，需要去除
 */
class GerritApiClient {
  private baseUrl: string;
  private auth: string;

  constructor(config: GerritAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.auth = Buffer
      ? Buffer.from(`${config.username}:${config.password}`).toString('base64')
      : btoa(`${config.username}:${config.password}`);
  }

  /** 构建 API URL */
  private apiUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /** 获取请求头 */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Basic ${this.auth}`,
      'Content-Type': 'application/json',
    };
  }

  /** 解析 Gerrit 响应 (去除 ")]}'" 前缀) */
  private parseResponse(text: string): any {
    // Gerrit 响应以 ")]}'" 开头，需要去除
    const cleanText = text.startsWith(")]}'") ? text.slice(4) : text;
    return JSON.parse(cleanText);
  }

  /** GET 请求 */
  async get<T>(path: string): Promise<T> {
    // Mock 实现 - 生产环境:
    // const response = await fetch(this.apiUrl(path), {
    //   method: 'GET',
    //   headers: this.getHeaders(),
    // });
    // const text = await response.text();
    // return this.parseResponse(text);
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
 * Gerrit 适配器实现
 *
 * 将 Gerrit REST API 统一映射到 ICodeRepoAdapter 接口。
 * Gerrit 概念映射:
 *   - Change -> PullRequest
 *   - Patch Set -> Commit
 *   - Review -> Review
 *   - Branch -> Branch
 */
export class GerritAdapter implements ICodeRepoAdapter {
  readonly type = RepoType.GERRIT;

  private client: GerritApiClient;
  private baseUrl: string;

  constructor(config: GerritAdapterConfig) {
    this.client = new GerritApiClient(config);
    this.baseUrl = config.baseUrl;
  }

  // ==================== 仓库管理 ====================

  /**
   * 获取仓库信息
   *
   * Gerrit API: GET /projects/:projectName
   */
  async getRepository(projectName: string): Promise<Repository> {
    // 生产实现:
    // const data = await this.client.get(`/projects/${encodeURIComponent(projectName)}`);

    return {
      id: projectName,
      name: projectName.split('/').pop() || 'unknown',
      fullName: projectName,
      type: RepoType.GERRIT,
      url: `${this.baseUrl}/${projectName}`,
      sshUrl: `ssh://${new URL(this.baseUrl).hostname}:29418/${projectName}.git`,
      httpUrl: `${this.baseUrl}/${projectName}.git`,
      defaultBranch: 'refs/heads/master',
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * 获取仓库列表
   *
   * Gerrit API: GET /projects/
   */
  async listRepositories(options?: {
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<Repository[]> {
    // 生产实现:
    // const params = new URLSearchParams();
    // if (options?.search) params.set('p', options.search);
    // const projects = await this.client.get(`/projects/?${params}`);

    return [];
  }

  // ==================== 分支管理 ====================

  /**
   * 获取分支列表
   *
   * Gerrit API: GET /projects/:projectName/branches/
   */
  async listBranches(repoId: string, options?: {
    page?: number;
    perPage?: number;
  }): Promise<Branch[]> {
    // 生产实现:
    // const branches = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/branches/`
    // );

    return [];
  }

  /**
   * 获取分支详情
   *
   * Gerrit API: GET /projects/:projectName/branches/:branchName
   */
  async getBranch(repoId: string, branchName: string): Promise<Branch> {
    // 生产实现:
    // const branch = await this.client.get(
    //   `/projects/${encodeURIComponent(repoId)}/branches/${encodeURIComponent(branchName)}`
    // );

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
   * Gerrit API: PUT /projects/:projectName/branches/:branchName
   */
  async createBranch(repoId: string, branchName: string, sourceRef: string): Promise<Branch> {
    // 生产实现:
    // const branch = await this.client.put(
    //   `/projects/${encodeURIComponent(repoId)}/branches/${encodeURIComponent(branchName)}`,
    //   { revision: sourceRef }
    // );

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
   * Gerrit API: DELETE /projects/:projectName/branches/:branchName
   */
  async deleteBranch(repoId: string, branchName: string): Promise<void> {
    // 生产实现:
    // await this.client.delete(
    //   `/projects/${encodeURIComponent(repoId)}/branches/${encodeURIComponent(branchName)}`
    // );
  }

  /**
   * 获取分支保护状态
   *
   * Gerrit 通过 Access 配置文件控制分支权限
   */
  async getBranchProtection(repoId: string, branchName: string): Promise<{
    isProtected: boolean;
    rules?: Record<string, any>;
  }> {
    // Gerrit 分支保护通过 access controls 配置
    // 生产实现需要获取 access 配置文件
    return { isProtected: false };
  }

  // ==================== 提交管理 ====================

  /**
   * 获取提交列表
   *
   * Gerrit API: GET /projects/:projectName/changes/ (查询 Changes/PatchSets)
   */
  async listCommits(repoId: string, options?: {
    branch?: string;
    page?: number;
    perPage?: number;
  }): Promise<Commit[]> {
    // 生产实现使用 Gerrit 的查询 API
    return [];
  }

  /**
   * 获取提交详情
   */
  async getCommit(repoId: string, sha: string): Promise<Commit> {
    return {
      sha,
      message: '',
      author: '',
      authorEmail: '',
      createdAt: new Date(),
    };
  }

  // ==================== Change (Pull Request) 管理 ====================

  /**
   * 创建 Change (等同于创建 PR)
   *
   * Gerrit 通过 git push to refs/for/<branch> 创建 Change
   * 也可以使用 Gerrit API 提交变更
   */
  async createPullRequest(repoId: string, input: {
    title: string;
    description?: string;
    sourceBranch: string;
    targetBranch: string;
    reviewers?: string[];
    labels?: string[];
  }): Promise<PullRequest> {
    // Gerrit 使用 git push 创建 Change:
    // git push origin HEAD:refs/for/<targetBranch>
    // 也可以使用 Gerrit Changes API

    return {
      id: `change-${Date.now()}`,
      externalId: `I${Date.now().toString(16)}`,  // Gerrit Change-Id 格式
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
   * 获取 Change 详情
   *
   * Gerrit API: GET /changes/:changeId
   */
  async getPullRequest(repoId: string, prId: string): Promise<PullRequest> {
    // 生产实现:
    // const change = await this.client.get(`/changes/${encodeURIComponent(prId)}?DETAIL_LABELS`);

    return {
      id: prId,
      externalId: prId,
      repoId,
      repoName: repoId,
      title: 'Mock Change',
      status: PullRequestStatus.OPEN,
      sourceBranch: 'feature-branch',
      targetBranch: 'refs/heads/master',
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
   * 获取 Change 列表
   *
   * Gerrit API: GET /changes/?q=status:open
   */
  async listPullRequests(repoId: string, options?: {
    state?: PullRequestStatus;
    author?: string;
    page?: number;
    perPage?: number;
  }): Promise<PullRequest[]> {
    // 生产实现:
    // const queryParts = [`project:${repoId}`];
    // if (options?.state === PullRequestStatus.OPEN) queryParts.push('status:open');
    // else if (options?.state === PullRequestStatus.MERGED) queryParts.push('status:merged');
    // else if (options?.state === PullRequestStatus.CLOSED) queryParts.push('status:abandoned');
    // if (options?.author) queryParts.push(`owner:${options.author}`);
    // const query = queryParts.join('+');
    // const changes = await this.client.get(`/changes/?q=${query}`);

    return [];
  }

  /**
   * 合并 Change
   *
   * Gerrit API: POST /changes/:changeId/revisions/current/submit
   */
  async mergePullRequest(repoId: string, prId: string, options?: {
    strategy?: MergeStrategy;
    commitMessage?: string;
  }): Promise<PullRequest> {
    // 生产实现:
    // await this.client.post(
    //   `/changes/${encodeURIComponent(prId)}/revisions/current/submit`
    // );

    return {
      id: prId,
      externalId: prId,
      repoId,
      repoName: repoId,
      title: 'Mock Change',
      status: PullRequestStatus.MERGED,
      sourceBranch: 'feature-branch',
      targetBranch: 'refs/heads/master',
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
   * 关闭 Change (Abandon)
   *
   * Gerrit API: POST /changes/:changeId/abandon
   */
  async closePullRequest(repoId: string, prId: string): Promise<PullRequest> {
    // 生产实现:
    // await this.client.post(
    //   `/changes/${encodeURIComponent(prId)}/abandon`
    // );

    return {
      id: prId,
      externalId: prId,
      repoId,
      repoName: repoId,
      title: 'Mock Change',
      status: PullRequestStatus.CLOSED,
      sourceBranch: 'feature-branch',
      targetBranch: 'refs/heads/master',
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
   * 更新 Change
   *
   * Gerrit 通过 git push 新的 patch set 更新 Change
   * API: PUT /changes/:changeId
   */
  async updatePullRequest(repoId: string, prId: string, input: {
    title?: string;
    description?: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<PullRequest> {
    // Gerrit 通过修改 topic 和 hashtags 来更新 Change
    return {
      id: prId,
      externalId: prId,
      repoId,
      repoName: repoId,
      title: input.title || 'Mock Change',
      description: input.description,
      status: PullRequestStatus.OPEN,
      sourceBranch: 'feature-branch',
      targetBranch: 'refs/heads/master',
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
   * 添加 Review
   *
   * Gerrit API: POST /changes/:changeId/revisions/current/review
   */
  async addReview(repoId: string, prId: string, input: {
    content: string;
    score?: number;
    state?: 'comment' | 'approve' | 'request_changes';
    fileComments?: FileComment[];
  }): Promise<Review> {
    // 生产实现:
    // Gerrit 使用 review API 设置 score 和 message
    // const body: Record<string, any> = {
    //   message: input.content,
    //   labels: {},
    // };
    // if (input.score !== undefined) {
    //   body.labels['Code-Review'] = input.score;  // -2 到 +2
    // }
    // await this.client.post(
    //   `/changes/${encodeURIComponent(prId)}/revisions/current/review`,
    //   body
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
   * 获取 Change 的 Reviews
   *
   * Gerrit API: GET /changes/:changeId/revisions/current/comments/
   */
  async listReviews(repoId: string, prId: string): Promise<Review[]> {
    // 生产实现:
    // const comments = await this.client.get(
    //   `/changes/${encodeURIComponent(prId)}/revisions/current/comments/`
    // );

    return [];
  }

  // ==================== Webhook 管理 ====================

  /**
   * 创建 Webhook
   *
   * Gerrit 通过 stream-events 或 webhooks 插件支持事件推送
   */
  async createWebhook(repoId: string, input: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<WebhookConfig> {
    // Gerrit 使用 webhooks 插件: PUT /config/server/~webhooks~remote/<name>
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
   */
  async listWebhooks(repoId: string): Promise<WebhookConfig[]> {
    return [];
  }

  /**
   * 删除 Webhook
   */
  async deleteWebhook(repoId: string, webhookId: string): Promise<void> {
    // Mock 实现
  }
}
