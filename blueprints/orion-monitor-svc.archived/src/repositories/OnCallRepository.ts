import type { OnCallSchedule } from '../types/monitor.js';
import type { IDbAdapter } from '../db/database.js';

export class OnCallRepository {
  constructor(private pool: IDbAdapter) {}

  async create(
    tenantId: string,
    projectId: string,
    createdBy: string,
    schedule: Omit<OnCallSchedule, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'projectId' | 'createdBy' | 'enabled'>,
  ): Promise<OnCallSchedule> {
    const result = await this.pool.query(
      `INSERT INTO oncall_schedules
       (tenant_id, project_id, name, description, rotation_type, rotation_start,
        rotation_duration_hours, layers, time_zone, enabled, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [tenantId, projectId, schedule.name, schedule.description, schedule.rotationType,
       new Date(schedule.rotationStart), schedule.rotationDurationHours,
       JSON.stringify(schedule.layers), schedule.timeZone, true, createdBy],
    );
    return this.entityToDto(result.rows[0]);
  }

  async findByTenant(tenantId: string, projectId?: string): Promise<OnCallSchedule[]> {
    let sql = 'SELECT * FROM oncall_schedules WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (projectId) { params.push(projectId); sql += ' AND project_id = $2'; }
    sql += ' ORDER BY created_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows.map(r => this.entityToDto(r));
  }

  async findById(id: string): Promise<OnCallSchedule | null> {
    const result = await this.pool.query('SELECT * FROM oncall_schedules WHERE id = $1', [id]);
    return result.rows[0] ? this.entityToDto(result.rows[0]) : null;
  }

  async update(id: string, updates: Partial<OnCallSchedule>): Promise<OnCallSchedule | null> {
    const fields = Object.keys(updates).filter(k => !['id', 'createdAt', 'updatedAt'].includes(k));
    if (fields.length === 0) return null;
    const setClauses = fields.map((f, i) => {
      const col = f.replace(/([A-Z])/g, '_$1').toLowerCase();
      return `${col} = $${i + 2}`;
    }).join(', ');
    const values = fields.map(f => {
      const v = (updates as any)[f];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    });
    const result = await this.pool.query(
      `UPDATE oncall_schedules SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    return result.rows[0] ? this.entityToDto(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM oncall_schedules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private entityToDto(row: any): OnCallSchedule {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      name: row.name,
      description: row.description ?? '',
      rotationType: row.rotation_type,
      rotationStart: row.rotation_start.toISOString(),
      rotationDurationHours: row.rotation_duration_hours,
      layers: typeof row.layers === 'string' ? JSON.parse(row.layers) : row.layers,
      timeZone: row.time_zone,
      enabled: row.enabled,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      createdBy: row.created_by,
    };
  }
}
