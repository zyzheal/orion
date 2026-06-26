/**
 * Webhook Service - 代码仓库 Webhook 处理服务
 *
 * 接收来自 GitLab、Gerrit 等代码仓库的 Webhook 事件，
 * 解析并统一格式，通过 EventBus 发布标准化事件。
 *
 * 支持的事件:
 *   - code.pr.opened     - PR/MR 被创建
 *   - code.pr.updated    - PR/MR 被更新
 *   - code.pr.merged     - PR/MR 被合并
 *   - code.pr.closed     - PR/MR 被关闭
 *   - code.pr.reviewed   - PR/MR 被评审
 *   - code.push          - 代码推送
 *   - code.branch.created  - 分支创建
 *   - code.branch.deleted  - 分支删除
 */

import { EventEmitter } from 'events';
import {
  CodeRepoWebhookPayload,
  WebhookEventType,
  WebhookProcessResult,
  RepoType,
  PullRequestStatus,
} from './types';
import { WebhookSecretRepository } from '../../repositories/WebhookSecretRepository';
import { WebhookEventLogRepository } from '../../repositories/WebhookEventLogRepository';

/** EventBus 接口 (复用现有 EventBusService) */
export interface IEventPublisher {
  publish<T = any>(
    type: string,
    data: T,
    options?: { source?: string; extensions?: Record<string, any> }
  ): Promise<string>;
}

/** Webhook Service 配置 */
export interface WebhookServiceConfig {
  /** 事件发布器 */
  eventPublisher?: IEventPublisher;
  /** 事件源标识 */
  source?: string;
  /** Webhook 密钥验证 (可选) */
  webhookSecrets?: Map<string, string>; // repoId -> secret
  /** 是否启用事件日志 */
  enableEventLog?: boolean;
  /** IP 白名单 (可选) */
  ipWhitelist?: string[]; // 允许的 IP 地址列表
  /** IP 白名单模式 (可选) */
  ipWhitelistMode?: 'allow' | 'deny'; // 'allow' = 只允许白名单, 'deny' = 禁止白名单
  /** 数据库连接 (可选) */
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

/** 内部事件日志记录 */
interface EventLogEntry {
  id: string;
  eventType: WebhookEventType;
  repoType: RepoType;
  repoName: string;
  eventId: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

/**
 * Webhook 处理服务
 *
 * 将不同代码仓库的 Webhook 载荷转换为统一的 CodeRepoWebhookPayload 格式，
 * 然后通过 EventBus 发布标准化事件。
 */
export class CodeRepoWebhookService extends EventEmitter {
  private eventPublisher: IEventPublisher | null;
  private source: string;
  private webhookSecrets: Map<string, string>;
  private enableEventLog: boolean;
  private eventLog: EventLogEntry[];
  private ipWhitelist: string[];
  private ipWhitelistMode: 'allow' | 'deny';
  private secretRepo: WebhookSecretRepository | null;
  private eventLogRepo: WebhookEventLogRepository | null;

  constructor(config?: WebhookServiceConfig) {
    super();
    this.eventPublisher = config?.eventPublisher || null;
    this.source = config?.source || 'code-repo-service';
    this.webhookSecrets = config?.webhookSecrets || new Map();
    this.enableEventLog = config?.enableEventLog !== false;
    this.eventLog = [];
    this.ipWhitelist = config?.ipWhitelist || [];
    this.ipWhitelistMode = config?.ipWhitelistMode || 'allow';

    // Initialize PostgreSQL repositories if db is available
    if (config?.db) {
      this.secretRepo = new WebhookSecretRepository(config.db);
      this.eventLogRepo = new WebhookEventLogRepository(config.db);
    } else {
      this.secretRepo = null;
      this.eventLogRepo = null;
    }
  }

  /**
   * 设置事件发布器
   */
  setEventPublisher(publisher: IEventPublisher): void {
    this.eventPublisher = publisher;
  }

  /**
   * 注册 Webhook 密钥
   */
  registerWebhookSecret(repoId: string, secret: string): void {
    this.webhookSecrets.set(repoId, secret);
    // Persist to PostgreSQL (fire-and-forget)
    this.secretRepo?.upsertByRepoId(repoId, secret).catch((err) => console.warn('[WebhookService] Failed to persist webhook secret:', err));
  }

  /**
   * 设置 IP 白名单
   */
  setIpWhitelist(whitelist: string[], mode: 'allow' | 'deny' = 'allow'): void {
    this.ipWhitelist = whitelist;
    this.ipWhitelistMode = mode;
  }

  /**
   * 验证 IP 白名单
   */
  verifyIpWhitelist(ipAddress: string): boolean {
    if (this.ipWhitelist.length === 0) {
      return true; // 没有配置白名单，允许所有
    }

    const isAllowed = this.ipWhitelist.includes(ipAddress);

    if (this.ipWhitelistMode === 'allow') {
      return isAllowed; // 只允许白名单中的 IP
    } else {
      return !isAllowed; // 禁止白名单中的 IP
    }
  }

  /**
   * 验证 Webhook 签名
   *
   * 支持:
   *   - GitLab: X-Gitlab-Token header
   *   - GitHub: X-Hub-Signature-256 header (HMAC-SHA256)
   */
  verifyWebhookSignature(
    repoId: string,
    payload: string,
    headers: Record<string, string | undefined>
  ): boolean {
    // Try Map cache first, then repository
    let secret = this.webhookSecrets.get(repoId);
    if (!secret && this.secretRepo) {
      // Fire-and-forget sync from repo to cache (non-blocking for signature check)
      this.secretRepo.findByRepoId(repoId).then(entity => {
        if (entity) {
          this.webhookSecrets.set(repoId, entity.secret);
        }
      }).catch((err) => console.warn('[WebhookService] Failed to sync webhook secret from repo:', err));
    }
    if (!secret) {
      // 没有配置密钥，跳过验证
      return true;
    }

    // GitLab 简单 Token 验证
    const gitlabToken = headers['x-gitlab-token'] || headers['X-Gitlab-Token'];
    if (gitlabToken) {
      return gitlabToken === secret;
    }

    // GitHub HMAC-SHA256 验证
    const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
    if (signature) {
      // 生产实现:
      // const crypto = require('crypto');
      // const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
      // return signature === expected;
      return signature === `sha256=${secret}`;  // Mock
    }

    return false;
  }

  /**
   * 处理 GitLab Webhook
   *
   * 解析 GitLab Webhook 载荷并发布统一事件
   */
  async handleGitLabWebhook(
    payload: any,
    headers: Record<string, string | undefined> = {}
  ): Promise<WebhookProcessResult> {
    try {
      const eventType = this.mapGitLabEventType(payload);
      if (!eventType) {
        return {
          success: false,
          error: `Unsupported GitLab event: ${payload.object_kind || 'unknown'}`,
        };
      }

      // 转换为统一格式
      const unifiedPayload = this.convertGitLabPayload(payload, eventType);

      // 发布事件
      const result = await this.publishEvent(unifiedPayload);

      this.emit(eventType, unifiedPayload);

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to process GitLab webhook',
      };
    }
  }

  /**
   * 处理 Gerrit Webhook
   *
   * 解析 Gerrit Webhook 载荷并发布统一事件
   */
  async handleGerritWebhook(
    payload: any,
    headers: Record<string, string | undefined> = {}
  ): Promise<WebhookProcessResult> {
    try {
      const eventType = this.mapGerritEventType(payload);
      if (!eventType) {
        return {
          success: false,
          error: `Unsupported Gerrit event: ${payload.type || 'unknown'}`,
        };
      }

      // 转换为统一格式
      const unifiedPayload = this.convertGerritPayload(payload, eventType);

      // 发布事件
      const result = await this.publishEvent(unifiedPayload);

      this.emit(eventType, unifiedPayload);

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to process Gerrit webhook',
      };
    }
  }

  /**
   * 处理 GitHub Webhook
   *
   * 解析 GitHub Webhook 载荷并发布统一事件
   */
  async handleGitHubWebhook(
    payload: any,
    headers: Record<string, string | undefined> = {}
  ): Promise<WebhookProcessResult> {
    try {
      const eventType = this.mapGitHubEventType(payload);
      if (!eventType) {
        return {
          success: false,
          error: `Unsupported GitHub event: ${payload.action || 'unknown'}`,
        };
      }

      // 转换为统一格式
      const unifiedPayload = this.convertGitHubPayload(payload, eventType);

      // 发布事件
      const result = await this.publishEvent(unifiedPayload);

      this.emit(eventType, unifiedPayload);

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to process GitHub webhook',
      };
    }
  }

  /**
   * 发布统一事件到 EventBus
   */
  private async publishEvent(
    payload: CodeRepoWebhookPayload
  ): Promise<WebhookProcessResult> {
    if (!this.eventPublisher) {
      // 没有事件发布器，仅记录
      if (this.enableEventLog) {
        this.logEvent(payload, 'mock-event-id', true);
      }
      return {
        success: true,
        eventId: 'mock-event-id',
        eventType: payload.eventType,
      };
    }

    try {
      const eventId = await this.eventPublisher.publish(payload.eventType, payload, {
        source: this.source,
        extensions: {
          repoType: payload.repoType,
          repoName: (payload.repository as any)?.fullName || payload.repositoryName,
        },
      });

      if (this.enableEventLog) {
        this.logEvent(payload, eventId, true);
      }

      return {
        success: true,
        eventId,
        eventType: payload.eventType,
      };
    } catch (error: any) {
      if (this.enableEventLog) {
        this.logEvent(payload, '', false, error.message);
      }

      return {
        success: false,
        error: error.message || 'Failed to publish event',
      };
    }
  }

  /**
   * 处理 Webhook 请求（公共入口点）
   * 
   * @param payload Webhook 载荷
   * @param headers 请求头
   * @param ipAddress 客户端 IP 地址
   * @param repoId 仓库 ID
   */
  async processWebhook(
    payload: any,
    headers: Record<string, string | undefined> = {},
    ipAddress?: string,
    repoId?: string
  ): Promise<WebhookProcessResult> {
    try {
      // IP 白名单验证
      if (ipAddress && !this.verifyIpWhitelist(ipAddress)) {
        return {
          success: false,
          error: `IP address ${ipAddress} is not allowed`,
        };
      }

      // 签名验证
      if (repoId && !this.verifyWebhookSignature(repoId, JSON.stringify(payload), headers)) {
        return {
          success: false,
          error: 'Invalid webhook signature',
        };
      }

      // 根据仓库类型分发处理
      const repoType = this.detectRepoType(headers, payload);
      
      switch (repoType) {
        case RepoType.GITLAB:
          return await this.handleGitLabWebhook(payload, headers);
        case RepoType.GITHUB:
          return await this.handleGitHubWebhook(payload, headers);
        case RepoType.GERRIT:
          return await this.handleGerritWebhook(payload, headers);
        default:
          return {
            success: false,
            error: `Unsupported repository type: ${repoType}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to process webhook',
      };
    }
  }

  /**
   * 检测仓库类型
   */
  private detectRepoType(headers: Record<string, string | undefined>, payload: any): RepoType {
    // 检查 GitLab
    if (headers['x-gitlab-token'] || headers['X-Gitlab-Token'] || payload.object_kind) {
      return RepoType.GITLAB;
    }
    
    // 检查 GitHub
    if (headers['x-github-event'] || payload.action || payload.pull_request) {
      return RepoType.GITHUB;
    }
    
    // 检查 Gerrit
    if (payload.type || payload.change) {
      return RepoType.GERRIT;
    }
    
    // 默认返回 GitLab
    return RepoType.GITLAB;
  }

  // ==================== GitLab 事件映射 ====================

  /** 将 GitLab 事件类型映射到统一类型 */
  private mapGitLabEventType(payload: any): WebhookEventType | null {
    const kind = payload.object_kind;
    const event = payload.event_type;

    switch (kind) {
      case 'merge_request':
        switch (payload.object_attributes?.action) {
          case 'open':
            return WebhookEventType.PR_OPENED;
          case 'update':
            if (payload.object_attributes?.oldrev) {
              return WebhookEventType.PR_UPDATED;
            }
            return WebhookEventType.PR_UPDATED;
          case 'merge':
            return WebhookEventType.PR_MERGED;
          case 'close':
            return WebhookEventType.PR_CLOSED;
          default: {
            // 根据状态判断
            const state = payload.object_attributes?.state;
            switch (state) {
              case 'opened': return WebhookEventType.PR_OPENED;
              case 'merged': return WebhookEventType.PR_MERGED;
              case 'closed': return WebhookEventType.PR_CLOSED;
              default: return WebhookEventType.PR_UPDATED;
            }
          }
        }
      case 'push':
        return WebhookEventType.PUSH;
      case 'note':
        return WebhookEventType.PR_REVIEWED;
      default:
        return null;
    }
  }

  /** 将 GitLab 载荷转换为统一格式 */
  private convertGitLabPayload(
    payload: any,
    eventType: WebhookEventType
  ): CodeRepoWebhookPayload {
    const repo = payload.project || payload.repository || {};
    const basePayload: CodeRepoWebhookPayload = {
      eventType,
      repoType: RepoType.GITLAB,
      repositoryId: String(repo.id || ''),
      repositoryName: repo.name || '',
      repositoryUrl: repo.web_url || repo.html_url || '',
      sender: payload.user_username || payload.user_name || '',
      repository: {
        id: String(repo.id || ''),
        name: repo.name || '',
        fullName: repo.path_with_namespace || repo.full_name || '',
        url: repo.web_url || repo.html_url || '',
      },
      rawPayload: payload,
      timestamp: new Date(),
      payload: payload as Record<string, unknown>,
    };

    // 添加 PR/MR 信息
    if (payload.object_kind === 'merge_request' || payload.object_attributes?.url?.includes('merge_requests')) {
      const mr = payload.object_attributes || {};
      basePayload.pullRequest = {
        id: String(mr.iid || mr.id || ''),
        externalId: String(mr.iid || ''),
        title: mr.title || '',
        sourceBranch: mr.source_branch || mr.source?.branch || '',
        targetBranch: mr.target_branch || mr.target?.branch || '',
        author: payload.user?.username || payload.user?.name || '',
        status: this.mapGitLabStateToStatus(mr.state),
        url: mr.url,
      };
    }

    // 添加 Push 信息
    if (payload.object_kind === 'push') {
      basePayload.push = {
        ref: payload.ref || '',
        sha: payload.after || payload.checkout_sha || '',
        author: payload.user_name || payload.user?.username || '',
        message: payload.commits?.[0]?.message || '',
      };
    }

    return basePayload;
  }

  /** 将 GitLab 状态映射为统一状态 */
  private mapGitLabStateToStatus(state?: string): PullRequestStatus {
    switch (state) {
      case 'opened': return PullRequestStatus.OPEN;
      case 'merged': return PullRequestStatus.MERGED;
      case 'closed': return PullRequestStatus.CLOSED;
      default: return PullRequestStatus.OPEN;
    }
  }

  // ==================== Gerrit 事件映射 ====================

  /** 将 Gerrit 事件类型映射到统一类型 */
  private mapGerritEventType(payload: any): WebhookEventType | null {
    const type = payload.type || payload.eventType;

    switch (type) {
      case 'change-merged':
        return WebhookEventType.PR_MERGED;
      case 'change-abandoned':
        return WebhookEventType.PR_CLOSED;
      case 'change-restored':
      case 'change-created':
        return WebhookEventType.PR_OPENED;
      case 'comment-added':
        return WebhookEventType.PR_REVIEWED;
      case 'ref-updated':
        return WebhookEventType.PUSH;
      case 'patchset-created':
        return WebhookEventType.PR_UPDATED;
      default:
        return null;
    }
  }

  /** 将 Gerrit 载荷转换为统一格式 */
  private convertGerritPayload(
    payload: any,
    eventType: WebhookEventType
  ): CodeRepoWebhookPayload {
    const project = payload.project || {};
    const change = payload.change || {};

    const basePayload: CodeRepoWebhookPayload = {
      eventType,
      repoType: RepoType.GERRIT,
      repositoryId: project.name || '',
      repositoryName: (project.name || '').split('/').pop() || '',
      repositoryUrl: project.url || '',
      sender: payload.uploader || payload.author || '',
      repository: {
        id: project.name || '',
        name: (project.name || '').split('/').pop() || '',
        fullName: project.name || '',
        url: project.url || '',
      },
      rawPayload: payload,
      timestamp: new Date(),
      payload: payload as Record<string, unknown>,
    };

    // 添加 Change 信息
    if (change.id || change.number) {
      basePayload.pullRequest = {
        id: String(change.number || change.id || ''),
        externalId: change.changeId || change.id || '',
        title: change.subject || '',
        sourceBranch: `refs/changes/${change.number || ''}`,
        targetBranch: change.branch || 'refs/heads/master',
        author: change.owner?.name || payload.author?.name || '',
        status: this.mapGerritStatus(eventType),
      };
    }

    return basePayload;
  }

  /** 将 Gerrit 事件映射为 PR 状态 */
  private mapGerritStatus(eventType: WebhookEventType): PullRequestStatus {
    switch (eventType) {
      case WebhookEventType.PR_MERGED:
        return PullRequestStatus.MERGED;
      case WebhookEventType.PR_CLOSED:
        return PullRequestStatus.CLOSED;
      default:
        return PullRequestStatus.OPEN;
    }
  }

  // ==================== GitHub 事件映射 ====================

  /** 将 GitHub 事件类型映射到统一类型 */
  private mapGitHubEventType(payload: any): WebhookEventType | null {
    const action = payload.action;

    switch (action) {
      case 'opened':
        return WebhookEventType.PR_OPENED;
      case 'edited':
      case 'synchronize':
        return WebhookEventType.PR_UPDATED;
      case 'closed':
        return payload.pull_request?.merged ? WebhookEventType.PR_MERGED : WebhookEventType.PR_CLOSED;
      case 'review_requested':
      case 'review_submitted':
        return WebhookEventType.PR_REVIEWED;
      default:
        return null;
    }
  }

  /** 将 GitHub 载荷转换为统一格式 */
  private convertGitHubPayload(
    payload: any,
    eventType: WebhookEventType
  ): CodeRepoWebhookPayload {
    const repo = payload.repository || {};
    const pr = payload.pull_request || {};

    const basePayload: CodeRepoWebhookPayload = {
      eventType,
      repoType: RepoType.GITHUB,
      repositoryId: String(repo.id || ''),
      repositoryName: repo.name || '',
      repositoryUrl: repo.html_url || '',
      sender: payload.sender?.login || '',
      repository: {
        id: String(repo.id || ''),
        name: repo.name || '',
        fullName: repo.full_name || '',
        url: repo.html_url || '',
      },
      rawPayload: payload,
      timestamp: new Date(),
      payload: payload as Record<string, unknown>,
    };

    if (pr.number || pr.id) {
      basePayload.pullRequest = {
        id: String(pr.number || pr.id || ''),
        externalId: String(pr.number || ''),
        title: pr.title || '',
        sourceBranch: pr.head?.ref || '',
        targetBranch: pr.base?.ref || '',
        author: pr.user?.login || '',
        status: this.mapGitHubStateToStatus(pr.state, pr.merged),
        url: pr.html_url,
      };
    }

    return basePayload;
  }

  /** 将 GitHub 状态映射为统一状态 */
  private mapGitHubStateToStatus(
    state?: string,
    merged?: boolean
  ): PullRequestStatus {
    if (merged) return PullRequestStatus.MERGED;
    switch (state) {
      case 'open': return PullRequestStatus.OPEN;
      case 'closed': return PullRequestStatus.CLOSED;
      default: return PullRequestStatus.OPEN;
    }
  }

  // ==================== 事件日志 ====================

  /** 记录事件 */
  private logEvent(
    payload: CodeRepoWebhookPayload,
    eventId: string,
    success: boolean,
    error?: string
  ): void {
    const entry: EventLogEntry = {
      id: uuidv4(),
      eventType: payload.eventType as any,
      repoType: payload.repoType as any,
      repoName: (payload.repository as any)?.fullName || payload.repositoryName,
      eventId,
      timestamp: new Date(),
      success,
      error,
    };

    this.eventLog.push(entry);

    // 只保留最近 1000 条日志 (in-memory cache)
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }

    // Persist to PostgreSQL (fire-and-forget)
    this.eventLogRepo?.create({
      id: entry.id,
      event_type: entry.eventType,
      repo_type: entry.repoType,
      repo_name: entry.repoName,
      event_id: entry.eventId,
      success: entry.success,
      error: entry.error || null,
      tenant_id: 'default',
    }).catch((err) => console.warn('[WebhookService] Failed to persist event log:', err));
  }

  /** 获取事件日志 */
  getEventLog(options?: {
    eventType?: WebhookEventType;
    repoType?: RepoType;
    limit?: number;
  }): EventLogEntry[] {
    let result = [...this.eventLog];

    if (options?.eventType) {
      result = result.filter(e => e.eventType === options.eventType);
    }
    if (options?.repoType) {
      result = result.filter(e => e.repoType === options.repoType);
    }

    const limit = options?.limit || 50;
    return result.slice(-limit);
  }
}

/** 生成 UUID */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
