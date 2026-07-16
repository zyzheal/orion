/**
 * OnCallOverrideRepository
 * OnCall 排班覆盖数据访问层
 */

import { BaseRepository } from '../db/base-repository';

export interface OnCallOverrideEntity {
  id: string;
  scheduleId: string;
  originalUserId: string;
  overrideUserId: string;
  startTime: Date;
  endTime: Date;
  reason?: string;
}

export class OnCallOverrideRepository extends BaseRepository<OnCallOverrideEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'oncall_overrides');
  }

  async findByScheduleId(scheduleId: string): Promise<OnCallOverrideEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM oncall_overrides WHERE schedule_id = $1 ORDER BY start_time ASC`,
      [scheduleId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActiveAtTime(scheduleId: string, time: Date): Promise<OnCallOverrideEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM oncall_overrides WHERE schedule_id = $1 AND start_time <= $2 AND end_time > $2 ORDER BY start_time ASC LIMIT 1`,
      [scheduleId, time],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByScheduleId(scheduleId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM oncall_overrides WHERE schedule_id = $1`,
      [scheduleId],
    );
  }

  protected mapRowToEntity(row: any): OnCallOverrideEntity {
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      originalUserId: row.original_user_id,
      overrideUserId: row.override_user_id,
      startTime: row.start_time,
      endTime: row.end_time,
      reason: row.reason,
    };
  }
}
