import { BaseRepository } from '../db/base-repository';
import { getCurrentTenantId } from '../db/tenant-context-storage';

/**
 * 通知去重记录实体
 */
export interface AlertNotificationDedupEntity {
  id: string;
  tenant_id: string;
  alert_fingerprint: string;
  alert_id: string;
  channel_type: string;
  sent_at: Date;
  notification_id: string | null;
}

/**
 * 创建去重记录输入
 */
export interface CreateAlertNotificationDedupInput {
  alert_fingerprint: string;
  alert_id: string;
  channel_type: string;
  notification_id?: string;
}

/**
 * AlertNotificationDedupRepository - 通知去重数据访问层
 *
 * 用于跟踪已发送的通知，防止在去重窗口内重复发送。
 * 同一告警（相同 fingerprint）+ 同一渠道，在去重窗口内只发送一次。
 */
export class AlertNotificationDedupRepository extends BaseRepository<AlertNotificationDedupEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_notification_dedup');
  }

  /**
   * 检查指定告警+渠道是否在去重窗口内已发送
   * @param alertFingerprint 告警指纹
   * @param channelType 渠道类型
   * @param windowMs 去重窗口（毫秒），默认 4 小时
   */
  async isDuplicate(alertFingerprint: string, channelType: string, windowMs: number = 4 * 60 * 60 * 1000): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM alert_notification_dedup
       WHERE tenant_id = $1
         AND alert_fingerprint = $2
         AND channel_type = $3
         AND sent_at > NOW() - INTERVAL '1 millisecond' * $4`,
      [tenantId, alertFingerprint, channelType, windowMs],
    );
    const count = parseInt((result.rows[0] as any)?.cnt ?? '0', 10);
    return count > 0;
  }

  /**
   * 记录已发送的通知去重
   */
  async create(input: CreateAlertNotificationDedupInput): Promise<AlertNotificationDedupEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO alert_notification_dedup (tenant_id, alert_fingerprint, alert_id, channel_type, notification_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        tenantId,
        input.alert_fingerprint,
        input.alert_id,
        input.channel_type,
        input.notification_id ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 批量创建去重记录
   */
  async batchCreate(inputs: CreateAlertNotificationDedupInput[]): Promise<AlertNotificationDedupEntity[]> {
    if (inputs.length === 0) return [];
    const tenantId = getCurrentTenantId();
    const records: AlertNotificationDedupEntity[] = [];

    for (const input of inputs) {
      const result = await this.db.query(
        `INSERT INTO alert_notification_dedup (tenant_id, alert_fingerprint, alert_id, channel_type, notification_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          tenantId,
          input.alert_fingerprint,
          input.alert_id,
          input.channel_type,
          input.notification_id ?? null,
        ],
      );
      records.push(this.mapRowToEntity(result.rows[0]));
    }
    return records;
  }

  /**
   * 获取告警的去重记录
   */
  async findByAlertId(alertId: string): Promise<AlertNotificationDedupEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM alert_notification_dedup
       WHERE tenant_id = $1 AND alert_id = $2
       ORDER BY sent_at DESC`,
      [tenantId, alertId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 清理过期的去重记录（超过 retentionMs 的记录）
   */
  async cleanup(retentionMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `DELETE FROM alert_notification_dedup
       WHERE tenant_id = $1 AND sent_at < NOW() - INTERVAL '1 millisecond' * $2`,
      [tenantId, retentionMs],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): AlertNotificationDedupEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      alert_fingerprint: row.alert_fingerprint,
      alert_id: row.alert_id,
      channel_type: row.channel_type,
      sent_at: row.sent_at ? new Date(row.sent_at) : new Date(),
      notification_id: row.notification_id,
    };
  }
}
