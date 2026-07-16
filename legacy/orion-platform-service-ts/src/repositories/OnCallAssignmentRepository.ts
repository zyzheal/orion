/**
 * OnCallAssignmentRepository
 * OnCall 排班分配数据访问层
 */

import { BaseRepository } from '../db/base-repository';

export interface OnCallAssignmentEntity {
  id: string;
  scheduleId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
}

export class OnCallAssignmentRepository extends BaseRepository<OnCallAssignmentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'oncall_assignments');
  }

  async findByScheduleId(scheduleId: string): Promise<OnCallAssignmentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM oncall_assignments WHERE schedule_id = $1 ORDER BY start_time ASC`,
      [scheduleId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByScheduleAndTime(scheduleId: string, time: Date): Promise<OnCallAssignmentEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM oncall_assignments WHERE schedule_id = $1 AND start_time <= $2 AND end_time > $2 ORDER BY start_time ASC LIMIT 1`,
      [scheduleId, time],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByScheduleId(scheduleId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM oncall_assignments WHERE schedule_id = $1`,
      [scheduleId],
    );
  }

  protected mapRowToEntity(row: any): OnCallAssignmentEntity {
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      userId: row.user_id,
      startTime: row.start_time,
      endTime: row.end_time,
    };
  }
}
