/**
 * PullRequestService — PR/MR 状态更新与评论服务
 *
 * 支持 GitHub 和 GitLab 的 PR/MR 操作：
 * - 更新 PR check 状态（pending/success/failure）
 * - 发布 PR 评论（测试结果、构建状态）
 * - PR 事件防抖（30s 窗口）
 */

import pino from 'pino';
import { OrionError } from '../../errors';

const logger = pino({ name: 'pull-request-service' });

export type PRProvider = 'github' | 'gitlab';

export interface PRContext {
  provider: PRProvider;
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
}

export interface PRCheckStatus {
  context: string;
  state: 'pending' | 'success' | 'failure' | 'error';
  description?: string;
  targetUrl?: string;
}

export interface PRComment {
  body: string;
}

/**
 * PR 防抖状态
 */
interface PrDebounceEntry {
  timer: NodeJS.Timeout;
  lastEventTime: number;
}

/**
 * PR API 客户端接口
 */
export interface PRApiClient {
  updateCheckStatus(context: PRContext, status: PRCheckStatus): Promise<void>;
  postComment(context: PRContext, comment: PRComment): Promise<void>;
  getOpenPrs(owner: string, repo: string): Promise<number[]>;
}

/**
 * GitHub API 客户端实现
 */
export class GitHubPRClient implements PRApiClient {
  private baseUrl = 'https://api.github.com';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async updateCheckStatus(context: PRContext, status: PRCheckStatus): Promise<void> {
    const url = `${this.baseUrl}/repos/${context.owner}/${context.repo}/statuses/${context.commitSha}`;
    const body = {
      state: status.state,
      description: status.description || '',
      context: status.context,
      target_url: status.targetUrl || '',
    };

    try {
      await this.request('POST', url, body);
      logger.info({ pr: context.prNumber, status: status.state }, 'GitHub check status updated');
    } catch (error) {
      logger.error({ error }, 'Failed to update GitHub check status');
    }
  }

  async postComment(context: PRContext, comment: PRComment): Promise<void> {
    const url = `${this.baseUrl}/repos/${context.owner}/${context.repo}/issues/${context.prNumber}/comments`;

    try {
      await this.request('POST', url, { body: comment.body });
      logger.info({ pr: context.prNumber }, 'GitHub PR comment posted');
    } catch (error) {
      logger.error({ error }, 'Failed to post GitHub PR comment');
    }
  }

  async getOpenPrs(owner: string, repo: string): Promise<number[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=open`;
    try {
      const prs = await this.request<any[]>('GET', url);
      return prs.map((pr: any) => pr.number);
    } catch {
      return [];
    }
  }

  private async request<T>(method: string, url: string, body?: any): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new OrionError(`GitHub API error: ${response.status} ${response.statusText}`, 'OPERATION_FAILED')
    }

    return response.json() as Promise<T>;
  }
}

/**
 * GitLab API 客户端实现
 */
export class GitLabPRClient implements PRApiClient {
  private baseUrl: string;
  private token: string;

  constructor(token: string, baseUrl?: string) {
    this.token = token;
    this.baseUrl = baseUrl || 'https://gitlab.com/api/v4';
  }

  async updateCheckStatus(context: PRContext, status: PRCheckStatus): Promise<void> {
    // GitLab uses pipeline status instead of commit statuses
    const projectId = `${context.owner}/${context.repo}`;
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/statuses/${context.commitSha}`;
    const body = {
      state: this.mapStateToGitLab(status.state),
      name: status.context,
      description: status.description || '',
      target_url: status.targetUrl || '',
    };

    try {
      await this.request('POST', url, body);
      logger.info({ pr: context.prNumber, status: status.state }, 'GitLab check status updated');
    } catch (error) {
      logger.error({ error }, 'Failed to update GitLab check status');
    }
  }

  async postComment(context: PRContext, comment: PRComment): Promise<void> {
    const projectId = `${context.owner}/${context.repo}`;
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/merge_requests/${context.prNumber}/notes`;

    try {
      await this.request('POST', url, { body: comment.body });
      logger.info({ pr: context.prNumber }, 'GitLab MR comment posted');
    } catch (error) {
      logger.error({ error }, 'Failed to post GitLab MR comment');
    }
  }

  async getOpenPrs(owner: string, repo: string): Promise<number[]> {
    const projectId = `${owner}/${repo}`;
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/merge_requests?state=opened`;
    try {
      const prs = await this.request<any[]>('GET', url);
      return prs.map((pr: any) => pr.iid);
    } catch {
      return [];
    }
  }

  private mapStateToGitLab(state: string): string {
    switch (state) {
      case 'success': return 'success';
      case 'failure': return 'failed';
      case 'pending': return 'pending';
      case 'error': return 'failed';
      default: return 'pending';
    }
  }

  private async request<T>(method: string, url: string, body?: any): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new OrionError(`GitLab API error: ${response.status} ${response.statusText}`, 'OPERATION_FAILED')
    }

    return response.json() as Promise<T>;
  }
}

/**
 * PullRequestService — 高层 PR 操作服务
 */
export class PullRequestService {
  private clients = new Map<PRProvider, PRApiClient>();
  private prDebounceMap = new Map<string, PrDebounceEntry>();
  private debounceMs = 30000; // 30 second debounce window

  constructor() {
    // Register default clients if tokens are available
    const githubToken = process.env.GITHUB_TOKEN;
    const gitlabToken = process.env.GITLAB_TOKEN;

    if (githubToken) {
      this.clients.set('github', new GitHubPRClient(githubToken));
    }
    if (gitlabToken) {
      this.clients.set('gitlab', new GitLabPRClient(gitlabToken, process.env.GITLAB_API_URL));
    }
  }

  /**
   * 注册 PR API 客户端
   */
  registerClient(provider: PRProvider, client: PRApiClient): void {
    this.clients.set(provider, client);
  }

  /**
   * 更新 PR check 状态（带防抖）
   */
  async updateCheckStatus(
    context: PRContext,
    status: PRCheckStatus,
    options?: { debounce?: boolean }
  ): Promise<void> {
    const client = this.clients.get(context.provider);
    if (!client) {
      logger.warn({ provider: context.provider }, 'No PR client registered for provider');
      return;
    }

    const debounceKey = `${context.provider}:${context.owner}/${context.repo}:${context.prNumber}`;

    // Apply debounce to prevent rapid status updates
    if (options?.debounce !== false) {
      if (this.shouldDebounce(debounceKey)) {
        logger.debug({ debounceKey }, 'PR update debounced');
        return;
      }
      this.setDebounce(debounceKey);
    }

    await client.updateCheckStatus(context, status);
  }

  /**
   * 发布 PR 评论
   */
  async postComment(context: PRContext, comment: PRComment): Promise<void> {
    const client = this.clients.get(context.provider);
    if (!client) {
      logger.warn({ provider: context.provider }, 'No PR client registered for provider');
      return;
    }

    await client.postComment(context, comment);
  }

  /**
   * 发布测试结果评论
   */
  async postTestResults(
    context: PRContext,
    testResults: { passed: number; failed: number; skipped: number; total: number }
  ): Promise<void> {
    const body = this.formatTestResults(testResults);
    await this.postComment(context, { body });
  }

  /**
   * 格式化测试结果为 Markdown
   */
  private formatTestResults(results: { passed: number; failed: number; skipped: number; total: number }): string {
    const emoji = results.failed > 0 ? '❌' : '✅';
    return `## ${emoji} Test Results

| Status | Count |
|--------|-------|
| Passed | ${results.passed} |
| Failed | ${results.failed} |
| Skipped | ${results.skipped} |
| **Total** | **${results.total}** |
`;
  }

  /**
   * 检查是否应该防抖
   */
  private shouldDebounce(key: string): boolean {
    const entry = this.prDebounceMap.get(key);
    if (!entry) return false;

    const elapsed = Date.now() - entry.lastEventTime;
    return elapsed < this.debounceMs;
  }

  /**
   * 设置防抖计时器
   */
  private setDebounce(key: string): void {
    const existing = this.prDebounceMap.get(key);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.prDebounceMap.delete(key);
    }, this.debounceMs);

    this.prDebounceMap.set(key, { timer, lastEventTime: Date.now() });
  }

  /**
   * 从 PR webhook payload 提取 PR 上下文
   */
  static extractPRContext(payload: any): PRContext | null {
    // GitHub PR payload
    if (payload.pull_request) {
      const pr = payload.pull_request;
      const [owner, repo] = (pr.base?.repo?.full_name || '').split('/');
      return {
        provider: 'github',
        owner: owner || '',
        repo: repo || '',
        prNumber: pr.number,
        commitSha: pr.head?.sha || '',
      };
    }

    // GitLab MR payload
    if (payload.object_attributes && payload.object_attributes.iid) {
      const attrs = payload.object_attributes;
      const path = attrs.target?.path_with_namespace || attrs.source?.path_with_namespace || '';
      const [owner, repo] = path.split('/');
      return {
        provider: 'gitlab',
        owner: owner || '',
        repo: repo || '',
        prNumber: attrs.iid,
        commitSha: attrs.last_commit?.id || '',
      };
    }

    return null;
  }
}
