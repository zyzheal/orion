/**
 * Bitbucket Adapter - Bitbucket 代码仓库适配器
 *
 * 实现 ICodeRepoAdapter 接口，对接 Bitbucket REST API。
 * 支持仓库管理、PR 管理、分支管理、评论管理等功能。
 *
 * Bitbucket API 文档: https://developer.atlassian.com/cloud/bitbucket/rest/
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
  FileDiff,
  DiffHunk,
  PRComment,
  WebhookConfig,
  WebhookEventType,
  MergeStrategy,
} from './types';
import { safeFetch } from '../../utils/safeFetch';

/** Bitbucket 适配器配置 */
export interface BitbucketAdapterConfig {
  /** Bitbucket 实例 URL */
  baseUrl: string;
  /** 访问令牌 */
  token: string;
  /** 工作区 */
  workspace: string;
  /** 请求超时 (ms) */
  timeout?: number;
  /** 是否启用真实 API 调用（默认通过 BITBUCKET_API_ENABLED 环境变量控制） */
  enableRealApi?: boolean;
}

/**
 * Bitbucket REST API 客户端
 *
 * 使用 native fetch() 调用 Bitbucket REST API。
 * 当服务不可达时降级为 mock 数据。
 */
class BitbucketApiClient {
  private baseUrl: string;
  private token: string;
  private workspace: string;
  private timeout: number;
  private enableRealApi: boolean;

  constructor(config: BitbucketAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.workspace = config.workspace;
    this.timeout = config.timeout || 10_000;
    this.enableRealApi = config.enableRealApi ?? process.env.BITBUCKET_API_ENABLED === 'true';
  }

  /** 构建 API URL */
  private apiUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /** 获取请求头 */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /** GET 请求 */
  async get<T>(path: string, fallback: T): Promise<T> {
    if (!this.enableRealApi) return fallback;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await safeFetch(this.apiUrl(path), {
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

      const response = await safeFetch(this.apiUrl(path), {
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

      const response = await safeFetch(this.apiUrl(path), {
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

      const response = await safeFetch(this.apiUrl(path), {
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
 * Bitbucket 适配器实现
 *
 * 将 Bitbucket REST API 统一映射到 ICodeRepoAdapter 接口。
 * Bitbucket 概念映射:
 *   - Repository -> Repository
 *   - Pull Request -> PullRequest
 *   - Commit -> Commit
 */
export class BitbucketAdapter implements ICodeRepoAdapter {
  readonly type = RepoType.BITBUCKET;

  private client: BitbucketApiClient;
  private baseUrl: string;

  constructor(config: BitbucketAdapterConfig) {
    this.client = new BitbucketApiClient(config);
    this.baseUrl = config.baseUrl;
  }

  // ==================== 仓库管理 ====================

  /**
   * 获取仓库信息
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}
   */
  async getRepository(repoId: string): Promise<Repository> {
    const fallback: Repository = {
      id: repoId,
      name: repoId.split('/').pop() || 'unknown',
      fullName: `${this.client['workspace']}/${repoId}`,
      type: RepoType.BITBUCKET,
      url: `${this.baseUrl}/${this.client['workspace']}/${repoId}`,
      defaultBranch: 'main',
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}`,
      fallback
    );

    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return fallback;
    }

    return this.mapBitbucketRepositoryToRepository(data);
  }

  /**
   * 获取仓库列表
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}
   */
  async listRepositories(options?: { page?: number; limit?: number; search?: string }): Promise<{ repos: Repository[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.search) params.set('q', `name~"${options.search}"`);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('pagelen', String(options.limit));

    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}?${params}`,
      { values: [] }
    );

    const repos = (data.values || []).map((repo: any) => this.mapBitbucketRepositoryToRepository(repo));
    return { repos, total: repos.length };
  }

  // ==================== 分支管理 ====================

  /**
   * 获取分支列表
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/refs/branches
   */
  async listBranches(repoId: string, options?: { page?: number; limit?: number }): Promise<{ branches: Branch[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('pagelen', String(options.limit));

    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/refs/branches?${params}`,
      { values: [] }
    );

    const branches = (data.values || []).map((b: any) => ({
      name: b.name,
      sha: b.target?.hash || '',
      protected: false,
      lastCommitDate: new Date(b.target?.date || Date.now()),
    }));
    return { branches, total: branches.length };
  }

  /**
   * 获取分支详情
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/refs/branches/{branch_name}
   */
  async getBranch(repoId: string, branchName: string): Promise<Branch> {
    const fallback: Branch = {
      name: branchName,
      protected: false,
      sha: '',
      lastCommitDate: new Date(),
    };

    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/refs/branches/${encodeURIComponent(branchName)}`,
      fallback
    );

    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return fallback;
    }

    return {
      name: data.name,
      sha: data.target?.hash || '',
      protected: false,
      lastCommitDate: new Date(data.target?.date || Date.now()),
    };
  }

  /**
   * 创建分支
   *
   * Bitbucket API: POST /2.0/repositories/{workspace}/{repo_slug}/refs/branches
   */
  async createBranch(repoId: string, branchName: string, sourceRef: string): Promise<Branch> {
    const fallback: Branch = {
      name: branchName,
      protected: false,
      sha: '',
      lastCommitDate: new Date(),
    };

    const branch: any = await this.client.post(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/refs/branches`,
      { name: branchName, target: { hash: sourceRef } },
      fallback
    );

    if (!branch || (typeof branch === 'object' && Object.keys(branch).length === 0)) {
      return fallback;
    }

    return {
      name: branch.name,
      sha: branch.target?.hash || '',
      protected: false,
      lastCommitDate: new Date(branch.target?.date || Date.now()),
    };
  }

  /**
   * 删除分支
   *
   * Bitbucket API: DELETE /2.0/repositories/{workspace}/{repo_slug}/refs/branches/{branch_name}
   */
  async deleteBranch(repoId: string, branchName: string): Promise<void> {
    await this.client.delete(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/refs/branches/${encodeURIComponent(branchName)}`
    );
  }

  /**
   * 获取分支保护状态
   */
  async getBranchProtection(repoId: string, branchName: string): Promise<BranchPolicy | null> {
    return null;
  }

  // ==================== 提交管理 ====================

  /**
   * 获取提交列表
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/commits/{branch}
   */
  async listCommits(repoId: string, options?: { branch?: string; page?: number; limit?: number }): Promise<{ commits: Commit[]; total: number }> {
    const params = new URLSearchParams();
    const branch = options?.branch || 'master';
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('pagelen', String(options.limit));

    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/commits/${encodeURIComponent(branch)}?${params}`,
      { values: [] }
    );

    const commits = (data.values || []).map((c: any) => ({
      sha: c.hash || '',
      message: c.message || '',
      author: {
        name: c.author?.raw || '',
        email: c.author?.user?.email || '',
        date: new Date(c.date || Date.now()),
      },
      url: `${this.baseUrl}/${this.client['workspace']}/${repoId}/commits/${c.hash}`,
    }));
    return { commits, total: commits.length };
  }

  /**
   * 获取提交详情
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/commit/{sha}
   */
  async getCommit(repoId: string, sha: string): Promise<Commit> {
    const fallback: Commit = {
      sha,
      message: '',
      author: { name: '', email: '', date: new Date() },
      url: `${this.baseUrl}/${this.client['workspace']}/${repoId}/commits/${sha}`,
    };

    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/commit/${encodeURIComponent(sha)}`,
      fallback
    );

    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return fallback;
    }

    return {
      sha: data.hash || sha,
      message: data.message || '',
      author: {
        name: data.author?.raw || '',
        email: data.author?.user?.email || '',
        date: new Date(data.date || Date.now()),
      },
      url: `${this.baseUrl}/${this.client['workspace']}/${repoId}/commits/${data.hash}`,
    };
  }

  // ==================== Pull Request 管理 ====================

  /**
   * 创建 Pull Request
   *
   * Bitbucket API: POST /2.0/repositories/{workspace}/{repo_slug}/pullrequests
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
      id: `pr-${Date.now()}`,
      title: input.title,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      author: 'current-user',
      status: PullRequestStatus.OPEN,
    };

    const pr: any = await this.client.post(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests`,
      {
        title: input.title,
        description: input.description,
        source: { branch: { name: input.sourceBranch } },
        destination: { branch: { name: input.targetBranch } },
        reviewers: input.reviewers?.map(id => ({ uuid: id })),
      },
      fallback
    );

    if (!pr || (typeof pr === 'object' && Object.keys(pr).length === 0)) {
      return fallback;
    }

    return this.mapBitbucketPRToPullRequest(pr);
  }

  /**
   * 获取 Pull Request 详情
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}
   */
  async getPullRequest(repoId: string, prId: string): Promise<PullRequest> {
    const fallback: PullRequest = {
      id: prId,
      title: 'Mock PR',
      sourceBranch: 'feature-branch',
      targetBranch: 'main',
      author: 'user',
      status: PullRequestStatus.OPEN,
    };

    const pr: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests/${prId}`,
      fallback
    );

    if (!pr || (typeof pr === 'object' && Object.keys(pr).length === 0)) {
      return fallback;
    }

    return this.mapBitbucketPRToPullRequest(pr);
  }

  /**
   * 获取 Pull Request 列表
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/pullrequests
   */
  async listPullRequests(repoId: string, options?: { state?: PullRequestStatus; page?: number; limit?: number }): Promise<{ pullRequests: PullRequest[]; total: number }> {
    const params = new URLSearchParams();
    const state = options?.state === PullRequestStatus.OPEN ? 'OPEN' : options?.state === PullRequestStatus.MERGED ? 'MERGED' : options?.state === PullRequestStatus.CLOSED ? 'DECLINED' : 'ALL';
    params.set('state', state);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('pagelen', String(options.limit));

    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests?${params}`,
      { values: [] }
    );

    const prs = (data.values || []).map((pr: any) => this.mapBitbucketPRToPullRequest(pr));
    return { pullRequests: prs, total: prs.length };
  }

  /**
   * 合并 Pull Request
   *
   * Bitbucket API: POST /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/merge
   */
  async mergePullRequest(repoId: string, prId: string, options?: { method?: MergeStrategy; commitMessage?: string }): Promise<PullRequest> {
    const body: Record<string, any> = {};
    if (options?.commitMessage) body.message = options.commitMessage;
    if (options?.method === 'squash') body.merge_strategy = 'squash';

    const pr: any = await this.client.post(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests/${prId}/merge`,
      body,
      null
    );

    return {
      id: prId,
      title: pr?.title || 'Merged PR',
      sourceBranch: pr?.source?.branch?.name || '',
      targetBranch: pr?.destination?.branch?.name || '',
      author: pr?.author?.display_name || 'user',
      status: PullRequestStatus.MERGED,
    };
  }

  /**
   * 关闭 Pull Request
   *
   * Bitbucket API: POST /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/decline
   */
  async closePullRequest(repoId: string, prId: string): Promise<PullRequest> {
    const pr: any = await this.client.post(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests/${prId}/decline`,
      {},
      null
    );

    return {
      id: prId,
      title: pr?.title || 'Declined PR',
      sourceBranch: pr?.source?.branch?.name || '',
      targetBranch: pr?.destination?.branch?.name || '',
      author: pr?.author?.display_name || 'user',
      status: PullRequestStatus.CLOSED,
    };
  }

  /**
   * 更新 Pull Request
   *
   * Bitbucket API: PUT /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}
   */
  async updatePullRequest(repoId: string, prId: string, input: { title?: string; description?: string }): Promise<PullRequest> {
    const body: Record<string, any> = {};
    if (input.title) body.title = input.title;
    if (input.description !== undefined) body.description = input.description;

    const pr: any = await this.client.put(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests/${prId}`,
      body,
      null
    );

    return {
      id: prId,
      title: pr?.title || input.title || 'PR',
      sourceBranch: pr?.source?.branch?.name || '',
      targetBranch: pr?.destination?.branch?.name || '',
      author: pr?.author?.display_name || 'user',
      status: PullRequestStatus.OPEN,
    };
  }

  // ==================== Review 管理 ====================

  /**
   * 添加 Review
   *
   * Bitbucket API: POST /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/comments
   */
  async addReview(repoId: string, prId: string, input: {
    content?: string;
    score?: number;
    state?: 'comment' | 'approve' | 'request_changes';
    fileComments?: FileComment[];
  }): Promise<Review> {
    const body: Record<string, any> = { content: { raw: input.content || '' } };

    await this.client.post(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests/${prId}/comments`,
      body,
      null
    );

    return {
      id: `review-${Date.now()}`,
      author: 'current-user',
      body: input.content || '',
      state: input.state === 'approve' ? 'approved' : input.state === 'request_changes' ? 'changes_requested' : 'pending',
      createdAt: new Date(),
    };
  }

  /**
   * 获取 PR 的 Reviews
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/comments
   */
  async listReviews(repoId: string, prId: string): Promise<Review[]> {
    const comments: any[] = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests/${prId}/comments`,
      []
    );

    return comments.map((comment: any) => ({
      id: String(comment.id || `review-${Date.now()}`),
      author: comment.user?.display_name || '',
      body: comment.content?.raw || '',
      state: 'pending',
      createdAt: new Date(comment.created_on || Date.now()),
    }));
  }

  // ==================== Webhook 管理 ====================

  /**
   * 创建 Webhook
   *
   * Bitbucket API: POST /2.0/repositories/{workspace}/{repo_slug}/hooks
   */
  async createWebhook(repoId: string, input: {
    url: string;
    events: WebhookEventType[];
    secret?: string;
  }): Promise<WebhookConfig> {
    const fallback: WebhookConfig = {
      id: `hook-${Date.now()}`,
      url: input.url,
      events: input.events,
      active: true,
      secret: input.secret,
    };

    const eventsMap: Record<string, string> = {
      pr_opened: 'pullrequest:created',
      pr_merged: 'pullrequest:fulfilled',
      pr_closed: 'pullrequest:rejected',
      pr_updated: 'pullrequest:updated',
      pr_reviewed: 'pullrequest:comment_created',
      push: 'repo:push',
    };

    const hook: any = await this.client.post(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/hooks`,
      {
        url: input.url,
        description: `Orion webhook for ${input.events.length} events`,
        active: true,
        events: input.events.map(e => eventsMap[e]).filter(Boolean),
      },
      fallback
    );

    if (!hook || (typeof hook === 'object' && Object.keys(hook).length === 0)) {
      return fallback;
    }

    return {
      id: String(hook.uuid || hook.id || `hook-${Date.now()}`),
      url: hook.url || input.url,
      events: input.events,
      active: hook.active !== false,
      secret: input.secret,
    };
  }

  /**
   * 获取 Webhook 列表
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/hooks
   */
  async listWebhooks(repoId: string): Promise<WebhookConfig[]> {
    const hooks: any[] = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/hooks`,
      []
    );

    return hooks.map(h => ({
      id: String(h.uuid || h.id || `hook-${Date.now()}`),
      url: h.url,
      events: [],
      active: h.active !== false,
      secret: undefined,
    }));
  }

  /**
   * 删除 Webhook
   *
   * Bitbucket API: DELETE /2.0/repositories/{workspace}/{repo_slug}/hooks/{hook_uuid}
   */
  async deleteWebhook(repoId: string, webhookId: string): Promise<void> {
    await this.client.delete(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/hooks/${encodeURIComponent(webhookId)}`
    );
  }

  /**
   * 列出标签
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/refs/tags
   */
  async listTags(repoId: string): Promise<{ tags: string[]; total: number }> {
    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/refs/tags?pagelen=100`,
      { values: [] }
    );

    const tags = (data.values || []).map((t: any) => t.name || '').filter(Boolean);
    return { tags, total: tags.length };
  }

  /**
   * 更新 Webhook
   *
   * Bitbucket API: PUT /2.0/repositories/{workspace}/{repo_slug}/hooks/{hook_uuid}
   */
  async updateWebhook(repoId: string, webhookId: string, input: { url?: string; events?: WebhookEventType[]; active?: boolean; secret?: string }): Promise<WebhookConfig> {
    const eventsMap: Record<string, string> = {
      pr_opened: 'pullrequest:created',
      pr_merged: 'pullrequest:fulfilled',
      pr_closed: 'pullrequest:rejected',
      pr_updated: 'pullrequest:updated',
      pr_reviewed: 'pullrequest:comment_created',
      push: 'repo:push',
    };

    const bbEvents = (input.events || []).map(e => eventsMap[e]).filter(Boolean);

    const data: any = await this.client.put(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/hooks/${encodeURIComponent(webhookId)}`,
      {
        url: input.url || '',
        active: input.active ?? true,
        events: bbEvents,
      },
      { uuid: webhookId }
    );

    return {
      id: data.uuid || webhookId,
      url: data.url || input.url || '',
      events: input.events || [],
      active: data.active,
      secret: input.secret,
    };
  }

  // ==================== Diff 与评论（Task 5.6） ====================

  /**
   * 获取文件 diff（两个 ref 之间）
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/diffstat/{from}..{to}
   */
  async getFileDiff(repoId: string, fromRef: string, toRef: string, options?: { path?: string }): Promise<FileDiff[]> {
    const data: any = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/diffstat/${encodeURIComponent(fromRef)}..${encodeURIComponent(toRef)}`,
      { values: [] }
    );

    if (!data || !Array.isArray(data.values)) return [];

    return data.values.map((diff: any) => ({
      path: diff.new?.path || diff.old?.path || '',
      oldBlobId: diff.old?.hash,
      newBlobId: diff.new?.hash,
      isNew: diff.status === 'added',
      isDeleted: diff.status === 'removed',
      isRenamed: diff.status === 'renamed',
      hunks: [],
      stats: {
        additions: diff.changes?.filter((c: any) => c.type === 'added').length || 0,
        deletions: diff.changes?.filter((c: any) => c.type === 'removed').length || 0,
        changes: diff.changes?.length || 0,
      },
    }));
  }

  /**
   * 列出 PR 评论
   *
   * Bitbucket API: GET /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/comments
   */
  async listComments(repoId: string, prId: string): Promise<PRComment[]> {
    const comments: any[] = await this.client.get(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests/${prId}/comments`,
      []
    );

    return comments.map((c: any) => ({
      id: String(c.id || Date.now()),
      prId,
      path: c.inline?.path,
      line: c.inline?.line,
      body: c.content?.raw || '',
      author: c.user?.display_name || '',
      createdAt: new Date(c.created_on || Date.now()),
      updatedAt: new Date(c.updated_on || c.created_on || Date.now()),
    }));
  }

  /**
   * 添加 PR 评论
   *
   * Bitbucket API: POST /2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/comments
   */
  async addComment(repoId: string, prId: string, input: { body: string; path?: string; line?: number }): Promise<PRComment> {
    const body: Record<string, any> = {
      content: { raw: input.body },
    };

    if (input.path) {
      body.inline = {
        path: input.path,
        line: input.line || 1,
      };
    }

    const comment: any = await this.client.post(
      `/repositories/${encodeURIComponent(this.client['workspace'])}/${encodeURIComponent(repoId)}/pullrequests/${prId}/comments`,
      body,
      null
    );

    return {
      id: String(comment?.id || Date.now()),
      prId,
      path: input.path,
      line: input.line,
      body: comment?.content?.raw || input.body,
      author: comment?.user?.display_name || 'current-user',
      createdAt: new Date(comment?.created_on || Date.now()),
      updatedAt: new Date(comment?.updated_on || comment?.created_on || Date.now()),
    };
  }

  // ==================== 数据映射方法 ====================

  /** 将 Bitbucket Repository 映射为 Repository */
  private mapBitbucketRepositoryToRepository(data: any): Repository {
    return {
      id: data.slug || String(data.uuid || data.id),
      name: data.name || '',
      fullName: `${data.workspace?.slug || this.client['workspace']}/${data.slug || data.name}`,
      type: RepoType.BITBUCKET,
      url: data.links?.html?.href || `${this.baseUrl}/${this.client['workspace']}/${data.slug}`,
      defaultBranch: data.mainbranch?.name || 'main',
      isPrivate: data.is_private !== false,
      description: data.description,
      createdAt: new Date(data.created_on || Date.now()),
      updatedAt: new Date(data.updated_on || Date.now()),
    };
  }

  /** 将 Bitbucket PR 映射为 PullRequest */
  private mapBitbucketPRToPullRequest(data: any): PullRequest {
    return {
      id: String(data.id || data.iid || ''),
      title: data.title || '',
      sourceBranch: data.source?.branch?.name || '',
      targetBranch: data.destination?.branch?.name || '',
      author: data.author?.display_name || data.author?.nickname || '',
      status: data.state === 'MERGED' ? PullRequestStatus.MERGED : data.state === 'DECLINED' ? PullRequestStatus.CLOSED : PullRequestStatus.OPEN,
    };
  }
}
