/**
 * Self-Healing Event Publisher - 发布自愈相关事件
 *
 * 使用 EventBusAdapter 统一接口，符合 CloudEvents 1.0 规范
 * ARCH-010: 重构使用 EventBusAdapter 消除接口适配冗余
 * Critical Fix: 添加异常处理，防止事件发布失败中断主服务
 */

import { EventBusAdapter, PublishOptions, PublishResult } from './EventBusAdapter';
import { EventBusService } from '../services/event-bus-service';
import {
  SelfHealingEventType,
  SelfHealingSeverity,
  SelfHealingActionType,
  SelfHealingIncidentType,
  SelfHealingIncidentDetectedEventData,
  SelfHealingStartedEventData,
  SelfHealingActionExecutedEventData,
  SelfHealingCompletedEventData,
  SelfHealingFailedEventData,
  SelfHealingApprovalRequestedEventData,
  SelfHealingApprovalRespondedEventData,
  SelfHealingIncidentEscalatedEventData,
  SelfHealingEventExtensions,
} from './types/selfhealing';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Fallback 日志目录
const FALLBACK_LOG_DIR = process.env.EVENT_FALLBACK_LOG_DIR || '/tmp/orion-events';

/**
 * 事件发布器配置
 */
export interface SelfHealingEventPublisherConfig {
  /** EventBusService 实例 (ARCH-010: 统一使用 EventBusService 类型) */
  eventBus?: EventBusService | null;
  /** 事件源标识 */
  source?: string;
  /** 默认租户 ID */
  defaultTenantId?: string;
  /** 默认用户 ID */
  defaultUserId?: string;
}

/**
 * Self-Healing 事件发布器
 *
 * ARCH-010: 使用 EventBusAdapter 统一接口
 * 负责将自愈相关事件发布到 NATS JetStream 事件总线
 * Critical Fix: 所有 publish 方法包含异常处理，失败时写入 fallback 日志
 */
export class SelfHealingEventPublisher {
  private adapter: EventBusAdapter;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;
  private fallbackEnabled: boolean;

  constructor(config?: SelfHealingEventPublisherConfig) {
    this.source = config?.source || 'self-healing-service';
    this.defaultTenantId = config?.defaultTenantId;
    this.defaultUserId = config?.defaultUserId;
    this.fallbackEnabled = true; // 默认启用 fallback
    this.adapter = new EventBusAdapter({
      eventBus: config?.eventBus,
      defaultSource: this.source,
      defaultTenantId: this.defaultTenantId,
      defaultUserId: this.defaultUserId,
    });

    // 确保 fallback 日志目录存在
    this.ensureFallbackLogDir();
  }

  /**
   * 确保 fallback 日志目录存在
   */
  private ensureFallbackLogDir(): void {
    try {
      if (!fs.existsSync(FALLBACK_LOG_DIR)) {
        fs.mkdirSync(FALLBACK_LOG_DIR, { recursive: true });
      }
    } catch (error) {
      logger.error({
        msg: 'Failed to create fallback log directory',
        dir: FALLBACK_LOG_DIR,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 设置事件总线
   * ARCH-010: 通过 Adapter 设置
   */
  setEventBus(eventBus: EventBusService): void {
    this.adapter.setEventBus(eventBus);
  }

  /**
   * 获取 Adapter (用于检查连接状态)
   */
  getAdapter(): EventBusAdapter {
    return this.adapter;
  }

  /**
   * 安全发布事件 - 包装异常处理
   * Critical Fix: 事件发布失败时记录日志但不中断主流程
   */
  private async safePublish(
    eventType: SelfHealingEventType,
    data: Record<string, unknown>,
    options?: PublishOptions
  ): Promise<PublishResult> {
    try {
      const result = await this.adapter.publish(eventType, data, options);
      return result;
    } catch (error) {
      // 记录错误但不抛出异常
      logger.error({
        msg: 'Event publish failed, using fallback',
        eventType,
        source: options?.source || this.source,
        tenantId: options?.tenantId || this.defaultTenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // 写入 fallback 日志文件（异步）
      if (this.fallbackEnabled) {
        await this.writeToFallbackLogAsync(eventType, data, options, error);
      }

      // 返回失败结果（但不抛出异常）
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Event publish failed',
        eventId: `fallback-${Date.now()}`,
      };
    }
  }

  /**
   * 写入 fallback 日志文件
   * 当事件总线不可用时，将事件写入本地文件以便后续恢复
   * Major Fix: 使用异步写入避免阻塞主线程
   */
  private async writeToFallbackLogAsync(
    eventType: SelfHealingEventType,
    data: Record<string, unknown>,
    options?: PublishOptions,
    error?: unknown
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        eventType,
        source: options?.source || this.source,
        tenantId: options?.tenantId || this.defaultTenantId,
        userId: options?.userId || this.defaultUserId,
        traceId: options?.traceId,
        data,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
        } : String(error),
        recovered: false,
      };

      const fileName = `events-${timestamp.split('T')[0]}.log`;
      const filePath = path.join(FALLBACK_LOG_DIR, fileName);
      const logLine = JSON.stringify(logEntry) + '\n';

      await fs.promises.appendFile(filePath, logLine, { encoding: 'utf8' });

      logger.info({
        msg: 'Event written to fallback log',
        eventType,
        filePath,
      });
    } catch (fallbackError) {
      logger.error({
        msg: 'Failed to write fallback log',
        eventType,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }
  }

  /**
   * 发布 self-healing.incident_detected 事件
   */
  async publishIncidentDetected(
    data: SelfHealingIncidentDetectedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.safePublish('self-healing.incident_detected', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.healing_started 事件
   */
  async publishHealingStarted(
    data: SelfHealingStartedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.safePublish('self-healing.healing_started', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.action_executed 事件
   */
  async publishActionExecuted(
    data: SelfHealingActionExecutedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.safePublish('self-healing.action_executed', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.healing_completed 事件
   */
  async publishHealingCompleted(
    data: SelfHealingCompletedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.safePublish('self-healing.healing_completed', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.healing_failed 事件
   */
  async publishHealingFailed(
    data: SelfHealingFailedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.safePublish('self-healing.healing_failed', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.approval_requested 事件
   */
  async publishApprovalRequested(
    data: SelfHealingApprovalRequestedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.safePublish('self-healing.approval_requested', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.approval_responded 事件
   */
  async publishApprovalResponded(
    data: SelfHealingApprovalRespondedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.safePublish('self-healing.approval_responded', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.incident_escalated 事件
   */
  async publishIncidentEscalated(
    data: SelfHealingIncidentEscalatedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.safePublish('self-healing.incident_escalated', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 转换 SelfHealingEventExtensions 为 PublishOptions
   */
  private toPublishOptions(extensions?: SelfHealingEventExtensions): PublishOptions {
    return {
      source: this.source,
      tenantId: extensions?.tenantId || this.defaultTenantId,
      userId: extensions?.userId || this.defaultUserId,
      traceId: extensions?.traceId,
      priority: extensions?.priority,
      version: extensions?.version,
    };
  }

  /**
   * 检查连接是否可用
   */
  isAvailable(): boolean {
    return this.adapter.isAvailable();
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): string {
    return this.adapter.getConnectionState();
  }
}

// 导出单例
export const selfHealingEventPublisher = new SelfHealingEventPublisher();