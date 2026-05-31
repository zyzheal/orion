/**
 * IMNotificationChannelRepository - IM 通知渠道持久化存储
 *
 * 将 IMNotifier 的适配器注册信息持久化到 PostgreSQL，
 * 支持钉钉、企业微信、飞书等 IM 平台的 webhook 配置管理。
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

/**
 * IM 通知渠道实体（数据库映射）
 */
export interface IMNotificationChannelEntity {
  id: string;
  tenantId: string;
  platform: 'dingtalk' | 'wecom' | 'feishu';
  name: string;
  webhookUrl: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class IMNotificationChannelRepository extends BaseRepository<IMNotificationChannelEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'im_notification_channels');
  }

  /**
   * 创建通知渠道
   */
  async createChannel(data: {
    id: string;
    tenantId: string;
    platform: 'dingtalk' | 'wecom' | 'feishu';
    name: string;
    webhookUrl: string;
    enabled?: boolean;
  }): Promise<IMNotificationChannelEntity> {
    const result = await this.db.query(
      `INSERT INTO im_notification_channels (id, tenant_id, platform, name, webhook_url, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.id, data.tenantId, data.platform, data.name, data.webhookUrl, data.enabled ?? true],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT into im_notification_channels returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 按租户查找所有通知渠道
   */
  async findByTenant(tenantId: string, options?: { enabledOnly?: boolean }): Promise<IMNotificationChannelEntity[]> {
    let query = `SELECT * FROM im_notification_channels WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (options?.enabledOnly) {
      query += ` AND enabled = true`;
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 按平台类型查找通知渠道
   */
  async findByPlatform(tenantId: string, platform: string): Promise<IMNotificationChannelEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM im_notification_channels WHERE tenant_id = $1 AND platform = $2 ORDER BY created_at DESC`,
      [tenantId, platform],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 按租户和平台查找启用的通知渠道
   */
  async findEnabledByPlatform(tenantId: string, platform: string): Promise<IMNotificationChannelEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM im_notification_channels WHERE tenant_id = $1 AND platform = $2 AND enabled = true ORDER BY created_at DESC`,
      [tenantId, platform],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 更新渠道启用状态
   */
  async updateEnabled(id: string, enabled: boolean): Promise<IMNotificationChannelEntity> {
    const result = await this.db.query(
      `UPDATE im_notification_channels SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [enabled, id],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, `UPDATE on im_notification_channels affected no rows (id: ${id})`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 更新渠道 webhook URL
   */
  async updateWebhookUrl(id: string, webhookUrl: string): Promise<IMNotificationChannelEntity> {
    const result = await this.db.query(
      `UPDATE im_notification_channels SET webhook_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [webhookUrl, id],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, `UPDATE on im_notification_channels affected no rows (id: ${id})`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): IMNotificationChannelEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      platform: row.platform,
      name: row.name,
      webhookUrl: row.webhook_url,
      enabled: row.enabled ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
