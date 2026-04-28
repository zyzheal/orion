/**
 * DND (Do Not Disturb) Service — 免打扰设置管理
 *
 * B-10: 用户免打扰时间窗口管理
 */

import { DatabasePool } from '../../services/database';

export interface DNDSettings {
  id: string;
  userId: string;
  enabled: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  repeatDays: number[]; // 1=Mon, 7=Sun
  allowCritical: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class DNDService {
  private db: DatabasePool;

  constructor(db: DatabasePool) {
    this.db = db;
  }

  async getSettings(userId: string): Promise<DNDSettings | null> {
    const result = await this.db.query(
      'SELECT * FROM chatops_dnd_settings WHERE user_id = $1',
      [userId],
    );
    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async updateSettings(userId: string, data: Partial<DNDSettings>): Promise<DNDSettings> {
    const existing = await this.getSettings(userId);
    if (!existing) {
      return this.createSettings(userId, data);
    }

    const result = await this.db.query(
      `UPDATE chatops_dnd_settings
       SET enabled = COALESCE($2, enabled),
           start_time = COALESCE($3, start_time),
           end_time = COALESCE($4, end_time),
           repeat_days = COALESCE($5, repeat_days),
           allow_critical = COALESCE($6, allow_critical),
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        data.enabled,
        data.startTime,
        data.endTime,
        data.repeatDays ? JSON.stringify(data.repeatDays) : null,
        data.allowCritical,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async toggleDND(userId: string, enabled: boolean): Promise<DNDSettings> {
    return this.updateSettings(userId, { enabled });
  }

  private async createSettings(userId: string, data: Partial<DNDSettings>): Promise<DNDSettings> {
    const result = await this.db.query(
      `INSERT INTO chatops_dnd_settings
         (user_id, enabled, start_time, end_time, repeat_days, allow_critical)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        data.enabled ?? false,
        data.startTime || '22:00',
        data.endTime || '08:00',
        data.repeatDays ? JSON.stringify(data.repeatDays) : JSON.stringify([1, 2, 3, 4, 5]),
        data.allowCritical ?? true,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * 判断用户是否在免打扰时段
   */
  async isInDndPeriod(userId: string): Promise<{ enabled: boolean; allowCritical: boolean; endTime?: string }> {
    const settings = await this.getSettings(userId);
    if (!settings || !settings.enabled) return { enabled: false, allowCritical: true };

    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const startMin = this.timeToMinutes(settings.startTime);
    const endMin = this.timeToMinutes(settings.endTime);

    // 跨午夜处理
    let inRange: boolean;
    if (startMin > endMin) {
      inRange = currentMin >= startMin || currentMin < endMin;
    } else {
      inRange = currentMin >= startMin && currentMin < endMin;
    }

    const dayOfWeek = now.getDay();
    const dayMatch = settings.repeatDays.includes(dayOfWeek);

    return { enabled: inRange && dayMatch, allowCritical: settings.allowCritical, endTime: settings.endTime };
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  private mapRow(row: any): DNDSettings {
    return {
      id: row.id,
      userId: row.user_id,
      enabled: row.enabled,
      startTime: row.start_time,
      endTime: row.end_time,
      repeatDays: row.repeat_days || [1, 2, 3, 4, 5],
      allowCritical: row.allow_critical,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
