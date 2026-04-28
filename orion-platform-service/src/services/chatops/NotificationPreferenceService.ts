/**
 * Notification Preference Service — 通知偏好 CRUD
 *
 * B-9: 用户通知渠道偏好管理
 */

import { DatabasePool } from '../../services/database';

export interface ChatOpsNotificationPreferenceEntity {
  id: string;
  userId: string;
  alertLevel: 'critical' | 'warning' | 'info';
  channelChatops: boolean;
  channelEmail: boolean;
  channelSlack: boolean;
  channelFeishu: boolean;
  channelDingtalk: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationPreferenceService {
  private db: DatabasePool;

  constructor(db: DatabasePool) {
    this.db = db;
  }

  async listByUserId(userId: string): Promise<ChatOpsNotificationPreferenceEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM chatops_notification_preferences WHERE user_id = $1 ORDER BY alert_level',
      [userId],
    );
    return result.rows.map(this.mapRow);
  }

  async upsert(data: {
    userId: string;
    alertLevel: 'critical' | 'warning' | 'info';
    channelChatops?: boolean;
    channelEmail?: boolean;
    channelSlack?: boolean;
    channelFeishu?: boolean;
    channelDingtalk?: boolean;
  }): Promise<ChatOpsNotificationPreferenceEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_notification_preferences
         (user_id, alert_level, channel_chatops, channel_email, channel_slack, channel_feishu, channel_dingtalk, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, alert_level)
       DO UPDATE SET
         channel_chatops = EXCLUDED.channel_chatops,
         channel_email = EXCLUDED.channel_email,
         channel_slack = EXCLUDED.channel_slack,
         channel_feishu = EXCLUDED.channel_feishu,
         channel_dingtalk = EXCLUDED.channel_dingtalk,
         updated_at = NOW()
       RETURNING *`,
      [
        data.userId,
        data.alertLevel,
        data.channelChatops ?? true,
        data.channelEmail ?? false,
        data.channelSlack ?? false,
        data.channelFeishu ?? false,
        data.channelDingtalk ?? false,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(userId: string, alertLevel: string): Promise<void> {
    await this.db.query(
      'DELETE FROM chatops_notification_preferences WHERE user_id = $1 AND alert_level = $2',
      [userId, alertLevel],
    );
  }

  private mapRow(row: any): ChatOpsNotificationPreferenceEntity {
    return {
      id: row.id,
      userId: row.user_id,
      alertLevel: row.alert_level,
      channelChatops: row.channel_chatops,
      channelEmail: row.channel_email,
      channelSlack: row.channel_slack,
      channelFeishu: row.channel_feishu,
      channelDingtalk: row.channel_dingtalk,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
