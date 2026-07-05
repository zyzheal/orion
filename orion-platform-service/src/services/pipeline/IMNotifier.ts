/**
 * IMNotifier - 即时通讯通知器
 *
 * 负责向钉钉、企业微信、飞书等 IM 平台发送 Pipeline 状态通知。
 * 使用适配器模式支持多种 IM 平台，每个平台通过独立的 Adapter 实现。
 *
 * 设计原则：
 * - 通知发送失败不应影响 Pipeline 的正常执行状态
 * - 支持动态注册新的 IM 适配器
 * - 所有错误被捕获并记录日志，不会向上抛出
 * - 通知渠道配置持久化到 PostgreSQL（IMNotificationChannelRepository）
 * - 通知发送记录持久化到 PostgreSQL（im_notifications 表）
 *
 * 迁移说明：
 * - adapters Map 保留为运行时适配器注册表（包含 send 方法的对象无法序列化到 DB）
 * - 通知渠道配置（webhookUrl、平台类型、名称）持久化到 PostgreSQL
 * - 通知发送记录（channel、recipient、message、status、sent_at）持久化到 PostgreSQL
 */

import { PipelineRun } from '../../models/PipelineRun';
import { IMNotificationChannelRepository } from '../../repositories/IMNotificationChannelRepository';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId, getCurrentTenantId } from '../../db/tenant-context-storage';

const logger = createLogger('IMNotifier');

// ============================================================================
// 接口定义
// ============================================================================

export type IMPlatformType = 'dingtalk' | 'wecom' | 'feishu';

export interface IMNotificationConfig {
  type: IMPlatformType;
  webhookUrl: string; // 包含 access_token 的完整 webhook URL
  name: string;       // 通知渠道名称，用于日志标识
}

export interface IMNotificationPayload {
  title: string;
  content: string;
  pipelineName: string;
  runId: string;
  status: 'success' | 'failed' | 'cancelled';
  duration?: string;
  triggerBy?: string;
}

export interface IMAdapter {
  readonly platformType: IMPlatformType;
  send(config: IMNotificationConfig, payload: IMNotificationPayload): Promise<void>;
}

/** IM 通知记录实体（数据库映射） */
export interface IMNotificationRecord {
  id: string;
  tenantId: string;
  pipelineId: string | null;
  runId: string | null;
  channel: string;
  recipient: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export type IMNotificationFilter = {
  tenantId?: string;
  channel?: string;
  status?: 'pending' | 'sent' | 'failed';
  pipelineId?: string;
  runId?: string;
  limit?: number;
  offset?: number;
};

// ============================================================================
// IMNotifier 主类
// ============================================================================

export class IMNotifier {
  /** 运行时适配器注册表（包含 send 方法，无法持久化到 DB） */
  private adapters: Map<IMPlatformType, IMAdapter>;
  /** 通知渠道配置持久化仓库 */
  private channelRepository: IMNotificationChannelRepository | null = null;
  /** 数据库连接（用于通知记录和渠道配置） */
  private db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> } | null = null;
  private tenantId: string;

  constructor(options?: {
    db?: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> };
    tenantId?: string;
  }) {
    this.adapters = new Map();
    this.tenantId = options?.tenantId || getCurrentTenantId();
    if (options?.db) {
      this.db = options.db;
      this.channelRepository = new IMNotificationChannelRepository(options.db);
    }
  }

  /**
   * 注册 IM 适配器（运行时注册，不持久化）
   */
  registerAdapter(adapter: IMAdapter): void {
    this.adapters.set(adapter.platformType, adapter);
    logger.info({ platform: adapter.platformType }, 'IM adapter registered');
  }

  /**
   * 获取已注册的适配器数量
   */
  getAdapterCount(): number {
    return this.adapters.size;
  }

  // ============================================================================
  // 通知记录持久化（PostgreSQL）
  // ============================================================================

  /**
   * 创建通知记录（落库）
   */
  private async createNotificationRecord(data: {
    tenantId: string;
    pipelineId?: string;
    runId?: string;
    channel: string;
    recipient: string;
    message: string;
  }): Promise<string> {
    if (!this.db) {
      return '';
    }
    try {
      const result = await this.db.query(
        `INSERT INTO im_notifications (tenant_id, pipeline_id, run_id, channel, recipient, message, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id`,
        [data.tenantId, data.pipelineId || null, data.runId || null, data.channel, data.recipient, data.message],
      );
      if (result.rows.length > 0) {
        return result.rows[0].id;
      }
      return '';
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'Failed to create IM notification record, continuing without persistence',
      );
      return '';
    }
  }

  /**
   * 更新通知记录状态为已发送
   */
  private async markNotificationSent(notificationId: string, sentAt?: Date): Promise<void> {
    if (!this.db || !notificationId) {
      return;
    }
    try {
      await this.db.query(
        `UPDATE im_notifications SET status = 'sent', sent_at = COALESCE($2, now()) WHERE id = $1`,
        [notificationId, sentAt?.toISOString()],
      );
    } catch (err) {
      logger.debug(
        { err: err instanceof Error ? err.message : String(err), notificationId },
        'Failed to update IM notification status to sent',
      );
    }
  }

  /**
   * 更新通知记录状态为失败
   */
  private async markNotificationFailed(notificationId: string, errorMessage: string): Promise<void> {
    if (!this.db || !notificationId) {
      return;
    }
    try {
      await this.db.query(
        `UPDATE im_notifications SET status = 'failed', error_message = $2, sent_at = now() WHERE id = $1`,
        [notificationId, errorMessage],
      );
    } catch (err) {
      logger.debug(
        { err: err instanceof Error ? err.message : String(err), notificationId },
        'Failed to update IM notification status to failed',
      );
    }
  }

  /**
   * 查询通知记录（从 PostgreSQL）
   */
  async queryNotifications(filter: IMNotificationFilter): Promise<IMNotificationRecord[]> {
    if (!this.db) {
      return [];
    }

    try {
      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.tenantId) {
        conditions.push(`tenant_id = $${paramIndex}`);
        params.push(filter.tenantId);
        paramIndex++;
      }
      if (filter.channel) {
        conditions.push(`channel = $${paramIndex}`);
        params.push(filter.channel);
        paramIndex++;
      }
      if (filter.status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(filter.status);
        paramIndex++;
      }
      if (filter.pipelineId) {
        conditions.push(`pipeline_id = $${paramIndex}`);
        params.push(filter.pipelineId);
        paramIndex++;
      }
      if (filter.runId) {
        conditions.push(`run_id = $${paramIndex}`);
        params.push(filter.runId);
        paramIndex++;
      }

      let query = `SELECT * FROM im_notifications WHERE ${conditions.join(' AND ')}`;

      const limit = filter.limit ?? 50;
      const offset = filter.offset ?? 0;
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      return result.rows.map((row: any) => this.mapRowToNotificationRecord(row));
    } catch (err) {
      logger.error(
        { traceId: getCurrentTraceId(), err },
        'Failed to query IM notifications from PostgreSQL',
      );
      return [];
    }
  }

  /**
   * 查询最近 N 条失败的通知记录
   */
  async getFailedNotifications(limit: number = 20): Promise<IMNotificationRecord[]> {
    return this.queryNotifications({ status: 'failed', limit });
  }

  /**
   * 按 Pipeline ID 查询通知记录
   */
  async getNotificationsByPipeline(pipelineId: string, limit: number = 50): Promise<IMNotificationRecord[]> {
    return this.queryNotifications({ pipelineId, limit });
  }

  /**
   * 按 Run ID 查询通知记录
   */
  async getNotificationsByRun(runId: string): Promise<IMNotificationRecord[]> {
    return this.queryNotifications({ runId, limit: 100 });
  }

  /**
   * 按渠道查询通知记录
   */
  async getNotificationsByChannel(channel: string, limit: number = 50): Promise<IMNotificationRecord[]> {
    return this.queryNotifications({ channel, limit });
  }

  /**
   * 将数据库行映射为通知记录实体
   */
  private mapRowToNotificationRecord(row: any): IMNotificationRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pipelineId: row.pipeline_id,
      runId: row.run_id,
      channel: row.channel,
      recipient: row.recipient,
      message: row.message,
      status: row.status || 'pending',
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      errorMessage: row.error_message,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  // ============================================================================
  // 通知渠道管理（PostgreSQL）
  // ============================================================================

  /**
   * 注册通知渠道到 PostgreSQL
   */
  async registerChannel(config: IMNotificationConfig): Promise<void> {
    if (!this.channelRepository) {
      logger.warn({ traceId: getCurrentTraceId() }, 'No channel repository configured, skipping channel persistence');
      return;
    }

    try {
      await this.channelRepository.createChannel({
        id: `${this.tenantId}:${config.type}:${config.name}`,
        tenantId: this.tenantId,
        platform: config.type,
        name: config.name,
        webhookUrl: config.webhookUrl,
        enabled: true,
      });
      logger.info({ platform: config.type, name: config.name }, 'IM notification channel registered');
    } catch (err) {
      logger.error(
        { err, platform: config.type, name: config.name },
        'Failed to register IM notification channel'
      );
    }
  }

  /**
   * 从 PostgreSQL 获取所有通知渠道
   */
  async getChannels(options?: { enabledOnly?: boolean }): Promise<IMNotificationConfig[]> {
    if (!this.channelRepository) {
      return [];
    }

    try {
      const entities = await this.channelRepository.findByTenant(this.tenantId, options);
      return entities.map(e => ({
        type: e.platform as IMPlatformType,
        webhookUrl: e.webhookUrl,
        name: e.name,
      }));
    } catch (err) {
      logger.error({ traceId: getCurrentTraceId(), err }, 'Failed to load IM notification channels from PostgreSQL');
      return [];
    }
  }

  /**
   * 按平台类型获取通知渠道
   */
  async getChannelsByPlatform(platform: IMPlatformType): Promise<IMNotificationConfig[]> {
    if (!this.channelRepository) {
      return [];
    }

    try {
      const entities = await this.channelRepository.findEnabledByPlatform(this.tenantId, platform);
      return entities.map(e => ({
        type: e.platform as IMPlatformType,
        webhookUrl: e.webhookUrl,
        name: e.name,
      }));
    } catch (err) {
      logger.error({ traceId: getCurrentTraceId(), err, platform }, 'Failed to load IM channels by platform from PostgreSQL');
      return [];
    }
  }

  /**
   * 删除通知渠道
   */
  async removeChannel(channelId: string): Promise<void> {
    if (!this.channelRepository) {
      logger.warn({ traceId: getCurrentTraceId() }, 'No channel repository configured');
      return;
    }

    try {
      await this.channelRepository.delete(channelId);
      logger.info({ channelId }, 'IM notification channel removed');
    } catch (err) {
      logger.error({ traceId: getCurrentTraceId(), err, channelId }, 'Failed to remove IM notification channel');
    }
  }

  // ============================================================================
  // 通知发送
  // ============================================================================

  /**
   * 发送 IM 通知（通用方法）
   * 如果适配器不存在或发送失败，记录日志但不抛出异常
   * 通知记录自动持久化到 PostgreSQL
   */
  async sendNotification(config: IMNotificationConfig, payload: IMNotificationPayload): Promise<void> {
    const adapter = this.adapters.get(config.type);
    if (!adapter) {
      logger.warn({ traceId: getCurrentTraceId(), platform: config.type }, 'IM adapter not found, skipping notification');
      return;
    }

    // 创建通知记录
    const notificationId = await this.createNotificationRecord({
      tenantId: this.tenantId,
      pipelineId: payload.runId ? `${payload.pipelineName}:${payload.runId}` : undefined,
      runId: payload.runId,
      channel: config.type,
      recipient: config.name,
      message: `${payload.title}\n${payload.content}`,
    });

    try {
      await adapter.send(config, payload);
      await this.markNotificationSent(notificationId);
      logger.info(
        { platform: config.type, runId: payload.runId, status: payload.status, notificationId },
        'IM notification sent successfully'
      );
    } catch (error) {
      // 通知发送失败不应影响 pipeline 状态
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.markNotificationFailed(notificationId, errorMsg);
      logger.error(
        { platform: config.type, runId: payload.runId, error: errorMsg },
        'Failed to send IM notification'
      );
    }
  }

  /**
   * 发送通知到所有已注册的渠道（从 PostgreSQL 加载）
   */
  async sendToAllChannels(payload: IMNotificationPayload): Promise<void> {
    const channels = await this.getChannels({ enabledOnly: true });
    if (channels.length === 0) {
      logger.info('No enabled IM notification channels found');
      return;
    }

    const promises = channels.map(config => this.sendNotification(config, payload));
    await Promise.allSettled(promises);
  }

  /**
   * Pipeline 完成时发送通知
   */
  async notifyOnPipelineComplete(run: PipelineRun, config: IMNotificationConfig, pipelineName?: string): Promise<void> {
    const duration = this.formatDuration(run.durationMs);
    const payload: IMNotificationPayload = {
      title: `Pipeline 完成: ${pipelineName || run.pipelineId}`,
      content: this.buildCompleteMessage(pipelineName || run.pipelineId, run, duration),
      pipelineName: pipelineName || run.pipelineId,
      runId: run.id,
      status: 'success',
      duration,
      triggerBy: run.triggerBy,
    };

    await this.sendNotification(config, payload);
  }

  /**
   * Pipeline 失败时发送通知
   */
  async notifyOnPipelineFailure(run: PipelineRun, config: IMNotificationConfig, pipelineName?: string): Promise<void> {
    const duration = this.formatDuration(run.durationMs);
    const payload: IMNotificationPayload = {
      title: `Pipeline 失败: ${pipelineName || run.pipelineId}`,
      content: this.buildFailedMessage(pipelineName || run.pipelineId, run, duration),
      pipelineName: pipelineName || run.pipelineId,
      runId: run.id,
      status: 'failed',
      duration,
      triggerBy: run.triggerBy,
    };

    await this.sendNotification(config, payload);
  }

  /**
   * Pipeline 取消时发送通知
   */
  async notifyOnPipelineCancelled(run: PipelineRun, config: IMNotificationConfig, pipelineName?: string): Promise<void> {
    const duration = this.formatDuration(run.durationMs);
    const payload: IMNotificationPayload = {
      title: `Pipeline 取消: ${pipelineName || run.pipelineId}`,
      content: this.buildCancelledMessage(pipelineName || run.pipelineId, run, duration),
      pipelineName: pipelineName || run.pipelineId,
      runId: run.id,
      status: 'cancelled',
      duration,
      triggerBy: run.triggerBy,
    };

    await this.sendNotification(config, payload);
  }

  /**
   * Send notification with a template.
   * Resolves {{stages.<name>.status}}, {{tasks.<name>.outputs.<key>}}, {{run.<field>}} placeholders.
   */
  sendWithTemplate(
    config: IMNotificationConfig,
    template: { title: string; content: string },
    context: {
      stages?: Record<string, { status: string }>;
      tasks?: Record<string, Record<string, unknown>>;
      run: { id: string; pipelineId: string; status: string; durationMs?: number; triggerBy?: string };
    },
  ): void {
    const title = this.resolveTemplate(template.title, context);
    const content = this.resolveTemplate(template.content, context);

    const payload: IMNotificationPayload = {
      title,
      content,
      pipelineName: context.run.pipelineId,
      runId: context.run.id,
      status: context.run.status as IMNotificationPayload['status'],
      duration: context.run.durationMs ? `${Math.floor(context.run.durationMs / 1000)}s` : undefined,
      triggerBy: context.run.triggerBy,
    };

    // Fire and forget - errors are handled in sendNotification
    this.sendNotification(config, payload).catch(() => {
      // Errors already logged in sendNotification
    });
  }

  /**
   * 批量发送通知（多个 IM 渠道）
   * 所有通知并行发送，互不影响
   */
  async sendBatch(configs: IMNotificationConfig[], payload: IMNotificationPayload): Promise<void> {
    const promises = configs.map(config => this.sendNotification(config, payload));
    await Promise.allSettled(promises);
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private formatDuration(durationMs?: number): string {
    if (durationMs === undefined || durationMs === null) {
      return '未知';
    }
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private buildCompleteMessage(pipelineName: string, run: PipelineRun, duration: string): string {
    const lines = [
      `### Pipeline 执行成功`,
      ``,
      `**Pipeline**: ${pipelineName}`,
      `**Run ID**: ${run.id}`,
      `**耗时**: ${duration}`,
    ];
    if (run.triggerBy) {
      lines.push(`**触发人**: ${run.triggerBy}`);
    }
    lines.push(``, `[查看详情](#/pipelines/${run.id})`);
    return lines.join('\n');
  }

  private buildFailedMessage(pipelineName: string, run: PipelineRun, duration: string): string {
    const lines = [
      `### Pipeline 执行失败`,
      ``,
      `**Pipeline**: ${pipelineName}`,
      `**Run ID**: ${run.id}`,
      `**耗时**: ${duration}`,
    ];
    if (run.triggerBy) {
      lines.push(`**触发人**: ${run.triggerBy}`);
    }
    lines.push(``, `[查看详情](#/pipelines/${run.id})`);
    return lines.join('\n');
  }

  private buildCancelledMessage(pipelineName: string, run: PipelineRun, duration: string): string {
    const lines = [
      `### Pipeline 已取消`,
      ``,
      `**Pipeline**: ${pipelineName}`,
      `**Run ID**: ${run.id}`,
      `**耗时**: ${duration}`,
    ];
    if (run.triggerBy) {
      lines.push(`**触发人**: ${run.triggerBy}`);
    }
    lines.push(``, `[查看详情](#/pipelines/${run.id})`);
    return lines.join('\n');
  }

  /**
   * Resolve template variables from context.
   * Supports {{stages.<name>.status}}, {{tasks.<name>.outputs.<key>}}, {{run.<field>}}.
   */
  private resolveTemplate(template: string, context: {
    stages?: Record<string, { status: string }>;
    tasks?: Record<string, Record<string, unknown>>;
    run: Record<string, unknown>;
  }): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.resolvePath(path.trim(), context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolve a dot-notation path from context object.
   */
  private resolvePath(path: string, context: Record<string, unknown>): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
