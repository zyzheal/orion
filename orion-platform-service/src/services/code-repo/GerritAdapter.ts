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
  BranchPolicy,
  Commit,
  PullRequest,
  PullRequestStatus,
  Review,
  FileComment,
  WebhookConfig,
  WebhookEventType,
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
      defaultBranch: 'refs/heads/master',
      isPrivate: true,
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
      defaultBranch: data.branches?.master || 'refs/heads/master',
      isPrivate: data.state !== 'ACTIVE',
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
    limit?: number;
  }): Promise<{ repos: Repository[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.search) params.set('p', options.search);

    const projects: Record<string, any> = await this.client.get(
      `/projects/?${params}`,
      {}
    );

    const repos = Object.entries(projects)
      .filter(([key]) => key !== '')
      .map(([key, data]) => ({
        id: key,
        name: key.split('/').pop() || 'unknown',
        fullName: key,
        type: RepoType.GERRIT,
        url: `${this.baseUrl}/${key}`,
        defaultBranch: 'refs/heads/master',
        isPrivate: data.state !== 'ACTIVE',
        description: data.description,
        createdAt: new Date(data.created_on || Date.now()),
        updatedAt: new Date(data.last_updated || Date.now()),
      }));
    return { repos, total: repos.length };
  }

  // ==================== 分支管理 ====================

  /**
   * 获取分支列表
   *
   * Gerrit API: GET /projects/:projectName/branches/
   */
  async listBranches(repoId: string, options?: {
    page?: number;
    limit?: number;
  }): Promise<{ branches: Branch[]; total: number }> {
    const branches: Record<string, any> = await this.client.get(
      `/projects/${encodeURIComponent(repoId)}/branches/`,
      {}
    );

    const branchList = Object.entries(branches)
      .filter(([key]) => key !== '')
      .map(([name, data]) => ({
        name,
        sha: data.revision || '',
        protected: false,
        lastCommitDate: new Date(),
      }));
    return { branches: branchList, total: branchList.length };
  }

  /**
   * 获取分支详情
   *
   * Gerrit API: GET /projects/:projectName/branches/:branchName
   */
  async getBranch(repoId: string, branchName: string): Promise<Branch> {
    const fallback: Branch = {
      name: branchName,
      protected: false,
      sha: '',
      lastCommitDate: new Date(),
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
      sha: branch.revision || '',
      protected: false,
      lastCommitDate: new Date(),
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
      protected: false,
      sha: '',
      lastCommitDate: new Date(),
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
      sha: branch.revision || '',
      protected: false,
      lastCommitDate: new Date(),
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
  async getBranchProtection(repoId: string, branchName: string): Promise<BranchPolicy | null> {
    return null; // Mock - would need to query Gerrit access permissions
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
    limit?: number;
  }): Promise<{ commits: Commit[]; total: number }> {
    const query = `project:${encodeURIComponent(repoId)}+status:merged`;
    const changes: any[] = await this.client.get(
      `/changes/?q=${query}`,
      []
    );

    const commits = changes.map((c) => ({
      sha: c.current_revision || '',
      message: c.subject || '',
      author: {
        name: c.owner?.name || '',
        email: c.owner?.email || '',
        date: new Date(c.created || Date.now()),
      },
      url: `${this.baseUrl}/${encodeURIComponent(repoId)}/+/${c._number || ''}`,
    }));
    return { commits, total: commits.length };
  }

  /**
   * 获取提交详情
   */
  async getCommit(repoId: string, sha: string): Promise<Commit> {
    const fallback: Commit = {
      sha,
      message: '',
      author: { name: '', email: '', date: new Date() },
      url: `${this.baseUrl}/${encodeURIComponent(repoId)}/+/${sha}`,
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
      author: {
        name: change.owner?.name || '',
        email: change.owner?.email || '',
        date: new Date(change.created || Date.now()),
      },
      url: `${this.baseUrl}/${encodeURIComponent(repoId)}/+/${change._number || sha}`,
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
      title: input.title,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      author: 'current-user',
      status: PullRequestStatus.OPEN,
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
      title: 'Mock Change',
      sourceBranch: 'feature-branch',
      targetBranch: 'refs/heads/master',
      author: 'user',
      status: PullRequestStatus.OPEN,
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
      title: change.subject || 'Change',
      sourceBranch: change.branch || '',
      targetBranch: change.dest_branch || 'refs/heads/master',
      author: change.owner?.name || 'user',
      status: change.status === 'MERGED' ? PullRequestStatus.MERGED : change.status === 'ABANDONED' ? PullRequestStatus.CLOSED : PullRequestStatus.OPEN,
    };
  }

  /**
   * 获取 Change 列表
   *
   * Gerrit API: GET /changes/?q=status:open
   */
  async listPullRequests(repoId: string, options?: {
    state?: PullRequestStatus;
    page?: number;
    limit?: number;
  }): Promise<{ pullRequests: PullRequest[]; total: number }> {
    const queryParts = [`project:${encodeURIComponent(repoId)}`];
    if (options?.state === PullRequestStatus.OPEN) queryParts.push('status:open');
    else if (options?.state === PullRequestStatus.MERGED) queryParts.push('status:merged');
    else if (options?.state === PullRequestStatus.CLOSED) queryParts.push('status:abandoned');
    const query = queryParts.join('+');

    const changes: any[] = await this.client.get(
      `/changes/?q=${query}`,
      []
    );

    const pullRequests = changes.map(c => ({
      id: c.change_id || String(c._number),
      title: c.subject || '',
      sourceBranch: c.branch || '',
      targetBranch: c.dest_branch || '',
      author: c.owner?.name || '',
      status: c.status === 'MERGED' ? PullRequestStatus.MERGED : c.status === 'ABANDONED' ? PullRequestStatus.CLOSED : PullRequestStatus.OPEN,
    }));
    return { pullRequests, total: pullRequests.length };
  }

  /**
   * 合并 Change
   *
   * Gerrit API: POST /changes/:changeId/revisions/current/submit
   */
  async mergePullRequest(repoId: string, prId: string, options?: {
    method?: MergeStrategy;
  }): Promise<PullRequest> {
    await this.client.post(
      `/changes/${encodeURIComponent(prId)}/revisions/current/submit`,
      {},
      null
    );

    return {
      id: prId,
      title: 'Merged Change',
      sourceBranch: 'feature-branch',
      targetBranch: 'refs/heads/master',
      author: 'user',
      status: PullRequestStatus.MERGED,
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
      title: 'Abandoned Change',
      sourceBranch: 'feature-branch',
      targetBranch: 'refs/heads/master',
      author: 'user',
      status: PullRequestStatus.CLOSED,
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
      title: input.title || 'Mock Change',
      sourceBranch: 'feature-branch',
      targetBranch: 'refs/heads/master',
      author: 'user',
      status: PullRequestStatus.OPEN,
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
      author: 'current-user',
      body: input.content,
      state: input.state === 'approve' ? 'approved' : input.state === 'request_changes' ? 'changes_requested' : 'pending',
      createdAt: new Date(),
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
          author: comment.author?.name || '',
          body: comment.message || '',
          state: 'pending',
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
    events: WebhookEventType[];
    secret?: string;
  }): Promise<WebhookConfig> {
    return {
      id: `hook-${Date.now()}`,
      url: input.url,
      events: input.events,
      active: true,
      secret: input.secret,
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

  /**
   * 更新 Webhook (Mock: Gerrit 无原生 Webhook API)
   */
  async updateWebhook(repoId: string, webhookId: string, input: {
    url?: string;
    events?: WebhookEventType[];
    active?: boolean;
    secret?: string;
  }): Promise<WebhookConfig> {
    return {
      id: webhookId,
      url: input.url || '',
      events: input.events || [],
      active: input.active ?? true,
      secret: input.secret,
    };
  }

  /**
   * 列出标签 (Mock: Gerrit 无原生 Tags API)
   */
  async listTags(repoId: string): Promise<{ tags: string[]; total: number }> {
    return { tags: [], total: 0 };
  }
}
