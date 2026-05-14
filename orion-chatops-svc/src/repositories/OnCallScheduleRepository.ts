import { BaseRepository } from '../db/base-repository';

export interface OnCallScheduleEntity {
  id: string;
  name: string;
  timezone: string;
  rotationType: string;
  rotationStartHour: number;
  teamMembers: string[];
  startDate: Date;
  escalations: Array<{ userId: string; delay: number }>;
  createdAt: Date;
  updatedAt: Date;
}

export class OnCallScheduleRepository extends BaseRepository<OnCallScheduleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'oncall_schedules');
  }

  async findByTimezone(timezone: string): Promise<OnCallScheduleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM oncall_schedules WHERE timezone = $1 ORDER BY created_at DESC`,
      [timezone],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByTeamMember(userId: string): Promise<OnCallScheduleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM oncall_schedules WHERE $1 = ANY(team_members) ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByRotationType(rotationType: string): Promise<OnCallScheduleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM oncall_schedules WHERE rotation_type = $1 ORDER BY created_at DESC`,
      [rotationType],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async updateEscalations(
    id: string,
    escalations: Array<{ userId: string; delay: number }>,
  ): Promise<OnCallScheduleEntity> {
    const result = await this.db.query(
      `UPDATE oncall_schedules SET escalations = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(escalations), id],
    );
    if (result.rows.length === 0) {
      throw new Error(`OnCall schedule with id ${id} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): OnCallScheduleEntity {
    return {
      id: row.id,
      name: row.name,
      timezone: row.timezone,
      rotationType: row.rotation_type,
      rotationStartHour: row.rotation_start_hour,
      teamMembers: row.team_members ?? [],
      startDate: row.start_date,
      escalations: row.escalations ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}