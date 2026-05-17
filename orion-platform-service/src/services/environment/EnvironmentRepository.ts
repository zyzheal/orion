import { DatabasePool } from '../database';
/**
 * EnvironmentRepository - Database layer for Environment operations
 *
 * Uses PostgreSQL when database pool is available, falls back to
 * in-memory Map() for development/testing.
 */

export interface Environment {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  type: string;
  cluster?: string;
  namespace?: string;
  config: Record<string, any>;
  status: string;
  locked?: boolean;
  locked_by?: string;
  locked_at?: Date;
  locked_reason?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class EnvironmentRepository {
  private inMemory: Map<string, Environment> = new Map();

  constructor(private pool: DatabasePool) {}

  private isDbAvailable(): boolean {
    return true;
  }

  async findById(id: string): Promise<Environment | null> {
    if (!this.isDbAvailable()) {
      return this.inMemory.get(id) || null;
    }
    return (await this.pool.query('SELECT * FROM environments WHERE id = $1', [id])).rows[0] || null;
  }

  async findByProject(projectId: string): Promise<Environment[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemory.values()).filter(e => e.project_id === projectId);
    }
    return (await this.pool.query('SELECT * FROM environments WHERE project_id = $1', [projectId])).rows;
  }

  async findAll(): Promise<Environment[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemory.values());
    }
    return (await this.pool.query('SELECT * FROM environments ORDER BY created_at DESC')).rows;
  }

  async create(projectId: string, name: string, type: string, config: Record<string, any>, cluster?: string, namespace?: string): Promise<Environment> {
    if (!this.isDbAvailable()) {
      const env: Environment = {
        id: `env-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        tenant_id: 'mock-tenant',
        project_id: projectId,
        name,
        type,
        cluster,
        namespace,
        config: config || {},
        status: 'active',
      };
      this.inMemory.set(env.id, env);
      return env;
    }

    const result = await this.pool.query(
      `INSERT INTO environments (project_id, name, type, config, cluster, namespace, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
      [projectId, name, type, config, cluster || null, namespace || null]
    );
    return result.rows[0];
  }

  async update(id: string, updates: { name?: string; type?: string; config?: Record<string, any>; cluster?: string; namespace?: string; status?: string }): Promise<Environment | null> {
    if (!this.isDbAvailable()) {
      const existing = this.inMemory.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates };
      this.inMemory.set(id, updated);
      return updated;
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name); }
    if (updates.type !== undefined) { fields.push(`type = $${paramIndex++}`); values.push(updates.type); }
    if (updates.config !== undefined) { fields.push(`config = $${paramIndex++}`); values.push(updates.config); }
    if (updates.cluster !== undefined) { fields.push(`cluster = $${paramIndex++}`); values.push(updates.cluster); }
    if (updates.namespace !== undefined) { fields.push(`namespace = $${paramIndex++}`); values.push(updates.namespace); }
    if (updates.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(updates.status); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = now()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE environments SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.isDbAvailable()) {
      return this.inMemory.delete(id);
    }

    const result = await this.pool.query('DELETE FROM environments WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Lock an environment to prevent deployments.
   */
  async lock(id: string, lockedBy: string, reason: string): Promise<Environment | null> {
    const result = await this.pool.query(
      `UPDATE environments
       SET locked = TRUE, locked_by = $2, locked_at = NOW(), locked_reason = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, lockedBy, reason]
    );
    return result.rows[0] || null;
  }

  /**
   * Unlock an environment to allow deployments.
   */
  async unlock(id: string): Promise<Environment | null> {
    const result = await this.pool.query(
      `UPDATE environments
       SET locked = FALSE, locked_by = NULL, locked_at = NULL, locked_reason = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }
}