import { DatabasePool } from '../database';
import { EnvironmentConfigRepository } from '../../repositories/EnvironmentConfigRepository';
import { createLogger } from '../../utils/logger';

const logger = createLogger('environment-repo');
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
  locked_expires_at?: Date;
  locked_reason?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class EnvironmentRepository {
  private inMemory: Map<string, Environment> = new Map();
  private configRepo: EnvironmentConfigRepository | null;

  constructor(private pool: DatabasePool) {
    this.configRepo = pool ? new EnvironmentConfigRepository(pool) : null;
  }

  private isDbAvailable(): boolean {
    return true;
  }

  async findById(id: string): Promise<Environment | null> {
    if (!this.isDbAvailable()) {
      return this.inMemory.get(id) || null;
    }
    // Try repository first, fall back to direct pool query
    if (this.configRepo) {
      const entity = await this.configRepo.findById(id);
      if (entity) {
        return this.mapEntityToEnvironment(entity);
      }
      return null;
    }
    return (await this.pool.query('SELECT * FROM environments WHERE id = $1', [id])).rows[0] || null;
  }

  async findByProject(projectId: string): Promise<Environment[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemory.values()).filter(e => e.project_id === projectId);
    }
    // Try repository first, fall back to direct pool query
    if (this.configRepo) {
      const entities = await this.configRepo.findByProjectId(projectId);
      return entities.map(e => this.mapEntityToEnvironment(e));
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
    const row = result.rows[0];

    // Also persist to BaseRepository (fire-and-forget)
    this.configRepo?.create({
      id: row.id,
      tenant_id: row.tenant_id,
      project_id: row.project_id,
      name: row.name,
      type: row.type,
      cluster: row.cluster || null,
      namespace: row.namespace || null,
      config: typeof row.config === 'string' ? row.config : JSON.stringify(row.config || {}),
      status: row.status,
      locked: row.locked || false,
      locked_by: row.locked_by || null,
      locked_at: row.locked_at || null,
      locked_reason: row.locked_reason || null,
    }).catch((err) => logger.warn({ err: err as Error, stack: (err as Error).stack, environmentId: row.id }, '[EnvironmentRepository] Failed to persist environment'));

    return row;
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
   * Automatically sets lock expiration based on locked_duration_seconds.
   */
  async lock(id: string, lockedBy: string, reason: string, tenantId?: string): Promise<Environment | null> {
    const result = await this.pool.query(
      `UPDATE environments
       SET locked = TRUE,
           locked_by = $2,
           locked_at = NOW(),
           locked_expires_at = NOW() + (COALESCE(locked_duration_seconds, 3600) || ' seconds')::INTERVAL,
           locked_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       ${tenantId ? 'AND tenant_id = $4' : ''}
       RETURNING *`,
      tenantId ? [id, lockedBy, reason, tenantId] : [id, lockedBy, reason]
    );
    return result.rows[0] || null;
  }

  /**
   * Unlock an environment to allow deployments.
   */
  async unlock(id: string, tenantId?: string): Promise<Environment | null> {
    const result = await this.pool.query(
      `UPDATE environments
       SET locked = FALSE,
           locked_by = NULL,
           locked_at = NULL,
           locked_expires_at = NULL,
           locked_reason = NULL,
           updated_at = NOW()
       WHERE id = $1
       ${tenantId ? 'AND tenant_id = $2' : ''}
       RETURNING *`,
      tenantId ? [id, tenantId] : [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Force unlock an environment (admin operation).
   * Bypasses normal lock state and clears all lock fields regardless of who locked it.
   */
  async forceUnlock(id: string, tenantId?: string): Promise<Environment | null> {
    const result = await this.pool.query(
      `UPDATE environments
       SET locked = FALSE,
           locked_by = NULL,
           locked_at = NULL,
           locked_expires_at = NULL,
           locked_reason = NULL,
           updated_at = NOW()
       WHERE id = $1
       ${tenantId ? 'AND tenant_id = $2' : ''}
       RETURNING *`,
      tenantId ? [id, tenantId] : [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Cleanup expired locks across environments.
   * Returns the number of locks that were cleaned up.
   */
  async cleanupExpiredLocks(tenantId?: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE environments
       SET locked = FALSE,
           locked_by = NULL,
           locked_at = NULL,
           locked_expires_at = NULL,
           locked_reason = NULL,
           updated_at = NOW()
       WHERE locked = TRUE
         AND locked_expires_at IS NOT NULL
         AND locked_expires_at <= NOW()
         ${tenantId ? 'AND tenant_id = $1' : ''}
       RETURNING id`,
      tenantId ? [tenantId] : []
    );
    return result.rowCount ?? 0;
  }

  /**
   * Count expired locks for a given tenant.
   */
  async countExpiredLocks(tenantId?: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM environments
       WHERE locked = TRUE
         AND locked_expires_at IS NOT NULL
         AND locked_expires_at <= NOW()
         ${tenantId ? 'AND tenant_id = $1' : ''}`,
      tenantId ? [tenantId] : []
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  /**
   * Map repository entity to Environment interface
   */
  private mapEntityToEnvironment(entity: any): Environment {
    return {
      id: entity.id,
      tenant_id: entity.tenant_id,
      project_id: entity.project_id,
      name: entity.name,
      type: entity.type,
      cluster: entity.cluster,
      namespace: entity.namespace,
      config: typeof entity.config === 'string' ? JSON.parse(entity.config) : (entity.config || {}),
      status: entity.status,
      locked: entity.locked,
      locked_by: entity.locked_by,
      locked_at: entity.locked_at,
      locked_expires_at: entity.locked_expires_at,
      locked_reason: entity.locked_reason,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
