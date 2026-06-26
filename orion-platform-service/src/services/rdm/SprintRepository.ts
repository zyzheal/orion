/**
 * Sprint Repository
 * Data access layer for sprint table
 */
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface SprintEntity {
  id: string;
  tenant_id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  status: string;
  capacity: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSprintInput {
  name: string;
  goal?: string;
  start_date: string;
  end_date: string;
  capacity?: number;
}

export interface UpdateSprintInput {
  name?: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  capacity?: number;
}

export class SprintRepository {
  constructor(private pool: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }> }) {}

  async list(filters?: { status?: string }): Promise<SprintEntity[]> {
    const tenantId = getCurrentTenantId();
    let query = 'SELECT * FROM sprint WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    if (filters?.status) {
      query += ' AND status = $2';
      params.push(filters.status);
    }
    query += ' ORDER BY start_date DESC';
    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  async get(id: string): Promise<SprintEntity | null> {
    const tenantId = getCurrentTenantId();
    const { rows } = await this.pool.query(
      'SELECT * FROM sprint WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return rows[0] ?? null;
  }

  async create(data: CreateSprintInput): Promise<SprintEntity> {
    const tenantId = getCurrentTenantId();
    const { rows } = await this.pool.query(
      `INSERT INTO sprint (tenant_id, name, goal, start_date, end_date, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, data.name, data.goal ?? null, data.start_date, data.end_date, data.capacity ?? null]
    );
    return rows[0];
  }

  private static readonly ALLOWED_COLUMNS = new Set(['name', 'goal', 'start_date', 'end_date', 'status', 'capacity']);

  async update(id: string, data: UpdateSprintInput): Promise<SprintEntity | null> {
    const tenantId = getCurrentTenantId();
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (!SprintRepository.ALLOWED_COLUMNS.has(key)) {
          throw new Error(`Invalid column name: ${key}`);
        }
        sets.push(`${key} = $${idx}`);
        params.push(value);
        idx++;
      }
    }
    if (sets.length === 0) return this.get(id);
    sets.push(`updated_at = NOW()`);
    params.push(id, tenantId);
    const { rows } = await this.pool.query(
      `UPDATE sprint SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params
    );
    return rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const { rowCount } = await this.pool.query(
      'DELETE FROM sprint WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (rowCount ?? 0) > 0;
  }

  async getActive(): Promise<SprintEntity | null> {
    const tenantId = getCurrentTenantId();
    const { rows } = await this.pool.query(
      "SELECT * FROM sprint WHERE tenant_id = $1 AND status = 'active' ORDER BY start_date DESC LIMIT 1",
      [tenantId]
    );
    return rows[0] ?? null;
  }
}
