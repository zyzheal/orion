import { BaseRepository } from '../db/base-repository';

export interface MaintenanceWindowEntity {
  id: string;
  tenantId: string;
  name: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  description: string | null;
  affectedServices: string[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MaintenanceWindowRepository extends BaseRepository<MaintenanceWindowEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'maintenance_windows');
  }

  async findByTenantId(tenantId: string): Promise<MaintenanceWindowEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM maintenance_windows WHERE tenant_id = $1 ORDER BY start_time DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(now?: Date): Promise<MaintenanceWindowEntity[]> {
    const currentTime = now ?? new Date();
    const result = await this.db.query(
      `SELECT * FROM maintenance_windows WHERE start_time <= $1 AND end_time >= $1`,
      [currentTime],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findUpcoming(startTime: Date, limit?: number): Promise<MaintenanceWindowEntity[]> {
    const limitValue = limit ?? 10;
    const result = await this.db.query(
      `SELECT * FROM maintenance_windows WHERE start_time >= $1 ORDER BY start_time ASC LIMIT $2`,
      [startTime, limitValue],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteExpired(beforeTime?: Date): Promise<number> {
    const time = beforeTime ?? new Date();
    const result = await this.db.query(
      `DELETE FROM maintenance_windows WHERE end_time < $1`,
      [time],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): MaintenanceWindowEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone ?? 'UTC',
      description: row.description ?? null,
      affectedServices: row.affected_services ?? [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}