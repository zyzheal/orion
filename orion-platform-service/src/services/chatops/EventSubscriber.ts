/**
 * ChatOps Event Subscriber
 *
 * 双层事件总线架构:
 * - 外层: EventBusService.subscribe() → NATS 订阅外部事件 (alert/pipeline/selfhealing)
 * - 内层: EventEmitter (localBus) → 内部组件通信 (SSE 推荐面板)
 *
 * ChatOpsEventSubscriber 作为桥梁: NATS 事件 → localBus 分发
 */

import { EventEmitter } from 'events';
import { EventBusService } from '../event-bus-service';

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

export class ChatOpsEventSubscriber {
  private eventBus: EventBusService;
  private localBus: EventEmitter = new EventEmitter();
  private activeRecommendations: Map<string, ChatOpsRecommendation> = new Map();
  private unsubscribeFns: Array<() => Promise<void>> = [];

  private readonly RECOMMENDATION_TTL_MS = 30 * 60 * 1000; // 推荐项 TTL: 30 分钟
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
    // 每 10 分钟清理过期推荐，防止 Map 无限增长
    this.cleanupTimer = setInterval(() => this.cleanExpiredRecommendations(), 10 * 60 * 1000);
    // 确保定时器不会阻止进程退出
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  /**
   * 初始化: 订阅所有相关外部事件
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
        const unsub = await this.eventBus.subscribe(event, async (rawEvent: EventBusPayload) => {
          // NATS 事件格式: { type, data, source, timestamp }
          // data 在 payload.data 中，若不存在则整个 payload 就是 data
          const payload = rawEvent.data || rawEvent;
          handler(payload);
        });
        this.unsubscribeFns.push(unsub);
      } catch (err) {
        console.warn(`[ChatOpsEventSubscriber] Failed to subscribe to ${event}:`, err);
      }
    }
  }

  // ==================== Alert Events ====================

  private handleAlertCreated(data: EventBusPayload): void {
    const alertId = String(data.alertId || data.id || '');
    if (!alertId) return;

    this.activeRecommendations.set(alertId, {
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
    });

    this.emitRecommendationUpdate();
  }

  private handleAlertAcknowledged(data: EventBusPayload): void {
    const alertId = String(data.alertId || data.id || '');
    if (alertId) this.activeRecommendations.delete(alertId);
    this.emitRecommendationUpdate();
  }

  private handleAlertDismissed(data: EventBusPayload): void {
    const alertId = String(data.alertId || data.id || '');
    if (alertId) this.activeRecommendations.delete(alertId);
    this.emitRecommendationUpdate();
  }

  // ==================== Pipeline Events ====================

  private handlePipelineCompleted(data: EventBusPayload): void {
    // 仅关注失败的 pipeline
    if (data.status === 'success' || data.status === 'completed') return;

    const key = `pipeline:${data.runId || data.pipelineId || 'unknown'}`;
    this.activeRecommendations.set(key, {
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
    });

    this.emitRecommendationUpdate();
  }

  private handlePipelineBlocked(data: EventBusPayload): void {
    const key = `pipeline:${data.runId || data.pipelineId || 'unknown'}`;
    this.activeRecommendations.set(key, {
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
    });

    this.emitRecommendationUpdate();
  }

  // ==================== Deploy Events ====================

  private handleDeployFinished(data: EventBusPayload): void {
    if (data.status !== 'failed') return;

    const key = `deploy:${data.deploymentId || 'unknown'}`;
    this.activeRecommendations.set(key, {
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
    });

    this.emitRecommendationUpdate();
  }

  // ==================== Self-Healing Events ====================

  private handleSelfHealingFailed(data: EventBusPayload): void {
    const key = `selfhealing:${data.policyId || 'unknown'}`;
    this.activeRecommendations.set(key, {
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
    });

    this.emitRecommendationUpdate();
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

  /** 清理过期推荐项，防止 Map 无限增长 */
  private cleanExpiredRecommendations(): void {
    const now = Date.now();
    for (const [key, rec] of this.activeRecommendations.entries()) {
      if (now - rec.createdAt.getTime() > this.RECOMMENDATION_TTL_MS) {
        this.activeRecommendations.delete(key);
      }
    }
  }

  /** 清理所有订阅 */
  async cleanup(): Promise<void> {
    // 停止 TTL 清理定时器
    clearInterval(this.cleanupTimer);
    for (const unsub of this.unsubscribeFns) {
      try { await unsub(); } catch {}
    }
    this.unsubscribeFns = [];
    this.localBus.removeAllListeners();
    this.activeRecommendations.clear();
  }
}
