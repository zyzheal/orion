/**
 * BackupPlanRepository - Database access layer for backup plan configurations
 *
 * Maps to the `backup_configs` table.
 */

import { DatabasePool } from '../database';

export interface BackupPlanRecord {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  target: Record<string, any>;
  schedule: string | null;
  retention_days: number;
  encryption_key: string | null;
  storage_config: Record<string, any>;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export class BackupPlanRepository {
  private pool: DatabasePool | null;
  private inMemory: Map<string, BackupPlanRecord> = new Map();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async create(plan: Omit<BackupPlanRecord, 'created_at' | 'updated_at'>): Promise<BackupPlanRecord> {
    const now = new Date();
    const record: BackupPlanRecord = {
      ...plan,
      created_at: now,
      updated_at: now,
    };

    if (!this.isDbAvailable()) {
      this.inMemory.set(plan.id, record);
      return record;
    }

    const result = await this.pool!.query(
      `INSERT INTO backup_configs (id, tenant_id, name, type, target, schedule, retention_days, encryption_key, storage_config, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        plan.id,
        plan.tenant_id,
        plan.name,
        plan.type,
        JSON.stringify(plan.target),
        plan.schedule,
        plan.retention_days,
        plan.encryption_key,
        JSON.stringify(plan.storage_config),
        plan.enabled,
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<BackupPlanRecord | null> {
    if (!this.isDbAvailable()) {
      return this.inMemory.get(id) || null;
    }
    const result = await this.pool!.query('SELECT * FROM backup_configs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(tenantId?: string): Promise<BackupPlanRecord[]> {
    if (!this.isDbAvailable()) {
      let plans = Array.from(this.inMemory.values());
      if (tenantId) {
        plans = plans.filter(p => p.tenant_id === tenantId);
      }
      return plans;
    }
    if (tenantId) {
      const result = await this.pool!.query(
        'SELECT * FROM backup_configs WHERE tenant_id = $1 ORDER BY created_at DESC',
        [tenantId]
      );
      return result.rows;
    }
    const result = await this.pool!.query('SELECT * FROM backup_configs ORDER BY created_at DESC');
    return result.rows;
  }

  async update(id: string, updates: Partial<BackupPlanRecord>): Promise<BackupPlanRecord | null> {
    if (!this.isDbAvailable()) {
      const plan = this.inMemory.get(id);
      if (!plan) return null;
      const updated = { ...plan, ...updates, updated_at: new Date() };
      this.inMemory.set(id, updated);
      return updated;
    }

    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id') {
        if (key === 'target' || key === 'storage_config') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(typeof value === 'string' ? value : JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) return existing;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool!.query(
      `UPDATE backup_configs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.isDbAvailable()) {
      return this.inMemory.delete(id);
    }
    const result = await this.pool!.query('DELETE FROM backup_configs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
