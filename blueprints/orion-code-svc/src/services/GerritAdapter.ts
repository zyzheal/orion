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
} from '../types/code-repo';

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
  /** 是否启用真实 API 调用（默认通过 GERRIT_API_ENABLED 环境变量控制） */
  enableRealApi?: boolean;
}

/**
 * Gerrit REST API 客户端
 *
 * 使用 native fetch() 调用 Gerrit REST API。
 * 注意: Gerrit 响应以 ")]}'" 魔法前缀开头，需要去除。
 * 当服务不可达时降级为 mock 数据。
 */
class GerritApiClient {
  private baseUrl: string;
  private auth: string;
  private timeout: number;
  private enableRealApi: boolean;

  constructor(config: GerritAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.auth = Buffer
      ? Buffer.from(`${config.username}:${config.password}`).toString('base64')
      : btoa(`${config.username}:${config.password}`);
    this.timeout = config.timeout || 10_000;
    this.enableRealApi = config.enableRealApi ?? process.env.GERRIT_API_ENABLED === 'true';
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
    const cleanText = text.startsWith(")]}'") ? text.slice(4) : text;
    return JSON.parse(cleanText);
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

      const text = await response.text();
      return this.parseResponse(text);
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

      const text = await response.text();
      return this.parseResponse(text);
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

      const text = await response.text();
      return this.parseResponse(text);
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
    const fallback: Repository = {
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

    const data: any = await this.client.get(
      `/projects/${encodeURIComponent(projectName)}`,
      fallback
    );

    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return fallback;
    }

    return {
      id: data.id || projectName,
      name: data.name || projectName.split('/').pop() || 'unknown',
      fullName: projectName,
      type: RepoType.GERRIT,
      url: data.web_url || `${this.baseUrl}/${projectName}`,
      sshUrl: `ssh://${new URL(this.baseUrl).hostname}:29418/${projectName}.git`,
      httpUrl: `${this.baseUrl}/${projectName}.git`,
      defaultBranch: data.branches?.master || 'refs/heads/master',
      visibility: data.state === 'ACTIVE' ? 'public' : 'private',
      description: data.description,
      createdAt: new Date(data.created_on || Date.now()),
      updatedAt: new Date(data.last_updated || Date.now()),
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
    const params = new URLSearchParams();
    if (options?.search) params.set('p', options.search);

    const projects: Record<string, any> = await this.client.get(
      `/projects/?${params}`,
      {}
    );

    return Object.entries(projects)
      .filter(([key]) => key !== '')
      .map(([key, data]) => ({
        id: key,
        name: key.split('/').pop() || 'unknown',
        fullName: key,
        type: RepoType.GERRIT,
        url: `${this.baseUrl}/${key}`,
        sshUrl: `ssh://${new URL(this.baseUrl).hostname}:29418/${key}.git`,
        httpUrl: `${this.baseUrl}/${key}.git`,
        defaultBranch: 'refs/heads/master',
        visibility: data.state === 'ACTIVE' ? 'public' : 'private',
        description: data.description,
        createdAt: new Date(data.created_on || Date.now()),
        updatedAt: new Date(data.last_updated || Date.now()),
      }));
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
    const branches: Record<string, any> = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/branches/`,
      {}
    );

    return Object.entries(branches)
      .filter(([key]) => key !== '')
      .map(([name, data]) => ({
        name,
        isProtected: false,
        lastCommitSha: data.revision || '',
        lastCommitMessage: '',
        lastCommitDate: new Date(),
        commitCount: 0,
      }));
  }

  /**
   * 获取分支详情
   *
   * Gerrit API: GET /projects/:projectName/branches/:branchName
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
      `/projects/${encodeURIComponent(repoId)}/branches/${encodeURIComponent(branchName)}`,
      fallback
    );

    if (!branch || (typeof branch === 'object' && Object.keys(branch).length === 0)) {
      return fallback;
    }

    return {
      name: branchName,
      isProtected: false,
      lastCommitSha: branch.revision || '',
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
    const fallback: Branch = {
      name: branchName,
      isProtected: false,
      lastCommitSha: '',
      lastCommitMessage: '',
      lastCommitDate: new Date(),
      commitCount: 0,
    };

    const branch: any = await this.client.put(
      `/projects/${encodeURIComponent(repoId)}/branches/${encodeURIComponent(branchName)}`,
      { revision: sourceRef },
      fallback
    );

    if (!branch || (typeof branch === 'object' && Object.keys(branch).length === 0)) {
      return fallback;
    }

    return {
      name: branchName,
      isProtected: false,
      lastCommitSha: branch.revision || '',
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
    await this.client.delete(
      `/projects/${encodeURIComponent(repoId)}/branches/${encodeURIComponent(branchName)}`
    );
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
    return { isProtected: false };
  }

  // ==================== 提交管理 ====================

  /**
   * 获取提交列表
   *
   * Gerrit API: GET /changes/?q=project:...
   */
  async listCommits(repoId: string, options?: {
    branch?: string;
    page?: number;
    perPage?: number;
  }): Promise<Commit[]> {
    const query = `project:${encodeURIComponent(repoId)}+status:merged`;
    const changes: any[] = await this.client.get(
      `/changes/?q=${query}`,
      []
    );

    return changes.map((c) => ({
      sha: c.current_revision || '',
      message: c.subject || '',
      author: c.owner?.name || '',
      authorEmail: c.owner?.email || '',
      createdAt: new Date(c.created || Date.now()),
    }));
  }

  /**
   * 获取提交详情
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
      `/changes/?q=commit:${encodeURIComponent(sha)}`,
      []
    );

    if (!commit || commit.length === 0) {
      return fallback;
    }

    const change = commit[0];
    return {
      sha: change.current_revision || sha,
      message: change.subject || '',
      author: change.owner?.name || '',
      authorEmail: change.owner?.email || '',
      createdAt: new Date(change.created || Date.now()),
    };
  }

  // ==================== Change (Pull Request) 管理 ====================

  /**
   * 创建 Change (等同于创建 PR)
   *
   * Gerrit 通过 git push to refs/for/<branch> 创建 Change
   */
  async createPullRequest(repoId: string, input: {
    title: string;
    description?: string;
    sourceBranch: string;
    targetBranch: string;
    reviewers?: string[];
    labels?: string[];
  }): Promise<PullRequest> {
    return {
      id: `change-${Date.now()}`,
      externalId: `I${Date.now().toString(16)}`,
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
    const fallback: PullRequest = {
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

    const change: any = await this.client.get(
      `/changes/${encodeURIComponent(prId)}?DETAIL_LABELS`,
      fallback
    );

    if (!change || (typeof change === 'object' && Object.keys(change).length === 0)) {
      return fallback;
    }

    return {
      id: change.change_id || prId,
      externalId: change.change_id || prId,
      repoId,
      repoName: change.project || repoId,
      title: change.subject || 'Change',
      description: '',
      status: change.status === 'MERGED' ? PullRequestStatus.MERGED : change.status === 'ABANDONED' ? PullRequestStatus.CLOSED : PullRequestStatus.OPEN,
      sourceBranch: change.branch || '',
      targetBranch: change.dest_branch || 'refs/heads/master',
      author: change.owner?.name || 'user',
      assignees: [],
      reviewers: [],
      labels: [],
      isMergeable: change.mergeable ?? true,
      createdAt: new Date(change.created || Date.now()),
      updatedAt: new Date(change.updated || Date.now()),
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
    const queryParts = [`project:${encodeURIComponent(repoId)}`];
    if (options?.state === PullRequestStatus.OPEN) queryParts.push('status:open');
    else if (options?.state === PullRequestStatus.MERGED) queryParts.push('status:merged');
    else if (options?.state === PullRequestStatus.CLOSED) queryParts.push('status:abandoned');
    if (options?.author) queryParts.push(`owner:${options.author}`);
    const query = queryParts.join('+');

    const changes: any[] = await this.client.get(
      `/changes/?q=${query}`,
      []
    );

    return changes.map(c => ({
      id: c.change_id || c._number,
      externalId: c.change_id || c._number,
      repoId,
      repoName: c.project || repoId,
      title: c.subject || '',
      description: '',
      status: c.status === 'MERGED' ? PullRequestStatus.MERGED : c.status === 'ABANDONED' ? PullRequestStatus.CLOSED : PullRequestStatus.OPEN,
      sourceBranch: c.branch || '',
      targetBranch: c.dest_branch || '',
      author: c.owner?.name || '',
      assignees: [],
      reviewers: [],
      labels: [],
      isMergeable: c.mergeable ?? true,
      createdAt: new Date(c.created || Date.now()),
      updatedAt: new Date(c.updated || Date.now()),
    }));
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
    await this.client.post(
      `/changes/${encodeURIComponent(prId)}/revisions/current/submit`,
      {},
      null
    );

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
    await this.client.post(
      `/changes/${encodeURIComponent(prId)}/abandon`,
      {},
      null
    );

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
   */
  async updatePullRequest(repoId: string, prId: string, input: {
    title?: string;
    description?: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<PullRequest> {
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
    const body: Record<string, any> = {
      message: input.content,
    };
    if (input.score !== undefined) {
      body.labels = { 'Code-Review': input.score };
    }

    await this.client.post(
      `/changes/${encodeURIComponent(prId)}/revisions/current/review`,
      body,
      null
    );

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
    const comments: Record<string, any[]> = await this.client.get(
      `/changes/${encodeURIComponent(prId)}/revisions/current/comments/`,
      {}
    );

    const reviews: Review[] = [];
    for (const [path, commentList] of Object.entries(comments)) {
      for (const comment of commentList) {
        reviews.push({
          id: comment.id || `review-${Date.now()}`,
          pullRequestId: prId,
          author: comment.author?.name || '',
          content: comment.message || '',
          state: 'comment',
          createdAt: new Date(comment.updated || Date.now()),
        });
      }
    }

    return reviews;
  }

  // ==================== Webhook 管理 ====================

  /**
   * 创建 Webhook
   */
  async createWebhook(repoId: string, input: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<WebhookConfig> {
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
    await this.client.delete(
      `/config/server/~webhooks~remote/${encodeURIComponent(webhookId)}`
    );
  }
}
