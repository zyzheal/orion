/**
 * ChatOps Event Subscriber
 *
 * 双层事件总线架构:
 * - 外层: EventBusService.subscribe() → NATS 订阅外部事件 (alert/pipeline/selfhealing)
 * - 内层: EventEmitter (localBus) → 内部组件通信 (SSE 推荐面板)
 *
 * ChatOpsEventSubscriber 作为桥梁: NATS 事件 → localBus 分发
 *
 * ARCH-003: 订阅失败不再静默，而是采用 fallback 策略：
 * 1. NATS 不可用：定时轮询数据库事件表（fallback_poll 模式）
 * 2. 订阅失败：记录失败并等待 NATS 重连后重新订阅
 *
 * Migrated from Map() to PostgreSQL Repository pattern.
 */

import { EventEmitter } from 'events';
import { EventBusService, EventBusError } from '../event-bus-service';
import { ChatOpsRecommendationRepository } from '../../repositories/ChatOpsRecommendationRepository';
import { ChatOpsSubscriptionFailureRepository } from '../../repositories/ChatOpsSubscriptionFailureRepository';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('EventSubscriber');

export interface ChatOpsRecommendation {
  id: string;
  type: 'alert' | 'blocked' | 'deploy_result' | 'selfhealing' | 'cost_anomaly';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  createdAt: Date;
  source: string;
}

interface EventBusPayload {
  type?: string;
  data?: Record<string, unknown>;
  source?: string;
  timestamp?: string;
  // 兼容直接传递 data 的场景
  [key: string]: unknown;
}

/** 订阅失败记录 */
interface SubscriptionFailure {
  event: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

export class ChatOpsEventSubscriber {
  private eventBus: EventBusService;
  private localBus: EventEmitter = new EventEmitter();
  private recommendationRepo: ChatOpsRecommendationRepository | null;
  private subscriptionFailureRepo: ChatOpsSubscriptionFailureRepository | null;
  private tenantId: string | null;
  /** In-memory cache for fast access (sync with DB) */
  private activeRecommendations: Map<string, ChatOpsRecommendation> = new Map();
  private unsubscribeFns: Array<() => Promise<void>> = [];
  /** ARCH-003: In-memory cache of subscription failures */
  private subscriptionFailures: Map<string, SubscriptionFailure> = new Map();
  /** ARCH-003: Fallback 轮询定时器 */
  private fallbackPollTimer: ReturnType<typeof setInterval> | null = null;

  private readonly RECOMMENDATION_TTL_MS = 30 * 60 * 1000; // 推荐项 TTL: 30 分钟
  private cleanupTimer: ReturnType<typeof setInterval>;
  /** ARCH-003: Fallback 轮询间隔 */
  private readonly FALLBACK_POLL_INTERVAL_MS = 5_000;

  constructor(
    eventBus: EventBusService,
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tenantId?: string,
  ) {
    this.eventBus = eventBus;
    this.recommendationRepo = db ? new ChatOpsRecommendationRepository(db) : null;
    this.subscriptionFailureRepo = db ? new ChatOpsSubscriptionFailureRepository(db) : null;
    this.tenantId = tenantId ?? null;
    // 每 10 分钟清理过期推荐，防止无限增长
    this.cleanupTimer = setInterval(() => this.cleanExpiredRecommendations(), 10 * 60 * 1000);
    // 确保定时器不会阻止进程退出
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }

    // ARCH-003: 监听 EventBus 状态变化，自动切换 fallback 模式
    this.eventBus.on('fallback', () => {
      logger.info('[ChatOpsEventSubscriber] EventBus in fallback mode, starting fallback polling');
      this.startFallbackPolling();
    });

    this.eventBus.on('connect', () => {
      logger.info('[ChatOpsEventSubscriber] EventBus connected, stopping fallback polling');
      this.stopFallbackPolling();
      // ARCH-003: 重连后重试失败的订阅
      this.retryFailedSubscriptions();
    });

    // Load existing recommendations from DB on startup
    this.loadFromDB();
  }

  /** Load active recommendations and unresolved failures from DB */
  private async loadFromDB(): Promise<void> {
    try {
      const recs = await this.recommendationRepo?.findActive(this.tenantId ?? undefined) ?? [];
      for (const rec of recs) {
        this.activeRecommendations.set(rec.id, {
          id: rec.id,
          type: rec.type as ChatOpsRecommendation['type'],
          severity: rec.severity as ChatOpsRecommendation['severity'],
          title: rec.title,
          description: rec.description ?? '',
          actions: rec.actions,
          createdAt: rec.createdAt,
          source: rec.source ?? '',
        });
      }

      const failures = await this.subscriptionFailureRepo?.findUnresolved(this.tenantId ?? undefined) ?? [];
      for (const f of failures) {
        this.subscriptionFailures.set(f.eventType, {
          event: f.eventType,
          error: f.errorMessage,
          timestamp: f.lastRetryAt,
          retryCount: f.retryCount,
        });
      }

      logger.info(`[ChatOpsEventSubscriber] Loaded ${recs.length} recommendations, ${failures.length} failures from DB`);
    } catch (err) {
      logger.warn('[ChatOpsEventSubscriber] Failed to load from DB:', err);
    }
  }

  /**
   * 初始化: 订阅所有相关外部事件
   * ARCH-003: 订阅失败记录并等待重连后重试
   */
  async initialize(): Promise<void> {
    const subscriptions: Array<{ event: string; handler: (data: EventBusPayload) => void }> = [
      { event: 'alert.created', handler: (d) => this.handleAlertCreated(d) },
      { event: 'alert.acknowledged', handler: (d) => this.handleAlertAcknowledged(d) },
      { event: 'alert.dismissed', handler: (d) => this.handleAlertDismissed(d) },
      { event: 'pipeline.run.completed', handler: (d) => this.handlePipelineCompleted(d) },
      { event: 'pipeline.run.blocked', handler: (d) => this.handlePipelineBlocked(d) },
      { event: 'deploy.finished', handler: (d) => this.handleDeployFinished(d) },
      { event: 'selfhealing.failed', handler: (d) => this.handleSelfHealingFailed(d) },
    ];

    for (const { event, handler } of subscriptions) {
      try {
        const unsub = await this.eventBus.subscribe(event, async (typedEvent) => {
          // TypedEnvelope format: { type, data, source, time, specversion, ... }
          const payload = typedEvent.data || typedEvent;
          handler(payload);
        });
        this.unsubscribeFns.push(unsub);
        // ARCH-003: 订阅成功后清除失败记录
        this.subscriptionFailures.delete(event);
        this.subscriptionFailureRepo?.markResolved(event).catch((err) => logger.warn({ err, event }, '[EventSubscriber] Failed to mark subscription resolved'));
      } catch (err: unknown) {
        // ARCH-003: 记录订阅失败，而非静默忽略
        const errorMsg = err instanceof EventBusError
          ? `${err.code}: ${err.message}`
          : (err instanceof Error ? err.message : 'Unknown error');

        const existing = this.subscriptionFailures.get(event);
        this.subscriptionFailures.set(event, {
          event,
          error: errorMsg,
          timestamp: new Date(),
          retryCount: existing ? existing.retryCount + 1 : 1,
        });

        // Persist to DB (fire-and-forget)
        this.subscriptionFailureRepo?.upsertFailure(event, errorMsg, this.tenantId ?? undefined)
          .catch((err) => logger.warn({ err, event }, '[EventSubscriber] Failed to persist subscription failure'));

        logger.warn(`[ChatOpsEventSubscriber] Failed to subscribe to ${event}:`, errorMsg);

        // ARCH-003: 根据错误类型决定策略
        if (err instanceof EventBusError) {
          if (err.code === 'DISABLED') {
            // EventBus 禁用，无需 fallback
            logger.info(`[ChatOpsEventSubscriber] EventBus disabled, skipping subscription to ${event}`);
          } else if (err.code === 'NOT_CONNECTED' && err.recoverable) {
            // NATS 未连接但可恢复，启动 fallback 轮询
            this.startFallbackPolling();
          }
        }
      }
    }

    // ARCH-003: 如果有订阅失败且处于 fallback 模式，启动轮询
    if (this.subscriptionFailures.size > 0 && this.eventBus.isFallback()) {
      this.startFallbackPolling();
    }
  }

  /**
   * ARCH-003: 启动 fallback 轮询（从数据库读取事件）
   */
  private startFallbackPolling(): void {
    if (this.fallbackPollTimer) return;  // 已启动

    logger.info('[ChatOpsEventSubscriber] Starting fallback polling for events');
    this.fallbackPollTimer = setInterval(async () => {
      await this.pollEventsFromDB();
    }, this.FALLBACK_POLL_INTERVAL_MS);

    if (typeof this.fallbackPollTimer.unref === 'function') {
      this.fallbackPollTimer.unref();
    }
  }

  /**
   * ARCH-003: 停止 fallback 轮询
   */
  private stopFallbackPolling(): void {
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
      logger.info('[ChatOpsEventSubscriber] Stopped fallback polling');
    }
  }

  /**
   * ARCH-003: 从数据库轮询 pending_fallback 状态的事件
   */
  private async pollEventsFromDB(): Promise<void> {
    try {
      const repos = this.eventBus.getRepositories();
      if (!repos.eventRepo) return;

      // 查询 pending_fallback 状态的事件
      const pendingEvents = await repos.eventRepo.findByStatus('pending_fallback', { limit: 10 });
      for (const event of pendingEvents) {
        try {
          const payload = event.payload as EventBusPayload;
          const handler = this.getHandlerForEvent(event.eventType);  // 使用 eventType 属性
          if (handler) {
            handler(payload.data || payload);
          }
          // 更新状态为 delivered
          await repos.eventRepo.updateStatus(event.id, 'delivered');
        } catch (err) {
          logger.warn('[ChatOpsEventSubscriber] Failed to process fallback event:', err);
        }
      }
    } catch (err) {
      logger.warn('[ChatOpsEventSubscriber] Fallback poll failed:', err);
    }
  }

  /**
   * ARCH-003: 根据事件类型获取 handler
   */
  private getHandlerForEvent(eventType: string): ((data: EventBusPayload) => void) | null {
    const handlerMap: Record<string, (data: EventBusPayload) => void> = {
      'alert.created': (d) => this.handleAlertCreated(d),
      'alert.acknowledged': (d) => this.handleAlertAcknowledged(d),
      'alert.dismissed': (d) => this.handleAlertDismissed(d),
      'pipeline.run.completed': (d) => this.handlePipelineCompleted(d),
      'pipeline.run.blocked': (d) => this.handlePipelineBlocked(d),
      'deploy.finished': (d) => this.handleDeployFinished(d),
      'selfhealing.failed': (d) => this.handleSelfHealingFailed(d),
    };
    return handlerMap[eventType] || null;
  }

  /**
   * ARCH-003: 重连后重试失败的订阅
   */
  private async retryFailedSubscriptions(): Promise<void> {
    if (this.subscriptionFailures.size === 0) return;

    logger.info('[ChatOpsEventSubscriber] Retrying failed subscriptions after reconnect');
    const failures = Array.from(this.subscriptionFailures.values());

    for (const failure of failures) {
      if (failure.retryCount >= 3) {
        logger.warn(`[ChatOpsEventSubscriber] Subscription ${failure.event} has exceeded max retries, skipping`);
        continue;
      }

      try {
        const handler = this.getHandlerForEvent(failure.event);
        if (!handler) continue;

        const unsub = await this.eventBus.subscribe(failure.event, async (typedEvent) => {
          const payload = typedEvent.data || typedEvent;
          handler(payload);
        });
        this.unsubscribeFns.push(unsub);
        this.subscriptionFailures.delete(failure.event);
        // Mark resolved in DB
        this.subscriptionFailureRepo?.markResolved(failure.event).catch(() => {});
        logger.info(`[ChatOpsEventSubscriber] Successfully re-subscribed to ${failure.event}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        this.subscriptionFailures.set(failure.event, {
          ...failure,
          error: errorMsg,
          timestamp: new Date(),
          retryCount: failure.retryCount + 1,
        });
        // Update retry count in DB
        this.subscriptionFailureRepo?.incrementRetryCount(failure.event).catch((err) => logger.warn({ err, event: failure.event }, '[EventSubscriber] Failed to increment retry count'));
        logger.warn(`[ChatOpsEventSubscriber] Re-subscription attempt ${failure.retryCount + 1} failed for ${failure.event}:`, errorMsg);
      }
    }
  }

  // ==================== Alert Events ====================

  private handleAlertCreated(data: EventBusPayload): void {
    const alertId = String(data.alertId || data.id || '');
    if (!alertId) return;

    const rec: ChatOpsRecommendation = {
      id: alertId,
      type: 'alert',
      severity: (data.severity as 'critical' | 'warning' | 'info') || 'warning',
      title: String(data.title || '新告警'),
      description: String(data.message || data.description || ''),
      actions: [
        { label: '查看日志', command: 'logs', params: { resource: data.resource } },
        { label: '诊断根因', command: 'diagnose', params: { resource: data.resource } },
        { label: '重启服务', command: 'restart', params: { pod: data.resource } },
      ],
      createdAt: new Date(),
      source: 'monitoring',
    };

    this.activeRecommendations.set(alertId, rec);
    this.persistRecommendation(rec);
    this.emitRecommendationUpdate();
  }

  private handleAlertAcknowledged(data: EventBusPayload): void {
    const alertId = String(data.alertId || data.id || '');
    if (alertId) {
      this.activeRecommendations.delete(alertId);
      this.recommendationRepo?.delete(alertId).catch((err) => logger.warn({ err, alertId }, '[EventSubscriber] Failed to delete recommendation'));
    }
    this.emitRecommendationUpdate();
  }

  private handleAlertDismissed(data: EventBusPayload): void {
    const alertId = String(data.alertId || data.id || '');
    if (alertId) {
      this.activeRecommendations.delete(alertId);
      this.recommendationRepo?.delete(alertId).catch((err) => logger.warn({ err, alertId }, '[EventSubscriber] Failed to delete recommendation'));
    }
    this.emitRecommendationUpdate();
  }

  // ==================== Pipeline Events ====================

  private handlePipelineCompleted(data: EventBusPayload): void {
    // 仅关注失败的 pipeline
    if (data.status === 'success' || data.status === 'completed') return;

    const key = `pipeline:${data.runId || data.pipelineId || 'unknown'}`;
    const rec: ChatOpsRecommendation = {
      id: key,
      type: 'blocked',
      severity: 'warning',
      title: `Pipeline #${data.runId || data.pipelineId} 执行失败`,
      description: String(data.error || data.message || '未知错误'),
      actions: [
        { label: '查看日志', command: 'logs', params: { resource: data.pipelineId } },
        { label: '重新执行', command: 'pipeline', params: { action: 'rerun', id: data.pipelineId } },
      ],
      createdAt: new Date(),
      source: 'pipeline',
    };

    this.activeRecommendations.set(key, rec);
    this.persistRecommendation(rec);
    this.emitRecommendationUpdate();
  }

  private handlePipelineBlocked(data: EventBusPayload): void {
    const key = `pipeline:${data.runId || data.pipelineId || 'unknown'}`;
    const rec: ChatOpsRecommendation = {
      id: key,
      type: 'blocked',
      severity: 'warning',
      title: `Pipeline #${data.runId || data.pipelineId} 等待确认`,
      description: String(data.message || '需要人工干预'),
      actions: [
        { label: '批准', command: 'pipeline', params: { action: 'approve', id: data.pipelineId } },
        { label: '拒绝', command: 'pipeline', params: { action: 'reject', id: data.pipelineId } },
      ],
      createdAt: new Date(),
      source: 'pipeline',
    };

    this.activeRecommendations.set(key, rec);
    this.persistRecommendation(rec);
    this.emitRecommendationUpdate();
  }

  // ==================== Deploy Events ====================

  private handleDeployFinished(data: EventBusPayload): void {
    if (data.status !== 'failed') return;

    const key = `deploy:${data.deploymentId || 'unknown'}`;
    const rec: ChatOpsRecommendation = {
      id: key,
      type: 'deploy_result',
      severity: 'critical',
      title: `部署失败: ${data.service || 'unknown'}`,
      description: String(data.error || data.message || ''),
      actions: [
        { label: '回滚', command: 'rollback', params: { deployment: data.deploymentId } },
        { label: '查看日志', command: 'logs', params: { resource: data.service } },
      ],
      createdAt: new Date(),
      source: 'deploy',
    };

    this.activeRecommendations.set(key, rec);
    this.persistRecommendation(rec);
    this.emitRecommendationUpdate();
  }

  // ==================== Self-Healing Events ====================

  private handleSelfHealingFailed(data: EventBusPayload): void {
    const key = `selfhealing:${data.policyId || 'unknown'}`;
    const rec: ChatOpsRecommendation = {
      id: key,
      type: 'selfhealing',
      severity: 'warning',
      title: `自愈失败: ${data.policyName || 'unknown'}`,
      description: String(data.error || data.message || ''),
      actions: [
        { label: '手动干预', command: 'diagnose', params: { resource: data.service } },
        { label: '查看详情', command: 'status', params: { resource: data.service } },
      ],
      createdAt: new Date(),
      source: 'selfhealing',
    };

    this.activeRecommendations.set(key, rec);
    this.persistRecommendation(rec);
    this.emitRecommendationUpdate();
  }

  // ==================== Persistence Helpers ====================

  /** Persist recommendation to DB (fire-and-forget) */
  private persistRecommendation(rec: ChatOpsRecommendation): void {
    this.recommendationRepo?.create({
      id: rec.id,
      tenant_id: this.tenantId,
      type: rec.type,
      severity: rec.severity,
      title: rec.title,
      description: rec.description,
      actions: rec.actions,
      source: rec.source,
      created_at: rec.createdAt,
    }).catch((err) => {
      logger.warn(`[ChatOpsEventSubscriber] Failed to persist recommendation ${rec.id}:`, err);
    });
  }

  // ==================== Local Bus ====================

  private emitRecommendationUpdate(): void {
    this.localBus.emit('chatops:recommendation_update', {
      recommendations: Array.from(this.activeRecommendations.values()),
    });
  }

  /** 获取本地 EventEmitter (SSE 路由监听这个) */
  getLocalBus(): EventEmitter {
    return this.localBus;
  }

  /** 获取当前活跃推荐 (支持按用户范围过滤) */
  getActiveRecommendations(): ChatOpsRecommendation[] {
    return Array.from(this.activeRecommendations.values());
  }

  /** 按用户权限过滤推荐 (简单实现: 基于 severity 和 role) */
  getFilteredRecommendations(userRole: string): ChatOpsRecommendation[] {
    const recs = this.getActiveRecommendations();
    // viewer 只看 info/warning，不显示 critical 的操作按钮
    if (userRole === 'viewer') {
      return recs.map(r => ({
        ...r,
        actions: r.severity === 'critical' ? [] : r.actions,
      }));
    }
    return recs;
  }

  /** 清理过期推荐项，防止无限增长 */
  private async cleanExpiredRecommendations(): Promise<void> {
    const now = Date.now();
    for (const [key, rec] of this.activeRecommendations.entries()) {
      if (now - rec.createdAt.getTime() > this.RECOMMENDATION_TTL_MS) {
        this.activeRecommendations.delete(key);
      }
    }

    // Also clean expired from DB
    this.recommendationRepo?.cleanExpired(this.RECOMMENDATION_TTL_MS, this.tenantId ?? undefined)
      .catch((err) => logger.warn({ err }, '[EventSubscriber] Failed to clean expired recommendations'));
  }

  /** 清理所有订阅 */
  async cleanup(): Promise<void> {
    // ARCH-003: 停止 fallback 轮询
    this.stopFallbackPolling();

    // 停止 TTL 清理定时器
    clearInterval(this.cleanupTimer);

    for (const unsub of this.unsubscribeFns) {
      try { await unsub(); } catch { /* intentionally empty - ignore unsubscribe errors */ }
    }
    this.unsubscribeFns = [];
    this.localBus.removeAllListeners();
    this.activeRecommendations.clear();
    this.subscriptionFailures.clear();
  }

  /**
   * ARCH-003: 获取订阅失败状态（用于监控）
   */
  getSubscriptionFailures(): SubscriptionFailure[] {
    return Array.from(this.subscriptionFailures.values());
  }

  /**
   * ARCH-003: 获取是否在 fallback 模式运行
   */
  isFallbackMode(): boolean {
    return this.fallbackPollTimer !== null;
  }
}
