/**
 * WebhookNotifier - 外部 Webhook 通知器
 *
 * 负责在 Pipeline 状态变更时向外部系统发送 Webhook 通知。
 * 内部复用 HookChainService 的 WebhookExecutor 模式（HTTP 调用），
 * 但专为 Pipeline 事件场景设计，提供：
 *
 * - 指数退避重试（默认 3 次）
 * - HMAC-SHA256 签名验证
 * - 事件过滤（只发送订阅的事件类型）
 * - 错误隔离（Webhook 失败不影响 Pipeline 状态）
 *
 * 设计原则：
 * - Webhook 发送失败不应影响 Pipeline 的正常执行状态
 * - 所有错误被捕获并记录日志，不会向上抛出
 * - 支持多个 Webhook 配置并行发送
 */

import crypto from 'crypto';
import pino from 'pino';
import { pipelineCircuitBreaker } from '../circuit-breaker/pipeline-circuit-breaker';
import { OrionError } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// 接口定义
// ============================================================================

export type WebhookEventType =
  | 'pipeline.complete'
  | 'pipeline.failed'
  | 'pipeline.cancelled';

export interface WebhookConfig {
  /** Webhook 目标 URL */
  url: string;
  /** HTTP 方法，默认 POST */
  method?: 'POST' | 'PUT' | 'PATCH';
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** HMAC 签名密钥（可选） */
  secret?: string;
  /** 订阅的事件类型列表，未设置则发送所有事件 */
  events?: WebhookEventType[];
  /** 最大重试次数，默认 3 */
  retries?: number;
}

export interface StageSummary {
  name: string;
  status: string;
  durationMs: number;
}

export interface WebhookPayload {
  /** 事件类型 */
  eventType: WebhookEventType;
  /** Pipeline Run ID */
  runId: string;
  /** Pipeline ID */
  pipelineId: string;
  /** 最终状态 */
  status: 'success' | 'failed' | 'cancelled';
  /** 事件时间戳 */
  timestamp: Date;
  /** 执行耗时 (ms) */
  durationMs?: number;
  /** Stages 摘要 */
  stagesSummary?: StageSummary[];
  /** 触发人 */
  triggerBy?: string;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// HMAC 签名工具函数（导出供测试使用）
// ============================================================================

/**
 * 生成 HMAC-SHA256 签名
 * @param secret 签名密钥
 * @param payload 待签名的 JSON 字符串
 * @returns 十六进制签名字符串
 */
export function generateHmacSignature(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// ============================================================================
// WebhookNotifier 主类
// ============================================================================

export class WebhookNotifier {
  /**
   * 判断给定配置是否应该发送该事件
   */
  shouldSend(config: WebhookConfig, payload: WebhookPayload): boolean {
    // 未配置 events 过滤器（undefined）时，发送所有事件
    if (config.events === undefined) {
      return true;
    }
    // 空数组表示不发送任何事件
    if (config.events.length === 0) {
      return false;
    }
    return config.events.includes(payload.eventType);
  }

  /**
   * 发送单个 Webhook 通知
   *
   * 发送失败会被捕获并记录日志，不会抛出异常，确保不影响 Pipeline 状态。
   * 支持指数退避重试。
   */
  async sendWebhook(config: WebhookConfig, payload: WebhookPayload): Promise<void> {
    const maxRetries = config.retries ?? 3;
    const body = JSON.stringify(this.buildRequestBody(payload));

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.doSend(config, body);
        logger.info(
          { url: config.url, runId: payload.runId, eventType: payload.eventType, attempt },
          'Webhook notification sent successfully'
        );
        return; // 成功，直接返回
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (attempt < maxRetries) {
          // 指数退避：1s, 2s, 4s, 8s...（带 jitter）
          const delayMs = this.calculateBackoff(attempt);
          logger.warn(
            { url: config.url, runId: payload.runId, attempt, maxRetries, delayMs, error: errorMsg },
            'Webhook sending failed, retrying with backoff'
          );
          await this.sleep(delayMs);
        } else {
          // 所有重试耗尽，记录错误但不抛出
          logger.error(
            { url: config.url, runId: payload.runId, eventType: payload.eventType, attempts: attempt + 1, error: errorMsg },
            'Webhook notification failed after all retries (non-fatal, pipeline status unaffected)'
          );
        }
      }
    }
  }

  /**
   * 批量发送 Webhook 通知到多个配置
   * 所有通知并行发送，互不影响
   */
  async sendAll(configs: WebhookConfig[], payload: WebhookPayload): Promise<void> {
    // 过滤出匹配事件的配置
    const matchingConfigs = configs.filter(config => this.shouldSend(config, payload));

    if (matchingConfigs.length === 0) {
      logger.debug({ eventType: payload.eventType }, 'No matching webhook configs for event');
      return;
    }

    // 并行发送，互不影响
    const promises = matchingConfigs.map(async (config) => {
      await this.sendWebhook(config, payload);
    });

    await Promise.allSettled(promises);
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 构建发送给 Webhook 的请求体
   */
  private buildRequestBody(payload: WebhookPayload): Record<string, unknown> {
    return {
      eventType: payload.eventType,
      runId: payload.runId,
      pipelineId: payload.pipelineId,
      status: payload.status,
      timestamp: payload.timestamp.toISOString(),
      durationMs: payload.durationMs,
      stagesSummary: payload.stagesSummary,
      triggerBy: payload.triggerBy,
      metadata: payload.metadata,
    };
  }

  /**
   * 执行单次 HTTP 请求 (F004: 通过熔断器保护)
   */
  private async doSend(config: WebhookConfig, body: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.headers || {}),
    };

    // 如果配置了 secret，添加 HMAC 签名
    if (config.secret) {
      const signature = generateHmacSignature(config.secret, body);
      headers['X-Webhook-Signature'] = signature;
      headers['X-Webhook-Signature-Algorithm'] = 'sha256';
    }

    // F004: 通过熔断器执行 webhook 调用
    await pipelineCircuitBreaker.execute('notification', this.extractProvider(config.url), async () => {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        throw new OrionError(`Webhook returned ${response.status} ${response.statusText}`, 'OPERATION_FAILED')
      }

      try {
        await response.json();
      } catch {
        // 忽略解析错误
      }
    });
  }

  /**
   * Extract notification provider name from webhook URL hostname.
   * e.g., https://hooks.slack.com/... → 'slack'
   */
  private extractProvider(url: string): string {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname.includes('slack')) return 'slack';
      if (hostname.includes('dingtalk') || hostname.includes('ding')) return 'dingtalk';
      if (hostname.includes('wecom') || hostname.includes('wechat')) return 'wecom';
      if (hostname.includes('lark') || hostname.includes('feishu')) return 'lark';
      if (hostname.includes('teams') || hostname.includes('microsoft')) return 'teams';
      // Use hostname as provider fallback
      return hostname.split('.')[0];
    } catch {
      return 'unknown';
    }
  }

  /**
   * 计算指数退避延迟（带 jitter）
   * 公式: min(baseDelay * 2^attempt, maxDelay) * jitter
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000; // 1 秒
    const maxDelay = 30000; // 最大 30 秒
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // 添加 50%~100% 的 jitter 避免惊群效应
    const jitter = 0.5 + Math.random() * 0.5;
    return Math.round(delay * jitter);
  }

  /**
   * 延迟辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
